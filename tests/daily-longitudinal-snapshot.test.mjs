import test from "node:test";
import assert from "node:assert/strict";
import { buildDailyLongitudinalSnapshot } from "../scripts/lib/daily-longitudinal-snapshot.mjs";

const input = {
  as_of: "2026-07-10", generated_at: "2026-07-10T09:00:00.000Z", model_version: "v0.10.67-test",
  observation_snapshot: { rows: [
    { pool_id: "direct", pool_name: "Direct", universe: "a_share", signals: { flow: { value: 0 }, price_momentum: { value: 1 } }, vector_forecast: { magnitude: 0.2, direction: "inward" } },
    { pool_id: "proxy", pool_name: "Proxy", universe: "a_share", signals: { flow: { value: null } }, vector_forecast: {} }
  ] },
  pool_observation_scores: { rows: [{ pool_id: "direct", observation_score: 9, final_score: 9, observation_tier: "strong_observe", flow_score: 0 }, { pool_id: "proxy", observation_score: 1, observation_tier: "insufficient" }] },
  pool_instrument_map: { module_id: "map_v1", rows: [{ pool_id: "direct", instrument_code: "510300", mapping_status: "direct_etf", mapping_confidence: 1 }, { pool_id: "proxy", instrument_code: "510301", mapping_status: "sector_proxy", mapping_confidence: 0.4 }] },
  pool_market_signals: { rows: [] }, pool_flow_signals: { rows: [{ pool_id: "direct", flow_value: 0, flow_status: "estimated_from_source" }, { pool_id: "proxy", flow_value: null, flow_status: "missing", reason: "unavailable" }] }, candidate_state_model: { rows: [] }, observation_candidate_ledger: { rows: [{ pool_id: "direct", main_reason: "qualified" }] }
};

test("snapshot keeps every pool, zero distinct from missing, and direct distinct from proxy", () => {
  const snapshot = buildDailyLongitudinalSnapshot(input);
  assert.equal(snapshot.row_count, 2);
  assert.equal(snapshot.rows[0].pool_id, "direct");
  assert.equal(snapshot.rows[0].flow_value, 0);
  assert.equal(snapshot.rows[1].flow_value, null);
  assert.equal(snapshot.rows[0].mapping_type, "direct");
  assert.equal(snapshot.rows[1].mapping_type, "sector_proxy");
  assert.equal(snapshot.rows[0].candidate_qualified, true);
  assert.equal(snapshot.rows[1].candidate_qualified, false);
  assert.equal("outcome_price" in snapshot.rows[0], false);
});

test("snapshot canonical content is deterministic", () => {
  assert.deepEqual(buildDailyLongitudinalSnapshot(input), buildDailyLongitudinalSnapshot(input));
});
