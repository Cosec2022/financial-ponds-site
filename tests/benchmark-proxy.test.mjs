import test from "node:test";
import assert from "node:assert/strict";
import { applyBenchmarkToArchive, benchmarkMappingRow, benchmarkMarketRow } from "../scripts/lib/benchmark-proxy.mjs";

const config = {
  pool_id: "a_share_a_share", symbol: "510300", instrument_name: "proxy", role: "broad_market_proxy",
  benchmark_type: "etf_proxy", market: "A-share", display_label: "A-share benchmark proxy: 510300",
  disclosure: "Operational ETF proxy; not the complete A-share market."
};
const provider = { date: "2026-07-09", symbol: "510300", close: 4.5, source_provider: "fixture", source_endpoint: "fixture" };

test("benchmark mapping is explicit and never uses a sector fallback", () => {
  const row = benchmarkMappingRow(config);
  assert.equal(row.mapping_status, "mapped");
  assert.equal(row.mapping_role, "benchmark_proxy");
  assert.equal(row.instrument_code, "510300");
});

test("benchmark market row requires exact configured symbol and valid close", () => {
  assert.equal(benchmarkMarketRow(config, provider).price_date, "2026-07-09");
  assert.equal(benchmarkMarketRow(config, { ...provider, symbol: "other" }), null);
  assert.equal(benchmarkMarketRow(config, { ...provider, close: null }), null);
});

test("formal archive application is exact-date and idempotent", () => {
  const original = { as_of: "2026-07-09", pool_market_signals: { rows: [], source_files_used: [] }, pool_instrument_map: { rows: [] } };
  const first = applyBenchmarkToArchive(original, config, provider);
  assert.equal(first.changed, true);
  assert.equal(first.archive.pool_market_signals.rows.length, 1);
  const second = applyBenchmarkToArchive(first.archive, config, provider);
  assert.equal(second.changed, false);
  assert.equal(second.archive.pool_market_signals.rows.length, 1);
  assert.equal(applyBenchmarkToArchive(original, config, { ...provider, date: "2026-07-10" }).changed, false);
});
