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
  ["etf_flow_leaderboard.json", (json) => json.module_id === "etf_flow_leaderboard_v0_10_43" && Array.isArray(json.rows) && (
    json.status === "leaderboard_available" || (json.status === "no_provider_rows" && json.rows.length === 0 && json.readiness?.data_readiness === "no_rows")
  )],
  ["sector_signal_attribution.json", (json) => json.status === "attribution_available" && json.module_id === "sector_signal_attribution_v0_10_44" && Array.isArray(json.rows) && json.rows.every((row) => Boolean(row.manual_review_boundary))],
  ["sector_watchlist_state.json", (json) => json.status === "watchlist_state_available" && json.module_id === "sector_watchlist_state_v0_10_45" && Array.isArray(json.rows) && Boolean(json.groups)],
  ["decision_gate_ledger.json", (json) => json.status === "gate_ledger_available" && json.module_id === "decision_gate_ledger_v0_10_46" && Array.isArray(json.gates) && json.gates.every((gate) => gate.reading && gate.next_action)],
  ["index_explainability.json", (json) => json.status === "index_explainability_available" && json.module_id === "index_explainability_v0_10_47" && Array.isArray(json.indexes) && json.indexes.every((item) => item.source_files?.length && (Object.keys(item.inputs ?? {}).length || item.caveats?.length))],
  ["observation_snapshot.json", (json) => json.status === "observation_snapshot_available" && json.module_id === "observation_snapshot_v0_10_48" && Array.isArray(json.rows) && json.rows.every(validateObservationRow)],
  ["manual_review_log.json", (json) => json.module_id === "manual_review_log_v0_10_48" && Array.isArray(json.entries)],
  ["outcome_labels.json", (json) => json.module_id === "outcome_labels_v0_10_48" && Array.isArray(json.labels) && Array.isArray(json.pending) && hasOutcomeHorizons(json.pending)],
  ["daily_data_vault.json", (json) => json.status === "vault_available" && json.module_id === "daily_data_vault_v0_10_48" && Array.isArray(json.files_seen) && Array.isArray(json.files_missing) && Boolean(json.file_hashes) && Boolean(json.data_reality_summary)],
  ["flow_channel_report.json", (json) => json.module_id === "flow_channel_report_v0_10_51" && Array.isArray(json.source_files_used) && (
    json.mapped_pool_count >= 1 || (json.mapped_pool_count === 0 && json.estimated_from_source_count === 0 && json.source_backed_flow_count === 0)
  )],
  ["pool_flow_signals.json", (json) => json.module_id === "pool_flow_signals_v0_10_51" && Array.isArray(json.rows) && json.rows.every((row) => flowStatuses.has(row.flow_status))],
  ["pool_instrument_map.json", (json) => json.module_id === "pool_instrument_map_v0_10_54" && Array.isArray(json.rows) && json.rows.every(validateInstrumentMapping)],
  ["pool_mapping_report.json", (json) => json.module_id === "pool_mapping_report_v0_10_54" && json.total_pool_count >= 1 && json.mapping_coverage_ratio > 0],
  ["market_signal_report.json", (json) => json.module_id === "market_signal_report_v0_10_54" && json.source_files_used.includes("financial-pond/data/pool_instrument_map.json") && (
    json.mapped_pool_count >= 1 || (json.mapped_pool_count === 0 && json.momentum_signal_count === 0 && json.liquidity_signal_count === 0)
  )],
  ["pool_market_signals.json", (json) => json.module_id === "pool_market_signals_v0_10_55" && Array.isArray(json.rows) && json.rows.every(validateMarketSignal)],
  ["signal_quality_report.json", (json) => json.module_id === "signal_quality_report_v0_10_55" && (
    json.confidence_cap_applied_count >= 1 || (json.confidence_cap_applied_count === 0 && json.high_quality_signal_count === 0 && json.medium_quality_signal_count === 0 && json.low_quality_signal_count === 0)
  )],
  ["pool_signal_quality.json", (json) => json.module_id === "pool_signal_quality_v0_10_55" && Array.isArray(json.rows) && json.rows.every(validateSignalQuality)],
  ["evening_observation_summary.json", (json) => json.module_id === "evening_observation_summary_v0_10_61" && json.observation_state === "observe_only" && Array.isArray(json.top_observation_pools) && json.top_observation_pools.every((row) => row.boundary?.includes("observe_only"))],
  ["pool_observation_scores.json", (json) => json.module_id === "pool_observation_scores_v0_10_61" && Array.isArray(json.rows) && json.rows.every(validateObservationScore)],
  ["observation_candidate_ledger.json", (json) => json.module_id === "observation_candidate_ledger_v0_10_61" && Array.isArray(json.rows) && json.rows.every(validateCandidate)],
  ["score_calibration_report.json", (json) => json.module_id === "score_calibration_report_v0_10_57" && Array.isArray(json.suspicious_distribution_flags) && Array.isArray(json.score_distribution)],
  ["candidate_state_model.json", validateCandidateStateModel],
  ["candidate_review_schedule.json", (json) => json.module_id === "candidate_review_schedule_v0_10_63" && Boolean(json.next_review_dates) && Array.isArray(json.next_due_reviews) && (
    json.candidate_count >= 1 || (json.candidate_count === 0 && Object.values(json.next_review_dates).every((dates) => Array.isArray(dates) && dates.length === 0))
  )],
  ["candidate_outcome_reviews.json", validateOutcomeReviews],
  ["outcome_review_report.json", (json) => ["outcome_review_report_v0_10_64", "outcome_review_report_v0_10_65"].includes(json.module_id) && typeof json.reviewed_count === "number" && typeof json.pending_count === "number" && typeof json.unavailable_count === "number" && Boolean(json.unavailable_by_reason) && Array.isArray(json.next_due_reviews)],
  ["candidate_due_review_verification.json", validateDueReviewVerification],
  ["candidate_price_basis.json", validateCandidatePriceBasis],
  ["review_readiness_report.json", (json) => json.module_id === "review_readiness_report_v0_10_61" && readinessStates.has(json.readiness_state) && json.candidate_count === json.baseline_available_count + json.baseline_missing_count],
  ["candidate_review_history.json", validateCandidateReviewHistory],
  ["candidate_review_analytics.json", validateCandidateReviewAnalytics],
  ["data_coverage_report.json", (json) => json.module_id === "data_coverage_report_v0_10_55" && Array.isArray(json.pools) && Array.isArray(json.priority_gaps) && json.total_signal_cells >= json.observed_pool_count && Boolean(json.flow_channel) && Boolean(json.market_channel) && Boolean(json.quality)],
  ["coverage_history.json", (json) => json.module_id === "coverage_history_v0_10_55" && Array.isArray(json.history)],
  ["history/latest_observation_pointer.json", validatePointer],
  ["daily_delta_report.json", (json) => json.module_id === "daily_delta_report_v0_10_55" && typeof json.comparison_available === "boolean" && Boolean(json.baseline_state)],
  ["pool_delta_signals.json", (json) => json.module_id === "pool_delta_signals_v0_10_55" && Array.isArray(json.rows) && json.rows.every((row) => deltaFlags.has(row.review_flag))],
  ["daily_delta_history.json", (json) => json.module_id === "daily_delta_history_v0_10_55" && Array.isArray(json.history)],
  ["news_review.json", (json) => Array.isArray(json.interpretation_boundary)],
  ["market_penetration_brief.json", validateMarketPenetrationBrief],
  ["pond_map.json", (json) => json.schema_version === "pond_map_v2_adaptive_graph"]
];

const signalSlots = ["flow", "price_momentum", "liquidity", "rotation", "news", "valuation", "fundamental", "risk"];
const signalReality = new Set(["real_provider", "real_provider_derived", "source_backed", "estimated_from_source", "derived_from_market", "manual_seed", "mock", "fixture", "missing", "planned", "insufficient_history", "unavailable"]);
const flowStatuses = new Set(["source_backed", "estimated_from_source", "derived", "missing", "unavailable"]);
const marketStatuses = new Set(["source_backed", "derived_from_market", "estimated_from_source", "missing", "unavailable"]);
const mappingStatuses = new Set(["mapped", "direct_index", "direct_etf", "sector_proxy", "broad_proxy", "unmapped", "unavailable"]);
const proxyLevels = new Set(["exact", "close", "loose", "broad", "none"]);
const evidenceQualities = new Set(["high", "medium", "low", "unavailable"]);
const proxyRisks = new Set(["none", "low", "medium", "high"]);
const boundaries = new Set(["observe_only", "manual_review", "blocked"]);
const deltaFlags = new Set(["insufficient_history", "changed", "stable", "improved_data", "new_signal", "confidence_change"]);
const observationTiers = new Set(["strong_observe", "moderate_observe", "weak_observe", "insufficient"]);
const reviewStatuses = new Set(["pending", "review_due", "reviewed", "insufficient_data"]);
const outcomeReviewStatuses = new Set(["pending", "reviewed", "unavailable", "skipped"]);
const legacyOutcomeReviewStatuses = new Set(["pending_not_due", "reviewed", "unavailable_missing_price", "unavailable_missing_benchmark", "unavailable_market_closed", "unavailable_data_stale", "skipped_invalid_baseline"]);
const outcomeReviewReasons = new Set(["pending_not_due", "pending_market_open", "awaiting_eod_data", "stale_data", "missing_price", "missing_benchmark", "calendar_unknown", "invalid_baseline"]);
const outcomeHorizons = new Set(["T+1", "T+3", "T+5", "T+20"]);
const directionResults = new Set(["aligned", "opposite", "neutral", "unavailable"]);
const readinessStates = new Set(["ready", "partially_ready", "not_ready"]);
const candidateStates = new Set(["Noise", "Pulse", "Early Right", "Major Candidate", "Confirmed Trend", "Overheated", "Cooling", "Failed"]);
const riskGateStatuses = new Set(["pass", "caution", "block", "insufficient_data"]);

function validateMarketPenetrationBrief(json) {
  return json.schema_version === "market_penetration_brief_v1"
    && Boolean(json.as_of)
    && Boolean(json.generated_at)
    && Boolean(json.coverage_window)
    && Array.isArray(json.source_status)
    && Array.isArray(json.market_facts)
    && Array.isArray(json.official_fact_candidates)
    && Array.isArray(json.media_narratives)
    && Array.isArray(json.unsupported_narratives)
    && Array.isArray(json.repeated_or_stale_items)
    && Array.isArray(json.unexplained_moves)
    && Array.isArray(json.possible_3_20_session_implications)
    && Array.isArray(json.verified_facts)
    && Array.isArray(json.warnings)
    && json.media_narratives.every((item) => item.verification_status === "candidate" && item.evidence_status === "media_narrative")
    && json.possible_3_20_session_implications.every((item) => item.kind === "hypothesis" && item.status === "not_a_fact");
}

function validatePointer(json) {
  return json.module_id === "latest_observation_pointer_v0_10_64"
    && Boolean(json.latest_as_of)
    && json.latest_path === `financial-pond/data/history/observations/${json.latest_as_of}.json`
    && json.available_snapshot_count >= 1;
}

function validateInstrumentMapping(row) {
  return mappingStatuses.has(row.mapping_status)
    && proxyLevels.has(row.proxy_level)
    && typeof row.mapping_confidence === "number"
    && Boolean(row.pool_id)
    && Boolean(row.boundary);
}

function validateMarketSignal(row) {
  return marketStatuses.has(row.momentum_status)
    && marketStatuses.has(row.liquidity_status)
    && Boolean(row.pool_id)
    && Boolean(row.boundary)
    && row.capped_confidence?.momentum <= row.raw_confidence?.momentum
    && row.capped_confidence?.liquidity <= row.raw_confidence?.liquidity;
}

function validateSignalQuality(row) {
  return evidenceQualities.has(row.evidence_quality)
    && proxyRisks.has(row.proxy_risk)
    && row.capped_momentum_confidence <= row.raw_momentum_confidence
    && row.capped_liquidity_confidence <= row.raw_liquidity_confidence;
}

function validateObservationScore(row) {
  return observationTiers.has(row.observation_tier)
    && typeof row.observation_score === "number"
    && ["flow_score", "momentum_score", "liquidity_score", "quality_score", "delta_score", "confidence_score", "proxy_penalty", "missing_data_penalty", "final_score"].every((field) => typeof row[field] === "number")
    && row.boundary?.includes("observe_only");
}

function validateCandidate(row) {
  return observationTiers.has(row.observation_tier)
    && reviewStatuses.has(row.review_status)
    && validateStateFields(row)
    && row.boundary?.includes("observe_only")
    && Boolean(row.review_t1_due || row.review_t1_calendar_known === false)
    && Boolean(row.review_t20_due || row.review_t20_calendar_known === false);
}

function validateOutcomeReviews(json) {
  const contractKnown = ["candidate_outcome_reviews_v0_10_64", "candidate_outcome_reviews_v0_10_65"].includes(json.module_id);
  return contractKnown
    && Array.isArray(json.rows)
    && json.rows.every((row) => {
      const normalized = normalizeOutcomeState(row);
      const future = row.review_as_of > json.as_of;
      const futureSafe = !future || (
        normalized.review_status === "pending"
        && normalized.review_reason === "pending_not_due"
        && row.outcome_available === false
        && row.observed_return === null
        && row.benchmark_return === null
        && row.relative_return === null
      );
      return outcomeHorizons.has(row.horizon)
        && (outcomeReviewStatuses.has(row.review_status) || legacyOutcomeReviewStatuses.has(row.review_status))
        && (normalized.review_status === "reviewed" ? (normalized.review_reason === null || row.migration_guard === "preserved_reviewed_outcome") : outcomeReviewReasons.has(normalized.review_reason))
        && directionResults.has(row.direction_result)
        && validateStateFields(row)
        && row.boundary?.includes("observe_only")
        && validateOutcomeAvailability({ ...row, ...normalized })
        && futureSafe;
    });
}

function validateCandidatePriceBasis(json) {
  return json.module_id === "candidate_price_basis_v0_10_61"
    && Array.isArray(json.rows)
    && json.rows.length >= 1
    && json.rows.every((row) => {
      const validPrice = row.baseline_available
        ? typeof row.baseline_price === "number" && row.baseline_price > 0 && Boolean(row.baseline_price_field)
        : row.baseline_price === null;
      return Boolean(row.pool_id) && row.boundary?.includes("observe_only") && validPrice && validateStateFields(row);
    });
}

function validateCandidateStateModel(json) {
  return json.module_id === "candidate_state_model_v0_10_61"
    && json.status === "state_model_available"
    && Array.isArray(json.rows)
    && json.rows.length >= 1
    && json.rows.every((row) => validateStateFields(row) && row.boundary?.includes("observe_only"));
}

function validateCandidateReviewHistory(json) {
  return ["candidate_review_history_v0_10_64", "candidate_review_history_v0_10_65"].includes(json.module_id)
    && Array.isArray(json.rows)
    && json.rows.length >= 1
    && json.rows.every((row) => validateStateFields(row) && Array.isArray(row.due_review_verifications) && row.boundary?.includes("observe_only"));
}

function validateCandidateReviewAnalytics(json) {
  const metricOk = (value) => typeof value === "number" || value === "insufficient_sample";
  const groupOk = (row) => Boolean(row.group)
    && typeof row.sample_size === "number"
    && ["available", "insufficient_sample"].includes(row.sample_status)
    && metricOk(row.win_rate_absolute)
    && metricOk(row.win_rate_vs_benchmark)
    && metricOk(row.average_return)
    && metricOk(row.average_excess_return);
  return ["candidate_review_analytics_v0_10_64", "candidate_review_analytics_v0_10_65"].includes(json.module_id)
    && ["analytics_available", "insufficient_sample"].includes(json.status)
    && typeof json.total_reviewed === "number"
    && json.reviewed_rows === json.total_reviewed
    && typeof json.pending_rows === "number"
    && typeof json.unavailable_rows === "number"
    && validateUnavailableBreakdown(json.unavailable_by_reason)
    && typeof json.insufficient_sample_rows === "number"
    && metricOk(json.win_rate_absolute)
    && metricOk(json.win_rate_vs_benchmark)
    && metricOk(json.average_return)
    && metricOk(json.average_excess_return)
    && typeof json.failed_pulse_count === "number"
    && metricOk(json.overheated_failure_rate)
    && metricOk(json.confirmed_trend_continuation_rate)
    && metricOk(json.early_right_continuation_rate)
    && Array.isArray(json.by_candidate_state)
    && Array.isArray(json.by_risk_gate_status)
    && Array.isArray(json.by_overheat_score_bucket)
    && Array.isArray(json.by_major_wave_score_bucket)
    && json.by_candidate_state.every(groupOk)
    && json.by_risk_gate_status.every(groupOk)
    && json.by_overheat_score_bucket.every(groupOk)
    && json.by_major_wave_score_bucket.every(groupOk)
    && json.boundary_notes?.includes("observe_only");
}

function validateDueReviewVerification(json) {
  return ["candidate_due_review_verification_v0_10_64", "candidate_due_review_verification_v0_10_65"].includes(json.module_id)
    && typeof json.due_review_count === "number"
    && typeof json.reviewed_count === "number"
    && typeof json.pending_count === "number"
    && typeof json.unavailable_count === "number"
    && validateUnavailableBreakdown(json.unavailable_by_reason)
    && Array.isArray(json.rows)
    && json.rows.every((row) => {
      const normalized = normalizeOutcomeState(row);
      const unavailable = ["unavailable", "skipped"].includes(normalized.review_status);
      const dueDiagnosticsOk = !row.is_due || (
        Boolean(row.symbol || normalized.review_reason === "invalid_baseline")
        && "latest_available_price_date" in row
      );
      return ["T+1", "T+3"].includes(row.review_horizon)
        && Boolean(row.name)
        && Boolean(row.as_of)
        && Boolean(row.review_due_date || normalized.review_reason === "calendar_unknown")
        && Boolean(row.expected_review_price_date || normalized.review_reason === "calendar_unknown")
        && typeof row.is_due === "boolean"
        && typeof row.required_market_data_exists === "boolean"
        && typeof row.review_completed === "boolean"
        && (outcomeReviewStatuses.has(row.review_status) || legacyOutcomeReviewStatuses.has(row.review_status))
        && (normalized.review_status === "reviewed" ? normalized.review_reason === null : outcomeReviewReasons.has(normalized.review_reason))
        && (!unavailable || Boolean(row.unavailable_reason))
        && Boolean(row.diagnostic_note)
        && dueDiagnosticsOk
        && row.boundary?.includes("observe_only");
    });
}

function validateUnavailableBreakdown(value) {
  const current = ["calendar_unknown", "stale_data", "missing_price", "missing_benchmark", "invalid_baseline"];
  const legacy = ["unavailable_market_closed", "unavailable_missing_price", "unavailable_missing_benchmark", "unavailable_data_stale", "skipped_invalid_baseline"];
  return Boolean(value) && (current.every((key) => typeof value[key] === "number") || legacy.every((key) => typeof value[key] === "number"));
}

function normalizeOutcomeState(row) {
  if (outcomeReviewStatuses.has(row.review_status)) return { review_status: row.review_status, review_reason: row.review_reason ?? null };
  const legacyReasons = {
    pending_not_due: ["pending", "pending_not_due"],
    reviewed: ["reviewed", null],
    unavailable_market_closed: ["unavailable", "awaiting_eod_data"],
    unavailable_data_stale: ["unavailable", "stale_data"],
    unavailable_missing_price: ["unavailable", "missing_price"],
    unavailable_missing_benchmark: ["unavailable", "missing_benchmark"],
    skipped_invalid_baseline: ["skipped", "invalid_baseline"]
  };
  const [review_status = row.review_status, review_reason = row.review_reason] = legacyReasons[row.review_status] ?? [];
  return { review_status, review_reason };
}

function validateOutcomeAvailability(row) {
  if (row.review_status === "reviewed") {
    return row.outcome_available === true
      && row.review_completed === true
      && typeof row.review_price === "number"
      && typeof row.absolute_return === "number";
  }
  if (["unavailable", "skipped"].includes(row.review_status)) {
    return row.outcome_available === false
      && row.review_completed === false
      && Boolean(row.unavailable_reason);
  }
  return true;
}

function validateStateFields(row) {
  const overheatValid = typeof row.overheat_score === "number" || row.overheat_score === "unavailable";
  const majorValid = typeof row.major_wave_score === "number" || row.major_wave_score === "unavailable";
  return candidateStates.has(row.candidate_state)
    && overheatValid
    && majorValid
    && riskGateStatuses.has(row.risk_gate_status)
    && Boolean(row.state_reason)
    && Boolean(row.overheat_reason)
    && Boolean(row.major_wave_reason)
    && Boolean(row.risk_gate_reason);
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
  if (archive.module_id !== "observation_archive_v0_10_64" || archive.as_of !== pointer.latest_as_of || !archive.market_signal_report || !archive.pool_market_signals || !archive.pool_instrument_map || !archive.pool_mapping_report || !archive.signal_quality_report || !archive.pool_signal_quality || !archive.evening_observation_summary || !archive.pool_observation_scores || !archive.evening_report || !archive.observation_candidate_ledger || !archive.score_calibration_report || !archive.candidate_state_model || !archive.candidate_review_schedule || !archive.candidate_outcome_reviews || !archive.outcome_review_report || !archive.candidate_due_review_verification || !archive.candidate_price_basis || !archive.review_readiness_report || !archive.candidate_review_history || !archive.candidate_review_analytics) failures.push(`${pointer.latest_path}: archive contract check failed`);
} catch (error) {
  failures.push(`history/observations archive: ${error.message}`);
}

try {
  const markdown = await readFile(resolve(root, "financial-pond", "data", "evening_report.md"), "utf8");
  for (const heading of ["# Evening Observation Summary", "## Observation State", "## Data Readiness", "## What Improved Today", "## Top Observation Pools", "## Caution / Low Quality Pools", "## Main Data Gaps", "## Boundary"]) {
    if (!markdown.includes(heading)) failures.push(`evening_report.md: missing ${heading}`);
  }
} catch (error) {
  failures.push(`evening_report.md: ${error.message}`);
}

if (failures.length) {
  console.error("Published Financial Ponds data is incomplete:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Published Financial Ponds data complete: ${requiredFiles.length} files`);
