import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runDailyDataVault } from "../src/tools/daily_data_vault.mjs";

test("daily data vault writes seen files, missing files, and hashes", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "fp-vault-"));
  const asOf = "2026-07-08";
  await mkdir(path.join(rootDir, "financial-pond", "data"), { recursive: true });
  await mkdir(path.join(rootDir, "model_outputs", asOf), { recursive: true });
  await mkdir(path.join(rootDir, "data", "provider_exports"), { recursive: true });
  await writeFile(path.join(rootDir, "financial-pond", "data", "dashboard.json"), JSON.stringify({ entities: {}, as_of: asOf }));
  await writeFile(path.join(rootDir, "model_outputs", asOf, "sector_flow_review.json"), JSON.stringify({ module_id: "sector_flow_review", status: "ok", as_of: asOf }));
  await writeFile(path.join(rootDir, "data", "provider_exports", "sample.csv"), "sector_id,value\nalpha,1\n");

  const { payload, jsonPath, manifestPath, publishedPath } = await runDailyDataVault({ rootDir, asOf });

  assert.equal(payload.module_id, "daily_data_vault_v0_10_48");
  assert.ok(payload.files_seen.find((file) => file.path.endsWith("dashboard.json")));
  assert.ok(payload.files_seen.find((file) => file.path.endsWith("sample.csv")));
  assert.ok(payload.files_missing.find((file) => file.endsWith("observation_snapshot.json")));
  assert.ok(Object.keys(payload.file_hashes).some((file) => file.endsWith("dashboard.json")));
  assert.equal(JSON.parse(await readFile(jsonPath, "utf8")).status, "vault_available");
  assert.equal(JSON.parse(await readFile(publishedPath, "utf8")).status, "vault_available");
  assert.match(await readFile(manifestPath, "utf8"), /"files_seen":/);
});
