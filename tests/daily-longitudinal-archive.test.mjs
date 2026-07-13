import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { appendImmutableSnapshot, rebuildDailyIndex } from "../scripts/lib/daily-longitudinal-archive.mjs";

const snapshot = { schema_version: "daily_longitudinal_snapshot_v1", snapshot_id: "2026-07-10:model", as_of: "2026-07-10", finality_status: "final", generated_at: "fixed", model_version: "model", row_count: 2, rows: [{ pool_id: "a" }, { pool_id: "b" }] };

test("immutable archive is idempotent, revisions changes, and rebuilds its index", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "daily-history-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const first = await appendImmutableSnapshot({ rootDir, snapshot });
  const same = await appendImmutableSnapshot({ rootDir, snapshot: { ...snapshot, generated_at: "later" } });
  const changed = await appendImmutableSnapshot({ rootDir, snapshot: { ...snapshot, rows: [{ pool_id: "a" }, { pool_id: "b", final_score: 2 }] }, correctionReason: "provider correction" });
  assert.equal(first.created, true); assert.equal(same.created, false, "execution timestamp alone does not create a revision"); assert.equal(changed.record.revision, 2); assert.equal(changed.record.supersedes_snapshot_id, first.record.snapshot_id);
  const index = await rebuildDailyIndex({ rootDir });
  assert.equal(index.records.length, 2);
  assert.equal(JSON.parse(await readFile(path.join(rootDir, "financial-pond/data/history/daily/index.json"), "utf8")).current_by_date["2026-07-10"].revision, 2);
});
