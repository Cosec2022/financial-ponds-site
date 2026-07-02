import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, readJsonFile } from "../src/core/config_loader.mjs";
import { buildRegistry } from "../src/core/registry.mjs";
import { validateConfig } from "../src/core/schema.mjs";
import { buildGraph } from "../src/core/graph_engine.mjs";
import { calculateScores } from "../src/core/scoring_engine.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function scoreFixture() {
  const config = await loadConfig(rootDir);
  const registry = buildRegistry(config);
  validateConfig(config, registry);
  const mock = await readJsonFile(path.join(rootDir, "config", "mock_scores", "2026-07-02.json"));
  return calculateScores({
    registry,
    graph: buildGraph(config.edges),
    inputScores: mock.scores,
    scoringConfig: config.scoring
  });
}

test("scores are calculated for all major pools", async () => {
  const scored = await scoreFixture();
  for (const id of ["us_equity", "sp500", "a_share", "btc", "gold"]) {
    const result = scored.results.get(id);
    assert.equal(result.kind, "pool");
    assert.equal(typeof result.score, "number");
  }
});

test("S&P 500 ETF inherits from configured S&P 500 pool", async () => {
  const scored = await scoreFixture();
  const asset = scored.results.get("sp500_etf_demo");
  const poolContribution = asset.contributors.find((item) => item.from === "sp500");
  assert.equal(asset.kind, "asset");
  assert.ok(poolContribution);
  assert.equal(poolContribution.channel, "pool_exposure");
});

test("child sector pool inherits parent pool through configured edge", async () => {
  const scored = await scoreFixture();
  const sector = scored.results.get("a_share_semiconductor");
  const parentContribution = sector.contributors.find((item) => item.from === "a_share");
  assert.ok(parentContribution);
  assert.equal(parentContribution.channel, "parent_market");
});

test("portfolio component can receive score through configured asset edge", async () => {
  const scored = await scoreFixture();
  const portfolio = scored.results.get("default_user_portfolio");
  assert.equal(portfolio.kind, "portfolio");
  assert.equal(typeof portfolio.score, "number");
  assert.ok(portfolio.contributors.some((item) => item.from === "a_share_semiconductor_etf_demo"));
});
