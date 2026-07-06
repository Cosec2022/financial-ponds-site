import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("maintenance convergence documents define rules, protocol, plans, and module IDs", async () => {
  const files = await Promise.all([
    readFile(path.join(rootDir, "docs", "MAINTENANCE_RULES.md"), "utf8"),
    readFile(path.join(rootDir, "docs", "UPDATE_PROTOCOL.md"), "utf8"),
    readFile(path.join(rootDir, "docs", "PROJECT_PLAN.md"), "utf8"),
    readFile(path.join(rootDir, "docs", "MODULE_PLAN.md"), "utf8"),
    readFile(path.join(rootDir, "docs", "GITHUB_SYNC_PROTOCOL.md"), "utf8"),
    readFile(path.join(rootDir, "docs", "handbook", "CURRENT_PROGRESS_V0_10_17.md"), "utf8"),
    readFile(path.join(rootDir, "docs", "handbook", "DATA_STATUS_MATRIX.md"), "utf8"),
    readFile(path.join(rootDir, "docs", "handbook", "FRONTEND_MODEL_CONTRACT.md"), "utf8")
  ]);
  const combined = files.join("\n");

  assert.match(combined, /extensible financial (pond )?network/);
  assert.match(combined, /capital-flow signals/);
  assert.match(combined, /price-volume analysis/);
  assert.match(combined, /news-pressure analysis/);
  assert.match(combined, /FP-CORE-01/);
  assert.match(combined, /FP-FLOW-01/);
  assert.match(combined, /FP-GEN-01/);
  assert.match(combined, /general_pool_input_contract\.json/);
  assert.match(combined, /input_profile/);
  assert.match(combined, /A-share first/);
  assert.match(combined, /31/);
  assert.match(combined, /framework_only/);
  assert.match(combined, /graph_cycle/);
  assert.match(combined, /GitHub = source code/);
  assert.match(combined, /Cloudflare = published website/);
  assert.match(combined, /npx wrangler@4\.102\.0 deploy/);
  assert.match(combined, /terminal commands/);
  assert.match(combined, /copyable/);
  assert.match(combined, /assistant must run validation|assistant must run the required validation/i);
  assert.match(combined, /Downloads/);
  assert.match(combined, /unzip/);
  assert.match(combined, /preview/);
  assert.match(combined, /deploy/);
  assert.match(combined, /FP-ROT-01/);
  assert.match(combined, /FP-HIST-01/);
  assert.match(combined, /FP-MAINT-01/);
  assert.match(combined, /general_pool_analysis\.json/);
  assert.match(combined, /sector_rotation_intelligence\.json/);
  assert.match(combined, /sector_rotation_history\.json/);
  assert.match(combined, /trading instruction/);
});
