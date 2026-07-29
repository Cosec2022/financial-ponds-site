import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildReviewAnalytics } from "../scripts/fp/lib/reviews.mjs";
import { validateTradingCalendar } from "../scripts/lib/trading-calendar.mjs";

const fixture = JSON.parse(await readFile(
  new URL("./fixtures/fp-model/review-sessions.json", import.meta.url),
  "utf8"
));
const calendar = validateTradingCalendar(fixture.calendar);

test("review builder produces exact-session reviewed, pending, and unavailable rows", () => {
  const result = build();
  const reviewedStructure = result.structural_state_reviews.find((row) => row.horizon === "T+1");
  const reviewedEntry = result.entry_state_reviews.find((row) => row.horizon === "T+1");
  const pending = result.entry_state_reviews.find((row) => row.horizon === "T+3");
  const unavailable = result.entry_state_reviews.find((row) => row.horizon === "T+20");

  assert.equal(reviewedStructure.review_status, "reviewed");
  assert.equal(reviewedStructure.signed_direction_persisted, true);
  assert.equal(reviewedStructure.state_transition, "major_candidate->confirmed_trend");
  assert.equal(reviewedEntry.review_status, "reviewed");
  assert.equal(reviewedEntry.etf_return_pct, 4);
  assert.equal(reviewedEntry.benchmark_return_pct, 1);
  assert.equal(reviewedEntry.excess_return_pct, 3);
  assert.equal(reviewedEntry.outcome_support, "supported");
  assert.equal(pending.review_status, "pending");
  assert.equal(pending.review_reason, "pending_not_due");
  assert.equal(unavailable.review_status, "unavailable");
  assert.equal(unavailable.review_reason, "calendar_unknown");
});

test("review builder preserves previously reviewed outcomes idempotently", () => {
  const first = build();
  const preserved = {
    ...first.entry_state_reviews.find((row) => row.horizon === "T+1"),
    review_etf_close: 9.99,
    outcome_available: true,
    review_status: "reviewed"
  };
  const second = build({ previousEntryReviews: [preserved] });
  const row = second.entry_state_reviews.find((item) => item.horizon === "T+1");
  assert.equal(row.review_etf_close, 9.99);
  assert.equal(row.migration_guard, "preserved_reviewed_outcome");
});

test("review builder marks a missing baseline decision as skipped", () => {
  const result = build({ decisionHistory: [] });
  const row = result.entry_state_reviews.find((item) => item.horizon === "T+1");
  assert.equal(row.review_status, "skipped");
  assert.equal(row.review_reason, "missing_baseline_decision");
  assert.equal(row.outcome_available, false);
});

function build(overrides = {}) {
  const assessmentHistory = [
    assessment(fixture.signal_date, 35, "major_candidate"),
    assessment(fixture.review_date, 48, "confirmed_trend")
  ];
  const decisionHistory = [decision(fixture.signal_date, "probe_only")];
  return buildReviewAnalytics({
    asOf: fixture.evaluation_date,
    assessmentHistory,
    decisionHistory,
    calendar,
    etfRows: fixture.etf_prices,
    benchmarkRows: fixture.benchmark_prices,
    previousStructuralReviews: [],
    previousEntryReviews: [],
    ...overrides
  });
}

function assessment(as_of, direction_score, structure_state) {
  return {
    as_of,
    rows: [{
      guidance_as_of: as_of,
      pool_id: fixture.pool_id,
      etf_symbol: fixture.etf_symbol,
      direction_score,
      structure_state
    }]
  };
}

function decision(as_of, entry_state) {
  return {
    as_of,
    rows: [{
      guidance_as_of: as_of,
      pool_id: fixture.pool_id,
      etf_symbol: fixture.etf_symbol,
      entry_state
    }]
  };
}
