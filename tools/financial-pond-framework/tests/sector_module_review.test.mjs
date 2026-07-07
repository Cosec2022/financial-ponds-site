import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runSectorFlowReview } from "../src/tools/sector_flow_review.mjs";
import { runSectorModuleReview } from "../src/tools/sector_module_review.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("sector module review keeps valuation, fundamental, and flow-price as independent modules", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-module-review-"));
  await cp(path.join(rootDir, "config"), path.join(outputRoot, "config"), { recursive: true });

  await runSectorFlowReview({
    rootDir: outputRoot,
    asOf: "2026-07-08",
    fixture: true
  });
  const result = await runSectorModuleReview({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });

  assert.equal(result.payload.module_id, "sector_module_review_v0_1");
  assert.equal(result.payload.counts.sectors, 31);
  const semiconductor = result.payload.sectors.find((row) => row.sector_id === "semiconductor");
  assert.ok(semiconductor.modules.valuation);
  assert.ok(semiconductor.modules.fundamental);
  assert.ok(semiconductor.modules.flow_price);
  assert.equal(semiconductor.modules.valuation.status, "manual_seed");
  assert.equal(semiconductor.modules.flow_price.status, "from_sector_flow_review");
  assert.ok(result.payload.interpretation_boundary.some((item) => item.includes("valuation module is independent")));
});
