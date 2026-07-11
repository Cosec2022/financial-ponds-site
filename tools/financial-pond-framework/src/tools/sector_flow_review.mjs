import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../core/config_loader.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";
import { evaluateSectorFlows, observationsFromMockScores } from "../model/flow_engine.mjs";
import { filterNewsForSectorScoring, normalizeNewsInputPolicy } from "../news/news_input_policy.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runSectorFlowReview({
  rootDir,
  asOf,
  scenarioPath,
  fixture = false
}) {
  const [sectorCatalog, flowConfig, flexibleRiskFactors, rawNewsInputPolicy] = await Promise.all([
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json")),
    readJsonFile(path.join(rootDir, "config", "model", "flow_engine_v0_9.json")),
    readJsonFile(path.join(rootDir, "config", "model", "flexible_risk_factors.json")),
    readJsonFile(path.join(rootDir, "config", "news", "news_input_policy.json")).catch(() => null)
  ]);
  const newsInputPolicy = normalizeNewsInputPolicy(rawNewsInputPolicy);

  const scenario = await loadScenario({ rootDir, scenarioPath, fixture });
  const resolvedAsOf = asOf ?? scenario?.as_of ?? await latestObservationDate(rootDir) ?? new Date().toISOString().slice(0, 10);
  const observationInput = fixture
    ? await loadFixtureObservations({ rootDir, asOf: resolvedAsOf })
    : await loadObservationFile({ rootDir, asOf: resolvedAsOf, newsInputPolicy });
  const observations = Array.isArray(observationInput) ? observationInput : observationInput.observations;

  const review = evaluateSectorFlows({
    observations,
    sectorCatalog,
    flowConfig,
    flexibleRiskFactors,
    scenario
  });
  const dataAvailability = buildDataAvailability(review.sector_reviews ?? []);
  const payload = {
    as_of: resolvedAsOf,
    generated_at: new Date().toISOString(),
    ...review,
    narrative_context: Array.isArray(observationInput) ? [] : observationInput.narrative_context,
    data_availability: dataAvailability,
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

async function loadObservationFile({ rootDir, asOf, newsInputPolicy }) {
  const filePath = path.join(rootDir, "observations", asOf, "node_observations.json");
  const providerFlowPath = path.join(rootDir, "observations", asOf, "provider_flow_observations.json");
  const aShareWaterPath = path.join(rootDir, "observations", asOf, "a_share_water_observations.json");
  const newsPath = path.join(rootDir, "observations", asOf, "news_observations.json");
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

  let newsObservations = [];
  try {
    const payload = JSON.parse(await readFile(newsPath, "utf8"));
    newsObservations = payload.observations ?? [];
  } catch (error) {
    newsObservations = [];
  }

  if (!baseObservations.length && !providerFlowObservations.length && !aShareWaterObservations.length && !newsObservations.length) {
    throw new Error(
      `No observations found for ${asOf}. Run npm run cycle ${asOf}, run provider conversion, or use npm run flow:review:fixture.`
    );
  }

  // Provider-flow observations are appended after the normal cycle output so
  // reviewed provider data can override same-day mock sector proxies during the
  // flow review. The main graph snapshot remains unchanged.
  return {
    observations: [...baseObservations, ...providerFlowObservations, ...aShareWaterObservations, ...filterNewsForSectorScoring(newsInputPolicy, newsObservations)],
    narrative_context: newsObservations.map((item) => ({ node_id: item.node_id, source: item.source ?? "news_intelligence_v1", event_count: item.value ?? 0, display_only: true }))
  };
}

function buildDataAvailability(rows) {
  const representativeRows = rows.filter((row) => row.coverage_status === "provider_mapped_representative");
  const representativeCount = representativeRows.length || rows.length;
  const directFlowCount = rows.filter((row) => componentAvailable(row, "direct_flow")).length;
  const representativeDirectFlowCount = representativeRows.filter((row) => componentAvailable(row, "direct_flow")).length;
  const confirmationCount = rows.filter((row) => componentAvailable(row, "market_confirmation")).length;
  const representativeConfirmationCount = representativeRows.filter((row) => componentAvailable(row, "market_confirmation")).length;
  const observedDirectFlowCount = rows.filter((row) => componentHasObservedSource(row, "direct_flow")).length;
  const representativeObservedDirectFlowCount = representativeRows.filter((row) => componentHasObservedSource(row, "direct_flow")).length;
  const observedConfirmationCount = rows.filter((row) => componentHasObservedSource(row, "market_confirmation")).length;
  const representativeObservedConfirmationCount = representativeRows.filter((row) => componentHasObservedSource(row, "market_confirmation")).length;
  const marketLiquidityCount = rows.filter((row) => componentAvailable(row, "market_liquidity")).length;
  const newsPressureCount = rows.filter((row) => componentAvailable(row, "policy_sentiment")).length;
  const fundamentalProxyCount = rows.filter((row) => componentAvailable(row, "fundamental_proxy")).length;
  const sourceSummary = buildSourceSummary(rows);
  const mode = availabilityMode({
    representativeCount,
    representativeDirectFlowCount,
    representativeConfirmationCount,
    representativeObservedDirectFlowCount,
    representativeObservedConfirmationCount,
    sourceReality: sourceSummary.reality
  });

  return {
    mode,
    headline: availabilityHeadline({
      mode,
      representativeDirectFlowCount,
      representativeCount,
      representativeConfirmationCount,
      representativeObservedDirectFlowCount,
      representativeObservedConfirmationCount,
      sourceReality: sourceSummary.reality
    }),
    source_reality: sourceSummary.reality,
    market_use_confidence: sourceSummary.market_use_confidence,
    source_counts: sourceSummary.source_counts,
    counts: {
      sectors: rows.length,
      representative_sectors: representativeRows.length,
      direct_flow_inputs: directFlowCount,
      representative_direct_flow_inputs: representativeDirectFlowCount,
      price_volume_confirmations: confirmationCount,
      representative_price_volume_confirmations: representativeConfirmationCount,
      observed_direct_flow_inputs: observedDirectFlowCount,
      representative_observed_direct_flow_inputs: representativeObservedDirectFlowCount,
      observed_price_volume_confirmations: observedConfirmationCount,
      representative_observed_price_volume_confirmations: representativeObservedConfirmationCount,
      market_liquidity_inputs: marketLiquidityCount,
      news_pressure_inputs: newsPressureCount,
      fundamental_proxy_inputs: fundamentalProxyCount
    },
    coverage: {
      representative_direct_flow: ratio(representativeDirectFlowCount, representativeCount),
      representative_price_volume: ratio(representativeConfirmationCount, representativeCount),
      all_sector_direct_flow: ratio(directFlowCount, rows.length),
      all_sector_price_volume: ratio(confirmationCount, rows.length)
    },
    warnings: availabilityWarnings({
      mode,
      representativeCount,
      representativeDirectFlowCount,
      representativeConfirmationCount,
      representativeObservedDirectFlowCount,
      representativeObservedConfirmationCount,
      sourceReality: sourceSummary.reality
    })
  };
}

function componentAvailable(row, componentName) {
  return Boolean(row?.components?.[componentName]?.available);
}

function componentHasObservedSource(row, componentName) {
  const component = row?.components?.[componentName];
  if (!component?.available) return false;
  return (component.nodes ?? []).some((node) => {
    if (typeof node === "string") return false;
    return sourceKind(node.source) === "observed";
  });
}

function buildSourceSummary(rows) {
  const sourceCounts = {};
  let observedCount = 0;
  let mockCount = 0;
  let unknownCount = 0;

  for (const row of rows) {
    for (const component of Object.values(row.components ?? {})) {
      if (!component?.available) continue;
      for (const node of component.nodes ?? []) {
        if (typeof node === "string") continue;
        const source = node.source ?? "unknown";
        sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
        const kind = sourceKind(source);
        if (kind === "observed") observedCount += 1;
        else if (kind === "mock") mockCount += 1;
        else unknownCount += 1;
      }
    }
  }

  const reality = observedCount > 0 && mockCount === 0 && unknownCount === 0
    ? "observed"
    : observedCount > 0
      ? "mixed_observed_mock"
      : mockCount > 0
        ? "mock"
        : "unknown";

  return {
    reality,
    market_use_confidence: reality === "observed" ? "medium" : "low",
    source_counts: sourceCounts
  };
}

function sourceKind(source) {
  if (!source) return "unknown";
  if (/mock|fixture|config\/mock_scores/i.test(source)) return "mock";
  if (/akshare|provider|efinance|qstock|exchange|real|local_csv|http_csv|http_json|a_share_water_level/i.test(source)) return "observed";
  return "unknown";
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function availabilityMode({
  representativeCount,
  representativeDirectFlowCount,
  representativeConfirmationCount,
  representativeObservedDirectFlowCount,
  representativeObservedConfirmationCount,
  sourceReality
}) {
  if (sourceReality === "mock") return "mock_only";
  if (sourceReality === "unknown" && (representativeDirectFlowCount > 0 || representativeConfirmationCount > 0)) return "source_unverified";
  if (representativeCount > 0 && representativeDirectFlowCount >= representativeCount && representativeConfirmationCount >= representativeCount) {
    return "etf_flow_ready";
  }
  if (representativeObservedDirectFlowCount > 0 && representativeObservedConfirmationCount > 0) return "partial_observed_flow";
  if (representativeDirectFlowCount > 0) return "partial_etf_flow";
  if (representativeConfirmationCount > 0) return "price_volume_only";
  return "thin_data";
}

function availabilityHeadline({
  mode,
  representativeDirectFlowCount,
  representativeCount,
  representativeConfirmationCount,
  representativeObservedDirectFlowCount,
  representativeObservedConfirmationCount
}) {
  if (mode === "mock_only") {
    return "Sector components are populated from mock or fixture sources; do not read this as live market evidence.";
  }
  if (mode === "source_unverified") {
    return "Sector components are populated, but source provenance is not verified; treat rankings as low confidence.";
  }
  if (mode === "etf_flow_ready") {
    return `ETF flow and price-volume confirmation are available for ${representativeCount}/${representativeCount} representative sectors; observed-source direct flow ${representativeObservedDirectFlowCount}/${representativeCount}, observed-source confirmation ${representativeObservedConfirmationCount}/${representativeCount}.`;
  }
  if (mode === "partial_observed_flow") {
    return `Observed-source ETF flow is partial: ${representativeObservedDirectFlowCount}/${representativeCount}; observed-source price-volume confirmation ${representativeObservedConfirmationCount}/${representativeCount}.`;
  }
  if (mode === "partial_etf_flow") {
    return `ETF flow is partial: ${representativeDirectFlowCount}/${representativeCount} representative sectors have direct flow inputs.`;
  }
  if (mode === "price_volume_only") {
    return `ETF share-flow is unavailable today; price-volume confirmation is available for ${representativeConfirmationCount}/${representativeCount} representative sectors.`;
  }
  return "Sector visibility is thin; wait for provider flow, price-volume, or water-level inputs before reading rotation strongly.";
}

function availabilityWarnings({
  mode,
  representativeCount,
  representativeDirectFlowCount,
  representativeConfirmationCount,
  representativeObservedDirectFlowCount,
  representativeObservedConfirmationCount,
  sourceReality
}) {
  const warnings = [];
  if (mode === "mock_only") {
    warnings.push("All active sector-flow inputs are mock or fixture sources; use this output only for UI/model-contract checks.");
  }
  if (mode === "source_unverified") {
    warnings.push("Sector-flow inputs are populated but source provenance is unknown; inspect component node sources before using the ranking.");
  }
  if (sourceReality === "mixed_observed_mock") {
    warnings.push("Observed provider inputs and mock inputs are mixed. Read observed-source coverage separately from raw component coverage.");
  }
  if (mode === "price_volume_only") {
    warnings.push("Direct ETF share-flow inputs are missing; sector ranking is based on price-volume, water-level, news, and proxy inputs.");
  }
  if (mode === "partial_etf_flow") {
    warnings.push(`Only ${representativeDirectFlowCount}/${representativeCount} representative sectors have direct ETF flow inputs.`);
  }
  if (representativeConfirmationCount < representativeCount) {
    warnings.push(`Only ${representativeConfirmationCount}/${representativeCount} representative sectors have price-volume confirmation.`);
  }
  if (representativeObservedDirectFlowCount < representativeCount) {
    warnings.push(`Only ${representativeObservedDirectFlowCount}/${representativeCount} representative sectors have observed-source direct ETF flow.`);
  }
  if (representativeObservedConfirmationCount < representativeCount) {
    warnings.push(`Only ${representativeObservedConfirmationCount}/${representativeCount} representative sectors have observed-source price-volume confirmation.`);
  }
  if (mode === "thin_data") {
    warnings.push("Do not read sector rotation as a market signal until at least price-volume confirmation is available.");
  }
  return warnings;
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
    "## Data Availability",
    "",
    `- mode: ${payload.data_availability?.mode ?? "unknown"}`,
    `- headline: ${payload.data_availability?.headline ?? "unknown"}`,
    `- representative_direct_flow_inputs: ${payload.data_availability?.counts?.representative_direct_flow_inputs ?? 0}/${payload.data_availability?.counts?.representative_sectors ?? 0}`,
    `- representative_price_volume_confirmations: ${payload.data_availability?.counts?.representative_price_volume_confirmations ?? 0}/${payload.data_availability?.counts?.representative_sectors ?? 0}`,
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
