// FP-ETF-FLOW-01 ETF Flow Leaderboard
// Input: AKShare provider inspection and provider flow observations
// Output: etf_flow_leaderboard.json and etf_flow_leaderboard.md
// Boundary: observation-only ranking. It must not emit buy/sell wording.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../core/config_loader.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runEtfFlowLeaderboard({
  rootDir = defaultRootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const payload = await buildEtfFlowLeaderboard({ rootDir, asOf: resolvedAsOf });
  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "etf_flow_leaderboard.json");
  const mdPath = path.join(outDir, "etf_flow_leaderboard.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));
  return { payload, jsonPath, mdPath };
}

export async function buildEtfFlowLeaderboard({ rootDir = defaultRootDir, asOf }) {
  const [catalog, observations, inspection] = await Promise.all([
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json")),
    readJsonIfExists(path.join(rootDir, "model_outputs", asOf, "akshare_provider_flow_observations.json")),
    readJsonIfExists(path.join(rootDir, "model_outputs", "provider_inspection", "akshare_etf_bridge_inspection.json"))
  ]);
  const sourceRows = observations?.row_findings?.length
    ? observations.row_findings
    : (inspection?.row_findings ?? []).filter((row) => !inspection?.as_of || inspection.as_of === asOf);
  const sectorNames = new Map((catalog.sectors ?? []).map((sector) => [sector.id, sector.name]));
  const inspectionBySector = new Map((inspection?.row_findings ?? []).map((row) => [row.sector_id, row]));
  const flowRanks = rankRows(sourceRows, "estimated_flow");
  const amountRanks = rankRows(sourceRows, "amount");
  const rows = sourceRows
    .map((row) => {
      const inspectionRow = inspectionBySector.get(row.sector_id) ?? {};
      const estimatedFlow = numberOrNull(row.estimated_flow);
      return {
        sector_id: row.sector_id,
        name: sectorNames.get(row.sector_id) ?? row.sector_id,
        fund_code: row.fund_code ?? inspectionRow.fund_code ?? null,
        fund_name: row.fund_name ?? inspectionRow.fund_name ?? null,
        amount: numberOrNull(row.amount ?? inspectionRow.amount),
        estimated_flow: estimatedFlow,
        estimated_flow_direction: flowDirection(estimatedFlow),
        estimated_flow_rank: flowRanks.get(row.sector_id) ?? null,
        amount_rank: amountRanks.get(row.sector_id) ?? null,
        enable_candidate: Boolean(inspectionRow.enable_candidate ?? row.enable_candidate ?? false),
        manual_review_label: manualReviewLabel({ row, inspectionRow, estimatedFlow })
      };
    })
    .sort((a, b) => (a.estimated_flow_rank ?? 999) - (b.estimated_flow_rank ?? 999) || (a.amount_rank ?? 999) - (b.amount_rank ?? 999));

  return {
    as_of: observations?.as_of ?? inspection?.as_of ?? asOf,
    generated_at: new Date().toISOString(),
    module_id: "etf_flow_leaderboard_v0_10_43",
    status: rows.length ? "leaderboard_available" : "no_provider_rows",
    source: observations ? "akshare_provider_flow_observations" : "akshare_provider_inspection",
    readiness: {
      provider_flow_readiness: observations?.readiness ?? "unknown",
      provider_history: observations?.provider_history ?? null,
      data_readiness: dataReadiness(observations, rows)
    },
    counts: {
      rows: rows.length,
      positive: rows.filter((row) => row.estimated_flow_direction === "positive").length,
      zero: rows.filter((row) => row.estimated_flow_direction === "zero").length,
      negative: rows.filter((row) => row.estimated_flow_direction === "negative").length,
      enable_candidates: rows.filter((row) => row.enable_candidate).length
    },
    rows,
    interpretation_boundary: [
      "Observation-only ETF flow leaderboard.",
      "Rows rank representative ETF estimated flow and amount from AKShare provider outputs.",
      "This file must not be interpreted as buy, sell, rebalance, or allocation instruction."
    ]
  };
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function rankRows(rows, key) {
  const ranked = rows
    .map((row) => ({ sector_id: row.sector_id, value: numberOrNull(row[key]) }))
    .filter((row) => row.sector_id && row.value !== null)
    .sort((a, b) => b.value - a.value);
  const result = new Map();
  ranked.forEach((row, index) => result.set(row.sector_id, index + 1));
  return result;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || value === "None") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function flowDirection(value) {
  if (typeof value !== "number") return "zero";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "zero";
}

function manualReviewLabel({ row, inspectionRow, estimatedFlow }) {
  if (inspectionRow.blocking_reason) return `manual_review_required:${inspectionRow.blocking_reason}`;
  if (!inspectionRow.enable_candidate && inspectionRow.enable_candidate !== undefined) return "manual_review_required:not_enable_candidate";
  if (estimatedFlow === null) return "manual_review_required:no_estimated_flow";
  if (row.flow_available === false) return "manual_review_required:flow_unavailable";
  return "observation_only_ready_for_review";
}

function dataReadiness(observations, rows) {
  if (!rows.length) return "no_rows";
  if (observations?.readiness === "flow_ready") return "flow_ready";
  if (rows.some((row) => typeof row.estimated_flow === "number")) return "partial_flow";
  return "baseline_or_inspection_only";
}

function buildMarkdown(payload) {
  const lines = [
    `# ETF Flow Leaderboard ${payload.as_of}`,
    "",
    `Status: ${payload.status}`,
    `Data readiness: ${payload.readiness.data_readiness}`,
    "",
    "Observation data only. Not a buy, sell, rebalance, or allocation instruction.",
    "",
    "| Sector | Fund | Estimated flow | Direction | Flow rank | Amount rank | Review |",
    "| --- | --- | ---: | --- | ---: | ---: | --- |"
  ];
  for (const row of payload.rows) {
    lines.push(`| ${row.name} | ${row.fund_code ?? ""} ${row.fund_name ?? ""} | ${row.estimated_flow ?? ""} | ${row.estimated_flow_direction} | ${row.estimated_flow_rank ?? ""} | ${row.amount_rank ?? ""} | ${row.manual_review_label} |`);
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runEtfFlowLeaderboard({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`ETF flow leaderboard written: ${result.jsonPath}`);
  console.log(`ETF flow leaderboard report written: ${result.mdPath}`);
}
