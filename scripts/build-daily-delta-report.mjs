import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const pointer = await readJson(resolve(dataDir, "history", "latest_observation_pointer.json"));
const latestArchive = await readJson(resolve(root, pointer.latest_path));
const previousArchive = pointer.previous_path ? await readJson(resolve(root, pointer.previous_path)) : null;
const comparisonAvailable = Boolean(previousArchive);
const latestRows = latestArchive.observation_snapshot?.rows ?? [];
const previousRows = new Map((previousArchive?.observation_snapshot?.rows ?? []).map((row) => [row.pool_id, row]));
const rows = latestRows.map((row) => poolDelta(row, previousRows.get(row.pool_id), comparisonAvailable));

const counts = rows.reduce((acc, row) => {
  acc[row.review_flag] = (acc[row.review_flag] ?? 0) + 1;
  return acc;
}, {});

const report = {
  module_id: "daily_delta_report_v0_10_55",
  as_of: latestArchive.as_of,
  generated_at: new Date().toISOString(),
  comparison_available: comparisonAvailable,
  latest_as_of: pointer.latest_as_of,
  previous_as_of: pointer.previous_as_of,
  latest_path: pointer.latest_path,
  previous_path: pointer.previous_path,
  observed_pool_count: rows.length,
  changed_pool_count: counts.changed ?? 0,
  improved_data_count: counts.improved_data ?? 0,
  new_signal_count: counts.new_signal ?? 0,
  confidence_change_count: counts.confidence_change ?? 0,
  insufficient_history_count: counts.insufficient_history ?? 0,
  stable_pool_count: counts.stable ?? 0,
  baseline_state: comparisonAvailable ? "today archived / previous available" : "today archived / insufficient history",
  boundary_notes: [
    "Delta report compares observation snapshots only.",
    "Rows are review flags, not execution signals.",
    "observe_only boundary remains in force."
  ]
};

const poolSignals = {
  module_id: "pool_delta_signals_v0_10_55",
  as_of: latestArchive.as_of,
  generated_at: report.generated_at,
  comparison_available: comparisonAvailable,
  rows
};

await writeFile(resolve(dataDir, "daily_delta_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(resolve(dataDir, "pool_delta_signals.json"), `${JSON.stringify(poolSignals, null, 2)}\n`, "utf8");
await updateHistory(report);
console.log(`Daily delta report written: comparison_available=${comparisonAvailable}`);

function poolDelta(latest, previous, comparisonAvailable) {
  const latestFlow = latest.signals?.flow ?? {};
  const previousFlow = previous?.signals?.flow ?? {};
  const latestMomentum = latest.signals?.price_momentum ?? {};
  const previousMomentum = previous?.signals?.price_momentum ?? {};
  const latestLiquidity = latest.signals?.liquidity ?? {};
  const previousLiquidity = previous?.signals?.liquidity ?? {};
  if (!comparisonAvailable || !previous) {
    return {
      pool_id: latest.pool_id,
      pool_name: latest.pool_name,
      review_flag: "insufficient_history",
      latest_flow_status: latestFlow.reality ?? "missing",
      previous_flow_status: null,
      latest_momentum_status: latestMomentum.reality ?? "missing",
      previous_momentum_status: null,
      latest_liquidity_status: latestLiquidity.reality ?? "missing",
      previous_liquidity_status: null,
      flow_value_delta: null,
      direction_delta: null,
      confidence_delta: null,
      main_change: latestCapApplied(latestMomentum, latestLiquidity) ? "confidence_capped" : "insufficient_history",
      boundary: "observe_only",
      reason: "No previous archived observation snapshot is available."
    };
  }
  const latestValue = numberOrNull(latestFlow.value);
  const previousValue = numberOrNull(previousFlow.value);
  const valueDelta = latestValue === null || previousValue === null ? null : round(latestValue - previousValue);
  const directionDelta = latest.vector_forecast?.direction === previous.vector_forecast?.direction ? "same" : "changed";
  const latestSignalConfidence = averageConfidence(latestMomentum, latestLiquidity);
  const previousSignalConfidence = averageConfidence(previousMomentum, previousLiquidity);
  const confidenceDelta = latestSignalConfidence === null || previousSignalConfidence === null
    ? null
    : round(latestSignalConfidence - previousSignalConfidence);
  const changed = latestFlow.reality !== previousFlow.reality || valueDelta !== 0 || directionDelta === "changed";
  const gainedMomentum = gainedMarketSignal(previousMomentum, latestMomentum);
  const gainedLiquidity = gainedMarketSignal(previousLiquidity, latestLiquidity);
  const capApplied = latestCapApplied(latestMomentum, latestLiquidity);
  const confidenceChanged = capApplied && confidenceDelta !== null && confidenceDelta !== 0;
  const reviewFlag = gainedMomentum && gainedLiquidity ? "improved_data" : gainedMomentum || gainedLiquidity ? "new_signal" : confidenceChanged ? "confidence_change" : changed ? "changed" : "stable";
  return {
    pool_id: latest.pool_id,
    pool_name: latest.pool_name,
    review_flag: reviewFlag,
    latest_flow_status: latestFlow.reality ?? "missing",
    previous_flow_status: previousFlow.reality ?? "missing",
    latest_momentum_status: latestMomentum.reality ?? "missing",
    previous_momentum_status: previousMomentum.reality ?? "missing",
    latest_liquidity_status: latestLiquidity.reality ?? "missing",
    previous_liquidity_status: previousLiquidity.reality ?? "missing",
    flow_value_delta: valueDelta,
    direction_delta: directionDelta,
    confidence_delta: confidenceDelta,
    main_change: capApplied ? "confidence_capped" : changed ? "observation_changed" : "stable",
    boundary: "observe_only",
    reason: gainedMomentum || gainedLiquidity
      ? "Market-backed observation coverage improved versus the previous archive."
      : changed ? "One or more observation fields changed versus previous archive." : "No compared observation field changed versus previous archive."
  };
}

function averageConfidence(...signals) {
  const values = signals.map((signal) => numberOrNull(signal?.confidence)).filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function latestCapApplied(...signals) {
  return signals.some((signal) => {
    const raw = numberOrNull(signal?.raw_confidence);
    const capped = numberOrNull(signal?.capped_confidence);
    return raw !== null && capped !== null && capped < raw;
  });
}

function gainedMarketSignal(previous, latest) {
  const previousAvailable = numberOrNull(previous?.value) !== null
    && ["real_provider", "real_provider_derived", "source_backed", "derived_from_market", "estimated_from_source"].includes(previous?.reality);
  const latestAvailable = numberOrNull(latest?.value) !== null
    && ["source_backed", "derived_from_market", "estimated_from_source"].includes(latest?.reality);
  return !previousAvailable && latestAvailable;
}

async function updateHistory(report) {
  const historyPath = resolve(dataDir, "daily_delta_history.json");
  let history = [];
  try {
    const existing = await readJson(historyPath);
    history = Array.isArray(existing.history) ? existing.history : [];
  } catch {
    history = [];
  }
  const snapshot = {
    as_of: report.as_of,
    comparison_available: report.comparison_available,
    latest_as_of: report.latest_as_of,
    previous_as_of: report.previous_as_of,
    observed_pool_count: report.observed_pool_count,
    changed_pool_count: report.changed_pool_count,
    improved_data_count: report.improved_data_count,
    new_signal_count: report.new_signal_count,
    confidence_change_count: report.confidence_change_count,
    insufficient_history_count: report.insufficient_history_count,
    stable_pool_count: report.stable_pool_count,
    baseline_state: report.baseline_state
  };
  const index = history.findIndex((row) => row.as_of === snapshot.as_of);
  if (index >= 0) history[index] = snapshot;
  else history.push(snapshot);
  history.sort((a, b) => a.as_of.localeCompare(b.as_of));
  await writeFile(historyPath, `${JSON.stringify({ module_id: "daily_delta_history_v0_10_55", history }, null, 2)}\n`, "utf8");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return Number(value.toFixed(4));
}
