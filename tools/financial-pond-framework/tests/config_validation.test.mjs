import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, readJsonFile } from "../src/core/config_loader.mjs";
import { buildRegistry } from "../src/core/registry.mjs";
import { validateConfig } from "../src/core/schema.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("config loads and validates", async () => {
  const config = await loadConfig(rootDir);
  const registry = buildRegistry(config);
  assert.equal(validateConfig(config, registry), true);
  assert.equal(registry.has("gold"), true);
  assert.equal(registry.has("a_share_semiconductor"), true);
});

test("sector pool is discovered through parent_pool, not hardcoded", async () => {
  const [config, catalog] = await Promise.all([
    loadConfig(rootDir),
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json"))
  ]);
  const registry = buildRegistry(config);
  const children = registry.childPools("a_share").map((pool) => pool.id).sort();
  const expected = catalog.sectors.map((sector) => `a_share_${sector.id}`).sort();
  assert.deepEqual(children, expected);
});

test("A-share sector catalog materializes pools, demo assets, and template nodes", async () => {
  const [config, catalog] = await Promise.all([
    loadConfig(rootDir),
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json"))
  ]);
  const registry = buildRegistry(config);

  for (const sector of catalog.sectors) {
    assert.equal(registry.has(`a_share_${sector.id}`), true);
    assert.equal(registry.has(`a_share_${sector.id}_etf_demo`), true);
    for (const template of catalog.node_templates) {
      assert.equal(registry.has(`${sector.id}_${template.suffix}`), true);
    }
  }
});

test("S&P 500 pool is discovered as a US equity child through config", async () => {
  const config = await loadConfig(rootDir);
  const registry = buildRegistry(config);
  const children = registry.childPools("us_equity").map((pool) => pool.id);
  assert.deepEqual(children, ["sp500"]);
});
