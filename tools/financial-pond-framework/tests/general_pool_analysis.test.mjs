import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadConfig, readJsonFile } from "../src/core/config_loader.mjs";
import { buildRegistry } from "../src/core/registry.mjs";
import { buildGeneralPoolAnalysis, runGeneralPoolAnalysis } from "../src/tools/general_pool_analysis.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("general pool analysis covers S&P 500 and A-share industry pools with one component contract", async () => {
  const [config, poolModels, inputContract, snapshot] = await Promise.all([
    loadConfig(rootDir),
    readJsonFile(path.join(rootDir, "config", "model", "pool_internal_models.json")),
    readJsonFile(path.join(rootDir, "config", "model", "general_pool_input_contract.json")),
    readJsonFile(path.join(rootDir, "snapshots", "2026-07-02", "graph_scores.json"))
  ]);
  const registry = buildRegistry(config);
  const aShareIndustryIds = [...registry.pools.values()]
    .filter((pool) => pool.parent_pool === "a_share")
    .map((pool) => pool.id);

  const payload = buildGeneralPoolAnalysis({
    asOf: "2026-07-02",
    registry,
    poolModels,
    inputContract,
    snapshot,
    targetPoolIds: ["sp500", ...aShareIndustryIds]
  });

  assert.equal(payload.module_id, "general_pool_analysis_v0_10_11");
  assert.equal(payload.input_contract_id, "general_pool_input_contract_v0_10_9");
  assert.equal(payload.counts.sp500, 1);
  assert.equal(payload.counts.a_share_industries, 31);
  assert.ok(payload.pool_reviews.find((item) => item.pool_id === "sp500"));
  assert.ok(payload.pool_reviews.every((item) => item.components.capital_flow));
  assert.ok(payload.pool_reviews.every((item) => item.components.network_influence));
  assert.ok(payload.pool_reviews.every((item) => item.components.price_volume));
  assert.ok(payload.pool_reviews.every((item) => item.components.news_pressure));
  const sp500 = payload.pool_reviews.find((item) => item.pool_id === "sp500");
  const semiconductor = payload.pool_reviews.find((item) => item.pool_id === "a_share_semiconductor");
  assert.equal(sp500.input_profile, "us_large_cap_index");
  assert.equal(semiconductor.input_profile, "a_share_industry");
  assert.ok(sp500.expected_inputs.fundamental_value.expected_nodes.includes("sp500_eps_revision"));
  assert.ok(!semiconductor.expected_inputs.fundamental_value.expected_nodes.includes("sp500_eps_revision"));
  assert.ok(semiconductor.expected_inputs.capital_flow.expected_nodes.includes("semiconductor_etf_flow"));
});

test("general pool analysis writes JSON and Markdown outputs", async () => {
  const { payload, jsonPath, mdPath } = await runGeneralPoolAnalysis({
    rootDir,
    asOf: "2026-07-02"
  });
  const json = JSON.parse(await readFile(jsonPath, "utf8"));
  const markdown = await readFile(mdPath, "utf8");

  assert.equal(json.module_id, "general_pool_analysis_v0_10_11");
  assert.equal(payload.counts.pools, 33);
  assert.match(markdown, /General Pool Analysis/);
  assert.match(markdown, /sp500/);
});
