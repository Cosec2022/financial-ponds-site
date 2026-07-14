import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketResearchPrompt,
  markMarketResearchUnavailable,
  mergeMarketResearchSynthesis,
  validateMarketResearchSynthesis
} from "../scripts/lib/market-penetration-ai.mjs";

const brief = {
  schema_version: "market_penetration_report_v2",
  as_of: "2026-07-14",
  headline: "deterministic",
  market_summary: { market_regime: "中性", dominant_style: "科技成长", capital_state: "集中轮动", action_boundary: "仅观察" },
  market_facts: [{ fact_id: "f1", pool_id: "a_share_ai_computer", observed_return: 1.2 }],
  sector_state_groups: { strengthening: [], cooling: [], overheated: [], weak: [] },
  evidence_summary: { reliability: "中等", total_pool_count: 67, market_ohlcv_count: 62, flow_available_count: 62 },
  fp_cross_checks: [
    { pool_id: "a_share_ai_computer", pool_name: "AI计算机", hard_data_direction: "Cooling", agreement: "数据支持", interpretation: "hard", next_watch: "watch" },
    { pool_id: "a_share_semiconductor", pool_name: "半导体", hard_data_direction: "Overheated", agreement: "风险提醒", interpretation: "hard", next_watch: "watch" }
  ],
  warnings: []
};

const synthesis = {
  as_of: "2026-07-14",
  headline: "全球科技风险偏好仍有支撑，但A股科技拥挤度上升。",
  market_summary: { market_regime: "中性偏进攻", dominant_style: "科技成长", capital_state: "集中轮动", action_boundary: "可跟踪，不追高" },
  what_happened: [
    { statement: "事实一", confidence: "confirmed", source_ids: ["s1"] },
    { statement: "事实二", confidence: "confirmed", source_ids: ["s2"] },
    { statement: "事实三", confidence: "likely", source_ids: ["s3"] }
  ],
  why_market_moved: [
    { statement: "驱动一", mechanism: "机制一", confidence: "confirmed", source_ids: ["s1"] },
    { statement: "驱动二", mechanism: "机制二", confidence: "likely", source_ids: ["s2"] }
  ],
  a_share_transmission: [
    { nodes: ["A", "B", "C"], note: "链一", source_ids: ["s1"] },
    { nodes: ["D", "E", "F"], note: "链二", source_ids: ["s2"] }
  ],
  fp_cross_checks: [
    { pool_id: "a_share_ai_computer", pool_name: "AI计算机", external_context: "外部支持", hard_data_direction: "Cooling", agreement: "部分同向", interpretation: "解释", next_watch: "观察", source_ids: ["s1"] },
    { pool_id: "a_share_semiconductor", pool_name: "半导体", external_context: "外部支持", hard_data_direction: "Overheated", agreement: "风险冲突", interpretation: "解释", next_watch: "观察", source_ids: ["s2"] }
  ],
  tomorrow_watch: [
    { statement: "观察一", confirmation: "确认一", invalidation: "失效一", source_ids: ["s1"] },
    { statement: "观察二", confirmation: "确认二", invalidation: "失效二", source_ids: ["s2"] },
    { statement: "观察三", confirmation: "确认三", invalidation: "失效三", source_ids: ["s3"] }
  ],
  sources: [
    { source_id: "s1", title: "Source 1", publisher: "Reuters", url: "https://example.com/1", published_at: "2026-07-14", used_for: "fact" },
    { source_id: "s2", title: "Source 2", publisher: "Official", url: "https://example.com/2", published_at: "2026-07-14", used_for: "fact" },
    { source_id: "s3", title: "Source 3", publisher: "Exchange", url: "https://example.com/3", published_at: null, used_for: "context" }
  ],
  uncertainties: ["因果关系仍需后续价格验证。"]
};

test("AI market research validates and preserves deterministic FP evidence", () => {
  assert.equal(validateMarketResearchSynthesis(synthesis, brief), true);
  const merged = mergeMarketResearchSynthesis(brief, synthesis, { model: "gpt-5.6-terra", generatedAt: "2026-07-14T12:00:00Z", responseId: "resp_1" });
  assert.equal(merged.headline, synthesis.headline);
  assert.deepEqual(merged.market_facts, brief.market_facts);
  assert.deepEqual(merged.sector_state_groups, brief.sector_state_groups);
  assert.deepEqual(merged.evidence_summary, brief.evidence_summary);
  assert.equal(merged.ai_synthesis.affects_model_scores, false);
  assert.equal(merged.ai_synthesis.web_search_used, true);
  assert.equal(merged.research_sources.length, 3);
});

test("AI research prompt carries date, candidates, and non-scoring boundary", () => {
  const prompt = buildMarketResearchPrompt(brief);
  assert.match(prompt, /2026-07-14/);
  assert.match(prompt, /a_share_ai_computer/);
  assert.match(prompt, /绝不能修改、重算/);
  assert.match(prompt, /未来 3–20 个交易日/);
});

test("missing API leaves deterministic report active", () => {
  const marked = markMarketResearchUnavailable(brief, { status: "unavailable", model: "gpt-5.6-terra" });
  assert.equal(marked.headline, brief.headline);
  assert.deepEqual(marked.market_facts, brief.market_facts);
  assert.equal(marked.ai_synthesis.status, "unavailable");
  assert.equal(marked.ai_synthesis.affects_model_scores, false);
});
