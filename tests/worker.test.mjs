import test from "node:test";
import assert from "node:assert/strict";
import worker from "../dist/server/index.js";

const request = (path) => new Request(`https://financial-ponds.coseclab.dev${path}`);

test("serves the Financial Ponds clickable pond map at the site root", async () => {
  const response = await worker.fetch(request("/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /Focused Workbench|Vector Workbench/);
  assert.match(html, /观察工作台/);
  assert.match(html, /Observation State/);
  assert.match(html, /Data Coverage/);
  assert.match(html, /Flow Channel/);
  assert.match(html, /Market Channel/);
  assert.match(html, /Daily Delta/);
  assert.match(html, /Baseline/);
  assert.match(html, /Signal Health/);
  assert.match(html, /Data Gap/);
  assert.match(html, /observe_only/);
  assert.match(html, /observed_pool_count/);
  assert.match(html, /pending_outcome_count/);
  assert.match(html, /execution_state/);
  assert.match(html, /今日观察/);
  assert.match(html, /信号矩阵/);
  assert.match(html, /资金矢量/);
  assert.match(html, /复盘记录/);
  assert.match(html, /高级诊断/);
  assert.match(html, /数据真实性审计/);
  assert.doesNotMatch(html, /资金池塘图谱/);
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
  assert.equal(dailyAnalysisJson.module_id, "daily_sector_analysis_v0_10_42");
  assert.equal(dailyAnalysisJson.status, "daily_sector_analysis_available");
  assert.ok(dailyAnalysisJson.tiers.confirm_next);
  const dailyRows = [
    ...(dailyAnalysisJson.tiers.priority_watch ?? []),
    ...(dailyAnalysisJson.tiers.confirm_next ?? []),
    ...(dailyAnalysisJson.tiers.avoid_watch ?? [])
  ];
  for (const row of dailyRows) {
    assert.ok("rotation_diagnostic" in row);
  }
  assert.ok(dailyAnalysisJson.gate_summary);
  assert.ok(dailyAnalysisJson.decision_gap?.checks?.length >= 5);
  assert.ok(dailyAnalysisJson.decision_ticket?.groups);

  const news = await worker.fetch(request("/data/news_review.json"), {});
  assert.equal(news.status, 200);
  assert.ok((await news.json()).interpretation_boundary);

  const maturity = await worker.fetch(request("/data/module_maturity_audit.json"), {});
  assert.equal(maturity.status, 200);
  const maturityJson = await maturity.json();
  assert.equal(maturityJson.module_id, "module_maturity_audit_v0_10_39");
  assert.ok(maturityJson.recommended_mainline);
  assert.ok(maturityJson.modules.find((row) => row.module_id === "FP-DATA-01"));

  const flowLeaderboard = await worker.fetch(request("/data/etf_flow_leaderboard.json"), {});
  assert.equal(flowLeaderboard.status, 200);
  const flowLeaderboardJson = await flowLeaderboard.json();
  assert.equal(flowLeaderboardJson.module_id, "etf_flow_leaderboard_v0_10_43");
  assert.equal(flowLeaderboardJson.status, "leaderboard_available");
  assert.ok(flowLeaderboardJson.rows.find((row) => row.sector_id === "brokerage"));

  const attribution = await worker.fetch(request("/data/sector_signal_attribution.json"), {});
  assert.equal(attribution.status, 200);
  const attributionJson = await attribution.json();
  assert.equal(attributionJson.module_id, "sector_signal_attribution_v0_10_44");
  assert.equal(attributionJson.status, "attribution_available");
  assert.ok(attributionJson.rows.length >= 1);
  assert.ok(attributionJson.rows.every((row) => row.manual_review_boundary));

  const watchlist = await worker.fetch(request("/data/sector_watchlist_state.json"), {});
  assert.equal(watchlist.status, 200);
  const watchlistJson = await watchlist.json();
  assert.equal(watchlistJson.module_id, "sector_watchlist_state_v0_10_45");
  assert.equal(watchlistJson.status, "watchlist_state_available");
  assert.ok(watchlistJson.rows.length >= 1);
  assert.ok(watchlistJson.groups);

  const gateLedger = await worker.fetch(request("/data/decision_gate_ledger.json"), {});
  assert.equal(gateLedger.status, 200);
  const gateLedgerJson = await gateLedger.json();
  assert.equal(gateLedgerJson.module_id, "decision_gate_ledger_v0_10_46");
  assert.equal(gateLedgerJson.status, "gate_ledger_available");
  assert.ok(Array.isArray(gateLedgerJson.gates));
  assert.ok(gateLedgerJson.gates.every((gate) => gate.reading && gate.next_action));

  const explainability = await worker.fetch(request("/data/index_explainability.json"), {});
  assert.equal(explainability.status, 200);
  const explainabilityJson = await explainability.json();
  assert.equal(explainabilityJson.module_id, "index_explainability_v0_10_47");
  assert.equal(explainabilityJson.status, "index_explainability_available");
  assert.ok(explainabilityJson.indexes.length >= 1);
  assert.ok(explainabilityJson.indexes.every((item) => item.source_files.length));

  const observation = await worker.fetch(request("/data/observation_snapshot.json"), {});
  assert.equal(observation.status, 200);
  const observationJson = await observation.json();
  assert.equal(observationJson.module_id, "observation_snapshot_v0_10_48");
  assert.equal(observationJson.status, "observation_snapshot_available");
  assert.ok(observationJson.rows.length >= 1);
  assert.ok(observationJson.rows.some((row) => row.signals?.flow?.reality === "estimated_from_source" || row.signals?.flow?.reality === "source_backed"));
  assert.ok(observationJson.rows.some((row) => row.signals?.price_momentum?.reality === "derived_from_market"));
  assert.ok(observationJson.rows.some((row) => row.signals?.liquidity?.reality === "derived_from_market"));
  assert.ok(observationJson.rows.every((row) => ["flow", "price_momentum", "liquidity", "rotation", "news", "valuation", "fundamental", "risk"].every((slot) => row.signals?.[slot]?.reality)));

  const manualReview = await worker.fetch(request("/data/manual_review_log.json"), {});
  assert.equal(manualReview.status, 200);
  assert.equal((await manualReview.json()).module_id, "manual_review_log_v0_10_48");

  const outcomes = await worker.fetch(request("/data/outcome_labels.json"), {});
  assert.equal(outcomes.status, 200);
  const outcomesJson = await outcomes.json();
  assert.equal(outcomesJson.module_id, "outcome_labels_v0_10_48");
  assert.ok(outcomesJson.pending.length >= 4);

  const vault = await worker.fetch(request("/data/daily_data_vault.json"), {});
  assert.equal(vault.status, 200);
  const vaultJson = await vault.json();
  assert.equal(vaultJson.module_id, "daily_data_vault_v0_10_48");
  assert.equal(vaultJson.status, "vault_available");
  assert.ok(vaultJson.files_seen.length >= 1);

  const coverage = await worker.fetch(request("/data/data_coverage_report.json"), {});
  assert.equal(coverage.status, 200);
  const coverageJson = await coverage.json();
  assert.equal(coverageJson.module_id, "data_coverage_report_v0_10_53");
  assert.ok(Array.isArray(coverageJson.pools));
  assert.ok(coverageJson.total_signal_cells >= coverageJson.observed_pool_count);
  assert.ok(Array.isArray(coverageJson.priority_gaps));
  assert.ok(coverageJson.estimated_count >= coverageJson.flow_channel.estimated_from_source_count);
  assert.ok(coverageJson.pools.some((row) => row.flow_status === "estimated"));
  assert.ok(coverageJson.market_channel.momentum_signal_count >= 1);
  assert.ok(coverageJson.market_channel.liquidity_signal_count >= 1);

  const coverageHistory = await worker.fetch(request("/data/coverage_history.json"), {});
  assert.equal(coverageHistory.status, 200);
  const coverageHistoryJson = await coverageHistory.json();
  assert.equal(coverageHistoryJson.module_id, "coverage_history_v0_10_53");
  assert.ok(Array.isArray(coverageHistoryJson.history));

  const pointer = await worker.fetch(request("/data/history/latest_observation_pointer.json"), {});
  assert.equal(pointer.status, 200);
  const pointerJson = await pointer.json();
  assert.equal(pointerJson.module_id, "latest_observation_pointer_v0_10_53");
  assert.ok(pointerJson.latest_path.endsWith(`${pointerJson.latest_as_of}.json`));

  const archive = await worker.fetch(request(`/data/history/observations/${pointerJson.latest_as_of}.json`), {});
  assert.equal(archive.status, 200);
  const archiveJson = await archive.json();
  assert.equal(archiveJson.module_id, "observation_archive_v0_10_53");
  assert.equal(archiveJson.as_of, pointerJson.latest_as_of);
  assert.ok(archiveJson.observation_snapshot);
  assert.ok(archiveJson.data_coverage_report);
  assert.ok(archiveJson.flow_channel_report);
  assert.ok(archiveJson.pool_flow_signals);
  assert.ok(archiveJson.market_signal_report);
  assert.ok(archiveJson.pool_market_signals);

  const flowChannel = await worker.fetch(request("/data/flow_channel_report.json"), {});
  assert.equal(flowChannel.status, 200);
  const flowChannelJson = await flowChannel.json();
  assert.equal(flowChannelJson.module_id, "flow_channel_report_v0_10_51");
  assert.ok(flowChannelJson.estimated_from_source_count >= 1);

  const poolFlowSignals = await worker.fetch(request("/data/pool_flow_signals.json"), {});
  assert.equal(poolFlowSignals.status, 200);
  const poolFlowSignalsJson = await poolFlowSignals.json();
  assert.equal(poolFlowSignalsJson.module_id, "pool_flow_signals_v0_10_51");
  assert.ok(poolFlowSignalsJson.rows.some((row) => row.flow_status === "estimated_from_source" || row.flow_status === "source_backed"));

  const marketChannel = await worker.fetch(request("/data/market_signal_report.json"), {});
  assert.equal(marketChannel.status, 200);
  const marketChannelJson = await marketChannel.json();
  assert.equal(marketChannelJson.module_id, "market_signal_report_v0_10_53");
  assert.ok(marketChannelJson.momentum_signal_count >= 1);
  assert.ok(marketChannelJson.liquidity_signal_count >= 1);

  const poolMarketSignals = await worker.fetch(request("/data/pool_market_signals.json"), {});
  assert.equal(poolMarketSignals.status, 200);
  const poolMarketSignalsJson = await poolMarketSignals.json();
  assert.equal(poolMarketSignalsJson.module_id, "pool_market_signals_v0_10_53");
  assert.ok(poolMarketSignalsJson.rows.some((row) => row.momentum_status === "derived_from_market"));

  const delta = await worker.fetch(request("/data/daily_delta_report.json"), {});
  assert.equal(delta.status, 200);
  const deltaJson = await delta.json();
  assert.equal(deltaJson.module_id, "daily_delta_report_v0_10_53");
  assert.equal(typeof deltaJson.comparison_available, "boolean");

  const deltaHistory = await worker.fetch(request("/data/daily_delta_history.json"), {});
  assert.equal(deltaHistory.status, 200);
  const deltaHistoryJson = await deltaHistory.json();
  assert.equal(deltaHistoryJson.module_id, "daily_delta_history_v0_10_53");
  assert.ok(deltaHistoryJson.history.length >= 1);

  const pondMap = await worker.fetch(request("/data/pond_map.json"), {});
  assert.equal(pondMap.status, 200);
  const pondMapJson = await pondMap.json();
  assert.ok(pondMapJson.ponds.find((pond) => pond.id === "electric_power"));
  assert.ok(pondMapJson.keyword_groups.find((group) => group.pond_id === "electric_power"));
  assert.equal(pondMapJson.schema_version, "pond_map_v2_adaptive_graph");
  assert.ok(pondMapJson.graph_adaptation.pond_proposals.electric_power.length >= 2);
});

test("defines the rerunnable Financial Ponds daily persistence command", async () => {
  const packageJson = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(new URL("../package.json", import.meta.url), "utf8")));
  assert.equal(packageJson.scripts["fp:daily"], "bash scripts/local/fp-daily.sh");
});
