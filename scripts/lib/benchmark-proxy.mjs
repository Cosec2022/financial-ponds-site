import { readFile } from "node:fs/promises";

export async function loadBenchmarkConfig(url = new URL("../../config/a-share-benchmark-proxy.v1.json", import.meta.url)) {
  const config = JSON.parse(await readFile(url, "utf8"));
  if (config.symbol !== "510300" || config.pool_id !== "a_share_a_share" || config.benchmark_type !== "etf_proxy") {
    throw new Error("Invalid A-share benchmark proxy configuration");
  }
  return config;
}

export function benchmarkMappingRow(config) {
  return {
    pool_id: config.pool_id,
    pool_name: "A-share benchmark proxy",
    instrument_type: "etf",
    instrument_code: config.symbol,
    instrument_name: config.instrument_name,
    market: config.market,
    mapping_status: "mapped",
    mapping_role: "benchmark_proxy",
    benchmark_type: config.benchmark_type,
    benchmark_role: config.role,
    mapping_confidence: 1,
    mapping_method: "Explicit versioned benchmark proxy configuration",
    proxy_level: "broad",
    source: "config/a-share-benchmark-proxy.v1.json",
    boundary: `${config.display_label}; ${config.disclosure}; observe_only`
  };
}

export function benchmarkMarketRow(config, providerRow) {
  if (!providerRow || providerRow.symbol !== config.symbol || !providerRow.date || !(Number(providerRow.close) > 0)) return null;
  return {
    pool_id: config.pool_id,
    pool_name: "A-share benchmark proxy",
    momentum_status: "missing",
    momentum_value: null,
    momentum_direction: "neutral",
    momentum_confidence: 0,
    momentum_source_type: "exact_date_close_only",
    liquidity_status: "missing",
    liquidity_value: null,
    liquidity_direction: "neutral",
    liquidity_confidence: 0,
    liquidity_source_type: "source_unavailable",
    source_file: "tools/financial-pond-framework/data/provider_exports/a_share_benchmark_daily.json",
    source_provider: providerRow.source_provider,
    source_endpoint: providerRow.source_endpoint,
    evidence_count: 1,
    freshness: "exact_date_archive",
    boundary: `${config.display_label}; ${config.disclosure}; observe_only`,
    reason: "Independent exact-date benchmark history row.",
    mapping_status: "mapped",
    mapping_role: "benchmark_proxy",
    mapping_confidence: 1,
    mapping_method: "Explicit versioned benchmark proxy configuration",
    proxy_level: "broad",
    instrument_code: config.symbol,
    instrument_name: config.instrument_name,
    benchmark_type: config.benchmark_type,
    benchmark_role: config.role,
    source_date: providerRow.date,
    price_date: providerRow.date,
    market_close: Number(providerRow.close),
    price_close: Number(providerRow.close),
    fund_code: config.symbol,
    fund_name: config.instrument_name
  };
}

export function applyBenchmarkToArchive(archive, config, providerRow) {
  const marketRow = benchmarkMarketRow(config, providerRow);
  if (!marketRow || archive?.as_of !== providerRow.date) return { archive, changed: false };
  const mappingRow = benchmarkMappingRow(config);
  const updated = structuredClone(archive);
  updated.pool_market_signals ??= { rows: [], source_files_used: [] };
  updated.pool_instrument_map ??= { rows: [] };
  updated.pool_market_signals.rows = upsertByPool(updated.pool_market_signals.rows, marketRow);
  updated.pool_instrument_map.rows = upsertByPool(updated.pool_instrument_map.rows, mappingRow);
  updated.pool_market_signals.source_files_used = [...new Set([
    ...(updated.pool_market_signals.source_files_used ?? []),
    marketRow.source_file
  ])];
  updated.benchmark_proxy = {
    display_label: config.display_label,
    symbol: config.symbol,
    benchmark_type: config.benchmark_type,
    role: config.role,
    disclosure: config.disclosure,
    exact_date: providerRow.date
  };
  return { archive: updated, changed: JSON.stringify(updated) !== JSON.stringify(archive) };
}

function upsertByPool(rows, value) {
  const next = (rows ?? []).filter((row) => row.pool_id !== value.pool_id);
  next.push(value);
  return next.sort((a, b) => String(a.pool_id).localeCompare(String(b.pool_id)));
}
