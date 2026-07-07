import test from "node:test";
import assert from "node:assert/strict";
import { buildDailySectorAnalysis } from "../src/tools/daily_sector_analysis.mjs";

test("daily sector analysis keeps not-ready ETF gates as observation-only tiers", () => {
  const payload = buildDailySectorAnalysis({
    asOf: "2026-07-07",
    inputs: {
      flow: {
        as_of: "2026-07-07",
        data_availability: { source_reality: "observed", market_use_confidence: "medium" },
        sector_reviews: [
          { sector_id: "brokerage", name: "券商", score: 0.28, label: "constructive_inflow_bias" },
          { sector_id: "semiconductor", name: "半导体", score: 0.2, label: "constructive_inflow_bias" },
          { sector_id: "bank_insurance", name: "Bank and Insurance", score: 0.17, label: "neutral" },
          { sector_id: "new_energy_ev", name: "新能源车", score: -0.05, label: "neutral" }
        ]
      },
      rotationHistory: {
        trend_state: "trend_confirmed",
        sample_days: 3,
        history: [
          {
            as_of: "2026-07-03",
            leaders: [
              { sector_id: "brokerage", name: "券商", score: 0.24, label: "constructive_inflow_bias" }
            ],
            laggards: [
              { sector_id: "new_energy_ev", name: "新能源车", score: -0.02, label: "neutral" }
            ]
          },
          {
            as_of: "2026-07-06",
            leaders: [
              { sector_id: "brokerage", name: "券商", score: 0.26, label: "constructive_inflow_bias" }
            ],
            laggards: [
              { sector_id: "new_energy_ev", name: "新能源车", score: -0.04, label: "neutral" }
            ]
          }
        ],
        latest: {
          as_of: "2026-07-07",
          leaders: [
            { sector_id: "brokerage", name: "券商", score: 0.28, label: "constructive_inflow_bias" },
            { sector_id: "semiconductor", name: "半导体", score: 0.2, label: "constructive_inflow_bias" }
          ],
          laggards: [
            { sector_id: "new_energy_ev", name: "新能源车", score: -0.05, label: "neutral" }
          ]
        },
        trend_confirmations: {
          persistent_leaders: [
            { sector_id: "brokerage", name: "券商", score: 0.28, label: "constructive_inflow_bias", streak_days: 3 }
          ],
          persistent_laggards: [
            { sector_id: "new_energy_ev", name: "新能源车", score: -0.05, label: "neutral", streak_days: 3 }
          ]
        }
      },
      moduleReview: {
        sectors: [
          { sector_id: "brokerage", name: "券商", modules: { valuation: { label: "fair", position_score: 0.08 }, fundamental: { label: "improving", score: 0.12 }, flow_price: { label: "constructive_inflow_bias", score: 0.28 } }, decision: { label: "balanced_candidate", text: "合理且改善" } },
          { sector_id: "new_energy_ev", name: "新能源车", modules: { valuation: { label: "fair", position_score: 0.02 }, fundamental: { label: "weak", score: -0.12 }, flow_price: { label: "neutral", score: -0.05 } }, decision: { label: "value_trap_risk", text: "便宜但基本面弱" } }
        ],
        risks: [
          { sector_id: "new_energy_ev", name: "新能源车", score: -0.05, decision: { label: "value_trap_risk", text: "便宜但基本面弱" } }
        ]
      },
      etfReadiness: {
        guidance_state: "not_ready",
        gates: {
          guidance_state: "not_ready",
          provider_run: "real_ok",
          provider_flow_readiness: "baseline_only",
          true_flow_coverage: 0,
          share_change_diagnostics: {
            status: "baseline_only",
            total_rows: 11,
            latest_share_rows: 11,
            previous_share_rows: 0,
            share_change_rows: 0,
            estimated_flow_rows: 0,
            next_unlock: "还差 11/11 只代表 ETF 的份额变化流。"
          },
          sample_days: 2,
          market_use_confidence: "low"
        },
        progress: {
          next_unlock: { label: "份额变化流", reading: "还需要下一个交易日。" }
        },
        blockers: [
          { id: "manual_valuation_fundamental", reading: "估值或基本面仍是手工种子。" }
        ],
        sectors: [
          { sector_id: "brokerage", readiness_score: 42, action: { label: "wait_for_real_flow", text: "等真实资金流" }, evidence: { observed_direct_flow: false, observed_price_volume: true }, blockers: ["baseline_only"] }
        ]
      },
      realityAudit: {
        overall_reality: "observed_pipeline"
      }
    }
  });

  assert.equal(payload.status, "daily_sector_analysis_available");
  assert.equal(payload.analysis_mode, "analysis_only");
  assert.equal(payload.gate_summary.provider_flow_readiness, "baseline_only");
  assert.equal(payload.gate_summary.sample_days, 3);
  assert.equal(payload.decision_gap.status, "blocked");
  assert.deepEqual(payload.decision_gap.passed_checks, ["provider_run", "trend_history", "source_reality"]);
  assert.deepEqual(payload.decision_gap.blocked_checks, ["share_change_flow", "valuation_fundamental"]);
  assert.match(payload.decision_gap.checks.find((item) => item.id === "share_change_flow").reading, /previous_share/);
  assert.equal(payload.decision_ticket.status, "watchlist_ready");
  assert.match(payload.decision_ticket.summary, /券商/);
  assert.equal(payload.decision_ticket.groups.priority_watch[0].sector_id, "brokerage");
  assert.equal(payload.decision_ticket.groups.priority_watch[0].ticket_label, "优先观察");
  assert.ok(payload.decision_ticket.groups.priority_watch[0].upgrade_conditions.some((item) => item.includes("份额变化流")));
  assert.ok(payload.decision_ticket.groups.priority_watch[0].failure_conditions.some((item) => item.includes("estimated_flow")));
  assert.equal(payload.decision_ticket.groups.avoid_watch[0].ticket_label, "回避观察");
  assert.equal(payload.tiers.priority_watch[0].sector_id, "brokerage");
  assert.equal(payload.tiers.priority_watch[0].rotation_diagnostic.state, "leader_continuation");
  assert.match(payload.tiers.priority_watch[0].rotation_diagnostic.reading, /领先延续/);
  assert.equal(payload.tiers.priority_watch[0].reading.includes("观察项"), true);
  assert.match(payload.tiers.priority_watch[0].reading, /轮动标签：领先延续/);
  assert.equal(payload.tiers.confirm_next.find((row) => row.sector_id === "bank_insurance").name, "银行保险");
  assert.equal(payload.tiers.avoid_watch[0].sector_id, "new_energy_ev");
  assert.equal(payload.tiers.avoid_watch[0].rotation_diagnostic.state, "laggard_continuation");
  assert.match(payload.headline, /只做观察/);
});
