import test from "node:test";
import assert from "node:assert/strict";
import { buildSectorBreadth } from "../scripts/lib/sector-breadth.mjs";

test("mock breadth is rejected and remains explicitly unavailable", () => {
  const result = buildSectorBreadth({
    asOf: "2026-07-28",
    input: {
      source_kind: "official_sector_constituents",
      constituent_source: "mock_observation_collector",
      constituent_as_of: "2026-07-28",
      composition_as_of: "2026-07-28",
      price_source: "mock_prices",
      sectors: []
    }
  });
  assert.equal(result.status, "unavailable");
  assert.match(result.reason, /不可信/);
  assert.deepEqual(result.rows, []);
});

test("traceable constituent metadata produces both advancer and MA20 ratios", () => {
  const result = buildSectorBreadth({
    asOf: "2026-07-28",
    input: {
      source_kind: "etf_constituent_basket",
      constituent_source: "official_etf_disclosure",
      constituent_as_of: "2026-07-28",
      composition_as_of: "2026-07-28",
      price_source: "verified_daily_prices",
      sectors: [{
        sector_id: "semiconductor",
        total_count: 3,
        constituents: [
          constituent("A", 11, 10, 9),
          constituent("B", 9, 10, 8),
          constituent("C", 8, 8, 9)
        ]
      }]
    }
  });
  assert.equal(result.status, "available");
  assert.equal(result.display_label, "ETF篮子扩散");
  assert.equal(result.rows[0].effective_count, 3);
  assert.equal(result.rows[0].total_count, 3);
  assert.equal(result.rows[0].advancers_ratio, 0.333333);
  assert.equal(result.rows[0].above_ma20_ratio, 0.666667);
  assert.equal(result.rows[0].composition_as_of, "2026-07-28");
});

function constituent(instrumentCode, close, previousClose, ma20) {
  return {
    instrument_code: instrumentCode,
    trade_date: "2026-07-28",
    close,
    previous_close: previousClose,
    ma20,
    source_provider: "verified_daily_prices"
  };
}
