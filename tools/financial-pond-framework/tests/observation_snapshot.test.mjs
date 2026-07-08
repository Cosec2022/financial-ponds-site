import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SIGNAL_SLOTS } from "../src/core/observation_schema.mjs";
import { runObservationSnapshot } from "../src/tools/observation_snapshot.mjs";

async function fixtureRoot() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "fp-observation-"));
  const dataDir = path.join(rootDir, "financial-pond", "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, "etf_flow_leaderboard.json"), JSON.stringify({
    status: "leaderboard_available",
    rows: [
      { sector_id: "alpha", name: "Alpha", estimated_flow: 100, estimated_flow_direction: "positive", estimated_flow_rank: 1, amount: 500 },
      { sector_id: "beta", name: "Beta", estimated_flow: 0, estimated_flow_direction: "zero", estimated_flow_rank: 2, amount: 100 }
    ]
  }));
  await writeFile(path.join(dataDir, "sector_flow_review.json"), JSON.stringify({
    as_of: "2026-07-08",
    sector_reviews: [
      {
        sector_id: "alpha",
        name: "Alpha",
        score: 0.2,
        components: {
          direct_flow: { available: true, source_reality: "provider_observed", score: 0.4 },
          market_confirmation: { available: true, source_reality: "derived_from_observed", score: 0.1 },
          market_liquidity: { available: false },
          policy_sentiment: { available: false }
        }
      },
      { sector_id: "beta", name: "Beta", score: -0.1, components: {} }
    ]
  }));
  await writeFile(path.join(dataDir, "daily_sector_analysis.json"), JSON.stringify({
    as_of: "2026-07-08",
    tiers: {
      priority_watch: [{ sector_id: "alpha", name: "Alpha", score: 0.3, rotation_diagnostic: { label: "leader", leader_days: 1 } }],
      confirm_next: [],
      avoid_watch: [{ sector_id: "beta", name: "Beta", score: -0.2 }]
    }
  }));
  await writeFile(path.join(dataDir, "sector_module_review.json"), JSON.stringify({
    sectors: [
      { sector_id: "alpha", modules: { valuation: { status: "manual_seed" }, fundamental: { status: "planned" } } },
      { sector_id: "beta", modules: { valuation: { status: "missing" }, fundamental: { status: "missing" } } }
    ]
  }));
  await writeFile(path.join(dataDir, "sector_watchlist_state.json"), JSON.stringify({ rows: [{ sector_id: "alpha", watch_state: "watch" }] }));
  await writeFile(path.join(dataDir, "decision_gate_ledger.json"), JSON.stringify({ execution_state: "blocked", gates: [{ status: "block" }] }));
  await writeFile(path.join(dataDir, "index_explainability.json"), JSON.stringify({ indexes: [{ index_id: "etf.estimated_flow.alpha", source_files: ["x"] }] }));
  return rootDir;
}

test("observation snapshot contains all signal slots and pending outcome horizons", async () => {
  const rootDir = await fixtureRoot();
  const { payload, outcomePath, manualReviewPath } = await runObservationSnapshot({ rootDir, asOf: "2026-07-08" });

  assert.equal(payload.module_id, "observation_snapshot_v0_10_48");
  assert.ok(payload.rows.length >= 2);
  for (const row of payload.rows) {
    assert.deepEqual(Object.keys(row.signals).sort(), [...SIGNAL_SLOTS].sort());
    assert.ok(SIGNAL_SLOTS.every((slot) => row.signals[slot].reality));
    assert.ok(row.vector_forecast.direction);
    assert.equal(row.vector_forecast.boundary, "blocked");
  }

  const outcomes = JSON.parse(await readFile(outcomePath, "utf8"));
  const horizons = new Set(outcomes.pending.map((item) => item.horizon));
  assert.deepEqual([...horizons].sort(), ["T+1", "T+20", "T+3", "T+5"].sort());
  assert.equal(JSON.parse(await readFile(manualReviewPath, "utf8")).module_id, "manual_review_log_v0_10_48");
});

test("observation history appends without overwriting", async () => {
  const rootDir = await fixtureRoot();
  const first = await runObservationSnapshot({ rootDir, asOf: "2026-07-08" });
  const firstRows = (await readFile(first.historyPath, "utf8")).trim().split(/\r?\n/).length;
  const second = await runObservationSnapshot({ rootDir, asOf: "2026-07-08" });
  const secondRows = (await readFile(second.historyPath, "utf8")).trim().split(/\r?\n/).length;
  assert.equal(secondRows, firstRows * 2);
});

test("observation core schema is not tied to one sample universe", async () => {
  const schemaText = await readFile(new URL("../src/core/observation_schema.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(schemaText, /a_share/i);
});
