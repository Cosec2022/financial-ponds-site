import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { appendOutcomeLabels, outcomeLabelsFromReviews } from "../scripts/lib/daily-outcome-label-ledger.mjs";

test("outcome labels are append-only, preserve missing benchmark, and do not mutate a snapshot", async (t) => {
  const reviews = { rows: [{ candidate_as_of: "2026-07-10", pool_id: "p", horizon: "T+1", review_status: "unavailable", baseline_price: 0, review_price: null, benchmark_symbol: "510300", benchmark_baseline_close: null, unavailable_reason: "missing_benchmark" }] };
  const labels = outcomeLabelsFromReviews({ reviews, generatedAt: "fixed" });
  assert.equal(labels[0].baseline_price, 0); assert.equal(labels[0].benchmark_baseline_price, null); assert.equal(labels[0].mfe, null);
  const rootDir = await mkdtemp(path.join(tmpdir(), "outcome-labels-")); t.after(() => rm(rootDir, { recursive: true, force: true }));
  assert.equal((await appendOutcomeLabels({ rootDir, labels })).appended, 1);
  assert.equal((await appendOutcomeLabels({ rootDir, labels })).appended, 0);
});
