import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../collectors/http_csv_collector.mjs";
import { clamp } from "../core/transforms.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function convertAShareWaterLevelToObservations({
  rootDir,
  asOf = null
}) {
  const csvPath = path.join(rootDir, "data", "provider_exports", "a_share_water_level.csv");
  const rows = parseCsv(await readFile(csvPath, "utf8"));
  const dates = [...new Set(rows.map((row) => row.date).filter(Boolean))].sort();
  const resolvedAsOf = asOf ?? dates.at(-1);
  if (!resolvedAsOf) {
    throw new Error("No A-share water-level export dates found. Run npm run provider:a-share-water first.");
  }
  const row = rows.find((item) => item.date === resolvedAsOf);
  if (!row) {
    throw new Error(`No A-share water-level row found for ${resolvedAsOf}. Available dates: ${dates.join(", ")}`);
  }

  const observations = [];
  const totalAmount = numberValue(row.total_amount);
  const breadthRatio = numberValue(row.breadth_ratio);
  const marginBalance = numberValue(row.margin_balance);

  if (totalAmount !== null) {
    observations.push({
      node_id: "a_share_turnover",
      as_of: resolvedAsOf,
      value: totalAmount,
      unit: "rmb_amount",
      score: scoreTurnover(totalAmount),
      confidence: 0.78,
      data_type: "hard_data",
      source: "a_share_water_level_provider",
      raw_ref: "data/provider_exports/a_share_water_level.csv",
      reason: "A-share total turnover estimated by summing AKShare all-stock quote amounts. This is market-water-level evidence, not sector flow."
    });
  }

  if (breadthRatio !== null) {
    observations.push({
      node_id: "a_share_breadth",
      as_of: resolvedAsOf,
      value: breadthRatio,
      unit: "advance_decline_ratio",
      score: clamp(breadthRatio * 2, -1, 1),
      confidence: 0.72,
      data_type: "hard_data",
      source: "a_share_water_level_provider",
      raw_ref: "data/provider_exports/a_share_water_level.csv",
      reason: "A-share breadth calculated as (up_count - down_count) / active_count from AKShare all-stock quote rows."
    });
  }

  if (marginBalance !== null) {
    observations.push({
      node_id: "margin_balance",
      as_of: resolvedAsOf,
      value: marginBalance,
      unit: "rmb_amount",
      score: 0,
      confidence: 0.35,
      data_type: "hard_data",
      source: "a_share_water_level_provider",
      raw_ref: "data/provider_exports/a_share_water_level.csv",
      reason: "Margin balance is exported as optional context. It is not directionally scored until local history is available."
    });
  }

  const payload = {
    converter_id: "a_share_water_level_to_observations_v0_9_8",
    as_of: resolvedAsOf,
    generated_at: new Date().toISOString(),
    readiness: observations.length ? "water_level_ready" : "no_observations",
    counts: {
      observations: observations.length,
      has_turnover: totalAmount !== null,
      has_breadth: breadthRatio !== null,
      has_margin_balance: marginBalance !== null
    },
    row: {
      total_amount: totalAmount,
      up_count: numberValue(row.up_count),
      down_count: numberValue(row.down_count),
      flat_count: numberValue(row.flat_count),
      active_count: numberValue(row.active_count),
      breadth_ratio: breadthRatio,
      margin_balance: marginBalance
    },
    observations,
    boundaries: [
      "A-share water level is broad market context.",
      "Turnover and breadth do not prove ETF net inflow.",
      "Margin balance is not directionally scored until local history exists."
    ]
  };

  const observationDir = path.join(rootDir, "observations", resolvedAsOf);
  const outputDir = path.join(rootDir, "model_outputs", resolvedAsOf);
  await Promise.all([
    mkdir(observationDir, { recursive: true }),
    mkdir(outputDir, { recursive: true })
  ]);

  const observationPath = path.join(observationDir, "a_share_water_observations.json");
  const modelJsonPath = path.join(outputDir, "a_share_water_level_observations.json");
  const modelMdPath = path.join(outputDir, "a_share_water_level_observations.md");

  await atomicWriteFile(observationPath, jsonContent({
    as_of: resolvedAsOf,
    observations
  }));
  await atomicWriteFile(modelJsonPath, jsonContent(payload));
  await atomicWriteFile(modelMdPath, buildMarkdown(payload));

  return {
    payload,
    observationPath,
    modelJsonPath,
    modelMdPath
  };
}

function scoreTurnover(value) {
  if (value >= 1_500_000_000_000) return 1;
  if (value >= 1_200_000_000_000) return 0.65;
  if (value >= 1_000_000_000_000) return 0.35;
  if (value >= 800_000_000_000) return 0;
  if (value >= 650_000_000_000) return -0.35;
  return -0.7;
}

function numberValue(value) {
  if (value === null || value === undefined || value === "" || value === "None") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildMarkdown(payload) {
  const lines = [
    "# A-share Water Level Observations",
    "",
    `- as_of: ${payload.as_of}`,
    `- readiness: ${payload.readiness}`,
    `- observations: ${payload.counts.observations}`,
    "",
    "## Row",
    "",
    `- total_amount: ${formatNumber(payload.row.total_amount)}`,
    `- breadth_ratio: ${formatNumber(payload.row.breadth_ratio)}`,
    `- up_count: ${formatNumber(payload.row.up_count)}`,
    `- down_count: ${formatNumber(payload.row.down_count)}`,
    `- active_count: ${formatNumber(payload.row.active_count)}`,
    `- margin_balance: ${formatNumber(payload.row.margin_balance)}`,
    "",
    "## Boundary",
    "",
    "- Turnover and breadth are broad market context.",
    "- They do not replace direct ETF flow.",
    "- Margin balance is included only when the provider exposes it.",
    ""
  ];
  return lines.join("\n");
}

function formatNumber(value) {
  return typeof value === "number" ? String(Number(value.toFixed(4))) : "";
}

function parseArgs(argv) {
  const args = {
    asOf: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await convertAShareWaterLevelToObservations({
    rootDir,
    asOf: args.asOf
  });
  console.log(`A-share water observations written: ${result.observationPath}`);
  console.log(`Review JSON written: ${result.modelJsonPath}`);
  console.log(`Review Markdown written: ${result.modelMdPath}`);
  console.log(`Readiness: ${result.payload.readiness}`);
  console.log(`Observations: ${result.payload.counts.observations}`);
}
