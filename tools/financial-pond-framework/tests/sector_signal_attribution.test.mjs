import test from "node:test";
import assert from "node:assert/strict";
import { buildSectorSignalAttribution } from "../src/tools/sector_signal_attribution.mjs";

const baseInputs = () => ({
  flowReview: {
    as_of: "2026-07-08",
    sector_reviews: [
      { sector_id: "alpha", name: "Alpha", score: 0.3 },
      { sector_id: "beta", name: "Beta", score: -0.2 }
    ]
  },
  rotationHistory: {
    latest: {
      leaders: [{ sector_id: "alpha", name: "Alpha", score: 0.3 }],
      laggards: [{ sector_id: "beta", name: "Beta", score: -0.2 }]
    }
  },
  moduleReview: {
    sectors: [
      {
        sector_id: "alpha",
        name: "Alpha",
        modules: {
          valuation: { status: "manual_seed" },
          fundamental: { status: "manual_seed" }
        },
        decision: { label: "balanced_candidate", text: "Balanced" }
      },
      {
        sector_id: "beta",
        name: "Beta",
        modules: {
          valuation: { status: "manual_seed" },
          fundamental: { status: "manual_seed" }
        },
        decision: { label: "wait_for_confirmation", text: "Wait" }
      }
    ]
  },
  etfReadiness: { guidance_state: "watch_only" },
  dailyAnalysis: {
    as_of: "2026-07-08",
    gate_summary: { guidance_state: "watch_only" },
    tiers: {
      priority_watch: [],
      confirm_next: [
        {
          sector_id: "alpha",
          name: "Alpha",
          tier: "confirm_next",
          score: 0.3,
          module_decision_label: "balanced_candidate",
          module_decision_text: "Balanced",
          rotation_diagnostic: { label: "领先待确认", latest_role: "leader", leader_days: 2 }
        }
      ],
      avoid_watch: [
        {
          sector_id: "beta",
          name: "Beta",
          tier: "avoid_watch",
          score: -0.2,
          module_decision_label: "wait_for_confirmation",
          module_decision_text: "Wait",
          rotation_diagnostic: { label: "弱势延续", latest_role: "laggard", laggard_days: 2 }
        }
      ]
    }
  },
  etfFlowLeaderboard: {
    rows: [
      { sector_id: "alpha", name: "Alpha", estimated_flow: 10, estimated_flow_rank: 1, amount: 100, amount_rank: 1 },
      { sector_id: "beta", name: "Beta", estimated_flow: -5, estimated_flow_rank: 2, amount: 80, amount_rank: 2 }
    ]
  },
  graphSnapshot: {
    results: [
      { id: "a_share_alpha", kind: "pool", score: 0.4 },
      { id: "a_share_beta", kind: "pool", score: -0.1 }
    ]
  }
});

test("sector signal attribution flags when ETF flow leader differs from daily leader", () => {
  const inputs = baseInputs();
  inputs.etfFlowLeaderboard.rows = [
    { sector_id: "beta", name: "Beta", estimated_flow: 50, estimated_flow_rank: 1, amount: 100, amount_rank: 1 },
    { sector_id: "alpha", name: "Alpha", estimated_flow: 10, estimated_flow_rank: 2, amount: 80, amount_rank: 2 }
  ];

  const result = buildSectorSignalAttribution({ asOf: "2026-07-08", inputs });

  assert.ok(result.conflicts.find((item) => item.id === "etf_flow_leader_differs_from_daily_leader"));
  assert.ok(result.rows.find((row) => row.sector_id === "alpha").conflict_notes.some((note) => note.includes("ETF 份额变化流第一")));
  assert.ok(result.rows.find((row) => row.sector_id === "beta").conflict_notes.some((note) => note.includes("ETF 份额变化流第一")));
});

test("sector signal attribution flags positive ETF flow with weak daily tier", () => {
  const inputs = baseInputs();
  inputs.etfFlowLeaderboard.rows.find((row) => row.sector_id === "beta").estimated_flow = 25;

  const result = buildSectorSignalAttribution({ asOf: "2026-07-08", inputs });

  assert.ok(result.conflicts.find((item) => item.id === "positive_flow_weak_daily_tier"));
  assert.ok(result.rows.find((row) => row.sector_id === "beta").conflict_notes.some((note) => note.includes("正向 ETF 份额变化流")));
});

test("sector signal attribution labels every row with manual review boundary", () => {
  const result = buildSectorSignalAttribution({ asOf: "2026-07-08", inputs: baseInputs() });

  assert.ok(result.rows.length >= 2);
  assert.ok(result.rows.every((row) => ["observation_only", "manual_review_required", "watch_only"].includes(row.manual_review_boundary)));
  assert.ok(result.rows.every((row) => row.manual_review_boundary));
});
