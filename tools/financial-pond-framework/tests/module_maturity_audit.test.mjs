import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildModuleMaturityAudit, runModuleMaturityAudit } from "../src/tools/module_maturity_audit.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("module maturity audit parses module and priority plans", async () => {
  const [modulePlan, projectPlan] = await Promise.all([
    readFile(path.join(rootDir, "docs", "MODULE_PLAN.md"), "utf8"),
    readFile(path.join(rootDir, "docs", "PROJECT_PLAN.md"), "utf8")
  ]);

  const payload = buildModuleMaturityAudit({
    asOf: "2026-07-08",
    modulePlan,
    projectPlan
  });

  assert.equal(payload.status, "module_maturity_available");
  assert.ok(payload.overall.module_count >= 15);
  assert.ok(payload.overall.average_progress > 30);
  assert.equal(payload.recommended_mainline.id, "a_share_real_provider_to_estimated_flow");
  assert.ok(payload.priority_modules.some((row) => row.module_id === "FP-DATA-01"));
  assert.ok(payload.low_maturity_modules.some((row) => row.module_id === "FP-GPT-01"));
  assert.ok(payload.modules.find((row) => row.module_id === "FP-ETF-01").blockers.includes("manual_or_seed_input"));
});

test("module maturity audit writes JSON and Markdown outputs", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-module-maturity-"));
  await mkdir(path.join(outputRoot, "docs"), { recursive: true });
  await writeFile(
    path.join(outputRoot, "docs", "MODULE_PLAN.md"),
    await readFile(path.join(rootDir, "docs", "MODULE_PLAN.md"), "utf8"),
    "utf8"
  );
  await writeFile(
    path.join(outputRoot, "docs", "PROJECT_PLAN.md"),
    await readFile(path.join(rootDir, "docs", "PROJECT_PLAN.md"), "utf8"),
    "utf8"
  );

  const result = await runModuleMaturityAudit({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });
  const output = JSON.parse(await readFile(result.jsonPath, "utf8"));
  const markdown = await readFile(result.mdPath, "utf8");

  assert.equal(output.module_id, "module_maturity_audit_v0_10_39");
  assert.match(markdown, /Module Maturity Audit/);
  assert.match(markdown, /Priority Modules/);
});
