import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketHistoryQuality,
  validateMarketHistoryQuality
} from "../scripts/lib/market-history-quality.mjs";

const dates = Array.from({ length: 20 }, (_, index) => `2026-07-${String(index + 1).padStart(2, "0")}`);
const benchmark = dates.map((tradeDate, index) => bar("510300", tradeDate, 4 + index / 100));
const etf = dates.map((tradeDate, index) => bar("512000", tradeDate, 1 + index / 100));
const instruments = [{ instrument_code: "512000" }];

test("history quality accepts exact complete bars and reports 20/20 alignment and turnover", () => {
  const report = buildMarketHistoryQuality({
    asOf: dates.at(-1),
    targetWindow: 20,
    etfRows: etf,
    benchmarkRows: benchmark,
    instruments,
    breadth: { status: "unavailable", reason: "尚未接入可信成分股数据源" }
  });
  assert.equal(validateMarketHistoryQuality(report), true);
  assert.equal(report.per_instrument[0].observed_trade_days, 20);
  assert.equal(report.benchmark_alignment.minimum_count, 20);
  assert.equal(report.turnover_readiness.minimum_count, 20);
  assert.equal(report.overall_status, "partial");
});

test("quality gate detects instrument+date duplicates, future rows, non-trading rows, and pollution", () => {
  const rows = [
    ...etf,
    { ...etf[0] },
    bar("512000", "2026-07-21", 1.5),
    bar("512000", "2026-06-30", 1.2),
    { ...etf[1], amount: null }
  ];
  const report = buildMarketHistoryQuality({
    asOf: dates.at(-1),
    targetWindow: 20,
    etfRows: rows,
    benchmarkRows: benchmark,
    instruments,
    breadth: null
  });
  assert.deepEqual(report.duplicated_dates, [dates[0], dates[1]]);
  assert.deepEqual(report.future_dates, ["2026-07-21"]);
  assert.deepEqual(report.non_trading_dates, []);
  assert.deepEqual(report.polluted_dates, [dates[1]]);
  assert.ok(report.hard_failures.includes("duplicated_dates"));
  assert.ok(report.hard_failures.includes("future_dates"));
  assert.ok(report.hard_failures.includes("field_pollution"));
});

test("a date inside the target range but outside the benchmark calendar is rejected", () => {
  const benchmarkWithoutTenth = benchmark.filter((row) => row.trade_date !== dates[9]);
  const report = buildMarketHistoryQuality({
    asOf: dates.at(-1),
    targetWindow: 19,
    etfRows: etf,
    benchmarkRows: benchmarkWithoutTenth,
    instruments,
    breadth: null
  });
  assert.deepEqual(report.non_trading_dates, [dates[9]]);
  assert.ok(report.hard_failures.includes("non_trading_dates"));
});

function bar(code, tradeDate, close) {
  return {
    trade_date: tradeDate,
    fund_code: code,
    symbol: code,
    open: close,
    high: close + 0.01,
    low: close - 0.01,
    close,
    volume: 1000,
    amount: 100000
  };
}
