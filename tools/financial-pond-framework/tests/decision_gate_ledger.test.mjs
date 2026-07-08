import test from "node:test";
import assert from "node:assert/strict";
import { buildDecisionGateLedger } from "../src/tools/decision_gate_ledger.mjs";

const baseInputs = () => ({
  etfReadiness: {
    as_of: "2026-07-08",
    guidance_state: "not_ready",
    gates: {
      provider_run: "real_ok",
      provider_flow_readiness: "flow_ready",
      flow_source_reality: "mixed_observed_mock",
      market_use_confidence: "low",
      true_flow_coverage: 1,
      sample_days: 4,
      min_sample_days: 3,
      valuation_fundamental_source: "manual_seed",
      share_change_diagnostics: {
        status: "flow_ready",
        total_rows: 11,
        estimated_flow_rows: 11,
        provider_history: {
          available_dates: ["2026-07-07", "2026-07-08"],
          date_count: 2
        }
      }
    },
    progress: {
      next_unlock: {
        milestone_id: "valuation_source",
        label: "估值来源",
        reading: "估值和基本面还需要接入真实来源。"
      }
    }
  },
  watchlist: {
    guidance_state: "not_ready",
    groups: {
      confirmed_watch: ["alpha"],
      conflict_review: ["beta"],
      flow_only_candidate: [],
      rotation_only_candidate: [],
      deteriorating_watch: [],
      avoid_watch: [],
      blocked_execution: ["alpha", "beta"]
    }
  },
  attribution: {
    conflicts: [
      {
        id: "etf_flow_leader_differs_from_daily_leader",
        sectors: ["alpha", "beta"]
      }
    ]
  },
  flowLeaderboard: { rows: [{ sector_id: "alpha" }] },
  dailyAnalysis: { as_of: "2026-07-08", gate_summary: { guidance_state: "not_ready" } },
  rotationHistory: { sample_days: 4, min_required_days_for_trend: 3, trend_state: "trend_confirmed" },
  moduleReview: {
    sectors: [
      {
        sector_id: "alpha",
        modules: {
          valuation: { status: "manual_seed" },
          fundamental: { status: "manual_seed" }
        }
      }
    ]
  },
  flowReview: {},
  dataRealityAudit: { overall_reality: "mixed_non_real" },
  providerHistory: { status: "flow_gate_ready" },
  graphSnapshot: { results: [{ id: "a_share_alpha", kind: "pool", score: 0.2 }] }
});

test("decision gate ledger explains provider-ready execution-blocked state", () => {
  const payload = buildDecisionGateLedger({ asOf: "2026-07-08", inputs: baseInputs() });

  assert.equal(payload.guidance_state, "not_ready");
  assert.equal(payload.execution_state, "blocked");
  assert.equal(payload.state_consistency.provider_ready_but_execution_blocked, true);
  assert.equal(payload.gates.find((gate) => gate.gate_id === "provider_run").status, "pass");
  assert.equal(payload.gates.find((gate) => gate.gate_id === "estimated_flow_coverage").status, "pass");
  assert.equal(payload.gates.find((gate) => gate.gate_id === "true_flow_coverage").status, "pass");
});

test("decision gate ledger surfaces attribution and watchlist conflicts", () => {
  const payload = buildDecisionGateLedger({ asOf: "2026-07-08", inputs: baseInputs() });

  assert.equal(payload.gates.find((gate) => gate.gate_id === "attribution_conflict").status, "warn");
  assert.equal(payload.gates.find((gate) => gate.gate_id === "watchlist_conflict_review").status, "warn");
  assert.ok(payload.warnings.some((gate) => gate.gate_id === "watchlist_conflict_review"));
});

test("decision gate ledger blocks manual valuation and fundamental seed", () => {
  const payload = buildDecisionGateLedger({ asOf: "2026-07-08", inputs: baseInputs() });

  assert.equal(payload.gates.find((gate) => gate.gate_id === "valuation_fundamental_reality").status, "block");
  assert.ok(payload.blockers.some((gate) => gate.gate_id === "valuation_fundamental_reality"));
});

test("decision gate ledger does not emit trade-action wording", () => {
  const payload = buildDecisionGateLedger({ asOf: "2026-07-08", inputs: baseInputs() });
  const text = JSON.stringify(payload);

  assert.doesNotMatch(text, /\bbuy\b|\bsell\b|\bposition\b|买入|卖出|仓位/i);
});

test("decision gate ledger gates include reading and next action", () => {
  const payload = buildDecisionGateLedger({ asOf: "2026-07-08", inputs: baseInputs() });

  assert.ok(payload.gates.length >= 12);
  assert.ok(payload.gates.every((gate) => gate.reading && gate.next_action));
});
