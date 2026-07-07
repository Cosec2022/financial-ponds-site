import test from "node:test";
import assert from "node:assert/strict";
import worker from "../dist/server/index.js";

const request = (path) => new Request(`https://financial-ponds.coseclab.dev${path}`);

test("serves the Financial Ponds clickable pond map at the site root", async () => {
  const response = await worker.fetch(request("/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /Financial Ponds/);
  assert.match(html, /资金池塘图谱/);
  assert.match(html, /数据真实性审计/);
  assert.match(html, /真实数据通道/);
  assert.match(html, /今日行业结论/);
  assert.match(html, /ETF行动准备度/);
  assert.match(html, /流入流出算法/);
  assert.match(html, /节点反馈 \/ 修改/);
});

test("serves dashboard, general pool analysis, sector review, rotation data, module review, news review, and pond map JSON", async () => {
  const dashboard = await worker.fetch(request("/data/dashboard.json"), {});
  assert.equal(dashboard.status, 200);
  assert.ok((await dashboard.json()).entities);

  const general = await worker.fetch(request("/data/general_pool_analysis.json"), {});
  assert.equal(general.status, 200);
  const generalJson = await general.json();
  assert.equal(generalJson.module_id, "general_pool_analysis_v0_10_11");
  assert.equal(generalJson.input_contract_id, "general_pool_input_contract_v0_10_9");
  assert.equal(generalJson.counts.sp500, 1);
  assert.equal(generalJson.counts.a_share_industries, 31);

  const review = await worker.fetch(request("/data/sector_flow_review.json"), {});
  assert.equal(review.status, 200);
  const reviewJson = await review.json();
  assert.ok(reviewJson.sector_reviews);
  assert.equal(reviewJson.counts.sectors, 31);
  assert.equal(reviewJson.counts.provider_mapped_representative_sectors, 11);
  assert.equal(reviewJson.counts.framework_only_sectors, 20);
  assert.ok(reviewJson.data_availability?.mode);

  const rotation = await worker.fetch(request("/data/sector_rotation_intelligence.json"), {});
  assert.equal(rotation.status, 200);
  const rotationJson = await rotation.json();
  assert.equal(rotationJson.module_id, "sector_rotation_intelligence_v0_10_5");
  assert.ok(rotationJson.leaders.length >= 1);
  assert.ok(rotationJson.data_availability?.mode);

  const rotationHistory = await worker.fetch(request("/data/sector_rotation_history.json"), {});
  assert.equal(rotationHistory.status, 200);
  const rotationHistoryJson = await rotationHistory.json();
  assert.equal(rotationHistoryJson.module_id, "sector_rotation_history_v0_10_19");
  assert.ok(rotationHistoryJson.trend_confirmations);
  assert.ok(rotationHistoryJson.sample_days >= 1);

  const moduleReview = await worker.fetch(request("/data/sector_module_review.json"), {});
  assert.equal(moduleReview.status, 200);
  const moduleReviewJson = await moduleReview.json();
  assert.equal(moduleReviewJson.module_id, "sector_module_review_v0_1");
  assert.ok(moduleReviewJson.sectors.find((row) => row.sector_id === "brokerage"));
  assert.ok(moduleReviewJson.sectors[0].modules.valuation);
  assert.ok(moduleReviewJson.sectors[0].modules.fundamental);
  assert.ok(moduleReviewJson.sectors[0].modules.flow_price);

  const etfReadiness = await worker.fetch(request("/data/etf_decision_readiness.json"), {});
  assert.equal(etfReadiness.status, 200);
  const etfReadinessJson = await etfReadiness.json();
  assert.equal(etfReadinessJson.module_id, "etf_decision_readiness_v0_2");
  assert.ok(etfReadinessJson.guidance_state);
  assert.ok(etfReadinessJson.progress?.milestones?.length >= 5);
  assert.ok(etfReadinessJson.gates?.share_change_diagnostics);

  const audit = await worker.fetch(request("/data/data_reality_audit.json"), {});
  assert.equal(audit.status, 200);
  const auditJson = await audit.json();
  assert.equal(auditJson.module_id, "data_reality_audit_v0_1");
  assert.equal(auditJson.overall_reality, "mixed_non_real");
  assert.ok(auditJson.layers.find((layer) => layer.id === "akshare_provider_doctor"));
  assert.ok(auditJson.layers.find((layer) => layer.id === "akshare_provider_run"));
  assert.ok(auditJson.layers.find((layer) => layer.id === "flow_price"));

  const dailyAnalysis = await worker.fetch(request("/data/daily_sector_analysis.json"), {});
  assert.equal(dailyAnalysis.status, 200);
  const dailyAnalysisJson = await dailyAnalysis.json();
  assert.equal(dailyAnalysisJson.module_id, "daily_sector_analysis_v0_10_35");
  assert.equal(dailyAnalysisJson.status, "daily_sector_analysis_available");
  assert.ok(dailyAnalysisJson.tiers.confirm_next);
  assert.ok(dailyAnalysisJson.gate_summary);
  assert.ok(dailyAnalysisJson.decision_gap?.checks?.length >= 5);
  assert.ok(dailyAnalysisJson.decision_ticket?.groups);

  const news = await worker.fetch(request("/data/news_review.json"), {});
  assert.equal(news.status, 200);
  assert.ok((await news.json()).interpretation_boundary);

  const pondMap = await worker.fetch(request("/data/pond_map.json"), {});
  assert.equal(pondMap.status, 200);
  const pondMapJson = await pondMap.json();
  assert.ok(pondMapJson.ponds.find((pond) => pond.id === "electric_power"));
  assert.ok(pondMapJson.keyword_groups.find((group) => group.pond_id === "electric_power"));
  assert.equal(pondMapJson.schema_version, "pond_map_v2_adaptive_graph");
  assert.ok(pondMapJson.graph_adaptation.pond_proposals.electric_power.length >= 2);
});
