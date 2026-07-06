import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { buildSectorRotationIntelligence, runSectorRotationIntelligence } from "../src/tools/sector_rotation_intelligence.mjs";

const sampleSectorReview = {
  as_of: "2026-07-02",
  sector_reviews: [
    sector("real_estate_infra", 0.30, "constructive_inflow_bias"),
    sector("resources_materials", 0.24, "constructive_inflow_bias"),
    sector("defense_military", 0.20, "neutral"),
    sector("consumer", 0.10, "neutral"),
    sector("healthcare_pharma", 0.06, "neutral"),
    sector("new_energy_ev", 0.02, "neutral"),
    sector("communication_electronics", -0.04, "neutral"),
    sector("ai_computer", -0.08, "neutral"),
    sector("semiconductor", -0.14, "neutral"),
    sector("bank_insurance", -0.19, "neutral"),
    sector("brokerage", -0.25, "outflow_watch")
  ]
};

const sampleNewsReview = {
  collection: {
    fallback_used: true
  }
};

test("sector rotation intelligence turns ranked sector review into readable leaders and laggards", () => {
  const result = buildSectorRotationIntelligence({
    sectorReview: sampleSectorReview,
    newsReview: sampleNewsReview
  });

  assert.equal(result.status, "rotation_available");
  assert.equal(result.rotation_state, "clear_rotation");
  assert.equal(result.evidence_level, "hard_data_with_news_fixture");
  assert.equal(result.leaders[0].sector_id, "real_estate_infra");
  assert.equal(result.laggards[0].sector_id, "brokerage");
  assert.ok(result.headline.includes("地产基建"));
  assert.ok(result.watch_points.some((item) => item.includes("新闻层当前为样例")));
  assert.ok(result.rotation_pairs[0].reading.includes("券商"));
});

test("sector rotation intelligence writes JSON and Markdown outputs", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-rotation-"));
  const outDir = path.join(outputRoot, "model_outputs", "2026-07-02");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "sector_flow_review.json"),
    JSON.stringify(sampleSectorReview, null, 2)
  );
  await writeFile(
    path.join(outDir, "news_review.json"),
    JSON.stringify(sampleNewsReview, null, 2)
  );

  const result = await runSectorRotationIntelligence({
    rootDir: outputRoot,
    asOf: "2026-07-02"
  });
  const json = JSON.parse(await readFile(result.jsonPath, "utf8"));
  const markdown = await readFile(result.mdPath, "utf8");

  assert.equal(json.module_id, "sector_rotation_intelligence_v0_10_5");
  assert.equal(json.counts.sectors, 11);
  assert.match(markdown, /A-share Sector Rotation Intelligence/);
});

function sector(sectorId, score, label) {
  return {
    sector_id: sectorId,
    pool_id: `a_share_${sectorId}`,
    score,
    label,
    confidence: 0.225,
    data_completeness: 0.55,
    components: {
      direct_flow: {
        score,
        confidence: 0.75,
        available: true,
        nodes: [{ node_id: `${sectorId}_etf_flow`, score, confidence: 0.75 }]
      },
      market_confirmation: {
        score: score / 2,
        confidence: 0.6,
        available: true,
        nodes: [{ node_id: `${sectorId}_relative_strength`, score: score / 2, confidence: 0.6 }]
      },
      market_liquidity: { score: 0, confidence: 0, available: false, nodes: [] },
      policy_sentiment: { score: 0, confidence: 0, available: false, nodes: [] },
      fundamental_proxy: { score: 0, confidence: 0, available: false, nodes: [] },
      external_factor_effect: { score: 0, confidence: 0, available: false, nodes: [] }
    },
    top_drivers: [
      {
        component: "direct_flow",
        score,
        contribution: score * 0.3,
        available: true
      },
      {
        component: "market_confirmation",
        score: score / 2,
        contribution: score * 0.125,
        available: true
      }
    ]
  };
}
