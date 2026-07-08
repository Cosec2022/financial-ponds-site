import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const requiredFiles = [
  ["dashboard.json", (json) => Boolean(json.entities)],
  ["general_pool_analysis.json", (json) => json.module_id === "general_pool_analysis_v0_10_11"],
  ["sector_flow_review.json", (json) => Boolean(json.data_availability?.mode) && Array.isArray(json.sector_reviews)],
  ["sector_rotation_intelligence.json", (json) => json.module_id === "sector_rotation_intelligence_v0_10_5"],
  ["sector_rotation_history.json", (json) => json.module_id === "sector_rotation_history_v0_10_19"],
  ["sector_module_review.json", (json) => json.module_id === "sector_module_review_v0_1"],
  ["etf_decision_readiness.json", (json) => json.status === "readiness_available" && Boolean(json.gates) && Boolean(json.gates.share_change_diagnostics)],
  ["data_reality_audit.json", (json) => json.status === "audit_available" && Array.isArray(json.layers)],
  ["daily_sector_analysis.json", (json) => json.status === "daily_sector_analysis_available" && Boolean(json.tiers) && Array.isArray(json.decision_gap?.checks) && Boolean(json.decision_ticket?.groups)],
  ["module_maturity_audit.json", (json) => json.status === "module_maturity_available" && Array.isArray(json.modules) && Boolean(json.recommended_mainline)],
  ["etf_flow_leaderboard.json", (json) => json.status === "leaderboard_available" && json.module_id === "etf_flow_leaderboard_v0_10_43" && Array.isArray(json.rows)],
  ["sector_signal_attribution.json", (json) => json.status === "attribution_available" && json.module_id === "sector_signal_attribution_v0_10_44" && Array.isArray(json.rows) && json.rows.every((row) => Boolean(row.manual_review_boundary))],
  ["sector_watchlist_state.json", (json) => json.status === "watchlist_state_available" && json.module_id === "sector_watchlist_state_v0_10_45" && Array.isArray(json.rows) && Boolean(json.groups)],
  ["decision_gate_ledger.json", (json) => json.status === "gate_ledger_available" && json.module_id === "decision_gate_ledger_v0_10_46" && Array.isArray(json.gates) && json.gates.every((gate) => gate.reading && gate.next_action)],
  ["index_explainability.json", (json) => json.status === "index_explainability_available" && json.module_id === "index_explainability_v0_10_47" && Array.isArray(json.indexes) && json.indexes.every((item) => item.source_files?.length && (Object.keys(item.inputs ?? {}).length || item.caveats?.length))],
  ["observation_snapshot.json", (json) => json.status === "observation_snapshot_available" && json.module_id === "observation_snapshot_v0_10_48" && Array.isArray(json.rows) && json.rows.every(validateObservationRow)],
  ["manual_review_log.json", (json) => json.module_id === "manual_review_log_v0_10_48" && Array.isArray(json.entries)],
  ["outcome_labels.json", (json) => json.module_id === "outcome_labels_v0_10_48" && Array.isArray(json.labels) && Array.isArray(json.pending) && hasOutcomeHorizons(json.pending)],
  ["daily_data_vault.json", (json) => json.status === "vault_available" && json.module_id === "daily_data_vault_v0_10_48" && Array.isArray(json.files_seen) && Array.isArray(json.files_missing) && Boolean(json.file_hashes) && Boolean(json.data_reality_summary)],
  ["flow_channel_report.json", (json) => json.module_id === "flow_channel_report_v0_10_51" && Array.isArray(json.source_files_used) && json.mapped_pool_count >= 1],
  ["pool_flow_signals.json", (json) => json.module_id === "pool_flow_signals_v0_10_51" && Array.isArray(json.rows) && json.rows.every((row) => flowStatuses.has(row.flow_status))],
  ["data_coverage_report.json", (json) => json.module_id === "data_coverage_report_v0_10_52" && Array.isArray(json.pools) && Array.isArray(json.priority_gaps) && json.total_signal_cells >= json.observed_pool_count && Boolean(json.flow_channel)],
  ["coverage_history.json", (json) => json.module_id === "coverage_history_v0_10_52" && Array.isArray(json.history)],
  ["history/latest_observation_pointer.json", validatePointer],
  ["daily_delta_report.json", (json) => json.module_id === "daily_delta_report_v0_10_52" && typeof json.comparison_available === "boolean" && Boolean(json.baseline_state)],
  ["pool_delta_signals.json", (json) => json.module_id === "pool_delta_signals_v0_10_52" && Array.isArray(json.rows) && json.rows.every((row) => deltaFlags.has(row.review_flag))],
  ["daily_delta_history.json", (json) => json.module_id === "daily_delta_history_v0_10_52" && Array.isArray(json.history)],
  ["news_review.json", (json) => Array.isArray(json.interpretation_boundary)],
  ["pond_map.json", (json) => json.schema_version === "pond_map_v2_adaptive_graph"]
];

const signalSlots = ["flow", "price_momentum", "liquidity", "rotation", "news", "valuation", "fundamental", "risk"];
const signalReality = new Set(["real_provider", "real_provider_derived", "source_backed", "estimated_from_source", "manual_seed", "mock", "fixture", "missing", "planned", "insufficient_history", "unavailable"]);
const flowStatuses = new Set(["source_backed", "estimated_from_source", "derived", "missing", "unavailable"]);
const boundaries = new Set(["observe_only", "manual_review", "blocked"]);
const deltaFlags = new Set(["insufficient_history", "changed", "stable"]);

function validatePointer(json) {
  return json.module_id === "latest_observation_pointer_v0_10_52"
    && Boolean(json.latest_as_of)
    && json.latest_path === `financial-pond/data/history/observations/${json.latest_as_of}.json`
    && json.available_snapshot_count >= 1;
}

function validateObservationRow(row) {
  return signalSlots.every((slot) => signalReality.has(row.signals?.[slot]?.reality) && row.signal_matrix_row?.[slot])
    && ["inward", "outward", "neutral"].includes(row.vector_forecast?.direction)
    && typeof row.vector_forecast?.magnitude === "number"
    && typeof row.vector_forecast?.confidence === "number"
    && boundaries.has(row.vector_forecast?.boundary)
    && (row.vector_forecast?.trace_id || row.vector_forecast?.trace_status);
}

function hasOutcomeHorizons(pending) {
  if (!pending.length) return false;
  const horizons = new Set(pending.map((item) => item.horizon));
  return ["T+1", "T+3", "T+5", "T+20"].every((horizon) => horizons.has(horizon));
}

const failures = [];

for (const [fileName, validate] of requiredFiles) {
  const filePath = resolve(root, "financial-pond", "data", fileName);
  try {
    const json = JSON.parse(await readFile(filePath, "utf8"));
    if (!validate(json)) failures.push(`${fileName}: contract check failed`);
  } catch (error) {
    failures.push(`${fileName}: ${error.message}`);
  }
}

try {
  const pointer = JSON.parse(await readFile(resolve(root, "financial-pond", "data", "history", "latest_observation_pointer.json"), "utf8"));
  const archive = JSON.parse(await readFile(resolve(root, pointer.latest_path), "utf8"));
  if (archive.module_id !== "observation_archive_v0_10_52" || archive.as_of !== pointer.latest_as_of) failures.push(`${pointer.latest_path}: archive contract check failed`);
} catch (error) {
  failures.push(`history/observations archive: ${error.message}`);
}

if (failures.length) {
  console.error("Published Financial Ponds data is incomplete:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Published Financial Ponds data complete: ${requiredFiles.length} files`);
