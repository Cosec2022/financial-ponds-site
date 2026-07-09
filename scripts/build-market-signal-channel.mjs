import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const sourceRelativePath = "tools/financial-pond-framework/data/provider_exports/a_share_etf_daily.csv";
const snapshotPath = resolve(dataDir, "observation_snapshot.json");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const instrumentMap = JSON.parse(await readFile(resolve(dataDir, "pool_instrument_map.json"), "utf8"));
const sourceRows = parseCsv(await readFile(resolve(root, sourceRelativePath), "utf8"));
const latestSourceDate = [...new Set(sourceRows.map((row) => row.date).filter(Boolean))].sort().at(-1) ?? null;
const latestRows = sourceRows.filter((row) => row.date === latestSourceDate);
const sourceByCode = new Map(latestRows.map((row) => [String(row.fund_code), row]));
const mappingByPool = new Map((instrumentMap.rows ?? []).map((row) => [row.pool_id, row]));
const asOf = process.env.AS_OF ?? new Date().toISOString().slice(0, 10);

snapshot.as_of = asOf;
for (const row of snapshot.rows ?? []) row.as_of = asOf;

const signals = (snapshot.rows ?? []).map((pool) => {
  const mapping = mappingByPool.get(pool.pool_id);
  return marketSignal(pool, mapping, sourceByCode.get(String(mapping?.instrument_code ?? "")));
});
const momentumCount = signals.filter((row) => isAvailable(row.momentum_status)).length;
const liquidityCount = signals.filter((row) => isAvailable(row.liquidity_status)).length;
const unmapped = signals.filter((row) => !isAvailable(row.momentum_status) && !isAvailable(row.liquidity_status));
const generatedAt = new Date().toISOString();
const signalFile = {
  module_id: "pool_market_signals_v0_10_54",
  as_of: asOf,
  generated_at: generatedAt,
  source_files_used: ["financial-pond/data/pool_instrument_map.json", sourceRelativePath],
  rows: signals
};
const report = {
  module_id: "market_signal_report_v0_10_54",
  as_of: asOf,
  generated_at: generatedAt,
  source_files_used: ["financial-pond/data/pool_instrument_map.json", sourceRelativePath],
  source_row_count: latestRows.length,
  mapped_pool_count: signals.length - unmapped.length,
  unmapped_pool_count: unmapped.length,
  momentum_signal_count: momentumCount,
  liquidity_signal_count: liquidityCount,
  missing_momentum_count: signals.length - momentumCount,
  missing_liquidity_count: signals.length - liquidityCount,
  coverage_ratio: signals.length ? round((momentumCount + liquidityCount) / (signals.length * 2)) : 0,
  mapping_method: "pool_instrument_map instrument_code to the latest a_share_etf_daily.csv fund_code",
  unmapped_examples: unmapped.slice(0, 5).map((row) => ({
    pool_id: row.pool_id,
    pool_name: row.pool_name,
    reason: row.reason
  })),
  boundary_notes: [
    "Momentum is derived from the latest available representative ETF daily percentage change.",
    "Liquidity is derived from provider amount and turnover observations.",
    "These are market observations, not exact capital movement and not trading signal.",
    "Unmapped pools remain missing; no market values are fabricated.",
    "observe_only boundary remains in force."
  ]
};

applySignals(snapshot, signals, report);
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
await writeFile(resolve(dataDir, "pool_market_signals.json"), `${JSON.stringify(signalFile, null, 2)}\n`, "utf8");
await writeFile(resolve(dataDir, "market_signal_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Market signal channel written: momentum=${momentumCount}, liquidity=${liquidityCount}`);

function marketSignal(pool, mapping, source) {
  const base = {
    pool_id: pool.pool_id,
    pool_name: pool.pool_name,
    momentum_status: "missing",
    momentum_value: null,
    momentum_direction: "neutral",
    momentum_confidence: 0,
    momentum_source_type: "source_unavailable",
    liquidity_status: "missing",
    liquidity_value: null,
    liquidity_direction: "neutral",
    liquidity_confidence: 0,
    liquidity_source_type: "source_unavailable",
    source_file: sourceRelativePath,
    evidence_count: 0,
    freshness: freshnessFor(latestSourceDate, asOf),
    boundary: "source unavailable; observe_only",
    reason: mapping?.mapping_method ?? "No instrument mapping is available for this observation pool.",
    mapping_status: mapping?.mapping_status ?? "unmapped",
    mapping_confidence: mapping?.mapping_confidence ?? 0,
    mapping_method: mapping?.mapping_method ?? "No mapping available.",
    proxy_level: mapping?.proxy_level ?? "none",
    instrument_code: mapping?.instrument_code ?? null,
    instrument_name: mapping?.instrument_name ?? null
  };
  if (!source) return base;

  const pctChange = numberOrNull(source.pct_change);
  const amount = numberOrNull(source.amount);
  const turnover = numberOrNull(source.turnover);
  const liquidityValue = amount ?? turnover;
  const direct = ["direct_index", "direct_etf"].includes(mapping.mapping_status);
  const status = direct ? "derived_from_market" : "estimated_from_source";
  return {
    ...base,
    momentum_status: pctChange === null ? "missing" : status,
    momentum_value: pctChange,
    momentum_direction: directionFor(pctChange),
    momentum_confidence: pctChange === null ? 0 : 0.82,
    momentum_source_type: pctChange === null ? "source_unavailable" : "provider_daily_pct_change",
    liquidity_status: liquidityValue === null ? "missing" : status,
    liquidity_value: liquidityValue,
    liquidity_direction: liquidityDirection(amount, latestRows),
    liquidity_confidence: liquidityValue === null ? 0 : 0.78,
    liquidity_source_type: amount !== null ? "provider_daily_amount" : "provider_daily_turnover",
    evidence_count: [source.close, source.pct_change, source.amount, source.turnover].filter((value) => numberOrNull(value) !== null).length,
    boundary: `${direct ? "derived" : "estimated"} from mapped market price/volume; not trading signal; observe_only`,
    reason: mapping.mapping_method,
    source_date: source.date,
    market_close: numberOrNull(source.close),
    fund_code: source.fund_code,
    fund_name: source.fund_name
  };
}

function applySignals(target, rows, channel) {
  const byPool = new Map(rows.map((row) => [row.pool_id, row]));
  for (const pool of target.rows ?? []) {
    const market = byPool.get(pool.pool_id);
    if (!market) continue;
    pool.signals.price_momentum = signal("price_momentum", market.momentum_status, market.momentum_value, market.momentum_direction, market.momentum_source_type, market);
    pool.signals.liquidity = signal("liquidity", market.liquidity_status, market.liquidity_value, market.liquidity_direction, market.liquidity_source_type, market);
    pool.signal_matrix_row.price_momentum = market.momentum_status;
    pool.signal_matrix_row.liquidity = market.liquidity_status;
  }
  target.counts = countRealities(target.rows ?? []);
  target.market_channel = {
    module_id: channel.module_id,
    momentum_signal_count: channel.momentum_signal_count,
    liquidity_signal_count: channel.liquidity_signal_count,
    missing_momentum_count: channel.missing_momentum_count,
    missing_liquidity_count: channel.missing_liquidity_count,
    coverage_ratio: channel.coverage_ratio
  };
}

function signal(slot, status, value, direction, sourceType, market) {
  const available = isAvailable(status);
  return {
    slot,
    reality: status,
    value,
    score: value,
    label: direction,
    source_file: market.source_file,
    source_type: sourceType,
    trace_id: `market.channel.${slot}.${market.pool_id}`,
    trace_status: available ? "available" : "missing",
    formula: slot === "price_momentum" ? "latest representative ETF daily pct_change" : "latest representative ETF amount; turnover fallback",
    variables: {
      ...(slot === "price_momentum" ? { pct_change: value } : { amount_or_turnover: value }),
      instrument_code: market.instrument_code,
      mapping_method: market.mapping_method,
      proxy_level: market.proxy_level
    },
    calculation: available ? `observed value = ${value}` : "source unavailable",
    reality_note: available ? "derived from market price/volume" : "source unavailable",
    boundary: market.boundary,
    reason: market.reason,
    instrument_used: {
      code: market.instrument_code,
      name: market.instrument_name
    },
    mapping_method: market.mapping_method,
    proxy_level: market.proxy_level
  };
}

function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(",");
  return lines.map((line) => Object.fromEntries(splitCsvLine(line).map((value, index) => [keys[index], value])));
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") quoted = !quoted;
    else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else current += char;
  }
  values.push(current);
  return values;
}

function freshnessFor(sourceDate, observationDate) {
  if (!sourceDate) return "source_unavailable";
  if (sourceDate === observationDate) return "current";
  return sourceDate < observationDate ? `stale_since_${sourceDate}` : `source_date_${sourceDate}`;
}

function directionFor(value) {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function liquidityDirection(value, rows) {
  if (value === null) return "neutral";
  const amounts = rows.map((row) => numberOrNull(row.amount)).filter((item) => item !== null).sort((a, b) => a - b);
  const median = amounts[Math.floor(amounts.length / 2)] ?? 0;
  return value >= median ? "above_median" : "below_median";
}

function countRealities(rows) {
  const counts = {};
  for (const row of rows) {
    for (const item of Object.values(row.signals ?? {})) {
      const key = item.reality ?? "missing";
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

function isAvailable(status) {
  return ["source_backed", "derived_from_market", "estimated_from_source"].includes(status);
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return Number(value.toFixed(4));
}
