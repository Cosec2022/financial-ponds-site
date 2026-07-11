import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadTradingCalendar, tradingSessionTarget } from "./lib/trading-calendar.mjs";
import { REVIEW_POLICY_VERSION, classifyReview, exactDatePrice, preserveReviewedOutcomes, shanghaiClock } from "./lib/review-policy.mjs";
import { loadBenchmarkConfig } from "./lib/benchmark-proxy.mjs";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const historyDir = resolve(dataDir, "history", "observations");
const ledger = await readJson(resolve(dataDir, "observation_candidate_ledger.json"));
const schedule = await readJson(resolve(dataDir, "candidate_review_schedule.json"));
const currentMarket = await readJson(resolve(dataDir, "pool_market_signals.json"));
const priceBasis = await readJson(resolve(dataDir, "candidate_price_basis.json"));
const previousOutcome = await readJsonOptional(resolve(dataDir, "candidate_outcome_reviews.json"), { rows: [] });
const tradingCalendar = await loadTradingCalendar();
const benchmarkConfig = await loadBenchmarkConfig();
const reviewNow = new Date(process.env.REVIEW_NOW ?? Date.now());
const currentAsOf = process.env.AS_OF ?? maxDate(schedule.as_of, shanghaiClock(reviewNow).date);
const archives = await readArchives();
const basisByCandidate = new Map((priceBasis.rows ?? []).map((row) => [`${row.candidate_as_of}|${row.pool_id}`, row]));
const generatedAt = new Date().toISOString();
const unavailableReasons = ["calendar_unknown", "stale_data", "missing_price", "missing_benchmark", "invalid_baseline"];
const horizons = [
  ["T+1", "review_t1_due"],
  ["T+3", "review_t3_due"],
  ["T+5", "review_t5_due"],
  ["T+20", "review_t20_due"]
];

const calculatedRows = (ledger.rows ?? []).flatMap((candidate) =>
  horizons.map(([horizon, dueField]) => reviewCandidate(candidate, horizon, candidate[dueField]))
).sort((a, b) =>
  a.candidate_as_of.localeCompare(b.candidate_as_of)
  || a.pool_id.localeCompare(b.pool_id)
  || horizonDays(a.horizon) - horizonDays(b.horizon)
);
const rows = preserveReviewedOutcomes(previousOutcome.rows ?? [], calculatedRows);
const preservedReviewedCount = rows.filter((row) => row.migration_guard === "preserved_reviewed_outcome").length;

const statusCounts = countBy(rows, "review_status");
const directionCounts = countBy(rows, "direction_result");
const dueReviewCount = rows.filter((row) => row.is_due).length;
const nextDueReviews = nextDue(rows);
const unavailableByReason = countUnavailableByReason(rows);
const report = {
  module_id: "outcome_review_report_v0_10_65",
  as_of: currentAsOf,
  generated_at: generatedAt,
  benchmark_proxy: benchmarkDisclosure(),
  total_candidates: (ledger.rows ?? []).length,
  due_review_count: dueReviewCount,
  reviewed_count: statusCounts.reviewed ?? 0,
  pending_count: statusCounts.pending ?? 0,
  unavailable_count: (statusCounts.unavailable ?? 0) + (statusCounts.skipped ?? 0),
  unavailable_by_reason: unavailableByReason,
  insufficient_count: statusCounts.skipped ?? 0,
  aligned_count: directionCounts.aligned ?? 0,
  opposite_count: directionCounts.opposite ?? 0,
  neutral_count: directionCounts.neutral ?? 0,
  reviewed_horizons: [...new Set(rows.filter((row) => row.review_status === "reviewed").map((row) => row.horizon))],
  next_due_reviews: nextDueReviews,
  boundary_notes: [
    "observe_only",
    "Future review dates remain pending.",
    "Observed returns are calculated only from archived market close values.",
    "Missing market levels or history never produce fabricated outcomes."
  ]
};
const output = {
  module_id: "candidate_outcome_reviews_v0_10_65",
  as_of: currentAsOf,
  generated_at: generatedAt,
  benchmark_proxy: benchmarkDisclosure(),
  review_policy_version: REVIEW_POLICY_VERSION,
  review_calendar_version: tradingCalendar.calendar_version,
  migration_audit: {
    preserved_reviewed_count: preservedReviewedCount,
    rule: "Previously reviewed outcomes are preserved by signal_date, pool_id, and horizon."
  },
  rows
};
const reviewHistory = {
  module_id: "candidate_review_history_v0_10_65",
  as_of: currentAsOf,
  generated_at: generatedAt,
  benchmark_proxy: benchmarkDisclosure(),
  rows: buildReviewHistory(rows),
  boundary_notes: [
    "observe_only",
    "History preserves candidate-date model state and review status.",
    "Future horizons remain pending until due date and source data are available."
  ]
};
const dueVerificationRows = rows.filter((row) => ["T+1", "T+3"].includes(row.horizon)).map((row) => ({
  as_of: row.candidate_as_of,
  candidate_as_of: row.candidate_as_of,
  signal_date: row.signal_date,
  symbol: row.symbol,
  name: row.instrument_name ?? row.pool_name,
  pool_id: row.pool_id,
  pool_name: row.pool_name,
  due_date: row.review_as_of,
  review_due_date: row.review_as_of,
  review_horizon: row.horizon,
  horizon_trading_sessions: row.horizon_trading_sessions,
  legacy_calendar_target_date: row.legacy_calendar_target_date,
  effective_review_date: row.effective_review_date,
  expected_review_price_date: row.expected_review_price_date,
  latest_available_price_date: row.latest_available_price_date,
  is_due: row.is_due,
  required_market_data_exists: row.required_market_data_exists,
  review_completed: row.review_completed,
  outcome_available: row.outcome_available,
  review_status: row.review_status,
  review_reason: row.review_reason,
  reviewed_at_data_date: row.reviewed_at_data_date,
  baseline_price: row.baseline_price,
  review_price: row.review_price,
  benchmark_symbol: row.benchmark_symbol,
  benchmark_type: row.benchmark_type,
  benchmark_baseline_date: row.benchmark_baseline_date,
  benchmark_baseline_close: row.benchmark_baseline_close,
  benchmark_review_date: row.benchmark_review_date,
  benchmark_review_close: row.benchmark_review_close,
  benchmark_mapping_status: row.benchmark_mapping_status,
  benchmark_source: row.benchmark_source,
  benchmark_missing_field: row.benchmark_missing_field,
  benchmark_latest_available_date: row.benchmark_latest_available_date,
  absolute_return: row.absolute_return,
  benchmark_return: row.benchmark_return,
  excess_return: row.excess_return,
  unavailable_reason: row.unavailable_reason,
  diagnostic_note: row.diagnostic_note,
  boundary: "observe_only; due review verification only"
}));
const dueVerification = {
  module_id: "candidate_due_review_verification_v0_10_65",
  as_of: currentAsOf,
  generated_at: generatedAt,
  benchmark_proxy: benchmarkDisclosure(),
  due_review_count: dueVerificationRows.filter((row) => row.is_due).length,
  reviewed_count: dueVerificationRows.filter((row) => row.review_status === "reviewed").length,
  pending_count: dueVerificationRows.filter((row) => row.review_status === "pending").length,
  unavailable_count: dueVerificationRows.filter((row) => ["unavailable", "skipped"].includes(row.review_status)).length,
  unavailable_by_reason: countUnavailableByReason(dueVerificationRows),
  expected_review_price_date: currentAsOf,
  latest_available_price_date: latestPriceDate(currentMarket?.rows ?? []),
  rows: dueVerificationRows,
  boundary_notes: [
    "observe_only",
    "Due reviews are explicit even when market data is unavailable.",
    "Unavailable rows are not counted as reviewed outcomes."
  ]
};

await writeJson(resolve(dataDir, "candidate_outcome_reviews.json"), output);
await writeJson(resolve(dataDir, "outcome_review_report.json"), report);
await writeJson(resolve(dataDir, "candidate_review_history.json"), reviewHistory);
await writeJson(resolve(dataDir, "candidate_due_review_verification.json"), dueVerification);
await updateSchedule(report);
console.log(`Candidate outcome reviews written: reviewed=${report.reviewed_count}, pending=${report.pending_count}, due=${report.due_review_count}`);

function reviewCandidate(candidate, horizon, reviewAsOf) {
  const horizonSessions = horizonDays(horizon);
  const target = tradingSessionTarget(tradingCalendar, candidate.as_of, horizonSessions);
  const effectiveReviewDate = target.effective_review_date;
  const base = {
    candidate_as_of: candidate.as_of,
    signal_date: candidate.as_of,
    review_as_of: effectiveReviewDate,
    effective_review_date: effectiveReviewDate,
    legacy_calendar_target_date: target.legacy_calendar_target_date,
    horizon_trading_sessions: horizonSessions,
    review_policy_version: REVIEW_POLICY_VERSION,
    review_calendar_version: tradingCalendar.calendar_version,
    calendar_known: target.calendar_known,
    calendar_unknown_reason: target.calendar_unknown_reason,
    horizon,
    pool_id: candidate.pool_id,
    pool_name: candidate.pool_name,
    original_observation_tier: candidate.observation_tier,
    original_observation_score: candidate.observation_score,
    original_direction: candidate.direction,
    original_capped_confidence: candidate.capped_confidence,
    original_evidence_quality: candidate.evidence_quality,
    original_proxy_risk: candidate.proxy_risk,
    candidate_state: candidate.candidate_state ?? "Noise",
    overheat_score: valueOrUnavailable(candidate.overheat_score),
    major_wave_score: valueOrUnavailable(candidate.major_wave_score),
    risk_gate_status: candidate.risk_gate_status ?? "insufficient_data",
    state_reason: candidate.state_reason ?? "State unavailable.",
    overheat_reason: candidate.overheat_reason ?? "Overheat unavailable.",
    major_wave_reason: candidate.major_wave_reason ?? "Major-wave unavailable.",
    risk_gate_reason: candidate.risk_gate_reason ?? "Risk gate unavailable.",
    symbol: null,
    instrument_name: null,
    review_status: "pending",
    review_reason: target.calendar_known ? "pending_not_due" : "calendar_unknown",
    outcome_available: false,
    review_completed: false,
    is_due: Boolean(effectiveReviewDate && effectiveReviewDate <= currentAsOf),
    required_market_data_exists: false,
    reviewed_at_data_date: null,
    expected_review_price_date: effectiveReviewDate,
    latest_available_price_date: null,
    benchmark_symbol: benchmarkConfig.symbol,
    benchmark_type: benchmarkConfig.benchmark_type,
    benchmark_baseline_date: null,
    benchmark_baseline_close: null,
    benchmark_review_date: null,
    benchmark_review_close: null,
    benchmark_mapping_status: "missing",
    benchmark_source: null,
    benchmark_missing_field: null,
    benchmark_latest_available_date: null,
    baseline_price: null,
    review_price: null,
    absolute_return: null,
    excess_return: null,
    unavailable_reason: null,
    diagnostic_note: target.calendar_known ? "Review state is determined by the effective trading-session date." : "Trading calendar does not cover the requested review target.",
    observed_return: null,
    benchmark_return: null,
    relative_return: null,
    direction_result: "unavailable",
    confidence_result: "not_reviewed",
    evidence_result: "not_reviewed",
    review_note: effectiveReviewDate ? `Scheduled for trading session ${effectiveReviewDate}.` : "Review target is outside calendar coverage.",
    boundary: "observe_only; outcome review only"
  };

  const basis = basisByCandidate.get(`${candidate.as_of}|${candidate.pool_id}`);
  const basisPrice = numberOrNull(basis?.baseline_price);
  const basisValid = Boolean(basis?.baseline_available && basis?.baseline_as_of === candidate.as_of && basisPrice !== null && basisPrice > 0);
  const basisFields = {
    symbol: basis?.instrument_code ?? null,
    instrument_name: basis?.instrument_name ?? candidate.pool_name,
    baseline_price: basisPrice
  };
  const baselineArchive = archives.get(candidate.as_of);
  const reviewArchive = effectiveReviewDate ? archives.get(effectiveReviewDate) : null;
  const reviewMarket = marketRow(reviewArchive, candidate.pool_id);
  const candidateReview = exactDatePrice(reviewMarket, effectiveReviewDate);
  const benchmarkBaselineRow = benchmarkRow(baselineArchive);
  const benchmarkReviewRow = benchmarkRow(reviewArchive);
  const benchmarkBaseline = exactDatePrice(benchmarkBaselineRow, candidate.as_of);
  const benchmarkReview = exactDatePrice(benchmarkReviewRow, effectiveReviewDate);
  const benchmarkMapping = [benchmarkBaselineRow, benchmarkReviewRow].find((row) =>
    row?.instrument_code === benchmarkConfig.symbol && row?.mapping_status === "mapped"
  ) ?? null;
  const benchmarkMappingAvailable = Boolean(benchmarkConfig.symbol && benchmarkConfig.pool_id);
  const policy = classifyReview({
    calendarKnown: target.calendar_known,
    effectiveReviewDate,
    now: reviewNow,
    datasetLatestDate: latestPriceDate(currentMarket?.rows ?? []),
    candidateBaselineValid: basisValid,
    candidateExactDateAvailable: candidateReview.exact,
    benchmarkMappingAvailable,
    benchmarkBaselineExactDateAvailable: benchmarkBaseline.exact,
    benchmarkReviewExactDateAvailable: benchmarkReview.exact
  });
  const benchmarkFields = {
    benchmark_symbol: benchmarkMapping?.instrument_code ?? benchmarkConfig.symbol,
    benchmark_type: benchmarkMapping?.benchmark_type ?? benchmarkConfig.benchmark_type,
    benchmark_baseline_date: benchmarkBaseline.date,
    benchmark_baseline_close: benchmarkBaseline.exact ? benchmarkBaseline.close : null,
    benchmark_review_date: benchmarkReview.date,
    benchmark_review_close: benchmarkReview.exact ? benchmarkReview.close : null,
    benchmark_mapping_status: benchmarkMapping?.mapping_status ?? "mapped",
    benchmark_source: benchmarkMapping?.source_file ?? null,
    benchmark_latest_available_date: benchmarkReview.date,
    benchmark_missing_field: benchmarkMissingField({ benchmarkMappingAvailable, benchmarkBaseline, benchmarkReview })
  };

  if (policy.review_status !== "reviewed") {
    const note = reasonText(policy.review_reason);
    return {
      ...base,
      ...basisFields,
      ...benchmarkFields,
      ...policy,
      required_market_data_exists: candidateReview.exact,
      reviewed_at_data_date: candidateReview.exact ? candidateReview.date : null,
      latest_available_price_date: latestPriceDate(currentMarket?.rows ?? []),
      review_price: candidateReview.exact ? candidateReview.close : null,
      unavailable_reason: policy.review_status === "pending" ? null : note,
      diagnostic_note: note,
      review_note: note
    };
  }

  const observedReturn = round(candidateReview.close / basisPrice - 1);
  const benchmarkReturn = round(benchmarkReview.close / benchmarkBaseline.close - 1);
  const excessReturn = round(observedReturn - benchmarkReturn);
  const directionResult = directionResultFor(candidate.direction, observedReturn);
  return {
    ...base,
    ...basisFields,
    ...benchmarkFields,
    review_status: "reviewed",
    review_reason: null,
    outcome_available: true,
    review_completed: true,
    required_market_data_exists: true,
    reviewed_at_data_date: candidateReview.date,
    latest_available_price_date: candidateReview.date,
    review_price: candidateReview.close,
    absolute_return: observedReturn,
    benchmark_return: benchmarkReturn,
    excess_return: excessReturn,
    observed_return: observedReturn,
    relative_return: excessReturn,
    direction_result: directionResult,
    confidence_result: directionResult === "aligned" ? "supported" : directionResult === "opposite" ? "not_supported" : "neutral",
    evidence_result: `${candidate.evidence_quality}_evidence_reviewed`,
    diagnostic_note: "Candidate and benchmark review prices are available.",
    review_note: `Observed return calculated from exact-date candidate and benchmark archives (${candidate.as_of} to ${effectiveReviewDate}).`,
    boundary: "observe_only; reviewed observation outcome"
  };
}

function marketRow(archive, poolId) {
  return (archive?.pool_market_signals?.rows ?? []).find((row) => row.pool_id === poolId) ?? null;
}

function directionResultFor(direction, observedReturn) {
  if (observedReturn === 0 || direction === "neutral") return "neutral";
  if ((direction === "inward" && observedReturn > 0) || (direction === "outward" && observedReturn < 0)) return "aligned";
  if (["inward", "outward"].includes(direction)) return "opposite";
  return "unavailable";
}

function nextDue(reviewRows) {
  const future = reviewRows.filter((row) => row.review_status === "pending");
  const earliest = future.map((row) => row.review_as_of).filter(Boolean).sort().at(0);
  if (!earliest) return [];
  return horizons.map(([horizon]) => ({
    date: earliest,
    horizon,
    count: future.filter((row) => row.review_as_of === earliest && row.horizon === horizon).length
  })).filter((row) => row.count > 0);
}

async function updateSchedule(reportValue) {
  const updated = {
    ...schedule,
    module_id: "candidate_review_schedule_v0_10_63",
    generated_at: generatedAt,
    reviewed_count: reportValue.reviewed_count,
    pending_count: reportValue.pending_count,
    unavailable_count: reportValue.unavailable_count,
    insufficient_count: reportValue.insufficient_count,
    next_due_reviews: reportValue.next_due_reviews
  };
  await writeJson(resolve(dataDir, "candidate_review_schedule.json"), updated);
}

function buildReviewHistory(reviewRows) {
  const grouped = new Map();
  for (const row of reviewRows) {
    const basis = basisByCandidate.get(`${row.candidate_as_of}|${row.pool_id}`) ?? {};
    const key = `${row.candidate_as_of}|${row.pool_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        as_of: row.candidate_as_of,
        symbol: basis.instrument_code ?? null,
        name: row.pool_name,
        pool_id: row.pool_id,
        baseline_price: basis.baseline_price ?? null,
        candidate_score: row.original_observation_score,
        candidate_state: row.candidate_state,
        overheat_score: row.overheat_score,
        major_wave_score: row.major_wave_score,
        risk_gate_status: row.risk_gate_status,
        state_reason: row.state_reason,
        overheat_reason: row.overheat_reason,
        major_wave_reason: row.major_wave_reason,
        risk_gate_reason: row.risk_gate_reason,
        t1_review_result: null,
        t3_review_result: null,
        t5_review_result: null,
        t20_review_result: null,
        due_review_verifications: [],
        outcome_status: "pending",
        review_notes: [],
        boundary: "observe_only; review history only"
      });
    }
    const item = grouped.get(key);
    const result = {
      signal_date: row.signal_date,
      review_horizon: row.horizon,
      horizon_trading_sessions: row.horizon_trading_sessions,
      legacy_calendar_target_date: row.legacy_calendar_target_date,
      effective_review_date: row.effective_review_date,
      review_due_date: row.review_as_of,
      reviewed_at_data_date: row.reviewed_at_data_date,
      expected_review_price_date: row.expected_review_price_date,
      latest_available_price_date: row.latest_available_price_date,
      baseline_price: row.baseline_price,
      review_price: row.review_price,
      benchmark_symbol: row.benchmark_symbol,
      benchmark_type: row.benchmark_type,
      benchmark_baseline_date: row.benchmark_baseline_date,
      benchmark_baseline_close: row.benchmark_baseline_close,
      benchmark_review_date: row.benchmark_review_date,
      benchmark_review_close: row.benchmark_review_close,
      benchmark_mapping_status: row.benchmark_mapping_status,
      benchmark_source: row.benchmark_source,
      benchmark_missing_field: row.benchmark_missing_field,
      benchmark_latest_available_date: row.benchmark_latest_available_date,
      absolute_return: row.absolute_return,
      benchmark_return: row.benchmark_return,
      excess_return: row.excess_return,
      unavailable_reason: row.unavailable_reason,
      diagnostic_note: row.diagnostic_note,
      review_as_of: row.review_as_of,
      review_status: row.review_status,
      review_reason: row.review_reason,
      outcome_available: row.outcome_available,
      observed_return: row.observed_return,
      benchmark_return: row.benchmark_return,
      relative_return: row.relative_return,
      direction_result: row.direction_result
    };
    if (row.horizon === "T+1") item.t1_review_result = result;
    if (row.horizon === "T+3") item.t3_review_result = result;
    if (row.horizon === "T+5") item.t5_review_result = result;
    if (row.horizon === "T+20") item.t20_review_result = result;
    item.review_notes.push(`${row.horizon}: ${row.review_note}`);
    if (["T+1", "T+3"].includes(row.horizon)) {
      item.due_review_verifications.push({
        as_of: row.candidate_as_of,
        signal_date: row.signal_date,
        due_date: row.review_as_of,
        review_horizon: row.horizon,
        horizon_trading_sessions: row.horizon_trading_sessions,
        legacy_calendar_target_date: row.legacy_calendar_target_date,
        effective_review_date: row.effective_review_date,
        expected_review_price_date: row.expected_review_price_date,
        latest_available_price_date: row.latest_available_price_date,
        is_due: row.is_due,
        required_market_data_exists: row.required_market_data_exists,
        review_completed: row.review_completed,
        review_status: row.review_status,
        review_reason: row.review_reason,
        unavailable_reason: row.unavailable_reason,
        diagnostic_note: row.diagnostic_note
      });
    }
    if (row.review_status === "reviewed") item.outcome_status = "reviewed";
    else if (item.outcome_status !== "reviewed" && isUnavailableStatus(row.review_status)) item.outcome_status = row.review_status;
  }
  return [...grouped.values()].sort((a, b) => a.as_of.localeCompare(b.as_of) || a.pool_id.localeCompare(b.pool_id));
}

function countUnavailableByReason(rows) {
  return unavailableReasons.reduce((counts, reason) => {
    counts[reason] = rows.filter((row) => row.review_reason === reason).length;
    return counts;
  }, {});
}

function isUnavailableStatus(status) {
  return ["unavailable", "skipped"].includes(status);
}

function benchmarkRow(archive) {
  return (archive?.pool_market_signals?.rows ?? []).find((row) => row.pool_id === benchmarkConfig.pool_id) ?? null;
}

function benchmarkDisclosure() {
  return {
    display_label: benchmarkConfig.display_label,
    symbol: benchmarkConfig.symbol,
    benchmark_type: benchmarkConfig.benchmark_type,
    role: benchmarkConfig.role,
    disclosure: benchmarkConfig.disclosure
  };
}

function benchmarkMissingField({ benchmarkMappingAvailable, benchmarkBaseline, benchmarkReview }) {
  if (!benchmarkMappingAvailable) return "benchmark_mapping";
  if (!benchmarkBaseline.exact) return benchmarkBaseline.date ? "benchmark_baseline_date_or_close" : "benchmark_baseline";
  if (!benchmarkReview.exact) return benchmarkReview.date ? "benchmark_review_date_or_close" : "benchmark_review";
  return null;
}

function reasonText(reason) {
  return ({
    pending_not_due: "Effective trading-session review date has not arrived.",
    pending_market_open: "Effective review session is still open in Asia/Shanghai.",
    awaiting_eod_data: "Market has closed; awaiting exact-date end-of-day provider data.",
    stale_data: "Provider data has not reached the effective review date.",
    missing_price: "Dataset covers the effective date, but the candidate exact-date close is missing.",
    missing_benchmark: "Benchmark mapping, signal-date baseline, or effective-date close is missing.",
    calendar_unknown: "Trading calendar does not cover the requested review target.",
    invalid_baseline: "Candidate signal-date baseline is invalid or not exact-date."
  })[reason] ?? "Review is unavailable.";
}

function latestPriceDate(rows) {
  return rows.map((row) => row.price_date ?? row.source_date).filter(Boolean).sort().at(-1) ?? null;
}

async function readArchives() {
  const result = new Map();
  const entries = await readdir(historyDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
    const archive = await readJson(resolve(historyDir, entry.name));
    result.set(archive.as_of, archive);
  }
  return result;
}

function horizonDays(value) {
  return Number(String(value).replace("T+", "")) || 0;
}

function countBy(items, field) {
  return items.reduce((counts, row) => {
    counts[row[field]] = (counts[row[field]] ?? 0) + 1;
    return counts;
  }, {});
}

function maxDate(...dates) {
  return dates.filter(Boolean).sort().at(-1);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function valueOrUnavailable(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : "unavailable";
}

function round(value) {
  return Number(value.toFixed(6));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJsonOptional(path, fallback) {
  try {
    return await readJson(path);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
