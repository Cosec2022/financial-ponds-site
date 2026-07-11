import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoricalImportPlan, committedArchivePaths } from "../scripts/lib/committed-historical-importer.mjs";

const archive = { as_of: "2026-07-08", generated_at: "2026-07-08T10:00:00.000Z", observation_snapshot: { module_id: "published_model", rows: [{ pool_id: "p", pool_name: "P", signals: {}, vector_forecast: {} }] }, pool_flow_signals: { rows: [] } };
const path = "financial-pond/data/history/observations/2026-07-08.json";

test("historical importer discovers only committed archive paths and never needs current time", () => {
  const paths = committedArchivePaths({ listPaths: () => [path, "financial-pond/data/history/observations/untracked.json"], from: "2026-07-08", to: "2026-07-08" });
  assert.deepEqual(paths, [{ path, as_of: "2026-07-08" }]);
  const plan = buildHistoricalImportPlan({ from: null, to: null, sourceCommit: "abc", listPaths: () => [path], readBlob: () => JSON.stringify(archive), blobId: () => "blob" });
  assert.equal(plan.source_commit, "abc");
  assert.equal(plan.items[0].snapshot.record_origin, "published_at_the_time");
  assert.equal(plan.items[0].snapshot.model_commit, null);
  assert.equal(plan.incomplete_dates[0], "2026-07-08");
});

test("historical importer reads the supplied committed blob, not a modified working-tree archive", () => {
  const plan = buildHistoricalImportPlan({ from: null, to: null, sourceCommit: "abc", listPaths: () => [path], readBlob: () => JSON.stringify(archive), blobId: () => "blob" });
  assert.equal(plan.items[0].snapshot.rows[0].pool_name, "P");
});
