import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const signalMap = [
  ["flow", "flow"],
  ["momentum", "price_momentum"],
  ["liquidity", "liquidity"],
  ["rotation", "rotation"],
  ["news", "news"],
  ["valuation", "valuation"],
  ["fundamental", "fundamental"],
  ["risk", "risk"]
];

const priorityOrder = [
  ["flow", "real flow"],
  ["momentum", "momentum confirmation"],
  ["liquidity", "liquidity confirmation"],
  ["rotation", "rotation evidence"],
  ["valuation", "valuation"],
  ["fundamental", "fundamental"],
  ["news", "news pressure"],
  ["risk", "risk boundary"]
];

const snapshot = JSON.parse(await readFile(resolve(dataDir, "observation_snapshot.json"), "utf8"));
const flowChannel = await readJson(resolve(dataDir, "flow_channel_report.json"), null);
const pools = Array.isArray(snapshot.rows) ? snapshot.rows : [];
const rows = pools.map(poolCoverageRow);
const totals = countStatuses(rows);
const totalSignalCells = rows.length * signalMap.length;
const coverageRatio = totalSignalCells ? round((totals.real + totals.estimated + totals.derived) / totalSignalCells) : 0;

const report = {
  module_id: "data_coverage_report_v0_10_52",
  as_of: snapshot.as_of,
  generated_at: new Date().toISOString(),
  observed_pool_count: rows.length,
  total_signal_cells: totalSignalCells,
  real_count: totals.real,
  estimated_count: totals.estimated,
  derived_count: totals.derived,
  planned_count: totals.planned,
  missing_count: totals.missing,
  insufficient_count: totals.insufficient,
  coverage_ratio: coverageRatio,
  flow_channel: flowChannel ? {
    source_backed_flow_count: flowChannel.source_backed_flow_count ?? 0,
    estimated_from_source_count: flowChannel.estimated_from_source_count ?? 0,
    missing_flow_count: flowChannel.missing_flow_count ?? 0,
    coverage_ratio: flowChannel.coverage_ratio ?? 0
  } : null,
  top_missing_signal_types: topMissingSignalTypes(rows),
  top_missing_pools: [...rows].sort((a, b) => a.coverage_score - b.coverage_score).slice(0, 10).map((row) => ({
    pool_id: row.pool_id,
    pool_name: row.pool_name,
    coverage_score: row.coverage_score,
    main_gap: row.main_gap,
    next_data_need: row.next_data_need
  })),
  priority_gaps: priorityGaps(rows),
  pools: rows
};

await writeFile(resolve(dataDir, "data_coverage_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await updateHistory(report);
console.log(`Data coverage report written: financial-pond/data/data_coverage_report.json`);

function poolCoverageRow(pool) {
  const statuses = Object.fromEntries(signalMap.map(([publicKey, sourceKey]) => [publicKey, signalStatus(pool.signals?.[sourceKey], publicKey)]));
  const covered = signalMap.filter(([key]) => ["real", "estimated", "derived"].includes(statuses[key])).length;
  const mainGap = mainGapFor(statuses);
  return {
    pool_id: pool.pool_id ?? pool.id ?? pool.sector_id ?? "unknown",
    pool_name: pool.pool_name ?? pool.name ?? pool.pool_id ?? "unknown",
    direction: pool.vector_forecast?.direction ?? pool.vector?.direction ?? "neutral",
    magnitude: numberOrNull(pool.vector_forecast?.magnitude ?? pool.vector?.magnitude),
    confidence: numberOrNull(pool.vector_forecast?.confidence ?? pool.vector?.confidence),
    flow_status: statuses.flow,
    momentum_status: statuses.momentum,
    liquidity_status: statuses.liquidity,
    rotation_status: statuses.rotation,
    news_status: statuses.news,
    valuation_status: statuses.valuation,
    fundamental_status: statuses.fundamental,
    risk_status: statuses.risk,
    coverage_score: round(covered / signalMap.length),
    main_gap: mainGap.id,
    next_data_need: mainGap.next
  };
}

function signalStatus(signal, publicKey) {
  const reality = signal?.reality ?? signal?.status ?? signal?.trace_status ?? "missing";
  const value = numberOrNull(signal?.value ?? signal?.score);
  if (reality === "real_provider" || reality === "source_backed") return "real";
  if (publicKey === "flow" && ["real_provider_derived", "estimated_from_source"].includes(reality) && value !== null) return "estimated";
  if (reality === "real_provider_derived" || reality === "manual_seed") return "derived";
  if (reality === "planned") return "planned";
  if (reality === "insufficient_history") return "insufficient";
  if (reality === "unavailable") return "missing";
  return "missing";
}

function mainGapFor(statuses) {
  for (const [id, label] of priorityOrder) {
    if (id === "flow" && !["real", "estimated"].includes(statuses.flow)) return { id: "missing source-backed flow", next: "connect mapped provider flow source" };
    if (["momentum", "liquidity"].includes(id) && !["real", "estimated"].includes(statuses[id])) return { id: `missing ${label}`, next: `connect ${label}` };
    if (id === "rotation" && ["missing", "planned", "insufficient"].includes(statuses.rotation)) return { id: "rotation insufficient", next: "collect more rotation evidence" };
    if (["valuation", "fundamental", "news"].includes(id) && ["missing", "planned"].includes(statuses[id])) return { id: `${label} planned`, next: `connect ${label}` };
    if (id === "risk" && statuses.risk !== "real") return { id: "risk derived", next: "connect reviewed risk boundary" };
  }
  return { id: "none", next: "monitor coverage drift" };
}

function countStatuses(rows) {
  const totals = { real: 0, estimated: 0, derived: 0, planned: 0, missing: 0, insufficient: 0 };
  for (const row of rows) {
    for (const [key] of signalMap) {
      const status = row[`${key}_status`];
      totals[status] = (totals[status] ?? 0) + 1;
    }
  }
  return totals;
}

function topMissingSignalTypes(rows) {
  return signalMap.map(([key]) => {
    const counts = { missing: 0, planned: 0, insufficient: 0 };
    for (const row of rows) {
      const status = row[`${key}_status`];
      if (status in counts) counts[status] += 1;
    }
    return {
      signal_type: key,
      missing_count: counts.missing,
      planned_count: counts.planned,
      insufficient_count: counts.insufficient,
      total_gap_count: counts.missing + counts.planned + counts.insufficient
    };
  }).sort((a, b) => b.total_gap_count - a.total_gap_count).filter((row) => row.total_gap_count > 0);
}

function priorityGaps(rows) {
  return priorityOrder.map(([key, label]) => {
    const affected = rows.filter((row) => gapMatches(key, row));
    return {
      signal_type: key,
      priority_label: label,
      affected_pool_count: affected.length,
      sample_pools: affected.slice(0, 5).map((row) => row.pool_name),
      next_data_need: nextNeedFor(key, label)
    };
  }).filter((gap) => gap.affected_pool_count > 0);
}

function gapMatches(key, row) {
  const status = row[`${key}_status`];
  if (key === "flow") return !["real", "estimated"].includes(status);
  if (["momentum", "liquidity"].includes(key)) return !["real", "estimated"].includes(status);
  if (key === "rotation") return ["missing", "planned", "insufficient"].includes(status);
  if (["valuation", "fundamental", "news"].includes(key)) return ["missing", "planned"].includes(status);
  if (key === "risk") return status !== "real";
  return false;
}

function nextNeedFor(key, label) {
  if (key === "flow") return "connect mapped provider flow source";
  if (key === "rotation") return "collect more rotation evidence";
  return `connect ${label}`;
}

async function updateHistory(report) {
  const historyPath = resolve(dataDir, "coverage_history.json");
  const snapshot = {
    as_of: report.as_of,
    real_count: report.real_count,
    estimated_count: report.estimated_count,
    derived_count: report.derived_count,
    missing_count: report.missing_count,
    planned_count: report.planned_count,
    insufficient_count: report.insufficient_count,
    coverage_ratio: report.coverage_ratio,
    observed_pool_count: report.observed_pool_count
  };
  let history = [];
  try {
    const existing = JSON.parse(await readFile(historyPath, "utf8"));
    history = Array.isArray(existing.history) ? existing.history : Array.isArray(existing) ? existing : [];
  } catch {
    history = [];
  }
  const last = history.at(-1);
  if (!last || JSON.stringify(last) !== JSON.stringify(snapshot)) history.push(snapshot);
  await writeFile(historyPath, `${JSON.stringify({ module_id: "coverage_history_v0_10_52", history }, null, 2)}\n`, "utf8");
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return Number(value.toFixed(4));
}
