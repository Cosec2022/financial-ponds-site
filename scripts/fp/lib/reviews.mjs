import { preserveReviewedOutcomes } from "../../lib/review-policy.mjs";
import { tradingSessionTarget } from "../../lib/trading-calendar.mjs";

const HORIZONS = Object.freeze([
  ["T+1", 1],
  ["T+3", 3],
  ["T+5", 5],
  ["T+20", 20]
]);
const POSITIVE_STATES = new Set(["watch_candidate", "major_candidate", "confirmed_trend"]);
const WAITING_STATES = new Set(["wait_confirmation", "wait_pullback", "do_not_chase"]);

export function buildReviewAnalytics({
  asOf,
  assessmentHistory,
  decisionHistory,
  calendar,
  etfRows,
  benchmarkRows,
  previousStructuralReviews = [],
  previousEntryReviews = []
}) {
  const assessments = byDate(assessmentHistory);
  const decisions = byDate(decisionHistory);
  const etfPrices = priceIndex(etfRows, (row) => String(row.fund_code ?? row.symbol ?? ""));
  const benchmarkPrices = priceIndex(benchmarkRows, () => "benchmark");
  const structuralRows = [];
  const entryRows = [];

  for (const [signalDate, assessment] of assessments) {
    if (signalDate > asOf) continue;
    const decision = decisions.get(signalDate);
    const decisionByPool = new Map((decision?.rows ?? []).map((row) => [row.pool_id, row]));
    for (const baseline of assessment.rows ?? []) {
      const baselineDecision = decisionByPool.get(baseline.pool_id) ?? null;
      for (const [horizon, sessions] of HORIZONS) {
        const target = tradingSessionTarget(calendar, signalDate, sessions);
        structuralRows.push(buildStructuralRow({
          asOf, horizon, target, baseline, assessments, etfPrices, benchmarkPrices
        }));
        entryRows.push(buildEntryRow({
          asOf, horizon, target, baseline, baselineDecision, assessments, decisions, etfPrices, benchmarkPrices
        }));
      }
    }
  }

  const structural_state_reviews = preserveReviewedOutcomes(previousStructuralReviews, structuralRows);
  const entry_state_reviews = preserveReviewedOutcomes(previousEntryReviews, entryRows);
  return {
    structural_state_reviews,
    entry_state_reviews,
    status_counts: countStatuses([...structural_state_reviews, ...entry_state_reviews])
  };
}

function buildStructuralRow({ asOf, horizon, target, baseline, assessments, etfPrices, benchmarkPrices }) {
  const common = commonRow({ horizon, target, baseline, reviewType: "structural_state" });
  const availability = reviewAvailability({ asOf, target, baseline, etfPrices, benchmarkPrices });
  if (availability.review_status !== "reviewed") {
    return {
      ...common,
      ...availability,
      ...emptyStructuralOutcome(),
      baseline_direction_score: baseline.direction_score,
      baseline_structure_state: baseline.structure_state
    };
  }

  const reviewAssessment = assessments.get(target.effective_review_date);
  const reviewed = reviewAssessment?.rows?.find((row) => row.pool_id === baseline.pool_id) ?? null;
  if (!reviewed) {
    return {
      ...common,
      review_status: "unavailable",
      review_reason: "missing_target_assessment",
      outcome_available: false,
      ...emptyStructuralOutcome(),
      baseline_direction_score: baseline.direction_score,
      baseline_structure_state: baseline.structure_state
    };
  }
  const baselineSign = signed(baseline.direction_score);
  const reviewSign = signed(reviewed.direction_score);
  return {
    ...common,
    review_status: "reviewed",
    review_reason: null,
    outcome_available: true,
    baseline_direction_score: baseline.direction_score,
    baseline_structure_state: baseline.structure_state,
    review_direction_score: reviewed.direction_score,
    review_structure_state: reviewed.structure_state,
    signed_direction_persisted: baselineSign !== 0 && baselineSign === reviewSign,
    positive_state_remained_positive: POSITIVE_STATES.has(baseline.structure_state)
      ? reviewSign > 0 && POSITIVE_STATES.has(reviewed.structure_state)
      : null,
    deterioration_continued: baseline.structure_state === "deteriorating"
      ? reviewSign < 0 || reviewed.structure_state === "deteriorating"
      : null,
    state_transition: `${baseline.structure_state}->${reviewed.structure_state}`
  };
}

function buildEntryRow({
  asOf,
  horizon,
  target,
  baseline,
  baselineDecision,
  assessments,
  decisions,
  etfPrices,
  benchmarkPrices
}) {
  const common = commonRow({ horizon, target, baseline, reviewType: "entry_state" });
  if (!baselineDecision) {
    return {
      ...common,
      review_status: "skipped",
      review_reason: "missing_baseline_decision",
      outcome_available: false,
      ...emptyEntryOutcome()
    };
  }
  const availability = reviewAvailability({ asOf, target, baseline, etfPrices, benchmarkPrices });
  if (availability.review_status !== "reviewed") {
    return {
      ...common,
      baseline_entry_state: baselineDecision.entry_state,
      ...availability,
      ...emptyEntryOutcome()
    };
  }

  const signalEtf = etfPrices.get(`${baseline.etf_symbol}|${baseline.guidance_as_of}`);
  const reviewEtf = etfPrices.get(`${baseline.etf_symbol}|${target.effective_review_date}`);
  const signalBenchmark = benchmarkPrices.get(`benchmark|${baseline.guidance_as_of}`);
  const reviewBenchmark = benchmarkPrices.get(`benchmark|${target.effective_review_date}`);
  const etfReturn = percentReturn(signalEtf, reviewEtf);
  const benchmarkReturn = percentReturn(signalBenchmark, reviewBenchmark);
  const excessReturn = round(etfReturn - benchmarkReturn);
  const invalidation = invalidationThrough({
    signalDate: baseline.guidance_as_of,
    targetDate: target.effective_review_date,
    poolId: baseline.pool_id,
    assessments,
    decisions
  });
  const support = outcomeSupport(baselineDecision.entry_state, etfReturn, excessReturn, invalidation);
  return {
    ...common,
    review_status: "reviewed",
    review_reason: null,
    outcome_available: true,
    baseline_entry_state: baselineDecision.entry_state,
    baseline_etf_close: signalEtf,
    review_etf_close: reviewEtf,
    baseline_benchmark_close: signalBenchmark,
    review_benchmark_close: reviewBenchmark,
    etf_return_pct: etfReturn,
    benchmark_return_pct: benchmarkReturn,
    excess_return_pct: excessReturn,
    invalidation_occurred_before_or_on_horizon: invalidation,
    outcome_support: support.value,
    outcome_support_reason: support.reason
  };
}

function reviewAvailability({ asOf, target, baseline, etfPrices, benchmarkPrices }) {
  if (!target.calendar_known) return state("unavailable", "calendar_unknown");
  if (target.effective_review_date > asOf) return state("pending", "pending_not_due");
  const signalDate = baseline.guidance_as_of;
  const signalEtf = etfPrices.get(`${baseline.etf_symbol}|${signalDate}`);
  const reviewEtf = etfPrices.get(`${baseline.etf_symbol}|${target.effective_review_date}`);
  const signalBenchmark = benchmarkPrices.get(`benchmark|${signalDate}`);
  const reviewBenchmark = benchmarkPrices.get(`benchmark|${target.effective_review_date}`);
  if (!positive(signalEtf) || !positive(signalBenchmark)) return state("skipped", "invalid_baseline");
  if (!positive(reviewEtf)) return state("unavailable", "missing_price");
  if (!positive(reviewBenchmark)) return state("unavailable", "missing_benchmark");
  return state("reviewed", null);
}

function commonRow({ horizon, target, baseline, reviewType }) {
  return {
    review_type: reviewType,
    signal_date: baseline.guidance_as_of,
    pool_id: baseline.pool_id,
    etf_symbol: baseline.etf_symbol,
    horizon,
    horizon_trading_sessions: target.horizon_trading_sessions,
    calendar_version: target.calendar_version,
    effective_review_date: target.effective_review_date,
    calendar_known: target.calendar_known
  };
}

function invalidationThrough({ signalDate, targetDate, poolId, assessments, decisions }) {
  for (const [date, decision] of decisions) {
    if (date < signalDate || date > targetDate) continue;
    const row = decision.rows?.find((item) => item.pool_id === poolId);
    if (row?.entry_state === "invalid") return true;
  }
  for (const [date, assessment] of assessments) {
    if (date < signalDate || date > targetDate) continue;
    const row = assessment.rows?.find((item) => item.pool_id === poolId);
    if ((row?.direction_score ?? 0) < 0 || row?.structure_state === "deteriorating") return true;
  }
  return false;
}

function outcomeSupport(entryState, etfReturn, excessReturn, invalidation) {
  if (["ready_now", "probe_only"].includes(entryState)) {
    const supported = etfReturn > 0 && excessReturn > 0 && !invalidation;
    return {
      value: supported ? "supported" : "not_supported",
      reason: supported
        ? "Positive absolute and excess returns persisted without invalidation."
        : "Positive absolute/excess return or invalidation requirement was not satisfied."
    };
  }
  if (WAITING_STATES.has(entryState)) {
    const supported = invalidation || excessReturn <= 0;
    return {
      value: supported ? "supported" : "not_supported",
      reason: supported
        ? "Waiting avoided an invalidated or non-outperforming entry."
        : "The ETF subsequently outperformed without invalidation while guidance remained waiting."
    };
  }
  if (entryState === "invalid") {
    const supported = invalidation || etfReturn <= 0 || excessReturn <= 0;
    return {
      value: supported ? "supported" : "not_supported",
      reason: supported
        ? "The invalid state was followed by invalidation, loss, or non-outperformance."
        : "The invalid row subsequently produced positive absolute and excess return."
    };
  }
  return { value: "inconclusive", reason: "Entry state has no outcome-support rule." };
}

function byDate(artifacts) {
  const result = new Map();
  for (const artifact of [...(artifacts ?? [])].sort((a, b) => String(a.as_of).localeCompare(String(b.as_of)))) {
    if (artifact?.as_of) result.set(artifact.as_of, artifact);
  }
  return result;
}

function priceIndex(rows, identity) {
  const result = new Map();
  for (const row of rows ?? []) {
    const date = String(row.date ?? row.trade_date ?? "");
    const close = numberOrNull(row.close);
    if (date && close !== null) result.set(`${identity(row)}|${date}`, close);
  }
  return result;
}

function emptyStructuralOutcome() {
  return {
    baseline_direction_score: null,
    baseline_structure_state: null,
    review_direction_score: null,
    review_structure_state: null,
    signed_direction_persisted: null,
    positive_state_remained_positive: null,
    deterioration_continued: null,
    state_transition: null
  };
}

function emptyEntryOutcome() {
  return {
    baseline_etf_close: null,
    review_etf_close: null,
    baseline_benchmark_close: null,
    review_benchmark_close: null,
    etf_return_pct: null,
    benchmark_return_pct: null,
    excess_return_pct: null,
    invalidation_occurred_before_or_on_horizon: null,
    outcome_support: null,
    outcome_support_reason: null
  };
}

function countStatuses(rows) {
  return rows.reduce((counts, row) => {
    counts[row.review_status] = (counts[row.review_status] ?? 0) + 1;
    return counts;
  }, { pending: 0, reviewed: 0, unavailable: 0, skipped: 0 });
}

function state(review_status, review_reason) {
  return { review_status, review_reason, outcome_available: review_status === "reviewed" };
}

function percentReturn(baseline, review) {
  return round((review / baseline - 1) * 100);
}

function signed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.sign(number) : 0;
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

export { HORIZONS };
