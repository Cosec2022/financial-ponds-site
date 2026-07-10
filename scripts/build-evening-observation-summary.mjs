import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadTradingCalendar, tradingSessionTarget } from "./lib/trading-calendar.mjs";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const tradingCalendar = await loadTradingCalendar();
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
  module_id: "pool_observation_scores_v0_10_57",
  as_of: snapshot.as_of,
  generated_at: generatedAt,
  rows
};
const summary = {
  module_id: "evening_observation_summary_v0_10_57",
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
await writeCalibrationReport(rows, tierCounts, generatedAt);
await writeCandidateLedger(summary.top_observation_pools, generatedAt);
console.log(`Evening observation summary written: top=${summary.top_observation_pools.length}, strong=${tierCounts.strong_observe ?? 0}`);

function scorePool(pool) {
  const mapping = mappingByPool.get(pool.pool_id) ?? {};
  const quality = qualityByPool.get(pool.pool_id) ?? {};
  const delta = deltaByPool.get(pool.pool_id) ?? {};
  const flow = pool.signals?.flow ?? {};
  const momentum = pool.signals?.price_momentum ?? {};
  const liquidity = pool.signals?.liquidity ?? {};
  const cappedConfidence = average([quality.capped_momentum_confidence, quality.capped_liquidity_confidence]);
  const magnitude = numberOrZero(pool.vector_forecast?.magnitude);
  const flowScore = available(flow.reality) ? round(10 + Math.min(magnitude, 1) * 8) : 0;
  const momentumScore = available(momentum.reality) ? round(6 + Math.min(Math.abs(numberOrZero(momentum.value)) / 3, 1) * 6) : 0;
  const liquidityScore = available(liquidity.reality) ? (liquidity.label === "above_median" ? 10 : 6) : 0;
  const qualityScore = qualityReward(quality.evidence_quality) + (["direct_index", "direct_etf"].includes(mapping.mapping_status) ? 8 : 0);
  const deltaScore = deltaReward(delta.review_flag);
  const confidenceScore = round(cappedConfidence * 16);
  const proxyPenaltyScore = proxyPenalty(quality.proxy_risk) + (mapping.mapping_status === "broad_proxy" ? 6 : 0);
  let missingDataPenalty = [flow, momentum, liquidity].filter((signal) => !available(signal.reality)).length * 10;
  if (capApplied(momentum) || capApplied(liquidity)) missingDataPenalty += 4;
  if (delta.review_flag === "insufficient_history") missingDataPenalty += 8;
  if (["unmapped", "unavailable"].includes(mapping.mapping_status)) missingDataPenalty += 20;
  const score = round(Math.max(0, Math.min(100,
    flowScore + momentumScore + liquidityScore + qualityScore + deltaScore + confidenceScore - proxyPenaltyScore - missingDataPenalty
  )));

  return {
    pool_id: pool.pool_id,
    pool_name: pool.pool_name,
    observation_score: score,
    observation_tier: observationTier(score, quality, cappedConfidence),
    direction: pool.vector_forecast?.direction ?? "neutral",
    magnitude,
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
    flow_score: flowScore,
    momentum_score: momentumScore,
    liquidity_score: liquidityScore,
    quality_score: qualityScore,
    delta_score: deltaScore,
    confidence_score: confidenceScore,
    proxy_penalty: proxyPenaltyScore,
    missing_data_penalty: missingDataPenalty,
    final_score: score,
    boundary: "observe_only; observation priority only"
  };
}

function observationTier(score, quality, cappedConfidence) {
  const momentumAvailable = available(quality.momentum_status);
  const liquidityAvailable = available(quality.liquidity_status);
  if (score >= 77 && quality.evidence_quality === "high" && ["none", "low"].includes(quality.proxy_risk) && cappedConfidence >= 0.55 && momentumAvailable && liquidityAvailable) return "strong_observe";
  if (score >= 55 && ["high", "medium"].includes(quality.evidence_quality) && cappedConfidence >= 0.4 && (momentumAvailable || liquidityAvailable)) return "moderate_observe";
  if (score >= 35 && quality.evidence_quality !== "unavailable" && (momentumAvailable || liquidityAvailable)) return "weak_observe";
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

async function writeCalibrationReport(scoreRows, counts, timestamp) {
  const scores = scoreRows.map((row) => row.final_score).sort((a, b) => a - b);
  const strongRows = scoreRows.filter((row) => row.observation_tier === "strong_observe");
  const suspiciousFlags = [];
  if ((counts.moderate_observe ?? 0) === 0) suspiciousFlags.push("moderate_count_zero");
  if ((counts.strong_observe ?? 0) > 15) suspiciousFlags.push("strong_count_above_15");
  if (strongRows.some((row) => row.proxy_risk === "high")) suspiciousFlags.push("high_proxy_risk_tiered_strong");
  if (strongRows.some((row) => row.capped_confidence < 0.5)) suspiciousFlags.push("low_capped_confidence_tiered_strong");
  const report = {
    module_id: "score_calibration_report_v0_10_57",
    as_of: snapshot.as_of,
    generated_at: timestamp,
    strong_count: counts.strong_observe ?? 0,
    moderate_count: counts.moderate_observe ?? 0,
    weak_count: counts.weak_observe ?? 0,
    insufficient_count: counts.insufficient ?? 0,
    score_min: scores.at(0) ?? 0,
    score_max: scores.at(-1) ?? 0,
    score_median: median(scores),
    score_distribution: [
      distributionBucket(scoreRows, "77-100", 77, 101),
      distributionBucket(scoreRows, "55-76.9999", 55, 77),
      distributionBucket(scoreRows, "35-54.9999", 35, 55),
      distributionBucket(scoreRows, "0-34.9999", 0, 35)
    ],
    threshold_rules: {
      strong_observe: "final_score >= 77; high evidence; proxy risk none/low; capped confidence >= 0.55; momentum and liquidity available",
      moderate_observe: "final_score >= 55; high/medium evidence; capped confidence >= 0.40; momentum or liquidity available",
      weak_observe: "final_score >= 35; usable evidence and at least one market observation",
      insufficient: "below calibrated gates, unavailable mapping, or insufficient usable evidence"
    },
    suspicious_distribution_flags: suspiciousFlags,
    calibration_notes: [
      "Score components are persisted per pool for audit.",
      "Magnitude and market confirmation separate direct-evidence pools that previously shared one coarse score.",
      "Proxy and missing-data penalties prevent coverage quantity from becoming strong evidence.",
      "Tiers express observation priority only."
    ]
  };
  await writeJson("score_calibration_report.json", report);
}

async function writeCandidateLedger(candidates, timestamp) {
  const ledgerPath = resolve(dataDir, "observation_candidate_ledger.json");
  const existing = await readJsonOptional(ledgerPath, { rows: [] });
  const retained = (existing.rows ?? []).filter((row) => row.as_of !== snapshot.as_of).map(migrateReviewSchedule);
  const current = candidates.map((row) => {
    const due = reviewSchedule(snapshot.as_of);
    return {
      as_of: snapshot.as_of,
      pool_id: row.pool_id,
      pool_name: row.pool_name,
      observation_tier: row.observation_tier,
      observation_score: row.observation_score,
      direction: row.direction,
      magnitude: row.magnitude,
      capped_confidence: row.capped_confidence,
      flow_status: row.flow_status,
      momentum_status: row.momentum_status,
      liquidity_status: row.liquidity_status,
      evidence_quality: row.evidence_quality,
      proxy_risk: row.proxy_risk,
      main_reason: row.main_reason,
      caution_reason: row.caution_reason,
      boundary: "observe_only; review candidate only",
      ...due,
      review_policy_version: "review_policy_v0_10_65",
      review_calendar_version: tradingCalendar.calendar_version,
      review_status: row.capped_confidence > 0 ? "pending" : "insufficient_data"
    };
  });
  const ledger = {
    module_id: "observation_candidate_ledger_v0_10_57",
    as_of: snapshot.as_of,
    generated_at: timestamp,
    rows: [...retained, ...current].sort((a, b) => a.as_of.localeCompare(b.as_of) || b.observation_score - a.observation_score)
  };
  const pending = current.filter((row) => ["pending", "review_due"].includes(row.review_status));
  const schedule = {
    module_id: "candidate_review_schedule_v0_10_57",
    as_of: snapshot.as_of,
    generated_at: timestamp,
    candidate_count: current.length,
    pending_t1_count: pending.length,
    pending_t3_count: pending.length,
    pending_t5_count: pending.length,
    pending_t20_count: pending.length,
    next_review_dates: {
      t1: uniqueDates(pending.map((row) => row.review_t1_due)),
      t3: uniqueDates(pending.map((row) => row.review_t3_due)),
      t5: uniqueDates(pending.map((row) => row.review_t5_due)),
      t20: uniqueDates(pending.map((row) => row.review_t20_due))
    },
    boundary_notes: [
      "observe_only",
      "Review dates schedule evidence checks only.",
      "Future outcomes remain pending until their due date and source data are available."
    ]
  };
  await writeJson("observation_candidate_ledger.json", ledger);
  await writeJson("candidate_review_schedule.json", schedule);
}

function migrateReviewSchedule(row) {
  if (["reviewed", "insufficient_data"].includes(row.review_status)) return row;
  const migrated = reviewSchedule(row.as_of);
  const changed = ["t1", "t3", "t5", "t20"].some((key) => row[`review_${key}_due`] !== migrated[`review_${key}_due`]);
  return {
    ...row,
    ...migrated,
    review_policy_version: "review_policy_v0_10_65",
    review_calendar_version: tradingCalendar.calendar_version,
    review_schedule_migration: {
      applied: changed,
      migrated_at_as_of: snapshot.as_of,
      previous_due_dates: changed ? {
        t1: row.review_t1_due,
        t3: row.review_t3_due,
        t5: row.review_t5_due,
        t20: row.review_t20_due
      } : null
    },
    review_status: migrated.review_t1_due && snapshot.as_of >= migrated.review_t1_due ? "review_due" : "pending"
  };
}

function distributionBucket(rows, label, min, max) {
  return {
    range: label,
    count: rows.filter((row) => row.final_score >= min && row.final_score < max).length
  };
}

function median(values) {
  if (!values.length) return 0;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : round((values[middle - 1] + values[middle]) / 2);
}

function reviewSchedule(signalDate) {
  const result = {};
  for (const horizon of [1, 3, 5, 20]) {
    const target = tradingSessionTarget(tradingCalendar, signalDate, horizon);
    result[`review_t${horizon}_due`] = target.effective_review_date;
    result[`review_t${horizon}_legacy_calendar_target`] = target.legacy_calendar_target_date;
    result[`review_t${horizon}_calendar_known`] = target.calendar_known;
    result[`review_t${horizon}_calendar_unknown_reason`] = target.calendar_unknown_reason;
  }
  return result;
}

function uniqueDates(values) {
  return [...new Set(values)].sort();
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

async function readJsonOptional(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await writeFile(resolve(dataDir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
