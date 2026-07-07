import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { buildSectorRotationHistory, mergeHistoryPayloads, runSectorRotationHistory } from "../src/tools/sector_rotation_history.mjs";

const rotationDay1 = rotation("2026-07-02", 0.28, -0.22);
const rotationDay2 = rotation("2026-07-03", 0.36, -0.30);
const rotationDay3 = rotation("2026-07-06", 0.34, -0.28);

test("sector rotation history stores daily snapshots and keeps trend unconfirmed with too few days", () => {
  const result = buildSectorRotationHistory({
    rotation: rotationDay1,
    previousHistory: null
  });

  assert.equal(result.module_id, "sector_rotation_history_v0_10_19");
  assert.equal(result.sample_days, 1);
  assert.equal(result.trend_state, "insufficient_history");
  assert.equal(result.trend_confirmations.confirmed, false);
  assert.ok(result.headline.includes("第一天"));
  assert.ok(result.sector_series.real_estate_infra);
});

test("sector rotation history compares latest day with previous saved day", () => {
  const day1 = buildSectorRotationHistory({ rotation: rotationDay1 });
  const day2 = buildSectorRotationHistory({
    rotation: rotationDay2,
    previousHistory: day1
  });

  assert.equal(day2.sample_days, 2);
  assert.equal(day2.changes.find((item) => item.sector_id === "real_estate_infra").change_label, "strengthening");
  assert.equal(day2.changes.find((item) => item.sector_id === "brokerage").change_label, "weakening");
  assert.ok(day2.headline.includes("样本仍不足"));
});

test("sector rotation history confirms persistent leaders and laggards after enough days", () => {
  const day1 = buildSectorRotationHistory({ rotation: rotationDay1 });
  const day2 = buildSectorRotationHistory({
    rotation: rotationDay2,
    previousHistory: day1
  });
  const day3 = buildSectorRotationHistory({
    rotation: rotationDay3,
    previousHistory: day2
  });

  assert.equal(day3.sample_days, 3);
  assert.equal(day3.trend_state, "trend_confirmed");
  assert.equal(day3.trend_confirmations.confirmed, true);
  assert.equal(day3.trend_confirmations.persistent_leaders[0].sector_id, "real_estate_infra");
  assert.equal(day3.trend_confirmations.persistent_leaders[0].streak_days, 3);
  assert.equal(day3.trend_confirmations.persistent_laggards[0].sector_id, "brokerage");
  assert.ok(day3.watch_points.some((item) => item.includes("趋势确认")));
});

test("sector rotation history recovery merges history days from multiple published payloads", () => {
  const day1 = buildSectorRotationHistory({ rotation: rotationDay1 });
  const day2 = buildSectorRotationHistory({
    rotation: rotationDay2,
    previousHistory: day1
  });
  const damagedCurrent = buildSectorRotationHistory({
    rotation: rotationDay3,
    previousHistory: day1
  });
  const recovered = mergeHistoryPayloads([damagedCurrent, day2]);
  const rebuilt = buildSectorRotationHistory({
    rotation: rotationDay3,
    previousHistory: recovered
  });

  assert.deepEqual(recovered.history.map((item) => item.as_of), [
    "2026-07-02",
    "2026-07-03",
    "2026-07-06"
  ]);
  assert.equal(rebuilt.sample_days, 3);
  assert.equal(rebuilt.trend_state, "trend_confirmed");
  assert.equal(rebuilt.trend_confirmations.persistent_leaders[0].streak_days, 3);
});

test("sector rotation history writes JSON and Markdown outputs", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-rotation-history-"));
  const outDir = path.join(outputRoot, "model_outputs", "2026-07-02");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "sector_rotation_intelligence.json"),
    JSON.stringify(rotationDay1, null, 2)
  );

  const result = await runSectorRotationHistory({
    rootDir: outputRoot,
    asOf: "2026-07-02"
  });
  const json = JSON.parse(await readFile(result.jsonPath, "utf8"));
  const markdown = await readFile(result.mdPath, "utf8");

  assert.equal(json.sample_days, 1);
  assert.match(markdown, /A-share Sector Rotation History/);
});

function rotation(asOf, leaderScore, laggardScore) {
  return {
    as_of: asOf,
    status: "rotation_available",
    rotation_state: "clear_rotation",
    evidence_level: "hard_data_with_news_fixture",
    confidence: 0.225,
    data_completeness: 0.55,
    score_spread: Number((leaderScore - laggardScore).toFixed(4)),
    leaders: [
      sector("real_estate_infra", "地产基建", leaderScore, "constructive_inflow_bias"),
      sector("resources_materials", "资源材料", 0.2, "constructive_inflow_bias"),
      sector("defense_military", "军工", 0.18, "neutral")
    ],
    laggards: [
      sector("brokerage", "券商", laggardScore, "outflow_watch"),
      sector("bank_insurance", "银行保险", -0.18, "neutral"),
      sector("semiconductor", "半导体", -0.12, "neutral")
    ],
    cluster_reviews: [],
    counts: {
      sectors: 11,
      news_fallback: true
    }
  };
}

function sector(sectorId, name, score, label) {
  return {
    sector_id: sectorId,
    pool_id: `a_share_${sectorId}`,
    name,
    score,
    label,
    confirmation_inputs: ["ETF流", "价量确认"]
  };
}
