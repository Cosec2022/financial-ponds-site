import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCollectionCycle } from "../src/pipeline/run_cycle.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("collection cycle runs with configured mock fallback on any date", async () => {
  const result = await runCollectionCycle({ rootDir, asOf: "2026-07-03" });
  assert.ok(result.observations.length > 0);
  assert.ok(result.layerSummary.upstream);
  assert.ok(result.regimeSummary);
  assert.ok(result.regimePath.endsWith("regime_summary.json"));
  assert.ok(result.reportPath.endsWith("daily_report.md"));
});
