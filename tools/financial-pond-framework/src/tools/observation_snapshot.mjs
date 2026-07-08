// FP-OBS-02 Observation Snapshot
// Builds generic pool-level vector observations from today's available data.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../collectors/http_csv_collector.mjs";
import { Boundary, ReviewHorizon, SIGNAL_SLOTS, SignalReality, emptySignal } from "../core/observation_schema.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_ID = "observation_snapshot_v0_10_48";
const HISTORY_MODULE_ID = "observation_history_v0_10_48";
const MANUAL_REVIEW_MODULE_ID = "manual_review_log_v0_10_48";
const OUTCOME_MODULE_ID = "outcome_labels_v0_10_48";
const HORIZONS = [ReviewHorizon.T1, ReviewHorizon.T3, ReviewHorizon.T5, ReviewHorizon.T20];

export async function runObservationSnapshot({ rootDir = defaultRootDir, asOf }) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const inputs = await readInputs({ rootDir, asOf: resolvedAsOf });
  const payload = buildObservationSnapshot({ asOf: resolvedAsOf, inputs });
  const repoRoot = repoRootFor(rootDir);
  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  const publishedDir = path.join(repoRoot, "financial-pond", "data");
  await mkdir(outDir, { recursive: true });
  await mkdir(publishedDir, { recursive: true });

  const jsonPath = path.join(outDir, "observation_snapshot.json");
  const publishedPath = path.join(publishedDir, "observation_snapshot.json");
  const manualReviewPath = path.join(publishedDir, "manual_review_log.json");
  const outcomePath = path.join(publishedDir, "outcome_labels.json");
  const historyPath = path.join(rootDir, "model_outputs", "observation_history.jsonl");

  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(publishedPath, jsonContent(payload));
  await ensureManualReviewLog(manualReviewPath);
  const outcomeLabels = await updateOutcomeLabels({ outcomePath, snapshot: payload });
  await appendObservationHistory({ historyPath, snapshot: payload });

  return { payload, jsonPath, publishedPath, manualReviewPath, outcomePath, historyPath, outcomeLabels };
}

export async function readInputs({ rootDir = defaultRootDir, asOf }) {
  const repoRoot = repoRootFor(rootDir);
  const modelDir = path.join(rootDir, "model_outputs", asOf);
  const dataDir = path.join(repoRoot, "financial-pond", "data");
  const readModelOrPublished = (file) => readJsonFirst([
    path.join(modelDir, file),
    path.join(dataDir, file)
  ]);

  const [etfFlowLeaderboard, sectorFlowReview, dailySectorAnalysis, sectorWatchlistState, decisionGateLedger, indexExplainability, dataRealityAudit, dailyDataVault, sectorModuleReview, rotationHistory, providerRows] = await Promise.all([
    readModelOrPublished("etf_flow_leaderboard.json"),
    readModelOrPublished("sector_flow_review.json"),
    readModelOrPublished("daily_sector_analysis.json"),
    readModelOrPublished("sector_watchlist_state.json"),
    readModelOrPublished("decision_gate_ledger.json"),
    readModelOrPublished("index_explainability.json"),
    readModelOrPublished("data_reality_audit.json"),
    readModelOrPublished("daily_data_vault.json"),
    readModelOrPublished("sector_module_review.json"),
    readModelOrPublished("sector_rotation_history.json"),
    readCsvIfExists(path.join(rootDir, "data", "provider_exports", "a_share_sector_flow.csv"))
  ]);

  return {
    etfFlowLeaderboard,
    sectorFlowReview,
    dailySectorAnalysis,
    sectorWatchlistState,
    decisionGateLedger,
    indexExplainability,
    dataRealityAudit,
    dailyDataVault,
    sectorModuleReview,
    rotationHistory,
    providerRows
  };
}

export function buildObservationSnapshot({ asOf, inputs }) {
  const pools = collectPools(inputs);
  const etfBySector = new Map((inputs.etfFlowLeaderboard?.rows ?? []).map((row) => [row.sector_id, row]));
  const flowBySector = new Map((inputs.sectorFlowReview?.sector_reviews ?? []).map((row) => [sectorId(row), row]));
  const dailyBySector = new Map(flattenDailyRows(inputs.dailySectorAnalysis).map((row) => [row.sector_id, row]));
  const watchBySector = new Map((inputs.sectorWatchlistState?.rows ?? []).map((row) => [row.sector_id, row]));
  const moduleBySector = new Map((inputs.sectorModuleReview?.sectors ?? []).map((row) => [row.sector_id, row]));
  const rotationBySector = rotationMap(inputs.rotationHistory, dailyBySector);
  const traceByIndexId = new Map((inputs.indexExplainability?.indexes ?? []).map((row) => [row.index_id, row]));
  const magnitudeRanks = rankMagnitude([...etfBySector.values()]);
  const executionBlocked = gateBlocked(inputs.decisionGateLedger);

  const rows = pools.map((pool) => {
    const etf = etfBySector.get(pool.sector_id) ?? {};
    const flow = flowBySector.get(pool.sector_id) ?? {};
    const daily = dailyBySector.get(pool.sector_id) ?? {};
    const watch = watchBySector.get(pool.sector_id) ?? {};
    const module = moduleBySector.get(pool.sector_id) ?? {};
    const rotation = rotationBySector.get(pool.sector_id) ?? {};
    const signals = buildSignals({ pool, etf, flow, daily, watch, module, rotation });
    const vector = buildVector({
      pool,
      etf,
      signals,
      magnitude: magnitudeRanks.get(pool.sector_id) ?? 0,
      boundary: executionBlocked ? Boundary.BLOCKED : Boundary.OBSERVE_ONLY
    });

    return {
      as_of: inputs.dailySectorAnalysis?.as_of ?? inputs.sectorFlowReview?.as_of ?? asOf,
      universe: pool.universe,
      pool_id: pool.pool_id,
      pool_name: pool.pool_name,
      sector_id: pool.sector_id,
      vector_forecast: vector,
      signals,
      signal_matrix_row: Object.fromEntries(SIGNAL_SLOTS.map((slot) => [slot, matrixStatus(signals[slot]?.reality)])),
      trace_refs: traceRefs({ pool, traceByIndexId, vector }),
      system_note: "Generic observation snapshot. Signals can be real, derived, seeded, missing, planned, or history-limited.",
      human_note: "",
      review_status: watch.watch_state ?? watch.state ?? "observe_only"
    };
  });

  const counts = countSignalReality(rows);
  return {
    module_id: MODULE_ID,
    as_of: rows[0]?.as_of ?? asOf,
    generated_at: new Date().toISOString(),
    status: rows.length ? "observation_snapshot_available" : "no_pools",
    execution_state: executionBlocked ? Boundary.BLOCKED : Boundary.OBSERVE_ONLY,
    observed_pool_count: rows.length,
    signal_slots: SIGNAL_SLOTS,
    counts,
    rows,
    interpretation_boundary: [
      "Observation records only.",
      "Boundaries are observe_only, manual_review, or blocked.",
      "Human review can add notes and outcome labels later."
    ]
  };
}

async function appendObservationHistory({ historyPath, snapshot }) {
  await mkdir(path.dirname(historyPath), { recursive: true });
  const lines = snapshot.rows.map((row) => JSON.stringify({
    module_id: HISTORY_MODULE_ID,
    appended_at: new Date().toISOString(),
    as_of: snapshot.as_of,
    universe: row.universe,
    pool_id: row.pool_id,
    pool_name: row.pool_name,
    vector_forecast: row.vector_forecast,
    signal_matrix_row: row.signal_matrix_row,
    boundary: row.vector_forecast.boundary
  })).join("\n");
  if (lines) await appendFile(historyPath, `${lines}\n`, "utf8");
}

async function ensureManualReviewLog(manualReviewPath) {
  const existing = await readJsonIfExists(manualReviewPath);
  const payload = existing?.module_id === MANUAL_REVIEW_MODULE_ID
    ? existing
    : { module_id: MANUAL_REVIEW_MODULE_ID, entries: [] };
  if (!Array.isArray(payload.entries)) payload.entries = [];
  await atomicWriteFile(manualReviewPath, jsonContent(payload));
  return payload;
}

async function updateOutcomeLabels({ outcomePath, snapshot }) {
  const existing = await readJsonIfExists(outcomePath);
  const payload = existing?.module_id === OUTCOME_MODULE_ID
    ? existing
    : { module_id: OUTCOME_MODULE_ID, labels: [], pending: [] };
  payload.labels = Array.isArray(payload.labels) ? payload.labels : [];
  payload.pending = Array.isArray(payload.pending) ? payload.pending : [];
  const keys = new Set(payload.pending.map((item) => outcomeKey(item)));
  for (const row of snapshot.rows) {
    for (const horizon of HORIZONS) {
      const pending = {
        as_of: snapshot.as_of,
        pool_id: row.pool_id,
        pool_name: row.pool_name,
        horizon,
        due_date: dueDate(snapshot.as_of, horizon),
        status: "pending",
        trace_status: row.vector_forecast.trace_status ?? "missing"
      };
      if (!keys.has(outcomeKey(pending))) {
        payload.pending.push(pending);
        keys.add(outcomeKey(pending));
      }
    }
  }
  await atomicWriteFile(outcomePath, jsonContent(payload));
  return payload;
}

function collectPools(inputs) {
  const pools = new Map();
  const add = ({ sector_id, name, universe = "a_share" }) => {
    if (!sector_id) return;
    pools.set(sector_id, {
      universe,
      sector_id,
      pool_id: `${universe}_${sector_id}`,
      pool_name: name ?? sector_id
    });
  };
  for (const row of inputs.etfFlowLeaderboard?.rows ?? []) add({ sector_id: row.sector_id, name: row.name });
  for (const row of inputs.sectorFlowReview?.sector_reviews ?? []) add({ sector_id: sectorId(row), name: row.name ?? row.display_name });
  for (const row of flattenDailyRows(inputs.dailySectorAnalysis)) add({ sector_id: row.sector_id, name: row.name });
  for (const row of inputs.sectorWatchlistState?.rows ?? []) add({ sector_id: row.sector_id, name: row.name });
  return [...pools.values()].sort((a, b) => a.pool_id.localeCompare(b.pool_id));
}

function buildSignals({ pool, etf, flow, daily, watch, module, rotation }) {
  const signals = Object.fromEntries(SIGNAL_SLOTS.map((slot) => [slot, emptySignal(slot)]));
  const flowComponent = flow.components?.direct_flow ?? {};
  const momentumComponent = flow.components?.market_confirmation ?? {};
  const liquidityComponent = flow.components?.market_liquidity ?? {};
  const newsComponent = flow.components?.policy_sentiment ?? {};
  const valuation = module.modules?.valuation ?? {};
  const fundamental = module.modules?.fundamental ?? {};

  signals.flow = signal({
    slot: "flow",
    reality: typeof etf.estimated_flow === "number" ? SignalReality.REAL_PROVIDER_DERIVED : realityFromComponent(flowComponent),
    value: numberOrNull(etf.estimated_flow),
    score: numberOrNull(flowComponent.score),
    label: etf.estimated_flow_direction ?? flowComponent.label ?? "missing",
    source_file: "etf_flow_leaderboard.json",
    trace_id: `etf.estimated_flow.${pool.sector_id}`
  });
  signals.price_momentum = signal({
    slot: "price_momentum",
    reality: realityFromComponent(momentumComponent),
    value: numberOrNull(momentumComponent.value),
    score: numberOrNull(momentumComponent.score),
    label: momentumComponent.label ?? "planned",
    source_file: "sector_flow_review.json",
    trace_id: `flow.market_confirmation.${pool.sector_id}`
  });
  signals.liquidity = signal({
    slot: "liquidity",
    reality: realityFromComponent(liquidityComponent),
    value: numberOrNull(liquidityComponent.value),
    score: numberOrNull(liquidityComponent.score),
    label: liquidityComponent.label ?? "planned",
    source_file: "sector_flow_review.json",
    trace_id: `flow.market_liquidity.${pool.sector_id}`
  });
  signals.rotation = signal({
    slot: "rotation",
    reality: rotation.label ? SignalReality.REAL_PROVIDER_DERIVED : SignalReality.INSUFFICIENT_HISTORY,
    value: rotation.streak_days ?? null,
    score: numberOrNull(rotation.score ?? daily.score),
    label: rotation.label ?? daily.rotation_diagnostic?.label ?? "insufficient_history",
    source_file: "sector_rotation_history.json",
    trace_id: `rotation.score.${pool.sector_id}`
  });
  signals.news = signal({
    slot: "news",
    reality: realityFromComponent(newsComponent, SignalReality.PLANNED),
    value: numberOrNull(newsComponent.value),
    score: numberOrNull(newsComponent.score),
    label: newsComponent.label ?? "planned",
    source_file: "sector_flow_review.json",
    trace_id: `news.pressure.${pool.sector_id}`
  });
  signals.valuation = signal({
    slot: "valuation",
    reality: moduleReality(valuation),
    value: numberOrNull(valuation.value),
    score: numberOrNull(valuation.score),
    label: valuation.status ?? valuation.label ?? "planned",
    source_file: "sector_module_review.json",
    trace_id: `module.valuation.${pool.sector_id}`
  });
  signals.fundamental = signal({
    slot: "fundamental",
    reality: moduleReality(fundamental),
    value: numberOrNull(fundamental.value),
    score: numberOrNull(fundamental.score),
    label: fundamental.status ?? fundamental.label ?? "planned",
    source_file: "sector_module_review.json",
    trace_id: `module.fundamental.${pool.sector_id}`
  });
  signals.risk = signal({
    slot: "risk",
    reality: watch.state || watch.watch_state || daily.blockers?.length ? SignalReality.REAL_PROVIDER_DERIVED : SignalReality.PLANNED,
    value: null,
    score: numberOrNull(watch.risk_score),
    label: watch.state ?? watch.watch_state ?? (daily.blockers?.length ? "blockers_present" : "planned"),
    source_file: "sector_watchlist_state.json",
    trace_id: `risk.boundary.${pool.sector_id}`
  });
  return signals;
}

function buildVector({ pool, etf, signals, magnitude, boundary }) {
  const flow = numberOrNull(etf.estimated_flow);
  const direction = flow > 0 ? "inward" : flow < 0 ? "outward" : "neutral";
  const coverageScore = SIGNAL_SLOTS.filter((slot) => ![SignalReality.MISSING, SignalReality.PLANNED].includes(signals[slot].reality)).length / SIGNAL_SLOTS.length;
  const realityScore = realityWeight(signals.flow.reality);
  const gateFactor = boundary === Boundary.BLOCKED ? 0.35 : 1;
  return {
    formula_id: "observation.vector_forecast.v0_10_48",
    F: flow,
    direction,
    magnitude,
    velocity: null,
    velocity_status: SignalReality.INSUFFICIENT_HISTORY,
    acceleration: null,
    acceleration_status: SignalReality.INSUFFICIENT_HISTORY,
    confidence: Number((realityScore * coverageScore * gateFactor).toFixed(4)),
    confidence_components: { reality_score: realityScore, coverage_score: Number(coverageScore.toFixed(4)), gate_factor: gateFactor },
    boundary,
    trace_id: `observation.vector.${pool.sector_id}`,
    trace_status: typeof flow === "number" ? "available" : "missing"
  };
}

function signal(item) {
  return {
    slot: item.slot,
    reality: item.reality,
    value: item.value ?? null,
    score: item.score ?? null,
    label: item.label ?? item.reality,
    source_file: item.source_file ?? null,
    trace_id: item.trace_id ?? null,
    trace_status: item.trace_id ? "available" : "missing"
  };
}

function traceRefs({ pool, traceByIndexId, vector }) {
  const ids = [
    `etf.estimated_flow.${pool.sector_id}`,
    `etf.estimated_flow_rank.${pool.sector_id}`,
    `daily.score.${pool.sector_id}`,
    `module.summary.${pool.sector_id}`
  ];
  return ids.map((traceId) => ({
    trace_id: traceId,
    trace_status: traceByIndexId.has(traceId) ? "available" : "missing",
    source_files: traceByIndexId.get(traceId)?.source_files ?? []
  })).concat([{ trace_id: vector.trace_id, trace_status: vector.trace_status, source_files: ["observation_snapshot.json"] }]);
}

function realityFromComponent(component, fallback = SignalReality.MISSING) {
  if (component?.available === true) {
    if (String(component.source_reality ?? component.reality ?? "").includes("observed")) return SignalReality.REAL_PROVIDER_DERIVED;
    if (component.source_reality === "manual_seed") return SignalReality.MANUAL_SEED;
    if (component.source_reality === "mock") return SignalReality.MOCK;
    if (component.source_reality === "fixture") return SignalReality.FIXTURE;
    return SignalReality.REAL_PROVIDER_DERIVED;
  }
  return fallback;
}

function moduleReality(module) {
  const status = String(module?.status ?? module?.reality ?? "");
  if (status.includes("manual_seed")) return SignalReality.MANUAL_SEED;
  if (status.includes("missing")) return SignalReality.MISSING;
  if (status.includes("planned")) return SignalReality.PLANNED;
  if (status) return SignalReality.REAL_PROVIDER_DERIVED;
  return SignalReality.PLANNED;
}

function matrixStatus(reality) {
  const map = {
    [SignalReality.REAL_PROVIDER]: "real",
    [SignalReality.REAL_PROVIDER_DERIVED]: "derived",
    [SignalReality.MANUAL_SEED]: "seed",
    [SignalReality.MOCK]: "missing",
    [SignalReality.FIXTURE]: "missing",
    [SignalReality.MISSING]: "missing",
    [SignalReality.PLANNED]: "planned",
    [SignalReality.INSUFFICIENT_HISTORY]: "insufficient"
  };
  return map[reality] ?? "missing";
}

function rankMagnitude(rows) {
  const ranked = rows
    .map((row) => ({ sector_id: row.sector_id, value: Math.abs(numberOrNull(row.estimated_flow) ?? 0) }))
    .sort((a, b) => b.value - a.value);
  const denom = Math.max(ranked.length - 1, 1);
  const map = new Map();
  ranked.forEach((row, index) => {
    map.set(row.sector_id, row.value === 0 ? 0 : Number((1 - index / denom).toFixed(4)));
  });
  return map;
}

function rotationMap(rotationHistory, dailyBySector) {
  const map = new Map();
  for (const [sectorId, row] of dailyBySector.entries()) {
    map.set(sectorId, {
      label: row.rotation_diagnostic?.label ?? null,
      score: row.score,
      streak_days: row.streak_days ?? row.rotation_diagnostic?.leader_days ?? row.rotation_diagnostic?.laggard_days ?? null
    });
  }
  for (const row of rotationHistory?.latest?.leaders ?? []) map.set(row.sector_id, { ...(map.get(row.sector_id) ?? {}), label: "leader", score: row.score });
  for (const row of rotationHistory?.latest?.laggards ?? []) map.set(row.sector_id, { ...(map.get(row.sector_id) ?? {}), label: "laggard", score: row.score });
  return map;
}

function countSignalReality(rows) {
  const counts = Object.fromEntries(Object.values(SignalReality).map((key) => [key, 0]));
  for (const row of rows) {
    for (const slot of SIGNAL_SLOTS) counts[row.signals[slot].reality] = (counts[row.signals[slot].reality] ?? 0) + 1;
  }
  return counts;
}

function flattenDailyRows(dailyAnalysis) {
  const tiers = dailyAnalysis?.tiers ?? {};
  return [
    ...(tiers.priority_watch ?? []),
    ...(tiers.confirm_next ?? []),
    ...(tiers.avoid_watch ?? [])
  ];
}

function sectorId(row) {
  return row?.sector_id ?? String(row?.pool_id ?? "").replace(/^a_share_/, "");
}

function gateBlocked(ledger) {
  if (ledger?.execution_state === Boundary.BLOCKED) return true;
  return (ledger?.gates ?? []).some((gate) => gate.status === "block");
}

function realityWeight(reality) {
  const weights = {
    [SignalReality.REAL_PROVIDER]: 1,
    [SignalReality.REAL_PROVIDER_DERIVED]: 0.9,
    [SignalReality.MANUAL_SEED]: 0.45,
    [SignalReality.MOCK]: 0.2,
    [SignalReality.FIXTURE]: 0.2,
    [SignalReality.INSUFFICIENT_HISTORY]: 0.25,
    [SignalReality.PLANNED]: 0.1,
    [SignalReality.MISSING]: 0.05
  };
  return weights[reality] ?? 0.05;
}

function dueDate(asOf, horizon) {
  const days = Number(String(horizon).replace("T+", ""));
  const date = new Date(`${asOf}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function outcomeKey(item) {
  return `${item.as_of}|${item.pool_id}|${item.horizon}`;
}

async function readJsonFirst(paths) {
  for (const filePath of paths) {
    const json = await readJsonIfExists(filePath);
    if (json) return json;
  }
  return null;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readCsvIfExists(filePath) {
  try {
    return parseCsv(await readFile(filePath, "utf8"));
  } catch {
    return [];
  }
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || value === "None") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function repoRootFor(rootDir) {
  const maybeRepo = path.resolve(rootDir, "..", "..");
  if (rootDir.endsWith(path.join("tools", "financial-pond-framework"))) return maybeRepo;
  return rootDir;
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
  const result = await runObservationSnapshot({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Observation snapshot written: ${result.jsonPath}`);
  console.log(`Observation snapshot published: ${result.publishedPath}`);
}
