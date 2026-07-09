import test from "node:test";
import assert from "node:assert/strict";
import worker from "../dist/server/index.js";

const request = (path) => new Request(`https://financial-ponds.coseclab.dev${path}`);

test("serves the Financial Ponds clickable pond map at the site root", async () => {
  const response = await worker.fetch(request("/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /v0\.10\.59 Observation Dashboard/);
  assert.match(html, /Today Status/);
  assert.match(html, /Observation Candidates/);
  assert.match(html, /Selected Candidate/);
  assert.match(html, /Evidence Quality/);
  assert.match(html, /Review Schedule/);
  assert.match(html, /Outcome Review/);
  assert.match(html, /observe_only/);
  assert.match(html, /Advanced Diagnostics/);
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
  assert.ok(observationJson.rows.filter((row) => row.signals?.price_momentum?.raw_confidence > 0).every((row) => row.signals.price_momentum.confidence === row.signals.price_momentum.capped_confidence));
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
  assert.equal(coverageJson.module_id, "data_coverage_report_v0_10_55");
  assert.ok(Array.isArray(coverageJson.pools));
  assert.ok(coverageJson.total_signal_cells >= coverageJson.observed_pool_count);
  assert.ok(Array.isArray(coverageJson.priority_gaps));
  assert.ok(coverageJson.estimated_count >= coverageJson.flow_channel.estimated_from_source_count);
  assert.ok(coverageJson.pools.some((row) => row.flow_status === "estimated"));
  assert.ok(coverageJson.market_channel.momentum_signal_count >= 1);
  assert.ok(coverageJson.market_channel.liquidity_signal_count >= 1);
  assert.ok(coverageJson.quality.proxy_evidence_ratio > 0);

  const coverageHistory = await worker.fetch(request("/data/coverage_history.json"), {});
  assert.equal(coverageHistory.status, 200);
  const coverageHistoryJson = await coverageHistory.json();
  assert.equal(coverageHistoryJson.module_id, "coverage_history_v0_10_55");
  assert.ok(Array.isArray(coverageHistoryJson.history));

  const pointer = await worker.fetch(request("/data/history/latest_observation_pointer.json"), {});
  assert.equal(pointer.status, 200);
  const pointerJson = await pointer.json();
  assert.equal(pointerJson.module_id, "latest_observation_pointer_v0_10_59");
  assert.ok(pointerJson.latest_path.endsWith(`${pointerJson.latest_as_of}.json`));

  const archive = await worker.fetch(request(`/data/history/observations/${pointerJson.latest_as_of}.json`), {});
  assert.equal(archive.status, 200);
  const archiveJson = await archive.json();
  assert.equal(archiveJson.module_id, "observation_archive_v0_10_59");
  assert.equal(archiveJson.as_of, pointerJson.latest_as_of);
  assert.ok(archiveJson.observation_snapshot);
  assert.ok(archiveJson.data_coverage_report);
  assert.ok(archiveJson.flow_channel_report);
  assert.ok(archiveJson.pool_flow_signals);
  assert.ok(archiveJson.market_signal_report);
  assert.ok(archiveJson.pool_market_signals);
  assert.ok(archiveJson.pool_instrument_map);
  assert.ok(archiveJson.pool_mapping_report);
  assert.ok(archiveJson.signal_quality_report);
  assert.ok(archiveJson.pool_signal_quality);
  assert.ok(archiveJson.evening_observation_summary);
  assert.ok(archiveJson.pool_observation_scores);
  assert.match(archiveJson.evening_report, /# Evening Observation Summary/);
  assert.ok(archiveJson.observation_candidate_ledger);
  assert.ok(archiveJson.score_calibration_report);
  assert.ok(archiveJson.candidate_review_schedule);
  assert.ok(archiveJson.candidate_outcome_reviews);
  assert.ok(archiveJson.outcome_review_report);

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
  assert.equal(marketChannelJson.module_id, "market_signal_report_v0_10_54");
  assert.ok(marketChannelJson.momentum_signal_count >= 1);
  assert.ok(marketChannelJson.liquidity_signal_count >= 1);

  const poolMarketSignals = await worker.fetch(request("/data/pool_market_signals.json"), {});
  assert.equal(poolMarketSignals.status, 200);
  const poolMarketSignalsJson = await poolMarketSignals.json();
  assert.equal(poolMarketSignalsJson.module_id, "pool_market_signals_v0_10_55");
  assert.ok(poolMarketSignalsJson.rows.some((row) => row.momentum_status === "derived_from_market"));
  assert.ok(poolMarketSignalsJson.rows.some((row) => row.momentum_status === "estimated_from_source"));
  assert.ok(poolMarketSignalsJson.rows.every((row) => row.capped_confidence.momentum <= row.raw_confidence.momentum));

  const instrumentMap = await worker.fetch(request("/data/pool_instrument_map.json"), {});
  assert.equal(instrumentMap.status, 200);
  const instrumentMapJson = await instrumentMap.json();
  assert.equal(instrumentMapJson.module_id, "pool_instrument_map_v0_10_54");
  assert.ok(instrumentMapJson.rows.some((row) => row.mapping_status === "direct_etf"));
  assert.ok(instrumentMapJson.rows.some((row) => row.mapping_status === "sector_proxy"));

  const mappingReport = await worker.fetch(request("/data/pool_mapping_report.json"), {});
  assert.equal(mappingReport.status, 200);
  const mappingReportJson = await mappingReport.json();
  assert.equal(mappingReportJson.module_id, "pool_mapping_report_v0_10_54");
  assert.ok(mappingReportJson.mapping_coverage_ratio > 0.1642);

  const qualityReport = await worker.fetch(request("/data/signal_quality_report.json"), {});
  assert.equal(qualityReport.status, 200);
  const qualityReportJson = await qualityReport.json();
  assert.equal(qualityReportJson.module_id, "signal_quality_report_v0_10_55");
  assert.ok(qualityReportJson.confidence_cap_applied_count >= 1);

  const poolQuality = await worker.fetch(request("/data/pool_signal_quality.json"), {});
  assert.equal(poolQuality.status, 200);
  const poolQualityJson = await poolQuality.json();
  assert.equal(poolQualityJson.module_id, "pool_signal_quality_v0_10_55");
  assert.ok(poolQualityJson.rows.every((row) => row.capped_momentum_confidence <= row.raw_momentum_confidence));

  const eveningSummary = await worker.fetch(request("/data/evening_observation_summary.json"), {});
  assert.equal(eveningSummary.status, 200);
  const eveningSummaryJson = await eveningSummary.json();
  assert.equal(eveningSummaryJson.module_id, "evening_observation_summary_v0_10_57");
  assert.ok(eveningSummaryJson.top_observation_pools.every((row) => row.boundary.includes("observe_only")));

  const observationScores = await worker.fetch(request("/data/pool_observation_scores.json"), {});
  assert.equal(observationScores.status, 200);
  const observationScoresJson = await observationScores.json();
  assert.equal(observationScoresJson.module_id, "pool_observation_scores_v0_10_57");
  assert.ok(observationScoresJson.rows.length >= 1);
  assert.ok(observationScoresJson.rows.every((row) => ["flow_score", "momentum_score", "liquidity_score", "quality_score", "delta_score", "confidence_score", "proxy_penalty", "missing_data_penalty", "final_score"].every((field) => typeof row[field] === "number")));

  const candidateLedger = await worker.fetch(request("/data/observation_candidate_ledger.json"), {});
  assert.equal(candidateLedger.status, 200);
  const candidateLedgerJson = await candidateLedger.json();
  assert.equal(candidateLedgerJson.module_id, "observation_candidate_ledger_v0_10_57");
  assert.ok(candidateLedgerJson.rows.every((row) => row.boundary.includes("observe_only")));

  const calibration = await worker.fetch(request("/data/score_calibration_report.json"), {});
  assert.equal(calibration.status, 200);
  const calibrationJson = await calibration.json();
  assert.equal(calibrationJson.module_id, "score_calibration_report_v0_10_57");
  const flags = new Set(calibrationJson.suspicious_distribution_flags);
  if (calibrationJson.moderate_count === 0) assert.ok(flags.has("moderate_count_zero"));
  if (calibrationJson.strong_count > 15) assert.ok(flags.has("strong_count_above_15"));
  const strongRows = observationScoresJson.rows.filter((row) => row.observation_tier === "strong_observe");
  if (strongRows.some((row) => row.proxy_risk === "high")) assert.ok(flags.has("high_proxy_risk_tiered_strong"));
  if (strongRows.some((row) => row.capped_confidence < 0.5)) assert.ok(flags.has("low_capped_confidence_tiered_strong"));

  const reviewSchedule = await worker.fetch(request("/data/candidate_review_schedule.json"), {});
  assert.equal(reviewSchedule.status, 200);
  const reviewScheduleJson = await reviewSchedule.json();
  assert.equal(reviewScheduleJson.module_id, "candidate_review_schedule_v0_10_59");
  assert.ok(reviewScheduleJson.candidate_count >= 1);

  const outcomeReviews = await worker.fetch(request("/data/candidate_outcome_reviews.json"), {});
  assert.equal(outcomeReviews.status, 200);
  const outcomeReviewsJson = await outcomeReviews.json();
  assert.equal(outcomeReviewsJson.module_id, "candidate_outcome_reviews_v0_10_59");
  assert.ok(outcomeReviewsJson.rows.length >= 4);
  for (const row of outcomeReviewsJson.rows) {
    if (row.review_as_of > outcomeReviewsJson.as_of) {
      assert.equal(row.review_status, "pending");
      assert.equal(row.outcome_available, false);
      assert.equal(row.observed_return, null);
      assert.equal(row.benchmark_return, null);
      assert.equal(row.relative_return, null);
    }
    if (row.review_status === "reviewed") assert.ok(row.boundary.includes("observe_only"));
  }

  const outcomeReport = await worker.fetch(request("/data/outcome_review_report.json"), {});
  assert.equal(outcomeReport.status, 200);
  const outcomeReportJson = await outcomeReport.json();
  assert.equal(outcomeReportJson.module_id, "outcome_review_report_v0_10_59");
  assert.equal(typeof outcomeReportJson.pending_count, "number");

  const eveningReport = await worker.fetch(request("/data/evening_report.md"), {});
  assert.equal(eveningReport.status, 200);
  assert.match(await eveningReport.text(), /# Evening Observation Summary/);

  const delta = await worker.fetch(request("/data/daily_delta_report.json"), {});
  assert.equal(delta.status, 200);
  const deltaJson = await delta.json();
  assert.equal(deltaJson.module_id, "daily_delta_report_v0_10_55");
  assert.equal(typeof deltaJson.comparison_available, "boolean");

  const deltaHistory = await worker.fetch(request("/data/daily_delta_history.json"), {});
  assert.equal(deltaHistory.status, 200);
  const deltaHistoryJson = await deltaHistory.json();
  assert.equal(deltaHistoryJson.module_id, "daily_delta_history_v0_10_55");
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
