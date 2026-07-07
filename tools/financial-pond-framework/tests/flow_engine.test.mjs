import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../src/core/config_loader.mjs";
import { evaluateSectorFlows, observationsFromMockScores } from "../src/model/flow_engine.mjs";
import { runSectorFlowReview } from "../src/tools/sector_flow_review.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("flow engine ranks all configured A-share sector ETF pools without hardcoded sector list", async () => {
  const [sectorCatalog, flowConfig, flexibleRiskFactors, scenario, mockScores] = await Promise.all([
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json")),
    readJsonFile(path.join(rootDir, "config", "model", "flow_engine_v0_9.json")),
    readJsonFile(path.join(rootDir, "config", "model", "flexible_risk_factors.json")),
    readJsonFile(path.join(rootDir, "config", "examples", "flow_scenario_global_tech_selloff.json")),
    readJsonFile(path.join(rootDir, "config", "mock_scores", "2026-07-02.json"))
  ]);

  const review = evaluateSectorFlows({
    observations: observationsFromMockScores({ mockScores, asOf: "2026-07-03" }),
    sectorCatalog,
    flowConfig,
    flexibleRiskFactors,
    scenario
  });

  assert.equal(review.sector_reviews.length, sectorCatalog.sectors.length);
  assert.equal(review.counts.factor_signals, 3);
  assert.ok(review.sector_reviews.every((item) => item.pool_id.startsWith("a_share_")));
  assert.ok(review.sector_reviews.every((item) => typeof item.score === "number"));
  assert.ok(review.sector_reviews.every((item) => item.score >= -1 && item.score <= 1));
});

test("global technology selloff scenario lowers technology sector review scores through flexible factors", async () => {
  const [sectorCatalog, flowConfig, flexibleRiskFactors, scenario, mockScores] = await Promise.all([
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json")),
    readJsonFile(path.join(rootDir, "config", "model", "flow_engine_v0_9.json")),
    readJsonFile(path.join(rootDir, "config", "model", "flexible_risk_factors.json")),
    readJsonFile(path.join(rootDir, "config", "examples", "flow_scenario_global_tech_selloff.json")),
    readJsonFile(path.join(rootDir, "config", "mock_scores", "2026-07-02.json"))
  ]);

  const observations = observationsFromMockScores({ mockScores, asOf: "2026-07-03" });
  const baseline = evaluateSectorFlows({
    observations,
    sectorCatalog,
    flowConfig,
    flexibleRiskFactors,
    scenario: null
  });
  const stressed = evaluateSectorFlows({
    observations,
    sectorCatalog,
    flowConfig,
    flexibleRiskFactors,
    scenario
  });

  const baselineSemi = baseline.sector_reviews.find((item) => item.pool_id === "a_share_semiconductor");
  const stressedSemi = stressed.sector_reviews.find((item) => item.pool_id === "a_share_semiconductor");
  const baselineAI = baseline.sector_reviews.find((item) => item.pool_id === "a_share_ai_computer");
  const stressedAI = stressed.sector_reviews.find((item) => item.pool_id === "a_share_ai_computer");

  assert.ok(stressedSemi.score < baselineSemi.score);
  assert.ok(stressedAI.score < baselineAI.score);
  assert.ok(
    stressedSemi.components.external_factor_effect.factor_contributors
      .some((item) => item.factor_id === "global_tech_risk")
  );
});

test("flow review writes isolated model output without changing source status", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-flow-review-"));
  await cp(path.join(rootDir, "config"), path.join(outputRoot, "config"), { recursive: true });

  const result = await runSectorFlowReview({
    rootDir: outputRoot,
    fixture: true
  });
  const review = await readJsonFile(
    path.join(outputRoot, "model_outputs", "2026-07-03", "sector_flow_review.json")
  );
  const markdown = await readFile(
    path.join(outputRoot, "model_outputs", "2026-07-03", "sector_flow_review.md"),
    "utf8"
  );

  assert.equal(result.jsonPath, path.join(outputRoot, "model_outputs", "2026-07-03", "sector_flow_review.json"));
  assert.equal(result.mdPath, path.join(outputRoot, "model_outputs", "2026-07-03", "sector_flow_review.md"));
  assert.equal(review.model_id, "flow_engine_v0_9");
  assert.equal(review.counts.sectors, 31);
  assert.equal(review.counts.provider_mapped_representative_sectors, 11);
  assert.equal(review.counts.framework_only_sectors, 20);
  assert.equal(review.data_availability.mode, "mock_only");
  assert.equal(review.data_availability.source_reality, "mock");
  assert.equal(review.data_availability.market_use_confidence, "low");
  assert.ok(review.data_availability.warnings.some((item) => item.includes("mock or fixture")));
  assert.match(markdown, /A-share Sector Flow Review/);
  assert.ok(review.safety_boundary.some((item) => item.includes("not a trading instruction")));
});
