import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile, loadConfig } from "../src/core/config_loader.mjs";
import { buildRegistry } from "../src/core/registry.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("default report entities are configured and registered", async () => {
  const [reportConfig, modelConfig] = await Promise.all([
    readJsonFile(path.join(rootDir, "config", "reporting", "default_entities.json")),
    loadConfig(rootDir)
  ]);
  const registry = buildRegistry(modelConfig);

  assert.ok(reportConfig.entities.includes("sp500"));
  assert.ok(reportConfig.entities.includes("sp500_etf_demo"));

  for (const entityId of reportConfig.entities) {
    assert.equal(registry.has(entityId), true, `${entityId} must be registered`);
  }
});
