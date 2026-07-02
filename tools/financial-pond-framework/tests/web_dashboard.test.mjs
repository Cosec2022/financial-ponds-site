import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { runDaily } from "../src/pipeline/run_daily.mjs";
import { exportDashboardData } from "../src/web/export_dashboard_data.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("dashboard export creates stable web data contract", async () => {
  await runDaily({ rootDir, asOf: "2026-07-02" });
  const dashboardPath = await exportDashboardData({ rootDir, asOf: "2026-07-02" });
  const dashboard = JSON.parse(await readFile(dashboardPath, "utf8"));

  assert.equal(dashboard.as_of, "2026-07-02");
  assert.ok(dashboard.entities.us_equity);
  assert.ok(dashboard.entities.gold);
  assert.ok(Array.isArray(dashboard.edges));
  assert.ok(Array.isArray(dashboard.groups.pools));
  assert.ok(Array.isArray(dashboard.observations));
});
