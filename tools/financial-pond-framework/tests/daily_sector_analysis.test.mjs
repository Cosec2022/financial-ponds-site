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
          { sector_id: "new_energy_ev", name: "新能源车", score: -0.05, label: "neutral" }
        ]
      },
      rotationHistory: {
        trend_state: "trend_confirmed",
        sample_days: 3,
        latest: {
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
          sample_days: 2,
          market_use_confidence: "low"
        },
        progress: {
          next_unlock: { label: "份额变化流", reading: "还需要下一个交易日。" }
        },
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
  assert.equal(payload.tiers.priority_watch[0].sector_id, "brokerage");
  assert.equal(payload.tiers.priority_watch[0].reading.includes("观察项"), true);
  assert.equal(payload.tiers.avoid_watch[0].sector_id, "new_energy_ev");
  assert.match(payload.headline, /只做观察/);
});
