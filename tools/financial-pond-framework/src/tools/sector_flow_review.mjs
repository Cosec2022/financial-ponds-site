import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../core/config_loader.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";
import { evaluateSectorFlows, observationsFromMockScores } from "../model/flow_engine.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runSectorFlowReview({
  rootDir,
  asOf,
  scenarioPath,
  fixture = false
}) {
  const [sectorCatalog, flowConfig, flexibleRiskFactors] = await Promise.all([
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json")),
    readJsonFile(path.join(rootDir, "config", "model", "flow_engine_v0_9.json")),
    readJsonFile(path.join(rootDir, "config", "model", "flexible_risk_factors.json"))
  ]);

  const scenario = await loadScenario({ rootDir, scenarioPath, fixture });
  const resolvedAsOf = asOf ?? scenario?.as_of ?? await latestObservationDate(rootDir) ?? new Date().toISOString().slice(0, 10);
  const observations = fixture
    ? await loadFixtureObservations({ rootDir, asOf: resolvedAsOf })
    : await loadObservationFile({ rootDir, asOf: resolvedAsOf });

  const review = evaluateSectorFlows({
    observations,
    sectorCatalog,
    flowConfig,
    flexibleRiskFactors,
    scenario
  });
  const payload = {
    as_of: resolvedAsOf,
    generated_at: new Date().toISOString(),
    ...review,
    safety_boundary: [
      "This is a sector-flow review, not a trading instruction.",
      "The output does not write to core graph scores.",
      "External factor pressure must be confirmed by domestic price, turnover, breadth, or ETF share data."
    ]
  };

  const outDir = path.join(rootDir, "model_outputs", resolvedAsOf);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "sector_flow_review.json");
  const mdPath = path.join(outDir, "sector_flow_review.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return {
    payload,
    jsonPath,
    mdPath
  };
}

async function latestObservationDate(rootDir) {
  try {
    const entries = await readdir(path.join(rootDir, "observations"), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .at(-1) ?? null;
  } catch {
    return null;
  }
}

async function loadScenario({ rootDir, scenarioPath, fixture }) {
  const resolved = scenarioPath
    ? path.resolve(rootDir, scenarioPath)
    : fixture
      ? path.join(rootDir, "config", "examples", "flow_scenario_global_tech_selloff.json")
      : null;
  return resolved ? readJsonFile(resolved) : null;
}

async function loadFixtureObservations({ rootDir, asOf }) {
  const mockScores = await readJsonFile(path.join(rootDir, "config", "mock_scores", "2026-07-02.json"));
  return observationsFromMockScores({ mockScores, asOf });
}

async function loadObservationFile({ rootDir, asOf }) {
  const filePath = path.join(rootDir, "observations", asOf, "node_observations.json");
  const providerFlowPath = path.join(rootDir, "observations", asOf, "provider_flow_observations.json");
  const aShareWaterPath = path.join(rootDir, "observations", asOf, "a_share_water_observations.json");
  let baseObservations = [];
  try {
    const payload = JSON.parse(await readFile(filePath, "utf8"));
    baseObservations = payload.observations ?? [];
  } catch (error) {
    baseObservations = [];
  }

  let providerFlowObservations = [];
  try {
    const payload = JSON.parse(await readFile(providerFlowPath, "utf8"));
    providerFlowObservations = payload.observations ?? [];
  } catch (error) {
    providerFlowObservations = [];
  }

  let aShareWaterObservations = [];
  try {
    const payload = JSON.parse(await readFile(aShareWaterPath, "utf8"));
    aShareWaterObservations = payload.observations ?? [];
  } catch (error) {
    aShareWaterObservations = [];
  }

  if (!baseObservations.length && !providerFlowObservations.length && !aShareWaterObservations.length) {
    throw new Error(
      `No observations found for ${asOf}. Run npm run cycle ${asOf}, run provider conversion, or use npm run flow:review:fixture.`
    );
  }

  // Provider-flow observations are appended after the normal cycle output so
  // reviewed provider data can override same-day mock sector proxies during the
  // flow review. The main graph snapshot remains unchanged.
  return [...baseObservations, ...providerFlowObservations, ...aShareWaterObservations];
}

function buildMarkdown(payload) {
  const lines = [
    "# A-share Sector Flow Review",
    "",
    `- as_of: ${payload.as_of}`,
    `- model_id: ${payload.model_id}`,
    `- scenario_id: ${payload.scenario_id ?? "none"}`,
    `- sectors: ${payload.counts.sectors}`,
    "",
    "## Rules",
    "",
    "- This review ranks relative sector-flow pressure.",
    "- It does not write to core graph scores.",
    "- External pressure only modifies the review; domestic market data must confirm it.",
    "",
    "## Ranking",
    "",
    "| Rank | Pool | Score | Label | Confidence | Data completeness |",
    "|---:|---|---:|---|---:|---:|"
  ];

  payload.sector_reviews.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | ${item.pool_id} | ${item.score.toFixed(3)} | ${item.label} | ${item.confidence.toFixed(3)} | ${item.data_completeness.toFixed(3)} |`
    );
  });

  lines.push("", "## Top Drivers", "");
  for (const item of payload.sector_reviews.slice(0, 5)) {
    const drivers = item.top_drivers
      .map((driver) => `${driver.component}: ${driver.contribution.toFixed(3)}`)
      .join("; ");
    lines.push(`- ${item.pool_id}: ${drivers || "no active driver"}`);
  }

  lines.push("");
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = {
    fixture: false,
    asOf: null,
    scenarioPath: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixture") args.fixture = true;
    if (arg === "--as-of") args.asOf = argv[index + 1];
    if (arg === "--scenario") args.scenarioPath = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const { payload, jsonPath, mdPath } = await runSectorFlowReview({
    rootDir,
    asOf: args.asOf,
    scenarioPath: args.scenarioPath,
    fixture: args.fixture
  });
  console.log(`Sector flow review written: ${jsonPath}`);
  console.log(`Sector flow markdown written: ${mdPath}`);
  console.log(`Sectors: ${payload.counts.sectors}`);
  console.log(`Top positive: ${payload.summary.top_positive.map((item) => `${item.pool_id}:${item.score.toFixed(2)}`).join(", ")}`);
  console.log(`Top negative: ${payload.summary.top_negative.map((item) => `${item.pool_id}:${item.score.toFixed(2)}`).join(", ")}`);
}
