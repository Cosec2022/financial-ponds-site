import test from "node:test";
import assert from "node:assert/strict";
import { buildIndexExplainability } from "../src/tools/index_explainability.mjs";

const inputs = {
  flowReview: {
    as_of: "2026-07-08",
    data_availability: { warnings: [] },
    sector_reviews: [
      {
        sector_id: "brokerage",
        pool_id: "a_share_brokerage",
        name: "Brokerage",
        display_name: "券商",
        score: 0.33,
        label: "constructive",
        confidence: 0.8,
        data_completeness: 0.7,
        top_drivers: [{ component: "direct_flow", contribution: 0.2 }]
      }
    ]
  },
  rotationHistory: {
    sample_days: 3,
    latest: { leaders: [{ sector_id: "brokerage", name: "券商", score: 0.33, rank: 1 }], laggards: [] },
    interpretation_boundary: ["history explanation only"]
  },
  moduleReview: { sectors: [] },
  etfReadiness: {
    as_of: "2026-07-08",
    guidance_state: "not_ready",
    gates: {
      guidance_state: "not_ready",
      provider_run: "real_ok",
      provider_flow_readiness: "flow_ready",
      flow_source_reality: "mixed_non_real",
      observed_direct_flow_inputs: 11,
      representative_sectors: 11,
      true_flow_coverage: 1,
      sample_days: 3,
      share_change_diagnostics: {
        total_rows: 11,
        latest_share_rows: 11,
        previous_share_rows: 11,
        share_change_rows: 11,
        estimated_flow_rows: 11
      },
      valuation_fundamental_source: "manual_seed"
    },
    blockers: [{ id: "manual_valuation_fundamental", reading: "manual seed still present" }],
    interpretation_boundary: ["readiness explanation only"]
  },
  dailyAnalysis: {
    as_of: "2026-07-08",
    tiers: {
      priority_watch: [
        {
          sector_id: "brokerage",
          name: "券商",
          tier: "priority_watch",
          score: 0.3338,
          current_flow_score: 0.33,
          streak_days: 3,
          readiness_score: 42,
          evidence: { observed_direct_flow: true },
          blockers: ["manual_valuation_fundamental"]
        }
      ],
      confirm_next: [],
      avoid_watch: []
    }
  },
  flowLeaderboard: {
    rows: [
      {
        sector_id: "brokerage",
        name: "券商",
        fund_code: "512000",
        amount: 1253277254,
        amount_rank: 3,
        estimated_flow: 390504407.04,
        estimated_flow_rank: 1
      }
    ]
  },
  attribution: { rows: [{ sector_id: "brokerage", name: "券商", final_rank: 1, daily_tier: "priority_watch", daily_score: 0.3338, signal_components: { etf_flow_rank: 1 } }] },
  watchlist: { groups: { confirmed_watch: ["brokerage"] }, rows: [{ sector_id: "brokerage", name: "券商", watch_state: "confirmed_watch", priority_level: "high", state_change: "new", evidence_summary: "state=confirmed_watch", positive_evidence: [], negative_evidence: [], conflict_evidence: [] }] },
  gateLedger: { gates: [{ gate_id: "provider_run", label: "Provider run", status: "pass", reading: "ok", next_action: "keep running", evidence: { provider_run: "real_ok" } }] },
  maturity: { overall: { module_count: 3, average_progress: 43.3, decision_path_progress: 50.8 }, boundary: ["project readiness only"] },
  dataRealityAudit: { overall_reality: "mixed_non_real" },
  providerHistory: { status: "flow_gate_ready" },
  providerRows: [
    {
      date: "2026-07-08",
      sector_id: "brokerage",
      latest_share: "73945235456",
      previous_share: "73208378048",
      share_change: "736857408",
      close: "0.53",
      estimated_flow: "390504407.04"
    }
  ],
  providerSectorRows: []
};

test("estimated_flow explanation includes raw share inputs, close, share_change, and formula", () => {
  const payload = buildIndexExplainability({ asOf: "2026-07-08", inputs });
  const item = payload.indexes.find((row) => row.index_id === "etf.estimated_flow.brokerage");
  assert.ok(item);
  assert.equal(item.formula_id, "provider.estimated_flow.v1");
  assert.ok("latest_share" in item.inputs);
  assert.ok("previous_share" in item.inputs);
  assert.ok("share_change" in item.inputs);
  assert.ok("close" in item.inputs);
  assert.match(item.formula.formula_human, /estimated_flow/);
});

test("guidance_state explanation includes readiness source and blockers", () => {
  const payload = buildIndexExplainability({ asOf: "2026-07-08", inputs });
  const item = payload.indexes.find((row) => row.index_id === "readiness.guidance_state");
  assert.ok(item);
  assert.ok(item.source_files.some((file) => file.includes("etf_decision_readiness.json")));
  assert.equal(item.inputs.provider_run, "real_ok");
  assert.equal(item.components[0].id, "manual_valuation_fundamental");
});

test("daily score explanation includes formula id, source files, and execution boundary", () => {
  const payload = buildIndexExplainability({ asOf: "2026-07-08", inputs });
  const item = payload.indexes.find((row) => row.index_id === "daily.score.brokerage");
  assert.ok(item);
  assert.equal(item.formula_id, "daily_sector_analysis.score_tier.v1");
  assert.ok(item.source_files.length >= 2);
  assert.ok(item.execution_boundary);
});

test("missing formula creates missing_explanations entry", () => {
  const payload = buildIndexExplainability({ asOf: "2026-07-08", inputs, formulas: [] });
  assert.ok(payload.missing_explanations.length > 0);
  assert.equal(payload.missing_explanations[0].status, "formula_registry_missing");
});

test("index explainability JSON does not emit trade-action wording", () => {
  const payload = buildIndexExplainability({ asOf: "2026-07-08", inputs });
  assert.doesNotMatch(JSON.stringify(payload), /\bbuy\b|\bsell\b|\bposition\b|买入|卖出|仓位/i);
});

test("every index has source files and either inputs or caveats", () => {
  const payload = buildIndexExplainability({ asOf: "2026-07-08", inputs });
  assert.ok(payload.indexes.length > 0);
  assert.ok(payload.indexes.every((item) => item.source_files.length > 0));
  assert.ok(payload.indexes.every((item) => Object.keys(item.inputs ?? {}).length > 0 || (item.caveats ?? []).length > 0));
});
