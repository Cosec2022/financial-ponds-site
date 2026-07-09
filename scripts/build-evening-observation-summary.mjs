import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const [snapshot, marketReport, mappingFile, qualityFile, qualityReport, coverageReport, deltaFile, deltaReport] = await Promise.all([
  readJson("observation_snapshot.json"),
  readJson("market_signal_report.json"),
  readJson("pool_instrument_map.json"),
  readJson("pool_signal_quality.json"),
  readJson("signal_quality_report.json"),
  readJson("data_coverage_report.json"),
  readJson("pool_delta_signals.json"),
  readJson("daily_delta_report.json")
]);

const mappingByPool = new Map((mappingFile.rows ?? []).map((row) => [row.pool_id, row]));
const qualityByPool = new Map((qualityFile.rows ?? []).map((row) => [row.pool_id, row]));
const deltaByPool = new Map((deltaFile.rows ?? []).map((row) => [row.pool_id, row]));
const rows = (snapshot.rows ?? []).map(scorePool).sort((a, b) =>
  b.observation_score - a.observation_score
  || b.capped_confidence - a.capped_confidence
  || canonicalWeight(b) - canonicalWeight(a)
  || a.pool_id.localeCompare(b.pool_id)
);
const tierCounts = rows.reduce((counts, row) => {
  counts[row.observation_tier] = (counts[row.observation_tier] ?? 0) + 1;
  return counts;
}, {});
const topPools = uniqueSemantic(rows.filter((row) => row.observation_tier !== "insufficient")).slice(0, 10);
const cautionPools = uniqueSemantic([...rows].sort((a, b) => cautionWeight(b) - cautionWeight(a))).filter((row) => row.caution_reason).slice(0, 10);
const unresolvedGaps = (coverageReport.priority_gaps ?? []).slice(0, 5).map((gap) => ({
  signal_type: gap.signal_type,
  affected_pool_count: gap.affected_pool_count,
  next_data_need: gap.next_data_need
}));
const generatedAt = new Date().toISOString();
const mainCaution = qualityReport.proxy_risk_level === "high"
  ? `Proxy evidence covers ${formatRatio(qualityReport.proxy_evidence_ratio)} of pools; proxy observations remain capped and secondary.`
  : "Evidence quality remains mixed; review pool-level boundaries.";

const scoresFile = {
  module_id: "pool_observation_scores_v0_10_56",
  as_of: snapshot.as_of,
  generated_at: generatedAt,
  rows
};
const summary = {
  module_id: "evening_observation_summary_v0_10_56",
  as_of: snapshot.as_of,
  generated_at: generatedAt,
  observation_state: "observe_only",
  data_readiness: `${marketReport.mapped_pool_count}/${marketReport.mapped_pool_count + marketReport.unmapped_pool_count} market mapped; quality guardrail active`,
  direct_evidence_ratio: qualityReport.direct_evidence_ratio,
  proxy_evidence_ratio: qualityReport.proxy_evidence_ratio,
  high_quality_count: qualityReport.high_quality_signal_count,
  medium_quality_count: qualityReport.medium_quality_signal_count,
  low_quality_count: qualityReport.low_quality_signal_count,
  confidence_cap_applied_count: qualityReport.confidence_cap_applied_count,
  delta_comparison_available: deltaReport.comparison_available,
  key_findings: [
    `Direct evidence covers ${formatRatio(qualityReport.direct_evidence_ratio)} of observed pools.`,
    `Proxy evidence covers ${formatRatio(qualityReport.proxy_evidence_ratio)} and carries ${qualityReport.proxy_risk_level} aggregate proxy risk.`,
    `${marketReport.momentum_signal_count} momentum and ${marketReport.liquidity_signal_count} liquidity observations are available.`,
    `${tierCounts.strong_observe ?? 0} pools meet the strict direct-evidence strong observation gate.`
  ],
  top_observation_pools: topPools.slice(0, 5),
  caution_pools: cautionPools.slice(0, 5),
  unresolved_gaps: unresolvedGaps,
  main_caution: mainCaution,
  boundary_notes: [
    "observe_only",
    "not investment advice",
    "insufficient outcome history",
    "no source-backed hard flow yet",
    "Observation scores express review priority only."
  ]
};

await writeJson("pool_observation_scores.json", scoresFile);
await writeJson("evening_observation_summary.json", summary);
await writeFile(resolve(dataDir, "evening_report.md"), markdownReport(summary), "utf8");
console.log(`Evening observation summary written: top=${summary.top_observation_pools.length}, strong=${tierCounts.strong_observe ?? 0}`);

function scorePool(pool) {
  const mapping = mappingByPool.get(pool.pool_id) ?? {};
  const quality = qualityByPool.get(pool.pool_id) ?? {};
  const delta = deltaByPool.get(pool.pool_id) ?? {};
  const flow = pool.signals?.flow ?? {};
  const momentum = pool.signals?.price_momentum ?? {};
  const liquidity = pool.signals?.liquidity ?? {};
  const cappedConfidence = average([quality.capped_momentum_confidence, quality.capped_liquidity_confidence]);
  let score = qualityReward(quality.evidence_quality);
  if (["direct_index", "direct_etf"].includes(mapping.mapping_status)) score += 15;
  if (mapping.mapping_status === "sector_proxy") score -= 8;
  if (mapping.mapping_status === "broad_proxy") score -= 14;
  score += available(momentum.reality) ? 10 : -8;
  score += available(liquidity.reality) ? 10 : -8;
  score += available(flow.reality) ? 15 : -12;
  score += deltaReward(delta.review_flag);
  score += cappedConfidence * 20;
  score += numberOrZero(pool.vector_forecast?.magnitude) * 5;
  score -= proxyPenalty(quality.proxy_risk);
  if (capApplied(momentum) || capApplied(liquidity)) score -= 5;
  if (delta.review_flag === "insufficient_history") score -= 10;
  if (["unmapped", "unavailable"].includes(mapping.mapping_status)) score -= 25;
  score = round(Math.max(0, Math.min(100, score)));

  return {
    pool_id: pool.pool_id,
    pool_name: pool.pool_name,
    observation_score: score,
    observation_tier: observationTier(score, quality, cappedConfidence),
    direction: pool.vector_forecast?.direction ?? "neutral",
    magnitude: numberOrZero(pool.vector_forecast?.magnitude),
    confidence: numberOrZero(pool.vector_forecast?.confidence),
    capped_confidence: cappedConfidence,
    flow_status: flow.reality ?? "missing",
    momentum_status: momentum.reality ?? "missing",
    liquidity_status: liquidity.reality ?? "missing",
    evidence_quality: quality.evidence_quality ?? "unavailable",
    proxy_risk: quality.proxy_risk ?? "none",
    delta_flag: delta.review_flag ?? "insufficient_history",
    main_reason: mainReason(mapping, quality, flow, momentum, liquidity, delta),
    caution_reason: cautionReason(mapping, quality, flow, delta),
    boundary: "observe_only; observation priority only"
  };
}

function observationTier(score, quality, cappedConfidence) {
  if (score >= 70 && quality.evidence_quality === "high" && quality.proxy_risk === "none" && cappedConfidence >= 0.6) return "strong_observe";
  if (score >= 45 && quality.evidence_quality !== "unavailable") return "moderate_observe";
  if (score >= 20 && quality.evidence_quality !== "unavailable") return "weak_observe";
  return "insufficient";
}

function mainReason(mapping, quality, flow, momentum, liquidity, delta) {
  const availableSignals = [flow, momentum, liquidity].filter((signal) => available(signal.reality)).length;
  return `${quality.evidence_quality ?? "unavailable"} evidence via ${mapping.mapping_status ?? "unmapped"}; ${availableSignals}/3 core observations available; delta ${delta.review_flag ?? "insufficient_history"}.`;
}

function cautionReason(mapping, quality, flow, delta) {
  const reasons = [];
  if (["sector_proxy", "broad_proxy"].includes(mapping.mapping_status)) reasons.push(`${mapping.mapping_status} with ${mapping.proxy_level} proxy`);
  if (quality.proxy_risk === "high") reasons.push("high proxy risk");
  if (!available(flow.reality)) reasons.push("flow unavailable");
  if (delta.review_flag === "insufficient_history") reasons.push("insufficient history");
  if (["unmapped", "unavailable"].includes(mapping.mapping_status)) reasons.push("instrument unavailable");
  return reasons.join("; ");
}

function markdownReport(summary) {
  const top = summary.top_observation_pools.map((row) => [
    `- **${row.pool_name}** | ${row.observation_tier} | ${row.direction}`,
    `  - flow ${row.flow_status}; momentum ${row.momentum_status}; liquidity ${row.liquidity_status}`,
    `  - evidence ${row.evidence_quality}; proxy risk ${row.proxy_risk}; capped confidence ${row.capped_confidence}`,
    `  - ${row.main_reason}`
  ].join("\n")).join("\n");
  const caution = summary.caution_pools.map((row) => `- **${row.pool_name}**: ${row.caution_reason || "quality review required"}`).join("\n");
  const gaps = summary.unresolved_gaps.map((gap) => `- ${gap.signal_type}: ${gap.affected_pool_count} pools; ${gap.next_data_need}`).join("\n");
  return `# Evening Observation Summary

## Observation State
- ${summary.observation_state}

## Data Readiness
- ${summary.data_readiness}
- Direct evidence ${formatRatio(summary.direct_evidence_ratio)}; proxy evidence ${formatRatio(summary.proxy_evidence_ratio)}.

## What Improved Today
${summary.key_findings.map((item) => `- ${item}`).join("\n")}

## Top Observation Pools
${top || "- No pool meets the current observation threshold."}

## Caution / Low Quality Pools
${caution || "- No additional caution pool."}

## Main Data Gaps
${gaps || "- No unresolved gap recorded."}

## Boundary
- observe_only
- not investment advice
- insufficient outcome history
- no source-backed hard flow yet
`;
}

function uniqueSemantic(items) {
  const seen = new Set();
  return items.filter((row) => {
    const key = row.pool_id.replace(/^a_share_a_share_/, "a_share_");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function qualityReward(quality) {
  return { high: 25, medium: 18, low: 8, unavailable: 0 }[quality] ?? 0;
}

function deltaReward(flag) {
  return { improved_data: 8, new_signal: 7, confidence_change: 4, changed: 2, stable: 0, insufficient_history: -10 }[flag] ?? 0;
}

function proxyPenalty(risk) {
  return { none: 0, low: 3, medium: 8, high: 15 }[risk] ?? 0;
}

function cautionWeight(row) {
  return ({ high: 4, medium: 3, low: 2, none: 0 }[row.proxy_risk] ?? 0) + (row.observation_tier === "insufficient" ? 3 : 0);
}

function canonicalWeight(row) {
  return row.pool_id.startsWith("a_share_a_share_") ? 0 : 1;
}

function available(status) {
  return ["source_backed", "estimated_from_source", "derived_from_market", "real_provider", "real_provider_derived"].includes(status);
}

function capApplied(signal) {
  return numberOrZero(signal?.capped_confidence) < numberOrZero(signal?.raw_confidence);
}

function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : 0;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value) {
  return Number(value.toFixed(4));
}

function formatRatio(value) {
  return `${Math.round(numberOrZero(value) * 100)}%`;
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(dataDir, file), "utf8"));
}

async function writeJson(file, value) {
  await writeFile(resolve(dataDir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
