import { createHash } from "node:crypto";

export const SNAPSHOT_SCHEMA_VERSION = "daily_longitudinal_snapshot_v1";
export const FEATURE_SCHEMA_VERSION = "daily_longitudinal_feature_v1";
export const REALITY_LABELS = new Set(["real", "estimated", "proxy", "manual_seed", "mock", "derived_from_non_real", "missing"]);
export const FINALITY_STATUSES = new Set(["provisional", "final", "corrected"]);

export function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

export function contentHash(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function buildDailyLongitudinalSnapshot(input) {
  const asOf = required(input.as_of, "as_of");
  const finalityStatus = input.finality_status ?? "final";
  if (!FINALITY_STATUSES.has(finalityStatus)) throw new Error(`Invalid finality_status: ${finalityStatus}`);
  const scoreByPool = byPool(input.pool_observation_scores?.rows);
  const mappingByPool = byPool(input.pool_instrument_map?.rows);
  const marketByPool = byPool(input.pool_market_signals?.rows);
  const flowByPool = byPool(input.pool_flow_signals?.rows);
  const stateByPool = byPool(input.candidate_state_model?.rows);
  const candidateByPool = byPool(input.observation_candidate_ledger?.rows);
  const pools = [...(input.observation_snapshot?.rows ?? [])].sort((a, b) => String(a.pool_id).localeCompare(String(b.pool_id)));
  const rows = pools.map((pool, index) => buildRow({ pool, index, total: pools.length, score: scoreByPool.get(pool.pool_id), mapping: mappingByPool.get(pool.pool_id), market: marketByPool.get(pool.pool_id), flow: flowByPool.get(pool.pool_id), state: stateByPool.get(pool.pool_id), candidate: candidateByPool.get(pool.pool_id) }));
  const header = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    snapshot_id: input.snapshot_id ?? `${asOf}:${input.model_version ?? "unknown"}:${finalityStatus}`,
    as_of: asOf,
    market: input.market ?? "a_share",
    timezone: input.timezone ?? "Asia/Shanghai",
    session_status: input.session_status ?? "closed",
    finality_status: finalityStatus,
    generated_at: required(input.generated_at, "generated_at"),
    publication_cutoff: input.publication_cutoff ?? asOf,
    model_version: input.model_version ?? "unknown",
    model_commit: input.model_commit ?? null,
    config_hash: input.config_hash ?? null,
    feature_schema_version: FEATURE_SCHEMA_VERSION,
    provider_versions: input.provider_versions ?? {},
    source_manifest: input.source_manifest ?? [],
    calendar_version: input.calendar_version ?? null,
    benchmark_definition: input.benchmark_definition ?? null,
    mapping_version: input.mapping_version ?? input.pool_instrument_map?.module_id ?? null,
    row_count: rows.length,
    warnings: input.warnings ?? [],
    rows
  };
  return { ...header, content_hash: contentHash(header) };
}

function buildRow({ pool, index, total, score = {}, mapping = {}, market = {}, flow = {}, state = {}, candidate = {} }) {
  const flowReality = normalizeReality(flow.flow_status, flow.source_type);
  const mappingType = mapping.mapping_status === "direct_etf" || mapping.mapping_status === "direct_index" ? "direct" : mapping.mapping_status === "unmapped" ? "missing" : "sector_proxy";
  const featureValues = {
    flow: nullable(pool.signals?.flow?.value ?? flow.flow_value),
    price_momentum: nullable(pool.signals?.price_momentum?.value ?? market.momentum_value),
    liquidity: nullable(pool.signals?.liquidity?.value ?? market.liquidity_value),
    rotation: nullable(pool.signals?.rotation?.value),
    news: nullable(pool.signals?.news?.value)
  };
  const missingFields = Object.entries(featureValues).filter(([, value]) => value === null).map(([key]) => key);
  return {
    pool_id: pool.pool_id,
    pool_name: pool.pool_name ?? null,
    market: mapping.market ?? pool.universe ?? "a_share",
    taxonomy: pool.sector_id ?? null,
    parent_pool_ids: pool.parent_pool_ids ?? [],
    related_pool_ids: pool.related_pool_ids ?? [],
    instrument_id: mapping.instrument_code ?? null,
    symbol: mapping.instrument_code ?? market.instrument_code ?? null,
    instrument_name: mapping.instrument_name ?? market.instrument_name ?? null,
    mapping_type: mappingType,
    mapping_quality: nullable(mapping.mapping_confidence),
    mapping_effective_from: mapping.mapping_effective_from ?? null,
    mapping_effective_to: mapping.mapping_effective_to ?? null,
    tradable_eligibility: mappingType === "direct" ? "eligible" : "not_eligible",
    tradable_rejection_reasons: mappingType === "direct" ? [] : [mapping.mapping_status ?? "missing_mapping"],
    close: nullable(market.price_close ?? market.market_close),
    previous_close: nullable(market.previous_close),
    pct_change: nullable(market.momentum_value),
    volume: nullable(market.volume),
    amount: nullable(market.amount),
    turnover: nullable(market.turnover),
    source_date: market.source_date ?? market.price_date ?? null,
    source_timestamp: market.source_timestamp ?? null,
    flow_value: nullable(flow.flow_value),
    flow_unit: flow.flow_unit ?? null,
    flow_direction: flow.flow_direction ?? "neutral",
    flow_reality_label: flowReality,
    flow_source: flow.source_file ?? null,
    flow_missing_reason: flowReality === "missing" ? flow.reason ?? "missing_flow" : null,
    feature_values: featureValues,
    feature_availability: Object.fromEntries(Object.entries(featureValues).map(([key, value]) => [key, value !== null])),
    feature_window: { as_of: pool.as_of ?? null },
    feature_source: Object.fromEntries(Object.keys(featureValues).map((key) => [key, pool.signals?.[key]?.source_file ?? null])),
    feature_quality: { evidence_quality: score.evidence_quality ?? null, proxy_risk: score.proxy_risk ?? null },
    absolute_strength: nullable(pool.vector_forecast?.magnitude),
    component_scores: componentScores(score),
    final_score: nullable(score.final_score ?? score.observation_score),
    rank: Number.isFinite(index) ? index + 1 : null,
    percentile: total ? Number((((total - index) / total) * 100).toFixed(4)) : null,
    direction: score.direction ?? pool.vector_forecast?.direction ?? "neutral",
    persistence: pool.signals?.rotation?.label ?? null,
    major_wave_score: nullable(state.major_wave_score ?? score.major_wave_score),
    major_wave_state: state.candidate_state ?? score.candidate_state ?? null,
    right_side_state: state.candidate_state ?? score.candidate_state ?? null,
    overheat_state: state.overheat_score === null || state.overheat_score === undefined ? null : state.overheat_score > 0 ? "flagged" : "clear",
    risk_state: state.risk_gate_status ?? score.risk_gate_status ?? null,
    candidate_qualified: Boolean(candidate.pool_id),
    candidate_rank: candidate.pool_id ? null : null,
    candidate_reasons: candidate.pool_id ? [candidate.main_reason].filter(Boolean) : [],
    rejection_reasons: candidate.pool_id ? [] : [score.observation_tier ?? "not_candidate"],
    data_complete: missingFields.length === 0,
    missing_fields: missingFields,
    stale_fields: [],
    proxy_fields: mappingType === "sector_proxy" ? ["mapping"] : [],
    quality_score: nullable(score.capped_confidence),
    quality_notes: [score.main_reason, mapping.mapping_method, flow.reason].filter(Boolean)
  };
}

function componentScores(score) { return Object.fromEntries(["flow_score", "momentum_score", "liquidity_score", "quality_score", "delta_score", "confidence_score", "proxy_penalty", "missing_data_penalty"].map((key) => [key, nullable(score?.[key]) ])); }
function byPool(rows = []) { return new Map(rows.map((row) => [row.pool_id, row])); }
function nullable(value) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function required(value, name) { if (!value) throw new Error(`Missing required ${name}`); return value; }
function normalizeReality(status, source) { if (["source_backed", "real", "derived_from_market"].includes(status)) return "real"; if (status === "estimated_from_source") return "estimated"; if (status === "mock" || source === "config/mock_scores") return "mock"; if (status === "manual_seed") return "manual_seed"; if (status === "proxy") return "proxy"; if (status === "derived_from_non_real") return "derived_from_non_real"; return "missing"; }
function sortKeys(value) { if (Array.isArray(value)) return value.map(sortKeys); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])])); return value; }
