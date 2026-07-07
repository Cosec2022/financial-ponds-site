import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("A-share daily CI runs graph cycle before sector flow review", async () => {
  const source = await readFile(path.join(rootDir, "src", "tools", "a_share_daily_ci.mjs"), "utf8");

  assert.match(source, /runner_id: "a_share_daily_ci_v0_10_27"/);
  assert.ok(source.indexOf('"akshare_provider_doctor"') < source.indexOf('"akshare_etf_snapshot"'));
  assert.ok(source.indexOf('"graph_cycle"') > source.indexOf('"news_intelligence"'));
  assert.ok(source.indexOf('"graph_cycle"') < source.indexOf('"sector_flow_review"'));
  assert.ok(source.indexOf('"sector_module_review"') < source.indexOf('"etf_decision_readiness"'));
  assert.match(source, /src\/pipeline\/run_cycle\.mjs/);
  assert.match(source, /src\/tools\/etf_decision_readiness\.mjs/);
});
