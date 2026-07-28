import test from "node:test";
import assert from "node:assert/strict";
import {
  SECTOR_OBSERVATION_STATUSES,
  buildSectorObservationPanel,
  classifyObservationStatus,
  parseCsv
} from "../scripts/lib/sector-observation-panel.mjs";

const dates = Array.from({ length: 20 }, (_, index) => `2026-07-${String(index + 1).padStart(2, "0")}`);
const currentRows = Array.from({ length: 10 }, (_, index) => candidate(index + 1, 80 - index));
const previousRows = [
  candidate(2, 72),
  candidate(1, 79),
  ...Array.from({ length: 7 }, (_, index) => candidate(index + 3, 78 - index)),
  candidate(11, 66)
];
const mappings = Array.from({ length: 11 }, (_, index) => ({
  pool_id: `a_share_sector_${index + 1}`,
  pool_name: `行业${index + 1}`,
  instrument_code: String(510000 + index + 1),
  mapping_status: "direct_etf"
}));
const etfRows = mappings.flatMap((mapping, sectorIndex) => dates.map((date, dateIndex) => ({
  date,
  sector_id: `sector_${sectorIndex + 1}`,
  fund_code: mapping.instrument_code,
  close: 100 + sectorIndex + dateIndex,
  pct_change: dateIndex === dates.length - 1 ? sectorIndex % 2 ? -1.2 : 1.4 : 0.5,
  amount: 1_000_000 + sectorIndex * 10_000 + dateIndex * 5_000
})));
const benchmarkRows = dates.map((date, index) => ({ date, symbol: "510300", close: 100 + index * 0.4 }));

test("panel preserves published order, emits four real-series contracts, and retains exits", () => {
  const panel = buildSectorObservationPanel({
    asOf: dates.at(-1),
    generatedAt: "2026-07-20T16:00:00.000Z",
    summary: summary(dates.at(-1), currentRows),
    instrumentMap: { rows: mappings },
    etfRows,
    benchmarkRows,
    archiveSummaries: [summary(dates.at(-2), previousRows)]
  });

  assert.deepEqual(panel.rows.map((row) => row.pool_id), currentRows.map((row) => row.pool_id));
  assert.deepEqual(panel.rows.map((row) => row.score), currentRows.map((row) => row.observation_score));
  assert.equal(panel.rows[0].rank, 1);
  assert.equal(panel.rows[0].previous_rank, 2);
  assert.equal(panel.rows[0].rank_change, 1);
  assert.equal(panel.rows[0].series.price_strength.available_points, 20);
  assert.equal(panel.rows[0].series.turnover_activity.available_points, 20);
  assert.equal(panel.rows[0].series.relative_strength.available_points, 20);
  assert.equal(panel.rows[0].series.internal_breadth.available_points, 0);
  assert.ok(panel.rows[0].series.turnover_activity.values.every((point) => Number.isFinite(point.value)));
  assert.ok(panel.rows[0].series.internal_breadth.values.every((point) => point.value === null));
  assert.equal(panel.departures.length, 1);
  assert.equal(panel.departures[0].pool_id, "a_share_sector_11");
  assert.equal(panel.departures[0].status_label, "退出观察");
});

test("missing inputs stay null and never become zero-valued curves", () => {
  const sparseRows = etfRows
    .filter((row) => row.fund_code === mappings[0].instrument_code)
    .slice(0, 3)
    .map((row, index) => ({ ...row, amount: index === 1 ? "" : row.amount }));
  const panel = buildSectorObservationPanel({
    asOf: dates.at(-1),
    generatedAt: "2026-07-20T16:00:00.000Z",
    summary: summary(dates.at(-1), [currentRows[0]]),
    instrumentMap: { rows: [mappings[0]] },
    etfRows: sparseRows,
    benchmarkRows: benchmarkRows.slice(0, 2),
    archiveSummaries: []
  });
  const row = panel.rows[0];
  assert.equal(row.series.turnover_activity.status, "insufficient_data");
  assert.ok(row.series.turnover_activity.values.every((point) => point.value === null));
  assert.doesNotMatch(JSON.stringify(row.series.turnover_activity), /"value":0(?:[,}])/);
  assert.equal(row.series.internal_breadth.latest, null);
  assert.equal(row.series.internal_breadth.missing_reason, "缺少来源可信的上涨成分股或站上20日均线比例");
});

test("breadth accepts only explicit source-backed ratios and rejects mock scores", () => {
  const base = {
    asOf: dates.at(-1),
    generatedAt: "2026-07-20T16:00:00.000Z",
    summary: summary(dates.at(-1), [currentRows[0]]),
    instrumentMap: { rows: [mappings[0]] },
    etfRows: etfRows.filter((row) => row.fund_code === mappings[0].instrument_code),
    benchmarkRows
  };
  const panel = buildSectorObservationPanel({
    ...base,
    breadthRows: [
      { date: dates[0], sector_id: "sector_1", metric: "constituent_advancers_ratio", breadth_ratio: 0.6, source_provider: "mock_observation_collector" },
      { date: dates[1], sector_id: "sector_1", metric: "constituent_advancers_ratio", breadth_ratio: 0.64, source_provider: "verified_constituent_provider" },
      { date: dates[2], sector_id: "sector_1", metric: "constituent_above_ma20_ratio", above_ma20_ratio: 0.68, source_provider: "verified_constituent_provider" }
    ]
  });
  const breadth = panel.rows[0].series.internal_breadth;
  assert.equal(breadth.values[0].value, null);
  assert.equal(breadth.values[1].value, 0.64);
  assert.equal(breadth.values[2].value, 0.68);
  assert.equal(breadth.status, "available");
});

test("status rules distinguish marginal change without forcing diversity", () => {
  const baseSeries = {
    mapping_status: "direct_etf",
    price_strength: { available_points: 20, latest_daily_change: 0.4 },
    turnover_activity: { latest: null },
    relative_strength: { latest: 1.2 },
    internal_breadth: { latest: null }
  };
  assert.equal(classifyObservationStatus({
    candidate: { observation_score: 80 },
    previousCandidate: { observation_score: 75 },
    rank: 2,
    previousRank: 4,
    series: baseSeries
  }), "strengthening");
  assert.equal(classifyObservationStatus({
    candidate: { observation_score: 70 },
    previousCandidate: { observation_score: 75 },
    rank: 6,
    previousRank: 3,
    series: baseSeries
  }), "weakening");
  assert.equal(classifyObservationStatus({
    candidate: { observation_score: 75 },
    previousCandidate: { observation_score: 74 },
    rank: 4,
    previousRank: 4,
    series: { ...baseSeries, price_strength: { available_points: 20, latest_daily_change: 3.1 }, relative_strength: { latest: -0.2 } }
  }), "price_only");
  assert.equal(classifyObservationStatus({
    candidate: { observation_score: 75 },
    previousCandidate: { observation_score: 75 },
    rank: 4,
    previousRank: 4,
    series: baseSeries
  }), "maintain");
  assert.equal(classifyObservationStatus({
    candidate: { observation_score: 75 },
    previousCandidate: null,
    rank: 1,
    previousRank: null,
    series: { ...baseSeries, price_strength: { available_points: 1, latest_daily_change: 5 } }
  }), "insufficient");
  assert.deepEqual(Object.values(SECTOR_OBSERVATION_STATUSES), ["边际增强", "维持观察", "边际转弱", "仅价格异动", "证据不足", "退出观察"]);
});

test("CSV parser preserves quoted provider fields", () => {
  const rows = parseCsv('date,fund_code,fund_name,close\n2026-07-20,510001,"行业ETF,示例",1.25\n');
  assert.deepEqual(rows, [{ date: "2026-07-20", fund_code: "510001", fund_name: "行业ETF,示例", close: "1.25" }]);
});

function candidate(index, score) {
  return {
    pool_id: `a_share_sector_${index}`,
    pool_name: `行业${index}`,
    observation_score: score,
    boundary: "observe_only"
  };
}

function summary(asOf, rows) {
  return {
    module_id: "evening_observation_summary_v0_10_61",
    as_of: asOf,
    top_observation_pools: rows
  };
}
