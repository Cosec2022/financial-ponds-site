import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyLongitudinalSnapshot } from "../scripts/lib/daily-longitudinal-snapshot.mjs";

const base = { as_of: "2026-07-10", generated_at: "fixed", observation_snapshot: { rows: [{ pool_id: "a", pool_name: "A", signals: {}, vector_forecast: {} }, { pool_id: "b", pool_name: "B", signals: {}, vector_forecast: {} }] }, pool_observation_scores: { rows: [{ pool_id: "a", final_score: 9 }, { pool_id: "b", final_score: 9 }] }, observation_candidate_ledger: { rows: [{ pool_id: "b" }, { pool_id: "a" }] }, evening_observation_summary: { top_observation_pools: [{ pool_id: "b" }] } };

test("missing full-pool ranks remain null despite array order and score ties", () => {
  const rows = buildDailyLongitudinalSnapshot(base).rows;
  assert.equal(rows.find((row) => row.pool_id === "a").rank, null);
  assert.equal(rows.find((row) => row.pool_id === "a").rank_missing_reason, "rank_unavailable_in_published_source");
});
test("candidate ledger and Top 5 order preserve their own published semantics only", () => {
  const rows = buildDailyLongitudinalSnapshot(base).rows;
  assert.equal(rows.find((row) => row.pool_id === "b").candidate_rank, 1);
  assert.equal(rows.find((row) => row.pool_id === "a").candidate_rank, 2);
  assert.equal(rows.find((row) => row.pool_id === "b").published_top5_position, 1);
  assert.equal(rows.find((row) => row.pool_id === "a").published_top5_position, null);
});
