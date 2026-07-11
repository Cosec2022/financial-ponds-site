export const REVIEW_POLICY_VERSION = "review_policy_v0_10_65";

export function classifyReview(input) {
  const {
    calendarKnown,
    effectiveReviewDate,
    now,
    datasetLatestDate,
    candidateBaselineValid,
    candidateExactDateAvailable,
    benchmarkMappingAvailable,
    benchmarkBaselineExactDateAvailable,
    benchmarkReviewExactDateAvailable
  } = input;
  if (!calendarKnown || !effectiveReviewDate) return state("unavailable", "calendar_unknown");
  if (!candidateBaselineValid) return state("skipped", "invalid_baseline");

  const clock = shanghaiClock(now);
  if (effectiveReviewDate > clock.date) return state("pending", "pending_not_due");
  if (effectiveReviewDate === clock.date && clock.minutes < 15 * 60) return state("pending", "pending_market_open");
  if ((!datasetLatestDate || datasetLatestDate < effectiveReviewDate) && effectiveReviewDate === clock.date) {
    return state("pending", "awaiting_eod_data");
  }
  if ((!datasetLatestDate || datasetLatestDate < effectiveReviewDate) && clock.date > effectiveReviewDate) {
    return state("unavailable", "stale_data");
  }
  if (!candidateExactDateAvailable) return state("unavailable", "missing_price");
  if (!benchmarkMappingAvailable || !benchmarkBaselineExactDateAvailable || !benchmarkReviewExactDateAvailable) {
    return state("unavailable", "missing_benchmark");
  }
  return state("reviewed", null);
}

export function exactDatePrice(row, expectedDate) {
  const date = row?.price_date ?? row?.source_date ?? null;
  const close = numberOrNull(row?.price_close ?? row?.market_close);
  return {
    date,
    close,
    exact: Boolean(date === expectedDate && close !== null && close > 0)
  };
}

export function preserveReviewedOutcomes(previousRows, nextRows) {
  const reviewed = new Map((previousRows ?? [])
    .filter((row) => row.review_status === "reviewed" && row.outcome_available === true)
    .map((row) => [reviewKey(row), row]));
  return (nextRows ?? []).map((row) => {
    const previous = reviewed.get(reviewKey(row));
    return previous ? { ...previous, migration_guard: "preserved_reviewed_outcome" } : row;
  });
}

export function shanghaiClock(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid review timestamp");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${byType.year}-${byType.month}-${byType.day}`, minutes: Number(byType.hour) * 60 + Number(byType.minute) };
}

function state(review_status, review_reason) {
  return { review_status, review_reason, outcome_available: review_status === "reviewed" };
}

function reviewKey(row) {
  return `${row.signal_date ?? row.candidate_as_of}|${row.pool_id}|${row.horizon}`;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
