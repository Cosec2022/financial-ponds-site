import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runSectorFlowReview } from "../src/tools/sector_flow_review.mjs";
import { runSectorModuleReview } from "../src/tools/sector_module_review.mjs";
import { runEtfDecisionReadiness } from "../src/tools/etf_decision_readiness.mjs";
import { runDataRealityAudit } from "../src/tools/data_reality_audit.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("data reality audit marks mock flow and manual seed modules as non-real", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-reality-audit-"));
  await cp(path.join(rootDir, "config"), path.join(outputRoot, "config"), { recursive: true });

  await runSectorFlowReview({
    rootDir: outputRoot,
    asOf: "2026-07-08",
    fixture: true
  });
  await runSectorModuleReview({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });
  await runEtfDecisionReadiness({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });
  const result = await runDataRealityAudit({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });

  assert.equal(result.payload.module_id, "data_reality_audit_v0_1");
  assert.equal(result.payload.overall_reality, "mixed_non_real");
  assert.equal(result.payload.layers.find((layer) => layer.id === "akshare_provider_doctor").reality, "provider_doctor_not_run");
  assert.equal(result.payload.layers.find((layer) => layer.id === "akshare_provider_run").reality, "provider_not_run");
  assert.equal(result.payload.layers.find((layer) => layer.id === "flow_price").reality, "mock");
  assert.equal(result.payload.layers.find((layer) => layer.id === "sector_modules").reality, "manual_seed");
  assert.equal(result.payload.layers.find((layer) => layer.id === "etf_decision_readiness").reality, "decision_gate_blocked");
  assert.ok(result.payload.warnings.some((warning) => warning.includes("mock/fixture")));
});
