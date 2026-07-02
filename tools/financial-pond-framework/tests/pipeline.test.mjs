import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../src/core/config_loader.mjs";
import { buildRegistry } from "../src/core/registry.mjs";
import { validateObservation, observationsToScoreMap } from "../src/contracts/observation_schema.mjs";
import { MockObservationCollector } from "../src/collectors/mock/mock_observation_collector.mjs";
import { runDaily } from "../src/pipeline/run_daily.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("mock collector emits valid observations for registered nodes", async () => {
  const config = await loadConfig(rootDir);
  const registry = buildRegistry(config);
  const collector = new MockObservationCollector(rootDir);
  const observations = await collector.collect({ asOf: "2026-07-02", registry, config });

  assert.ok(observations.length > 0);
  for (const observation of observations) {
    assert.equal(validateObservation(observation, registry), true);
  }
});

test("observations convert to confidence-adjusted score map", () => {
  const scores = observationsToScoreMap([
    {
      node_id: "example",
      score: 1.2,
      confidence: 0.5
    }
  ]);
  assert.equal(scores.example, 0.6);
});

test("daily pipeline writes observations, snapshot, and report", async () => {
  const result = await runDaily({ rootDir, asOf: "2026-07-02" });
  assert.ok(result.observationPath.endsWith("node_observations.json"));
  assert.ok(result.snapshotPath.endsWith("graph_scores.json"));
  assert.ok(result.reportPath.endsWith("daily_report.md"));
  assert.ok(result.dashboardPath.endsWith("dashboard.json"));

  const report = await readFile(result.reportPath, "utf8");
  assert.match(report, /Daily Financial Pond Report/);
  assert.match(report, /AI does not directly set final pool scores/);
});
