import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const mappingFile = await readJson("pool_instrument_map.json");
const marketFile = await readJson("pool_market_signals.json");
const snapshot = await readJson("observation_snapshot.json");
const mappingByPool = new Map((mappingFile.rows ?? []).map((row) => [row.pool_id, row]));
const snapshotByPool = new Map((snapshot.rows ?? []).map((row) => [row.pool_id, row]));
let confidenceCapAppliedCount = 0;

const rows = (marketFile.rows ?? []).map((market) => {
  const mapping = mappingByPool.get(market.pool_id) ?? {};
  const cap = confidenceCap(mapping);
  const quality = evidenceQuality(mapping);
  const risk = proxyRisk(mapping);
  const rawMomentum = numberOrZero(market.momentum_confidence);
  const rawLiquidity = numberOrZero(market.liquidity_confidence);
  const cappedMomentum = Math.min(rawMomentum, cap);
  const cappedLiquidity = Math.min(rawLiquidity, cap);
  if (cappedMomentum < rawMomentum) confidenceCapAppliedCount += 1;
  if (cappedLiquidity < rawLiquidity) confidenceCapAppliedCount += 1;
  const capReason = capReasonFor(mapping, cap);

  Object.assign(market, {
    raw_confidence: { momentum: rawMomentum, liquidity: rawLiquidity },
    confidence_cap: { momentum: cap, liquidity: cap },
    capped_confidence: { momentum: cappedMomentum, liquidity: cappedLiquidity },
    momentum_raw_confidence: rawMomentum,
    liquidity_raw_confidence: rawLiquidity,
    momentum_confidence_cap: cap,
    liquidity_confidence_cap: cap,
    momentum_capped_confidence: cappedMomentum,
    liquidity_capped_confidence: cappedLiquidity,
    momentum_confidence: cappedMomentum,
    liquidity_confidence: cappedLiquidity,
    evidence_quality: quality,
    proxy_risk: risk,
    confidence_cap_reason: capReason
  });
  applyToSnapshot(snapshotByPool.get(market.pool_id), market, capReason);

  return {
    pool_id: market.pool_id,
    pool_name: market.pool_name,
    mapping_status: mapping.mapping_status ?? "unmapped",
    proxy_level: mapping.proxy_level ?? "none",
    mapping_confidence: numberOrZero(mapping.mapping_confidence),
    momentum_status: market.momentum_status,
    liquidity_status: market.liquidity_status,
    raw_momentum_confidence: rawMomentum,
    raw_liquidity_confidence: rawLiquidity,
    capped_momentum_confidence: cappedMomentum,
    capped_liquidity_confidence: cappedLiquidity,
    evidence_quality: quality,
    proxy_risk: risk,
    confidence_cap_reason: capReason,
    boundary: "quality guardrail applied; observe_only"
  };
});

const mappedRows = rows.filter((row) => !["unmapped", "unavailable"].includes(row.mapping_status));
const directRows = rows.filter((row) => ["direct_index", "direct_etf"].includes(row.mapping_status));
const proxyRows = rows.filter((row) => ["sector_proxy", "broad_proxy"].includes(row.mapping_status));
const counts = countQuality(rows);
const generatedAt = new Date().toISOString();
const qualityFile = {
  module_id: "pool_signal_quality_v0_10_55",
  as_of: snapshot.as_of,
  generated_at: generatedAt,
  rows
};
const report = {
  module_id: "signal_quality_report_v0_10_55",
  as_of: snapshot.as_of,
  generated_at: generatedAt,
  total_pool_count: rows.length,
  mapped_pool_count: mappedRows.length,
  direct_evidence_count: directRows.length,
  proxy_evidence_count: proxyRows.length,
  unmapped_count: rows.length - mappedRows.length,
  direct_evidence_ratio: ratio(directRows.length, rows.length),
  proxy_evidence_ratio: ratio(proxyRows.length, rows.length),
  proxy_risk_level: proxyRows.length > directRows.length ? "high" : proxyRows.length ? "medium" : "none",
  confidence_cap_applied_count: confidenceCapAppliedCount,
  high_quality_signal_count: counts.high ?? 0,
  medium_quality_signal_count: counts.medium ?? 0,
  low_quality_signal_count: counts.low ?? 0,
  boundary_notes: [
    "Coverage quantity is reported separately from evidence quality.",
    "Confidence caps only reduce source confidence; they never increase it.",
    "Sector and broad proxies remain estimates with explicit proxy risk.",
    "Unavailable mappings retain zero confidence and the observe_only boundary."
  ]
};

marketFile.module_id = "pool_market_signals_v0_10_55";
marketFile.quality_guardrail = {
  module_id: report.module_id,
  confidence_cap_applied_count: confidenceCapAppliedCount
};
snapshot.quality_guardrail = report;

await writeJson("pool_market_signals.json", marketFile);
await writeJson("observation_snapshot.json", snapshot);
await writeJson("pool_signal_quality.json", qualityFile);
await writeJson("signal_quality_report.json", report);
console.log(`Signal quality guardrail written: capped=${confidenceCapAppliedCount}, proxy_risk=${report.proxy_risk_level}`);

function applyToSnapshot(pool, market, capReason) {
  if (!pool?.signals) return;
  for (const [slot, prefix] of [["price_momentum", "momentum"], ["liquidity", "liquidity"]]) {
    const signal = pool.signals[slot];
    if (!signal) continue;
    signal.raw_confidence = market[`${prefix}_raw_confidence`];
    signal.confidence_cap = market[`${prefix}_confidence_cap`];
    signal.capped_confidence = market[`${prefix}_capped_confidence`];
    signal.confidence = market[`${prefix}_capped_confidence`];
    signal.evidence_quality = market.evidence_quality;
    signal.proxy_risk = market.proxy_risk;
    signal.confidence_cap_reason = capReason;
    signal.mapping_status = market.mapping_status;
    signal.proxy_level = market.proxy_level;
    signal.variables = {
      ...(signal.variables ?? {}),
      mapping_status: market.mapping_status,
      proxy_level: market.proxy_level,
      raw_confidence: signal.raw_confidence,
      confidence_cap: signal.confidence_cap,
      capped_confidence: signal.capped_confidence
    };
  }
}

function confidenceCap(mapping) {
  if (mapping.mapping_status === "direct_index") return 0.85;
  if (mapping.mapping_status === "direct_etf") return 0.75;
  if (mapping.mapping_status === "sector_proxy" && ["exact", "close"].includes(mapping.proxy_level)) return 0.6;
  if (mapping.mapping_status === "sector_proxy" && mapping.proxy_level === "loose") return 0.45;
  if (mapping.mapping_status === "broad_proxy") return 0.35;
  return 0;
}

function evidenceQuality(mapping) {
  if (["direct_index", "direct_etf"].includes(mapping.mapping_status)) return "high";
  if (mapping.mapping_status === "sector_proxy" && ["exact", "close"].includes(mapping.proxy_level)) return "medium";
  if (["sector_proxy", "broad_proxy"].includes(mapping.mapping_status)) return "low";
  return "unavailable";
}

function proxyRisk(mapping) {
  if (["direct_index", "direct_etf"].includes(mapping.mapping_status)) return "none";
  if (mapping.mapping_status === "sector_proxy" && mapping.proxy_level === "exact") return "low";
  if (mapping.mapping_status === "sector_proxy" && mapping.proxy_level === "close") return "medium";
  if (["sector_proxy", "broad_proxy"].includes(mapping.mapping_status)) return "high";
  return "none";
}

function capReasonFor(mapping, cap) {
  if (!cap) return "No usable mapping; confidence capped at 0.";
  return `${mapping.mapping_status} with proxy_level ${mapping.proxy_level}; maximum confidence ${cap}.`;
}

function countQuality(items) {
  return items.reduce((counts, row) => {
    counts[row.evidence_quality] = (counts[row.evidence_quality] ?? 0) + 1;
    return counts;
  }, {});
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function ratio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(dataDir, file), "utf8"));
}

async function writeJson(file, value) {
  await writeFile(resolve(dataDir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
