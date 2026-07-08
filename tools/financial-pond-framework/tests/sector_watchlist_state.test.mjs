import test from "node:test";
import assert from "node:assert/strict";
import { buildSectorWatchlistState } from "../src/tools/sector_watchlist_state.mjs";

const baseInputs = () => ({
  dailyAnalysis: {
    as_of: "2026-07-08",
    gate_summary: { guidance_state: "watch_only" },
    tiers: {
      priority_watch: [],
      confirm_next: [
        {
          sector_id: "leader",
          name: "Leader",
          tier: "confirm_next",
          score: 0.32,
          rotation_diagnostic: { label: "领先延续", latest_role: "leader", leader_days: 3 }
        }
      ],
      avoid_watch: [
        {
          sector_id: "weak",
          name: "Weak",
          tier: "avoid_watch",
          score: -0.2,
          rotation_diagnostic: { label: "弱势延续", latest_role: "laggard", laggard_days: 3 }
        }
      ]
    }
  },
  attribution: {
    as_of: "2026-07-08",
    rows: [
      {
        sector_id: "leader",
        name: "Leader",
        daily_tier: "confirm_next",
        final_rank: 1,
        positive_reasons: ["daily strong"],
        negative_reasons: [],
        conflict_notes: ["ETF 份额变化流第一与综合日结论第一不一致，需要人工复核。"],
        signal_components: { etf_flow_rank: 2, rotation_label: "领先延续" }
      },
      {
        sector_id: "weak",
        name: "Weak",
        daily_tier: "avoid_watch",
        final_rank: 2,
        positive_reasons: [],
        negative_reasons: ["daily weak"],
        conflict_notes: [],
        signal_components: { etf_flow_rank: 3, rotation_label: "弱势延续" }
      },
      {
        sector_id: "flow_only",
        name: "Flow Only",
        daily_tier: "unranked",
        final_rank: 3,
        positive_reasons: ["flow positive"],
        negative_reasons: [],
        conflict_notes: [],
        signal_components: { etf_flow_rank: 1, rotation_label: null }
      },
      {
        sector_id: "rotation_only",
        name: "Rotation Only",
        daily_tier: "unranked",
        final_rank: 4,
        positive_reasons: ["rotation strong"],
        negative_reasons: [],
        conflict_notes: [],
        signal_components: { etf_flow_rank: 4, rotation_label: "领先延续" }
      }
    ]
  },
  etfFlowLeaderboard: {
    rows: [
      { sector_id: "leader", estimated_flow: 100, estimated_flow_rank: 2, amount: 1000, amount_rank: 1 },
      { sector_id: "weak", estimated_flow: 50, estimated_flow_rank: 3, amount: 900, amount_rank: 2 },
      { sector_id: "flow_only", estimated_flow: 200, estimated_flow_rank: 1, amount: 800, amount_rank: 3 },
      { sector_id: "rotation_only", estimated_flow: 0, estimated_flow_rank: 4, amount: 700, amount_rank: 4 }
    ]
  },
  etfReadiness: { guidance_state: "watch_only" },
  rotationHistory: {
    latest: {
      leaders: [
        { sector_id: "leader", name: "Leader", score: 0.32 },
        { sector_id: "rotation_only", name: "Rotation Only", score: 0.28 }
      ],
      laggards: [{ sector_id: "weak", name: "Weak", score: -0.2 }]
    }
  },
  moduleReview: { sectors: [] },
  flowReview: { sector_reviews: [] },
  previousWatchlist: null
});

test("watchlist state maps attribution conflicts to conflict_review", () => {
  const result = buildSectorWatchlistState({ asOf: "2026-07-08", inputs: baseInputs() });
  const row = result.rows.find((item) => item.sector_id === "leader");
  assert.equal(row.watch_state, "conflict_review");
  assert.equal(row.manual_review_required, true);
  assert.ok(result.groups.conflict_review.includes("leader"));
});

test("watchlist state maps top positive ETF flow with weak or absent daily tier to flow_only_candidate", () => {
  const result = buildSectorWatchlistState({ asOf: "2026-07-08", inputs: baseInputs() });
  const row = result.rows.find((item) => item.sector_id === "flow_only");
  assert.equal(row.watch_state, "flow_only_candidate");
  assert.ok(result.groups.flow_only_candidate.includes("flow_only"));
});

test("watchlist state maps strong rotation with zero or negative ETF flow to rotation_only_candidate", () => {
  const result = buildSectorWatchlistState({ asOf: "2026-07-08", inputs: baseInputs() });
  const row = result.rows.find((item) => item.sector_id === "rotation_only");
  assert.equal(row.watch_state, "rotation_only_candidate");
  assert.ok(result.groups.rotation_only_candidate.includes("rotation_only"));
});

test("watchlist state blocks execution boundary when guidance is watch_only", () => {
  const result = buildSectorWatchlistState({ asOf: "2026-07-08", inputs: baseInputs() });
  assert.equal(result.guidance_state, "watch_only");
  assert.ok(result.rows.every((row) => row.execution_boundary.includes("execution language blocked")));
  assert.ok(result.groups.blocked_execution.length >= result.rows.length);
});

test("watchlist state marks all rows new without a previous file", () => {
  const result = buildSectorWatchlistState({ asOf: "2026-07-08", inputs: baseInputs() });
  assert.ok(result.rows.length >= 4);
  assert.ok(result.rows.every((row) => row.state_change === "new"));
});
