import { readFile } from "node:fs/promises";

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function topSectors(rows, direction) {
  return [...rows]
    .filter((row) => typeof row.score === "number")
    .sort((a, b) => direction * ((b.score ?? 0) - (a.score ?? 0)))
    .slice(0, 5)
    .map((row) => ({
      sector_id: row.sector_id,
      name: row.name ?? row.display_name ?? row.sector_id,
      score: row.score,
      label: row.label?.text ?? row.label ?? row.decision?.text ?? null
    }));
}

const [
  flow,
  rotationHistory,
  moduleReview,
  readiness,
  daily,
  maturity,
  attribution,
  watchlist,
  gateLedger,
  explainability
] = await Promise.all([
  readJson("financial-pond/data/sector_flow_review.json"),
  readJson("financial-pond/data/sector_rotation_history.json"),
  readJson("financial-pond/data/sector_module_review.json"),
  readJson("financial-pond/data/etf_decision_readiness.json"),
  readJson("financial-pond/data/daily_sector_analysis.json"),
  readJson("financial-pond/data/module_maturity_audit.json"),
  readJson("financial-pond/data/sector_signal_attribution.json"),
  readJson("financial-pond/data/sector_watchlist_state.json"),
  readJson("financial-pond/data/decision_gate_ledger.json"),
  readJson("financial-pond/data/index_explainability.json")
]);

const asOf = readiness?.as_of ?? daily?.as_of ?? flow?.as_of ?? new Date().toISOString().slice(0, 10);
const [providerHistory, providerObs] = await Promise.all([
  readJson("tools/financial-pond-framework/model_outputs/provider_history/akshare_provider_history.json"),
  readJson(`tools/financial-pond-framework/model_outputs/${asOf}/akshare_provider_flow_observations.json`)
]);

const gates = readiness?.gates ?? daily?.gate_summary ?? {};
const shareChange = providerObs?.share_change_diagnostics ?? gates.share_change_diagnostics ?? {};
const providerHistoryPayload = providerObs?.provider_history ?? shareChange.provider_history ?? providerHistory?.history ?? providerHistory ?? null;
const flowRows = flow?.sector_reviews ?? [];
const moduleRows = moduleReview?.sectors ?? [];
const providerDates = uniq([
  ...(providerHistoryPayload?.available_dates ?? []),
  ...(providerHistory?.available_dates ?? []),
  ...(providerHistory?.dates ?? [])
]);
const blockers = uniq([
  ...(readiness?.blockers ?? []).map((item) => item.id ?? item),
  ...(daily?.decision_gap?.checks ?? []).filter((item) => item.status !== "passed").map((item) => item.id ?? item.label),
  ...(maturity?.recommended_mainline?.blockers ?? [])
]);

const summary = {
  as_of: asOf,
  provider_flow_readiness: providerObs?.readiness ?? gates.provider_flow_readiness ?? "unknown",
  provider_history_status: providerHistory?.status ?? providerHistoryPayload?.status ?? (providerHistoryPayload?.date_count ? "available" : "unknown"),
  dates: providerDates,
  estimated_flow_rows: shareChange.estimated_flow_rows ?? providerObs?.counts?.flow_ready_rows ?? null,
  guidance_state: readiness?.guidance_state ?? gates.guidance_state ?? null,
  true_flow_coverage: gates.true_flow_coverage ?? null,
  daily_headline: daily?.headline ?? null,
  priority_watch: (daily?.tiers?.priority_watch ?? []).map((row) => row.name ?? row.sector_id),
  top_positive_sectors: topSectors(flowRows.length ? flowRows : moduleRows, 1),
  top_negative_sectors: topSectors(flowRows.length ? flowRows : moduleRows, -1),
  sample_days: gates.sample_days ?? rotationHistory?.sample_days ?? null,
  maturity_average: maturity?.overall?.average_progress ?? null,
  maturity_decision_path: maturity?.overall?.decision_path_progress ?? null,
  attribution_headline: attribution?.headline ?? null,
  conflicts_count: attribution?.conflicts?.length ?? 0,
  first_conflict: attribution?.conflicts?.[0] ?? null,
  top_attribution_rows: (attribution?.rows ?? []).slice(0, 5).map((row) => ({
    sector_id: row.sector_id,
    name: row.name,
    daily_tier: row.daily_tier,
    daily_score: row.daily_score,
    final_rank: row.final_rank,
    etf_flow_rank: row.signal_components?.etf_flow_rank ?? null,
    conflict_notes: row.conflict_notes ?? [],
    manual_review_boundary: row.manual_review_boundary
  })),
  watchlist_headline: watchlist?.headline ?? null,
  watchlist_group_counts: watchlist?.groups ? Object.fromEntries(Object.entries(watchlist.groups).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])) : null,
  conflict_review_sectors: watchlist?.groups?.conflict_review ?? [],
  confirmed_watch_sectors: watchlist?.groups?.confirmed_watch ?? [],
  flow_only_candidate_sectors: watchlist?.groups?.flow_only_candidate ?? [],
  deteriorating_watch_sectors: watchlist?.groups?.deteriorating_watch ?? [],
  blocked_execution_reason: (watchlist?.rows ?? []).find((row) => row.execution_boundary?.includes("blocked"))?.execution_boundary ?? null,
  execution_state: gateLedger?.execution_state ?? null,
  gate_counts: gateLedger?.gates ? {
    pass: gateLedger.gates.filter((gate) => gate.status === "pass").length,
    warn: gateLedger.gates.filter((gate) => gate.status === "warn").length,
    block: gateLedger.gates.filter((gate) => gate.status === "block").length,
    unknown: gateLedger.gates.filter((gate) => gate.status === "unknown").length
  } : null,
  gate_top_blockers: (gateLedger?.blockers ?? []).slice(0, 5).map((gate) => ({
    gate_id: gate.gate_id,
    label: gate.label,
    reading: gate.reading
  })),
  gate_next_unlock_sequence: gateLedger?.next_unlock_sequence ?? [],
  provider_ready_but_execution_blocked: gateLedger?.state_consistency?.provider_ready_but_execution_blocked ?? null,
  explainability_status: explainability?.status ?? null,
  explained_index_count: explainability?.indexes?.length ?? 0,
  missing_explanations_count: explainability?.missing_explanations?.length ?? 0,
  top_missing_explanations: (explainability?.missing_explanations ?? []).slice(0, 5).map((item) => ({
    index_id: item.index_id,
    formula_id: item.formula_id,
    status: item.status
  })),
  blockers,
  next_action: daily?.next_unlock?.label ?? readiness?.progress?.next_unlock?.label ?? maturity?.recommended_mainline?.next_actions?.[0] ?? null
};

console.log(JSON.stringify(summary, null, 2));
