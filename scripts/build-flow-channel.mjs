import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const modelOutputDir = resolve(root, "tools", "financial-pond-framework", "model_outputs");
const sourceFile = "etf_flow_leaderboard.json";
const upstreamFile = "akshare_provider_flow_observations.json";

const snapshotPath = resolve(dataDir, "observation_snapshot.json");
const leaderboardPath = resolve(dataDir, sourceFile);
const snapshot = await readJson(snapshotPath);
const leaderboard = await readJson(leaderboardPath, null);
const instrumentMap = await readJson(resolve(dataDir, "pool_instrument_map.json"), null);
const asOf = process.env.AS_OF ?? snapshot?.as_of ?? leaderboard?.as_of ?? "unknown";
snapshot.as_of = asOf;
for (const row of snapshot?.rows ?? []) row.as_of = asOf;
const upstream = await readJson(resolve(modelOutputDir, asOf, upstreamFile), null);

const sourceRows = Array.isArray(leaderboard?.rows) ? leaderboard.rows : [];
const sourceByCode = new Map(sourceRows.map((row) => [String(row.fund_code ?? ""), row]));
const mappingByPool = new Map((instrumentMap?.rows ?? []).map((row) => [row.pool_id, row]));
const flowSignals = (Array.isArray(snapshot?.rows) ? snapshot.rows : []).map((pool) => {
  const mapping = mappingByPool.get(pool.pool_id);
  const source = mapping?.mapping_status === "direct_etf" ? sourceByCode.get(String(mapping.instrument_code)) : null;
  return poolFlowSignal(pool, source, mapping);
});
const mappedSignals = flowSignals.filter((row) => row.flow_status === "source_backed" || row.flow_status === "estimated_from_source");
const mappedSourceIds = new Set(mappedSignals.map((row) => String(row.sector_id ?? "")));
const unmappedRows = sourceRows.filter((row) => !mappedSourceIds.has(String(row.sector_id ?? "")));
const sourceBackedCount = flowSignals.filter((row) => row.flow_status === "source_backed").length;
const estimatedCount = flowSignals.filter((row) => row.flow_status === "estimated_from_source").length;
const missingCount = flowSignals.filter((row) => row.flow_status === "missing" || row.flow_status === "unavailable").length;

const flowSignalFile = {
  module_id: "pool_flow_signals_v0_10_51",
  as_of: asOf,
  generated_at: new Date().toISOString(),
  source_files_used: sourceFilesUsed(),
  rows: flowSignals.map(({ sector_id, ...row }) => row)
};

const flowReport = {
  module_id: "flow_channel_report_v0_10_51",
  as_of: asOf,
  generated_at: flowSignalFile.generated_at,
  source_files_used: sourceFilesUsed(),
  source_row_count: sourceRows.length,
  mapped_pool_count: mappedSignals.length,
  unmapped_row_count: unmappedRows.length,
  source_backed_flow_count: sourceBackedCount,
  estimated_from_source_count: estimatedCount,
  missing_flow_count: missingCount,
  coverage_ratio: flowSignals.length ? round((sourceBackedCount + estimatedCount) / flowSignals.length) : 0,
  mapping_method: "direct_etf rows from pool_instrument_map.json mapped by instrument_code; proxy flow remains missing",
  unmapped_examples: unmappedRows.slice(0, 5).map((row) => ({
    sector_id: row.sector_id,
    name: row.name,
    fund_code: row.fund_code,
    reason: "source sector_id did not match an observation pool sector_id"
  })),
  boundary_notes: [
    "Flow channel uses representative ETF estimated_flow from provider-backed artifacts when available.",
    "Mapped rows are estimated_from_source because the available field is estimated_flow, not exact capital movement.",
    "Unmapped pools remain missing or unavailable; no values are fabricated."
  ]
};

applyFlowSignals(snapshot, flowSignals);

await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
await writeFile(resolve(dataDir, "pool_flow_signals.json"), `${JSON.stringify(flowSignalFile, null, 2)}\n`, "utf8");
await writeFile(resolve(dataDir, "flow_channel_report.json"), `${JSON.stringify(flowReport, null, 2)}\n`, "utf8");

console.log(`Flow channel written: ${mappedSignals.length}/${flowSignals.length} pools mapped`);

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw error;
  }
}

function sourceFilesUsed() {
  const files = ["pool_instrument_map.json", sourceFile];
  if (upstream) files.push(`tools/financial-pond-framework/model_outputs/${asOf}/${upstreamFile}`);
  return files;
}

function poolFlowSignal(pool, source, mapping) {
  const existing = pool.signals?.flow ?? {};
  if (!source) {
    return {
      sector_id: pool.sector_id,
      pool_id: pool.pool_id ?? pool.id ?? pool.sector_id ?? "unknown",
      pool_name: pool.pool_name ?? pool.name ?? pool.pool_id ?? "unknown",
      flow_status: leaderboard ? "missing" : "unavailable",
      flow_value: null,
      flow_direction: "neutral",
      flow_magnitude: 0,
      flow_confidence: 0,
      source_type: leaderboard ? "not_mapped" : "source_unavailable",
      source_file: leaderboard ? sourceFile : null,
      evidence_count: 0,
      freshness: asOf === snapshot?.as_of ? "current_snapshot" : "unknown",
      boundary: leaderboard ? "source unavailable for this pool" : "source unavailable",
      reason: mapping && !["direct_etf", "direct_index"].includes(mapping.mapping_status)
        ? "Instrument proxy is not used for flow because the relationship is not direct."
        : leaderboard ? "No provider-backed representative ETF row matched this observation pool." : "Flow source file is not available."
    };
  }

  const value = numberOrNull(source.estimated_flow);
  const status = source.flow_status === "source_backed" ? "source_backed" : "estimated_from_source";
  return {
    sector_id: pool.sector_id,
    pool_id: pool.pool_id ?? pool.id ?? pool.sector_id ?? "unknown",
    pool_name: pool.pool_name ?? source.name ?? pool.pool_id ?? "unknown",
    flow_status: status,
    flow_value: value,
    flow_direction: source.estimated_flow_direction ?? directionFor(value),
    flow_magnitude: magnitudeFor(value, sourceRows),
    flow_confidence: status === "source_backed" ? 0.82 : 0.72,
    source_type: "akshare_provider_estimated_flow",
    source_file: sourceFile,
    evidence_count: evidenceCount(source),
    freshness: asOf === leaderboard?.as_of ? "current" : "stale",
    boundary: status === "source_backed" ? "source-backed observation" : "source-backed estimate",
    fund_code: source.fund_code,
    fund_name: source.fund_name,
    amount: numberOrNull(source.amount),
    reason: "Representative ETF estimated_flow from AKShare provider-backed flow artifacts."
  };
}

function applyFlowSignals(targetSnapshot, signals) {
  const byPool = new Map(signals.map((row) => [row.pool_id, row]));
  const counts = {};
  for (const row of targetSnapshot.rows ?? []) {
    const flow = byPool.get(row.pool_id);
    if (!flow) continue;
    row.signals ??= {};
    row.signals.flow = {
      slot: "flow",
      reality: flow.flow_status,
      value: flow.flow_value,
      score: flow.flow_value,
      label: flow.flow_status,
      source_file: flow.source_file ?? "pool_flow_signals.json",
      source_type: flow.source_type,
      trace_id: `flow.channel.${normalizeSectorId(row.sector_id)}`,
      trace_status: flow.flow_status === "missing" || flow.flow_status === "unavailable" ? "missing" : "available",
      boundary: flow.boundary,
      reason: flow.reason
    };
    row.signal_matrix_row ??= {};
    row.signal_matrix_row.flow = flow.flow_status;
    row.vector_forecast ??= {};
    row.vector_forecast.F = flow.flow_value;
    row.vector_forecast.direction = directionFor(flow.flow_value);
    row.vector_forecast.magnitude = flow.flow_magnitude;
    row.vector_forecast.confidence = Math.max(numberOrNull(row.vector_forecast.confidence) ?? 0, flow.flow_confidence * 0.42);
    row.vector_forecast.trace_id = `flow.channel.${normalizeSectorId(row.sector_id)}`;
    row.vector_forecast.trace_status = row.signals.flow.trace_status;
    counts[flow.flow_status] = (counts[flow.flow_status] ?? 0) + 1;
  }
  targetSnapshot.counts = countSignalRealities(targetSnapshot.rows ?? []);
  targetSnapshot.flow_channel = {
    module_id: "flow_channel_report_v0_10_51",
    source_backed_flow_count: sourceBackedCount,
    estimated_from_source_count: estimatedCount,
    missing_flow_count: missingCount,
    coverage_ratio: flowReport.coverage_ratio
  };
}

function countSignalRealities(rows) {
  const counts = {};
  for (const row of rows) {
    for (const signal of Object.values(row.signals ?? {})) {
      const key = signal?.reality ?? "missing";
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

function normalizeSectorId(value) {
  return String(value ?? "").replace(/^a_share_/, "");
}

function directionFor(value) {
  const number = numberOrNull(value);
  if (number === null || number === 0) return "neutral";
  return number > 0 ? "inward" : "outward";
}

function magnitudeFor(value, rows) {
  const number = Math.abs(numberOrNull(value) ?? 0);
  const max = Math.max(...rows.map((row) => Math.abs(numberOrNull(row.estimated_flow) ?? 0)), 0);
  return max ? round(number / max) : 0;
}

function evidenceCount(source) {
  return ["fund_code", "amount", "estimated_flow", "estimated_flow_rank"].filter((key) => source[key] !== undefined && source[key] !== null).length;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return Number(value.toFixed(4));
}
