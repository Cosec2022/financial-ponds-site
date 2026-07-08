const EXECUTION_BOUNDARY = "Explanation only. No execution instruction.";

export const FORMULA_REGISTRY = [
  {
    formula_id: "provider.estimated_flow.v1",
    label: "Provider estimated_flow",
    plain_language: "Representative ETF flow is the ETF share change multiplied by the latest close. The provider export calculates and stores the raw value.",
    formula_human: "estimated_flow = share_change * close; share_change = latest_share - previous_share.",
    formula_machine: "estimated_flow = (latest_share - previous_share) * close",
    inputs: ["latest_share", "previous_share", "share_change", "close"],
    output: "estimated_flow",
    caveats: ["Requires a previous provider date. A first-date baseline cannot produce share_change."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "etf_flow_leaderboard.rank.v1",
    label: "ETF flow leaderboard rank",
    plain_language: "Leaderboard ranks sort available numeric rows from high to low.",
    formula_human: "estimated_flow_rank and amount_rank are 1-based descending ranks within the provider row set.",
    formula_machine: "rank = index(descending(rows by metric)) + 1",
    inputs: ["estimated_flow", "amount"],
    output: "estimated_flow_rank | amount_rank",
    caveats: ["Rows without a numeric metric do not receive a rank."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "sector_flow_review.score.v1",
    label: "Sector flow review score",
    plain_language: "The flow review score is a weighted average of available component scores, then clamped to [-1, 1].",
    formula_human: "score = clamp(sum(component_score * component_weight for available components) / sum(abs(all configured weights)), -1, 1).",
    formula_machine: "score = clamp(weightedScore(components, component_weights).score, -1, 1)",
    inputs: ["components", "component_weights"],
    output: "score",
    caveats: ["Unavailable components contribute no numerator but configured weights remain in the denominator."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "sector_rotation_history.score.v1",
    label: "Rotation leader or laggard score",
    plain_language: "Rotation history preserves the latest sector score produced by sector rotation intelligence and tracks streaks across stored days.",
    formula_human: "latest leader/laggard score = compacted latest rotation intelligence row score; streak_days = consecutive days on the same side.",
    formula_machine: "score = latest.{leaders|laggards}[sector].score; streak_days = sideStreak(history, sector, side)",
    inputs: ["latest.leaders.score", "latest.laggards.score", "history"],
    output: "score | streak_days",
    caveats: ["History cannot infer missing days; it only compares stored snapshots."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "daily_sector_analysis.score_tier.v1",
    label: "Daily sector score and tier",
    plain_language: "Daily rows preserve the source score from rotation or flow rows, then tier lists are filtered by priority, confirmation, and risk rules.",
    formula_human: "row.score = row.score ?? flow.score; priority_watch requires persistent leader score >= 0.08; confirm_next requires score >= 0.12 and not already priority; avoid_watch uses score <= 0.08 or risk module labels.",
    formula_machine: "score = numberOrNull(source.score ?? flow.score) ?? 0; tier = selected list in buildDailySectorAnalysis",
    inputs: ["rotation_history", "sector_flow_review", "sector_module_review", "etf_decision_readiness"],
    output: "score | tier | current_flow_score",
    caveats: ["Tier membership is list-based and de-duplicated by sector."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "etf_decision_readiness.gates.v1",
    label: "ETF readiness gates",
    plain_language: "Guidance state is derived from blocker gates. True-flow coverage is observed representative direct-flow rows divided by representative sectors.",
    formula_human: "true_flow_coverage = observed_direct_flow_inputs / representative_sectors. guidance_state = not_ready if hard blockers exist; watch_only if only softer blockers remain; otherwise decision_support_ready.",
    formula_machine: "guidance_state = blockerClass(blockers); true_flow_coverage = observedDirect / representativeSectors",
    inputs: ["provider_run", "provider_flow_readiness", "flow_source_reality", "observed_direct_flow_inputs", "representative_sectors", "sample_days", "module seeds"],
    output: "guidance_state | true_flow_coverage",
    caveats: ["Manual seed valuation or fundamental inputs keep readiness constrained even when provider flow is ready."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "sector_signal_attribution.final_rank.v1",
    label: "Signal attribution final rank",
    plain_language: "Attribution rows are sorted by daily tier priority, daily score, ETF flow rank, and sector id.",
    formula_human: "sort by tierPriority, descending daily_score, ascending etf_flow_rank, sector_id; final_rank = sorted index + 1.",
    formula_machine: "final_rank = index(sort(rows, rowSort)) + 1",
    inputs: ["daily_tier", "daily_score", "etf_flow_rank", "sector_id"],
    output: "final_rank",
    caveats: ["Final rank is explanatory ordering, not an execution ranking."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "sector_watchlist_state.state.v1",
    label: "Watchlist state",
    plain_language: "Watchlist state is a rule order over daily tier, conflicts, ETF flow rank, rotation strength, deterioration, and fallback boundary.",
    formula_human: "priority with conflict -> conflict_review; priority -> confirmed_watch; conflict -> conflict_review; top positive flow alone -> flow_only_candidate; strong rotation without flow -> rotation_only_candidate; deterioration -> deteriorating_watch; avoid tier -> avoid_watch; otherwise blocked_execution.",
    formula_machine: "watch_state = classifyWatchState({daily, attribution, etf, rotation, module, flow})",
    inputs: ["daily.tier", "attribution.conflict_notes", "etf.estimated_flow", "etf.estimated_flow_rank", "rotation", "module", "flow"],
    output: "watch_state | priority_level | state_change",
    caveats: ["State changes need a previous watchlist file; first observed rows are marked new."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "decision_gate_ledger.status.v1",
    label: "Decision gate status",
    plain_language: "Each gate status is assigned by explicit readiness conditions; pass, warn, block, or unknown are then counted.",
    formula_human: "gate_counts = count(gates by status). Individual gate conditions are encoded in decision_gate_ledger.mjs.",
    formula_machine: "gate_counts = gates.reduce(countBy(status))",
    inputs: ["etf_readiness.gates", "watchlist.groups", "attribution.conflicts", "data_reality_audit", "graph_snapshot"],
    output: "gate.status | gate_counts",
    caveats: ["Provider-ready can coexist with blocked execution when non-provider gates fail."],
    execution_boundary: EXECUTION_BOUNDARY
  },
  {
    formula_id: "module_maturity_audit.progress.v1",
    label: "Module maturity progress",
    plain_language: "Maturity progress parses module percentages from MODULE_PLAN and averages them.",
    formula_human: "average_progress = average(all module progress). decision_path_progress = average(FP-DATA-01, FP-FLOW-01, FP-HIST-01, FP-ETF-01, FP-DAILY-01 progress).",
    formula_machine: "average(values); average(decisionPathModules.map(progress))",
    inputs: ["MODULE_PLAN module rows", "decision path module ids"],
    output: "average_progress | decision_path_progress",
    caveats: ["This is project readiness, not market direction."],
    execution_boundary: EXECUTION_BOUNDARY
  }
];

const FORMULA_BY_ID = new Map(FORMULA_REGISTRY.map((formula) => [formula.formula_id, formula]));

export function getFormula(formulaId, registry = FORMULA_BY_ID) {
  if (registry instanceof Map) return registry.get(formulaId) ?? null;
  return new Map((registry ?? []).map((formula) => [formula.formula_id, formula])).get(formulaId) ?? null;
}

export function formulaMap(registry = FORMULA_REGISTRY) {
  return new Map(registry.map((formula) => [formula.formula_id, formula]));
}
