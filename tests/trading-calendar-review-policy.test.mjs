import test from "node:test";
import assert from "node:assert/strict";
import { loadTradingCalendar, tradingSessionTarget, validateTradingCalendar } from "../scripts/lib/trading-calendar.mjs";
import { classifyReview, exactDatePrice, preserveReviewedOutcomes } from "../scripts/lib/review-policy.mjs";
import { compareNullableIsoDate, compareReviewDue } from "../scripts/lib/review-due-sort.mjs";

const calendar = validateTradingCalendar({
  calendar_version: "fixture-v1",
  timezone: "Asia/Shanghai",
  covered_date_range: { start: "2026-07-01", end: "2026-07-17" },
  official_closure_dates: ["2026-07-06"],
  sessions: ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"]
});

test("T+N counts explicit trading sessions across weekends and a holiday", () => {
  assert.equal(tradingSessionTarget(calendar, "2026-07-02", 1).effective_review_date, "2026-07-03");
  assert.equal(tradingSessionTarget(calendar, "2026-07-02", 3).effective_review_date, "2026-07-08");
  assert.equal(tradingSessionTarget(calendar, "2026-07-03", 1).effective_review_date, "2026-07-07");
  assert.equal(tradingSessionTarget(calendar, "2026-07-03", 3).effective_review_date, "2026-07-09");
});

test("calendar coverage unknown fails closed", () => {
  const result = tradingSessionTarget(calendar, "2026-07-17", 1);
  assert.equal(result.calendar_known, false);
  assert.equal(result.calendar_unknown_reason, "target_outside_coverage");
  assert.deepEqual(classifyReview({ calendarKnown: false }), { review_status: "unavailable", review_reason: "calendar_unknown", outcome_available: false });
});

test("review due sorting keeps calendar-unknown null targets without inventing a date", () => {
  const rows = [
    { date: null, signal_date: "2026-09-02", pool_id: "z", horizon_trading_sessions: 3, horizon: "T+3" },
    { date: "2026-08-07", signal_date: "2026-07-10", pool_id: "b", horizon_trading_sessions: 20, horizon: "T+20" },
    { date: null, signal_date: "2026-09-01", pool_id: "a", horizon_trading_sessions: 1, horizon: "T+1" }
  ].sort(compareReviewDue);
  assert.deepEqual(rows.map((row) => row.date), ["2026-08-07", null, null]);
  assert.deepEqual(rows.slice(1).map((row) => row.pool_id), ["a", "z"]);
  assert.throws(() => compareNullableIsoDate("2026-02-30", null), /Expected nullable ISO date/);
});

test("review state machine uses injected Shanghai timestamps", () => {
  const base = {
    calendarKnown: true,
    effectiveReviewDate: "2026-07-10",
    datasetLatestDate: "2026-07-10",
    candidateBaselineValid: true,
    candidateExactDateAvailable: true,
    benchmarkMappingAvailable: true,
    benchmarkBaselineExactDateAvailable: true,
    benchmarkReviewExactDateAvailable: true
  };
  assert.equal(classifyReview({ ...base, effectiveReviewDate: "2026-07-13", now: "2026-07-10T08:00:00Z" }).review_reason, "pending_not_due");
  assert.equal(classifyReview({ ...base, now: "2026-07-10T06:59:00Z" }).review_reason, "pending_market_open");
  assert.equal(classifyReview({ ...base, now: "2026-07-10T07:01:00Z", datasetLatestDate: "2026-07-09" }).review_reason, "awaiting_eod_data");
  assert.equal(classifyReview({ ...base, now: "2026-07-11T01:00:00Z", datasetLatestDate: "2026-07-09" }).review_reason, "stale_data");
  assert.equal(classifyReview({ ...base, now: "2026-07-11T01:00:00Z", candidateExactDateAvailable: false }).review_reason, "missing_price");
  assert.equal(classifyReview({ ...base, now: "2026-07-11T01:00:00Z", benchmarkReviewExactDateAvailable: false }).review_reason, "missing_benchmark");
  assert.equal(classifyReview({ ...base, now: "2026-07-11T01:00:00Z", candidateBaselineValid: false }).review_reason, "invalid_baseline");
  assert.equal(classifyReview({ ...base, now: "2026-07-11T01:00:00Z" }).review_status, "reviewed");
});

test("exact-date prices reject both stale and future fallback rows", () => {
  assert.equal(exactDatePrice({ price_date: "2026-07-10", price_close: 1.2 }, "2026-07-10").exact, true);
  assert.equal(exactDatePrice({ price_date: "2026-07-09", price_close: 1.1 }, "2026-07-10").exact, false);
  assert.equal(exactDatePrice({ price_date: "2026-07-11", price_close: 1.3 }, "2026-07-10").exact, false);
});

test("reviewed outcomes are preserved once and pending rows remain migratable", () => {
  const reviewed = { signal_date: "2026-07-09", pool_id: "p1", horizon: "T+1", review_status: "reviewed", outcome_available: true, review_price: 10 };
  const pending = { signal_date: "2026-07-10", pool_id: "p2", horizon: "T+1", review_status: "pending", outcome_available: false };
  const next = [
    { ...reviewed, review_price: 99 },
    { ...pending, effective_review_date: "2026-07-13" }
  ];
  const migrated = preserveReviewedOutcomes([reviewed, pending], next);
  assert.equal(migrated.length, 2);
  assert.equal(migrated[0].review_price, 10);
  assert.equal(migrated[0].migration_guard, "preserved_reviewed_outcome");
  assert.equal(migrated[1].effective_review_date, "2026-07-13");
});

test("both benchmark dates must be exact before a review can be reviewed", () => {
  const base = {
    calendarKnown: true,
    effectiveReviewDate: "2026-07-10",
    now: "2026-07-11T01:00:00Z",
    datasetLatestDate: "2026-07-10",
    candidateBaselineValid: true,
    candidateExactDateAvailable: true,
    benchmarkMappingAvailable: true,
    benchmarkBaselineExactDateAvailable: true,
    benchmarkReviewExactDateAvailable: true
  };
  assert.equal(classifyReview({ ...base, benchmarkBaselineExactDateAvailable: false }).review_reason, "missing_benchmark");
  assert.equal(classifyReview({ ...base, benchmarkReviewExactDateAvailable: false }).review_reason, "missing_benchmark");
  assert.equal(classifyReview(base).review_status, "reviewed");
});

test("production calendar covers the current T+20 target", async () => {
  const production = await loadTradingCalendar();
  assert.equal(production.covered_date_range.start, "2026-07-01");
  assert.equal(production.covered_date_range.end, "2026-08-31");
  assert.equal(tradingSessionTarget(production, "2026-07-10", 20).effective_review_date, "2026-08-07");
});
