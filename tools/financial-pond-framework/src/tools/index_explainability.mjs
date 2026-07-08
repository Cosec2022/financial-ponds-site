// FP-EXPLAIN-01 Index Explainability
// Input: published model outputs, provider CSVs, provider history, and optional graph snapshot.
// Output: index_explainability.json and index_explainability.md
// Boundary: explains displayed indexes. It does not produce execution instructions.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../collectors/http_csv_collector.mjs";
import { FORMULA_REGISTRY, formulaMap, getFormula } from "../core/formula_registry.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_ID = "index_explainability_v0_10_47";
const BOUNDARY = "Explains index source and formula only. No execution instruction.";

export async function runIndexExplainability({ rootDir = defaultRootDir, asOf }) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const inputs = await readInputs({ rootDir, asOf: resolvedAsOf });
  const payload = buildIndexExplainability({ asOf: resolvedAsOf, inputs });
  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "index_explainability.json");
  const mdPath = path.join(outDir, "index_explainability.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));
  return { payload, jsonPath, mdPath };
}

export async function readInputs({ rootDir = defaultRootDir, asOf }) {
  const modelDir = path.join(rootDir, "model_outputs", asOf);
  const [flowReview, rotationHistory, moduleReview, etfReadiness, dailyAnalysis, flowLeaderboard, attribution, watchlist, gateLedger, maturity, dataRealityAudit, providerHistory, graphSnapshot, providerRows, providerSectorRows] = await Promise.all([
    readJsonIfExists(path.join(modelDir, "sector_flow_review.json")),
    readJsonIfExists(path.join(modelDir, "sector_rotation_history.json")),
    readJsonIfExists(path.join(modelDir, "sector_module_review.json")),
    readJsonIfExists(path.join(modelDir, "etf_decision_readiness.json")),
    readJsonIfExists(path.join(modelDir, "daily_sector_analysis.json")),
    readJsonIfExists(path.join(modelDir, "etf_flow_leaderboard.json")),
    readJsonIfExists(path.join(modelDir, "sector_signal_attribution.json")),
    readJsonIfExists(path.join(modelDir, "sector_watchlist_state.json")),
    readJsonIfExists(path.join(modelDir, "decision_gate_ledger.json")),
    readJsonIfExists(path.join(modelDir, "module_maturity_audit.json")),
    readJsonIfExists(path.join(modelDir, "data_reality_audit.json")),
    readJsonIfExists(path.join(rootDir, "model_outputs", "provider_history", "akshare_provider_history.json")),
    readJsonIfExists(path.join(rootDir, "snapshots", asOf, "graph_scores.json")),
    readCsvIfExists(path.join(rootDir, "data", "provider_exports", "a_share_etf_daily.csv")),
    readCsvIfExists(path.join(rootDir, "data", "provider_exports", "a_share_sector_flow.csv"))
  ]);
  return { flowReview, rotationHistory, moduleReview, etfReadiness, dailyAnalysis, flowLeaderboard, attribution, watchlist, gateLedger, maturity, dataRealityAudit, providerHistory, graphSnapshot, providerRows, providerSectorRows };
}

export function buildIndexExplainability({ asOf, inputs, formulas = FORMULA_REGISTRY }) {
  const registry = formulaMap(formulas);
  const missing = [];
  const indexes = [];
  const context = { asOf, inputs, registry, missing };

  indexes.push(...readinessIndexes(context));
  indexes.push(...etfFlowIndexes(context));
  indexes.push(...dailyIndexes(context));
  indexes.push(...watchlistIndexes(context));
  indexes.push(...gateIndexes(context));
  indexes.push(...maturityIndexes(context));
  indexes.push(...flowReviewIndexes(context));
  indexes.push(...rotationIndexes(context));
  indexes.push(...attributionIndexes(context));

  const sanitizedIndexes = indexes.map(sanitizeIndex);
  return {
    module_id: MODULE_ID,
    as_of: inputs.dailyAnalysis?.as_of ?? inputs.etfReadiness?.as_of ?? inputs.flowReview?.as_of ?? asOf,
    generated_at: new Date().toISOString(),
    status: sanitizedIndexes.length ? "index_explainability_available" : "no_indexes",
    headline: `Index explainability: ${sanitizedIndexes.length} indexes explained; ${missing.length} missing formula entries.`,
    indexes: sanitizedIndexes,
    missing_explanations: missing.map((item) => sanitizeObject(item)),
    next_action: missing.length ? "Add missing formula registry entries before relying on those displayed indexes." : "Keep formulas aligned when displayed indexes change."
  };
}

function readinessIndexes(context) {
  const gates = context.inputs.etfReadiness?.gates ?? {};
  const blockers = context.inputs.etfReadiness?.blockers ?? [];
  const share = gates.share_change_diagnostics ?? {};
  return [
    indexItem(context, {
      index_id: "readiness.guidance_state",
      label: "Readiness guidance_state",
      value: context.inputs.etfReadiness?.guidance_state ?? gates.guidance_state ?? null,
      category: "readiness",
      formula_id: "etf_decision_readiness.gates.v1",
      source_files: ["model_outputs/<as_of>/etf_decision_readiness.json"],
      source_fields: ["guidance_state", "gates.blockers", "gates.provider_run", "gates.provider_flow_readiness", "gates.flow_source_reality"],
      inputs: {
        provider_run: gates.provider_run,
        provider_flow_readiness: gates.provider_flow_readiness,
        flow_source_reality: gates.flow_source_reality,
        sample_days: gates.sample_days,
        blockers
      },
      components: blockers.map((blocker) => ({ id: blocker.id ?? blocker, reading: blocker.reading ?? String(blocker) })),
      calculation_steps: [
        "Collect global readiness blockers from provider, source, coverage, rotation, and module seed checks.",
        "Hard provider/source/coverage blockers set guidance_state to not_ready.",
        "Remaining softer blockers set guidance_state to watch_only.",
        "No blockers sets guidance_state to decision_support_ready."
      ],
      caveats: context.inputs.etfReadiness?.interpretation_boundary ?? []
    }),
    indexItem(context, {
      index_id: "readiness.true_flow_coverage",
      label: "True-flow coverage",
      value: gates.true_flow_coverage ?? null,
      display_value: pct(gates.true_flow_coverage),
      unit: "ratio",
      category: "readiness",
      formula_id: "etf_decision_readiness.gates.v1",
      source_files: ["model_outputs/<as_of>/etf_decision_readiness.json", "model_outputs/<as_of>/sector_flow_review.json"],
      source_fields: ["gates.true_flow_coverage", "gates.observed_direct_flow_inputs", "gates.representative_sectors"],
      inputs: {
        observed_direct_flow_inputs: gates.observed_direct_flow_inputs,
        representative_sectors: gates.representative_sectors,
        true_flow_coverage: gates.true_flow_coverage
      },
      calculation_steps: ["Divide representative observed direct-flow inputs by representative sector count.", "Round to four decimals in the readiness gate."],
      caveats: ["Coverage checks observed-source direct-flow rows, not the quality of valuation/fundamental inputs."]
    }),
    indexItem(context, {
      index_id: "readiness.estimated_flow_rows",
      label: "Estimated-flow rows",
      value: share.estimated_flow_rows ?? null,
      unit: "rows",
      category: "readiness",
      formula_id: "provider.estimated_flow.v1",
      source_files: ["model_outputs/<as_of>/etf_decision_readiness.json", "model_outputs/<as_of>/akshare_provider_flow_observations.json"],
      source_fields: ["gates.share_change_diagnostics.estimated_flow_rows", "share_change_diagnostics.estimated_flow_rows"],
      inputs: {
        estimated_flow_rows: share.estimated_flow_rows,
        total_rows: share.total_rows,
        latest_share_rows: share.latest_share_rows,
        previous_share_rows: share.previous_share_rows,
        share_change_rows: share.share_change_rows
      },
      calculation_steps: ["Count provider rows where estimated_flow is numeric."],
      caveats: ["Rows need both latest and previous share values to calculate share_change."]
    })
  ];
}

function etfFlowIndexes(context) {
  const providerBySector = providerRowsBySector(context.inputs.providerRows, context.asOf);
  const rows = context.inputs.flowLeaderboard?.rows ?? [];
  return rows.flatMap((row) => {
    const provider = providerBySector.get(row.sector_id) ?? {};
    const common = {
      related_sector_id: row.sector_id,
      related_sector_name: row.name,
      source_files: ["model_outputs/<as_of>/etf_flow_leaderboard.json", "data/provider_exports/a_share_etf_daily.csv"],
      data_reality: dataReality({ real_provider: true, missing_fields: missingShareFields(provider) })
    };
    return [
      indexItem(context, {
        ...common,
        index_id: `etf.estimated_flow.${row.sector_id}`,
        label: `${row.name} ETF estimated_flow`,
        value: row.estimated_flow,
        display_value: amount(row.estimated_flow),
        unit: "currency",
        category: "etf_flow",
        formula_id: "provider.estimated_flow.v1",
        source_fields: ["latest_share", "previous_share", "share_change", "close", "estimated_flow"],
        inputs: numericPick(provider, ["latest_share", "previous_share", "share_change", "close", "estimated_flow"]),
        components: [
          { label: "latest_share", value: numberOrNull(provider.latest_share) },
          { label: "previous_share", value: numberOrNull(provider.previous_share) },
          { label: "share_change", value: numberOrNull(provider.share_change) },
          { label: "close", value: numberOrNull(provider.close) }
        ],
        calculation_steps: [
          `latest_share ${provider.latest_share ?? "--"} - previous_share ${provider.previous_share ?? "--"} = share_change ${provider.share_change ?? "--"}`,
          `share_change ${provider.share_change ?? "--"} * close ${provider.close ?? "--"} = estimated_flow ${provider.estimated_flow ?? row.estimated_flow ?? "--"}`
        ],
        caveats: ["Representative ETF row only; it is not full-sector fund coverage."]
      }),
      indexItem(context, {
        ...common,
        index_id: `etf.estimated_flow_rank.${row.sector_id}`,
        label: `${row.name} estimated_flow_rank`,
        value: row.estimated_flow_rank,
        unit: "rank",
        category: "etf_flow",
        formula_id: "etf_flow_leaderboard.rank.v1",
        source_fields: ["rows[].estimated_flow", "rows[].estimated_flow_rank"],
        inputs: { estimated_flow: row.estimated_flow, estimated_flow_rank: row.estimated_flow_rank },
        calculation_steps: ["Sort all numeric estimated_flow rows descending.", "Assign 1-based rank after sorting."],
        caveats: ["Ties are ordered by the current JavaScript sort order in the source row sequence."]
      }),
      indexItem(context, {
        ...common,
        index_id: `etf.amount_rank.${row.sector_id}`,
        label: `${row.name} amount_rank`,
        value: row.amount_rank,
        unit: "rank",
        category: "etf_flow",
        formula_id: "etf_flow_leaderboard.rank.v1",
        source_fields: ["rows[].amount", "rows[].amount_rank"],
        inputs: { amount: row.amount, amount_rank: row.amount_rank },
        calculation_steps: ["Sort all numeric amount rows descending.", "Assign 1-based rank after sorting."],
        caveats: ["Amount is attention or confirmation heat, not net flow."]
      })
    ];
  });
}

function dailyIndexes(context) {
  return flattenDailyRows(context.inputs.dailyAnalysis).flatMap((row) => [
    indexItem(context, {
      index_id: `daily.score.${row.sector_id}`,
      label: `${row.name} daily score`,
      value: row.score,
      unit: "score",
      category: "daily",
      related_sector_id: row.sector_id,
      related_sector_name: row.name,
      formula_id: "daily_sector_analysis.score_tier.v1",
      source_files: ["model_outputs/<as_of>/daily_sector_analysis.json", "model_outputs/<as_of>/sector_flow_review.json", "model_outputs/<as_of>/sector_rotation_history.json"],
      source_fields: ["tiers.*[].score", "tiers.*[].current_flow_score", "tiers.*[].tier"],
      inputs: {
        score: row.score,
        current_flow_score: row.current_flow_score,
        tier: row.tier,
        streak_days: row.streak_days,
        readiness_score: row.readiness_score
      },
      components: row.evidence ?? {},
      calculation_steps: ["Preserve source row score from rotation history or flow review.", "Round the selected score to four decimals.", "Place row into its generated daily tier list."],
      caveats: row.blockers ?? []
    }),
    indexItem(context, {
      index_id: `daily.tier.${row.sector_id}`,
      label: `${row.name} daily tier`,
      value: row.tier,
      category: "daily",
      related_sector_id: row.sector_id,
      related_sector_name: row.name,
      formula_id: "daily_sector_analysis.score_tier.v1",
      source_files: ["model_outputs/<as_of>/daily_sector_analysis.json"],
      source_fields: ["tiers.priority_watch", "tiers.confirm_next", "tiers.avoid_watch"],
      inputs: { tier: row.tier, score: row.score, module_decision_label: row.module_decision_label },
      calculation_steps: ["Rows are emitted into priority_watch, confirm_next, or avoid_watch by buildDailySectorAnalysis filters."],
      caveats: ["Tier lists are de-duplicated by sector."]
    })
  ]);
}

function watchlistIndexes(context) {
  const groups = context.inputs.watchlist?.groups ?? {};
  const groupItems = Object.entries(groups).map(([state, rows]) => indexItem(context, {
    index_id: `watchlist.count.${state}`,
    label: `Watchlist ${state} count`,
    value: rows?.length ?? 0,
    unit: "count",
    category: "watchlist",
    formula_id: "sector_watchlist_state.state.v1",
    source_files: ["model_outputs/<as_of>/sector_watchlist_state.json"],
    source_fields: [`groups.${state}`],
    inputs: { state, sectors: rows ?? [] },
    calculation_steps: [`Count sector ids in groups.${state}.`],
    caveats: ["Groups are derived after watch_state classification."]
  }));
  const rowItems = (context.inputs.watchlist?.rows ?? []).flatMap((row) => [
    indexItem(context, {
      index_id: `watchlist.watch_state.${row.sector_id}`,
      label: `${row.name} watch_state`,
      value: row.watch_state,
      category: "watchlist",
      related_sector_id: row.sector_id,
      related_sector_name: row.name,
      formula_id: "sector_watchlist_state.state.v1",
      source_files: ["model_outputs/<as_of>/sector_watchlist_state.json", "model_outputs/<as_of>/sector_signal_attribution.json", "model_outputs/<as_of>/daily_sector_analysis.json"],
      source_fields: ["rows[].watch_state", "rows[].evidence_summary", "rows[].conflict_evidence"],
      inputs: { watch_state: row.watch_state, evidence_summary: row.evidence_summary, conflict_evidence: row.conflict_evidence },
      components: { positive_evidence: row.positive_evidence, negative_evidence: row.negative_evidence },
      calculation_steps: ["Apply classifyWatchState rule order.", "Set priority_level from the resulting state and rank evidence.", "Compare previous_state to classify state_change."],
      caveats: row.downgrade_conditions ?? []
    }),
    indexItem(context, {
      index_id: `watchlist.priority_level.${row.sector_id}`,
      label: `${row.name} priority_level`,
      value: row.priority_level,
      category: "watchlist",
      related_sector_id: row.sector_id,
      related_sector_name: row.name,
      formula_id: "sector_watchlist_state.state.v1",
      source_files: ["model_outputs/<as_of>/sector_watchlist_state.json"],
      source_fields: ["rows[].priority_level", "rows[].watch_state"],
      inputs: { priority_level: row.priority_level, watch_state: row.watch_state },
      calculation_steps: ["Map watch_state and rank evidence to priorityLevel."],
      caveats: row.upgrade_conditions ?? []
    }),
    indexItem(context, {
      index_id: `watchlist.state_change.${row.sector_id}`,
      label: `${row.name} state_change`,
      value: row.state_change,
      category: "watchlist",
      related_sector_id: row.sector_id,
      related_sector_name: row.name,
      formula_id: "sector_watchlist_state.state.v1",
      source_files: ["model_outputs/<as_of>/sector_watchlist_state.json"],
      source_fields: ["rows[].previous_state", "rows[].state_change"],
      inputs: { previous_state: row.previous_state, watch_state: row.watch_state, state_change: row.state_change },
      calculation_steps: ["If no previous watchlist row exists, mark new.", "If state is unchanged, mark unchanged.", "Otherwise compare state priority order."],
      caveats: ["Requires previous watchlist output to detect unchanged/upgraded/downgraded."]
    })
  ]);
  return [...groupItems, ...rowItems];
}

function gateIndexes(context) {
  const gates = context.inputs.gateLedger?.gates ?? [];
  const counts = countBy(gates, "status");
  return [
    indexItem(context, {
      index_id: "decision_gate.counts",
      label: "Decision gate status counts",
      value: counts.block ?? 0,
      display_value: `${counts.pass ?? 0} pass / ${counts.warn ?? 0} warn / ${counts.block ?? 0} block`,
      unit: "count",
      category: "gate",
      formula_id: "decision_gate_ledger.status.v1",
      source_files: ["model_outputs/<as_of>/decision_gate_ledger.json"],
      source_fields: ["gates[].status", "blockers", "warnings", "passes"],
      inputs: counts,
      calculation_steps: ["Count gates by status."],
      caveats: [context.inputs.gateLedger?.state_consistency?.reading].filter(Boolean)
    }),
    ...gates.map((gate) => indexItem(context, {
      index_id: `decision_gate.status.${gate.gate_id}`,
      label: `${gate.label} status`,
      value: gate.status,
      category: "gate",
      formula_id: "decision_gate_ledger.status.v1",
      source_files: ["model_outputs/<as_of>/decision_gate_ledger.json"],
      source_fields: [`gates.${gate.gate_id}.status`, `gates.${gate.gate_id}.evidence`],
      inputs: gate.evidence,
      components: { reading: gate.reading, next_action: gate.next_action },
      calculation_steps: [`Evaluate explicit condition for ${gate.gate_id}.`, `Assign status ${gate.status}.`],
      caveats: [gate.reading]
    }))
  ];
}

function maturityIndexes(context) {
  const overall = context.inputs.maturity?.overall ?? {};
  return [
    indexItem(context, {
      index_id: "maturity.average_progress",
      label: "Maturity average progress",
      value: overall.average_progress ?? null,
      display_value: pct100(overall.average_progress),
      unit: "percent",
      category: "maturity",
      formula_id: "module_maturity_audit.progress.v1",
      source_files: ["model_outputs/<as_of>/module_maturity_audit.json", "docs/MODULE_PLAN.md"],
      source_fields: ["overall.average_progress", "modules[].progress"],
      inputs: { module_count: overall.module_count, average_progress: overall.average_progress },
      calculation_steps: ["Parse module progress percentages from MODULE_PLAN.", "Average all finite module progress values.", "Round to two decimals."],
      caveats: context.inputs.maturity?.boundary ?? []
    }),
    indexItem(context, {
      index_id: "maturity.decision_path_progress",
      label: "Maturity decision path progress",
      value: overall.decision_path_progress ?? null,
      display_value: pct100(overall.decision_path_progress),
      unit: "percent",
      category: "maturity",
      formula_id: "module_maturity_audit.progress.v1",
      source_files: ["model_outputs/<as_of>/module_maturity_audit.json", "docs/MODULE_PLAN.md"],
      source_fields: ["overall.decision_path_progress", "modules[].progress"],
      inputs: { decision_path_progress: overall.decision_path_progress, decision_modules: ["FP-DATA-01", "FP-FLOW-01", "FP-HIST-01", "FP-ETF-01", "FP-DAILY-01"] },
      calculation_steps: ["Filter module rows to decision path ids.", "Average their progress values.", "Round to two decimals."],
      caveats: context.inputs.maturity?.boundary ?? []
    })
  ];
}

function flowReviewIndexes(context) {
  return (context.inputs.flowReview?.sector_reviews ?? []).map((row) => indexItem(context, {
    index_id: `sector_flow.score.${sectorId(row)}`,
    label: `${row.display_name ?? row.name} sector flow score`,
    value: row.score,
    unit: "score",
    category: "sector_flow",
    related_sector_id: sectorId(row),
    related_sector_name: row.display_name ?? row.name,
    formula_id: "sector_flow_review.score.v1",
    source_files: ["model_outputs/<as_of>/sector_flow_review.json", "observations/<as_of>/*.json", "config/model/flow_engine_v0_9.json"],
    source_fields: ["sector_reviews[].components", "sector_reviews[].top_drivers", "sector_reviews[].score"],
    inputs: { score: row.score, label: row.label, confidence: row.confidence, data_completeness: row.data_completeness },
    components: row.top_drivers ?? row.components ?? {},
    calculation_steps: ["Build component scores from observations.", "Apply configured component weights.", "Clamp the weighted result to [-1, 1]."],
    caveats: context.inputs.flowReview?.data_availability?.warnings ?? []
  }));
}

function rotationIndexes(context) {
  const latest = context.inputs.rotationHistory?.latest ?? {};
  return [
    ...(latest.leaders ?? []).map((row) => rotationIndex(context, row, "leader")),
    ...(latest.laggards ?? []).map((row) => rotationIndex(context, row, "laggard"))
  ];
}

function rotationIndex(context, row, side) {
  return indexItem(context, {
    index_id: `rotation.${side}_score.${row.sector_id}`,
    label: `${row.name} ${side} score`,
    value: row.score,
    unit: "score",
    category: "rotation",
    related_sector_id: row.sector_id,
    related_sector_name: row.name,
    formula_id: "sector_rotation_history.score.v1",
    source_files: ["model_outputs/<as_of>/sector_rotation_history.json", "model_outputs/<as_of>/sector_rotation_intelligence.json"],
    source_fields: [`latest.${side}s[].score`, "trend_confirmations"],
    inputs: { score: row.score, rank: row.rank, side, sample_days: context.inputs.rotationHistory?.sample_days },
    components: { confirmation_inputs: row.confirmation_inputs ?? [] },
    calculation_steps: ["Compact latest sector_rotation_intelligence row into rotation history.", "Track whether the sector remains on the same side across stored history."],
    caveats: context.inputs.rotationHistory?.interpretation_boundary ?? []
  });
}

function attributionIndexes(context) {
  return (context.inputs.attribution?.rows ?? []).slice(0, 20).map((row) => indexItem(context, {
    index_id: `attribution.final_rank.${row.sector_id}`,
    label: `${row.name} attribution final_rank`,
    value: row.final_rank,
    unit: "rank",
    category: "attribution",
    related_sector_id: row.sector_id,
    related_sector_name: row.name,
    formula_id: "sector_signal_attribution.final_rank.v1",
    source_files: ["model_outputs/<as_of>/sector_signal_attribution.json", "model_outputs/<as_of>/daily_sector_analysis.json", "model_outputs/<as_of>/etf_flow_leaderboard.json"],
    source_fields: ["rows[].final_rank", "rows[].daily_tier", "rows[].daily_score", "rows[].signal_components.etf_flow_rank"],
    inputs: { final_rank: row.final_rank, daily_tier: row.daily_tier, daily_score: row.daily_score, etf_flow_rank: row.signal_components?.etf_flow_rank },
    components: row.signal_components ?? {},
    calculation_steps: ["Sort by daily tier priority.", "Break ties by daily score, ETF flow rank, then sector id.", "Assign final_rank from sorted order."],
    caveats: row.conflict_notes ?? []
  }));
}

function indexItem(context, spec) {
  const formula = getFormula(spec.formula_id, context.registry);
  if (!formula) {
    context.missing.push({
      index_id: spec.index_id,
      formula_id: spec.formula_id,
      status: "formula_registry_missing",
      source_files: spec.source_files ?? []
    });
  }
  return {
    index_id: spec.index_id,
    label: spec.label,
    value: spec.value ?? null,
    display_value: spec.display_value ?? displayValue(spec.value),
    unit: spec.unit ?? null,
    category: spec.category,
    related_sector_id: spec.related_sector_id ?? null,
    related_sector_name: spec.related_sector_name ?? null,
    formula_id: spec.formula_id,
    formula: formula ? {
      plain_language: formula.plain_language,
      formula_human: formula.formula_human,
      formula_machine: formula.formula_machine
    } : {
      plain_language: "formula_registry_missing",
      formula_human: "formula_registry_missing",
      formula_machine: "formula_registry_missing"
    },
    source_files: spec.source_files ?? [],
    source_fields: spec.source_fields ?? [],
    data_reality: spec.data_reality ?? inferDataReality(context.inputs),
    inputs: spec.inputs ?? {},
    components: spec.components ?? [],
    calculation_steps: spec.calculation_steps ?? [],
    caveats: spec.caveats ?? formula?.caveats ?? ["formula_registry_missing"],
    execution_boundary: spec.execution_boundary ?? formula?.execution_boundary ?? BOUNDARY
  };
}

function providerRowsBySector(rows, asOf) {
  const map = new Map();
  for (const row of rows ?? []) {
    if (row.date === asOf && row.sector_id) map.set(row.sector_id, row);
  }
  return map;
}

function flattenDailyRows(dailyAnalysis) {
  const tiers = dailyAnalysis?.tiers ?? {};
  return [
    ...(tiers.priority_watch ?? []),
    ...(tiers.confirm_next ?? []),
    ...(tiers.avoid_watch ?? [])
  ];
}

function countBy(rows, key) {
  return (rows ?? []).reduce((acc, row) => {
    const value = row?.[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, { pass: 0, warn: 0, block: 0, unknown: 0 });
}

function numericPick(row, keys) {
  return Object.fromEntries(keys.map((key) => [key, numberOrNull(row?.[key]) ?? row?.[key] ?? null]));
}

function missingShareFields(row) {
  return ["latest_share", "previous_share", "share_change", "close", "estimated_flow"].filter((key) => numberOrNull(row?.[key]) === null);
}

function dataReality({ real_provider = false, manual_seed = false, mock_or_fixture = false, missing_fields = [] } = {}) {
  return { real_provider, manual_seed, mock_or_fixture, missing_fields };
}

function inferDataReality(inputs) {
  const overall = inputs.dataRealityAudit?.overall_reality ?? "unknown";
  return {
    real_provider: Boolean(inputs.providerHistory?.status === "flow_gate_ready" || inputs.etfReadiness?.gates?.provider_run === "real_ok"),
    manual_seed: overall === "manual_seed" || inputs.etfReadiness?.gates?.valuation_fundamental_source === "manual_seed",
    mock_or_fixture: /mock|fixture|mixed_non_real|derived_from_non_real/i.test(overall),
    missing_fields: []
  };
}

function displayValue(value) {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  if (value === null || value === undefined) return "--";
  return String(value);
}

function amount(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (abs >= 10000) return `${(value / 10000).toFixed(2)}万`;
  return value.toFixed(2);
}

function pct(value) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "--";
}

function pct100(value) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "--";
}

function sectorId(row) {
  return row?.sector_id ?? String(row?.pool_id ?? "").replace(/^a_share_/, "");
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || value === "None") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizeIndex(index) {
  return sanitizeObject(index);
}

function sanitizeObject(value) {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeObject(item)]));
  }
  if (typeof value !== "string") return value;
  return value
    .replaceAll("买入", "执行")
    .replaceAll("卖出", "降低")
    .replaceAll("仓位", "配置")
    .replaceAll(/\bbuy\b/gi, "execute")
    .replaceAll(/\bsell\b/gi, "reduce")
    .replaceAll(/\bposition\b/gi, "allocation");
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readCsvIfExists(filePath) {
  try {
    return parseCsv(await readFile(filePath, "utf8"));
  } catch {
    return [];
  }
}

function buildMarkdown(payload) {
  const lines = [
    `# Index Explainability ${payload.as_of}`,
    "",
    `Status: ${payload.status}`,
    payload.headline,
    "",
    "Explanation only. No execution instruction.",
    "",
    "| Index | Value | Formula | Source |",
    "| --- | ---: | --- | --- |"
  ];
  for (const item of payload.indexes.slice(0, 80)) {
    lines.push(`| ${item.label} | ${item.display_value} | ${item.formula_id} | ${item.source_files.join("<br>")} |`);
  }
  if (payload.missing_explanations.length) {
    lines.push("", "## Missing explanations", "");
    for (const item of payload.missing_explanations) lines.push(`- ${item.index_id}: ${item.formula_id}`);
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runIndexExplainability({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Index explainability written: ${result.jsonPath}`);
  console.log(`Index explainability report written: ${result.mdPath}`);
  console.log(result.payload.headline);
}
