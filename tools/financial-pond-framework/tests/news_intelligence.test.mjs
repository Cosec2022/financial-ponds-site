import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { filterHistoricalNewsItems, runNewsIntelligence } from "../src/news/news_intelligence.mjs";
import { runSectorFlowReview } from "../src/tools/sector_flow_review.mjs";
import { buildEtfFlowLeaderboard } from "../src/tools/etf_flow_leaderboard.mjs";

async function tempProjectRoot() {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "news-intel-"));
  const projectRoot = path.resolve(import.meta.dirname, "..");
  await cp(path.join(projectRoot, "config"), path.join(outputRoot, "config"), { recursive: true });
  return outputRoot;
}

test("news intelligence is an independent module that writes observations and review", async () => {
  const rootDir = await tempProjectRoot();
  const result = await runNewsIntelligence({ rootDir, asOf: "2026-07-02", fixture: true });

  assert.ok(result.observations.length > 0);
  assert.equal(result.review.module_id, "news_daily_v1");
  assert.equal(result.review.collection.fallback_used, true);
  assert.ok(result.review.interpretation_boundary.some((line) => line.includes("News is expectation pressure")));

  const payload = JSON.parse(await readFile(result.observationsPath, "utf8"));
  assert.equal(payload.source, "news_intelligence_v1");
  assert.ok(payload.observations.some((item) => item.node_id === "semiconductor_policy_news"));
});

test("historical news filtering excludes later and undated items without a fixture fallback", () => {
  const result = filterHistoricalNewsItems([
    { title: "before", published_at: "2026-07-13T08:00:00Z" },
    { title: "after", published_at: "2026-07-14T00:00:00Z" },
    { title: "undated" }
  ], "2026-07-13");
  assert.deepEqual(result.items.map((item) => item.title), ["before"]);
  assert.equal(result.excluded_after_cutoff, 1);
  assert.equal(result.excluded_missing_timestamp, 1);
});

test("ETF leaderboard retains the requested date when only a stale inspection exists", async () => {
  const rootDir = await tempProjectRoot();
  await mkdir(path.join(rootDir, "model_outputs", "provider_inspection"), { recursive: true });
  await writeFile(path.join(rootDir, "model_outputs", "provider_inspection", "akshare_etf_bridge_inspection.json"), JSON.stringify({ as_of: "2026-07-10", row_findings: [] }));
  const result = await buildEtfFlowLeaderboard({ rootDir, asOf: "2026-07-13" });
  assert.equal(result.as_of, "2026-07-13");
  assert.equal(result.status, "no_provider_rows");
});

test("sector flow review keeps news observations as display-only narrative context", async () => {
  const rootDir = await tempProjectRoot();
  await runNewsIntelligence({ rootDir, asOf: "2026-07-02", fixture: true });

  const result = await runSectorFlowReview({ rootDir, asOf: "2026-07-02", fixture: false });
  const semiconductor = result.payload.sector_reviews.find((item) => item.sector_id === "semiconductor");
  assert.equal(semiconductor.components.policy_sentiment.available, false);
  assert.ok(result.payload.narrative_context.length > 0);
  assert.equal(result.payload.narrative_context.every((item) => item.display_only), true);
});
