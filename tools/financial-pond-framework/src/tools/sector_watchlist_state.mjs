// FP-WATCH-01 Sector Watchlist State
// Input: daily sector analysis, sector signal attribution, ETF flow leaderboard,
// ETF readiness, rotation history, module review, and flow review.
// Output: sector_watchlist_state.json and sector_watchlist_state.md
// Boundary: observation-only state machine. It must not emit execution advice.

import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_ID = "sector_watchlist_state_v0_10_45";
const WATCH_STATES = [
  "confirmed_watch",
  "conflict_review",
  "flow_only_candidate",
  "rotation_only_candidate",
  "deteriorating_watch",
  "avoid_watch",
  "blocked_execution"
];

export async function runSectorWatchlistState({
  rootDir = defaultRootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const inputs = await readInputs({ rootDir, asOf: resolvedAsOf });
  const payload = buildSectorWatchlistState({ asOf: resolvedAsOf, inputs });
  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "sector_watchlist_state.json");
  const mdPath = path.join(outDir, "sector_watchlist_state.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));
  return { payload, jsonPath, mdPath };
}

export async function readInputs({ rootDir = defaultRootDir, asOf }) {
  const modelDir = path.join(rootDir, "model_outputs", asOf);
  const [dailyAnalysis, attribution, etfFlowLeaderboard, etfReadiness, rotationHistory, moduleReview, flowReview, previousWatchlist] = await Promise.all([
    readJsonIfExists(path.join(modelDir, "daily_sector_analysis.json")),
    readJsonIfExists(path.join(modelDir, "sector_signal_attribution.json")),
    readJsonIfExists(path.join(modelDir, "etf_flow_leaderboard.json")),
    readJsonIfExists(path.join(modelDir, "etf_decision_readiness.json")),
    readJsonIfExists(path.join(modelDir, "sector_rotation_history.json")),
    readJsonIfExists(path.join(modelDir, "sector_module_review.json")),
    readJsonIfExists(path.join(modelDir, "sector_flow_review.json")),
    readPreviousWatchlist({ rootDir, asOf })
  ]);
  return { dailyAnalysis, attribution, etfFlowLeaderboard, etfReadiness, rotationHistory, moduleReview, flowReview, previousWatchlist };
}

export function buildSectorWatchlistState({ asOf, inputs }) {
  const dailyRows = flattenDailyRows(inputs.dailyAnalysis);
  const dailyBySector = new Map(dailyRows.map((row) => [row.sector_id, row]));
  const attributionBySector = new Map((inputs.attribution?.rows ?? []).map((row) => [row.sector_id, row]));
  const etfBySector = new Map((inputs.etfFlowLeaderboard?.rows ?? []).map((row) => [row.sector_id, row]));
  const moduleBySector = new Map((inputs.moduleReview?.sectors ?? []).map((row) => [row.sector_id, row]));
  const flowBySector = new Map((inputs.flowReview?.sector_reviews ?? []).map((row) => [sectorId(row), row]));
  const rotationBySector = buildRotationMap(inputs.rotationHistory, dailyRows);
  const previousBySector = new Map((inputs.previousWatchlist?.rows ?? []).map((row) => [row.sector_id, row]));
  const guidanceState = inputs.etfReadiness?.guidance_state ?? inputs.dailyAnalysis?.gate_summary?.guidance_state ?? inputs.attribution?.guidance_state ?? "unknown";
  const executionBlocked = !["execution_ready", "decision_support_ready"].includes(guidanceState);
  const sectors = collectSectorIds({ dailyBySector, attributionBySector, etfBySector, moduleBySector, flowBySector, rotationBySector });

  const rows = sectors.map((id) => {
    const daily = dailyBySector.get(id) ?? {};
    const attribution = attributionBySector.get(id) ?? {};
    const etf = etfBySector.get(id) ?? {};
    const module = moduleBySector.get(id) ?? {};
    const flow = flowBySector.get(id) ?? {};
    const rotation = rotationBySector.get(id) ?? {};
    const watchState = classifyWatchState({ daily, attribution, etf, rotation, module, flow });
    const previousState = previousBySector.get(id)?.watch_state ?? null;
    const stateChange = stateChangeLabel({ previousState, watchState, hasPrevious: Boolean(inputs.previousWatchlist) });
    const conflictEvidence = [...(attribution.conflict_notes ?? [])];
    const positiveEvidence = buildPositiveEvidence({ daily, attribution, etf, rotation, flow });
    const negativeEvidence = buildNegativeEvidence({ daily, attribution, etf, rotation, module, flow });
    const executionBoundary = executionBlocked
      ? `execution language blocked: guidance_state=${guidanceState}; observation-only review.`
      : "observation-only review; human confirmation still required.";

    return {
      sector_id: id,
      name: daily.name ?? attribution.name ?? displayName(module.name) ?? flow.name ?? etf.name ?? id,
      watch_state: watchState,
      previous_state: previousState,
      state_change: stateChange,
      priority_level: priorityLevel({ watchState, daily, attribution, etf }),
      evidence_summary: evidenceSummary({ watchState, daily, attribution, etf, rotation }),
      positive_evidence: positiveEvidence,
      negative_evidence: negativeEvidence,
      conflict_evidence: conflictEvidence,
      upgrade_conditions: upgradeConditions({ watchState, guidanceState }),
      downgrade_conditions: downgradeConditions({ watchState }),
      execution_boundary: executionBoundary,
      manual_review_required: conflictEvidence.length > 0 || watchState === "conflict_review" || executionBlocked
    };
  }).sort(rowSort);

  const groups = buildGroups(rows, executionBlocked);
  return {
    module_id: MODULE_ID,
    as_of: inputs.dailyAnalysis?.as_of ?? inputs.attribution?.as_of ?? asOf,
    generated_at: new Date().toISOString(),
    status: rows.length ? "watchlist_state_available" : "no_watchlist_rows",
    guidance_state: guidanceState,
    headline: buildHeadline({ rows, groups, guidanceState }),
    rows,
    groups,
    next_action: nextAction({ groups, guidanceState })
  };
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function readPreviousWatchlist({ rootDir, asOf }) {
  try {
    const entries = await readdir(path.join(rootDir, "model_outputs"), { withFileTypes: true });
    const previousDates = entries
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && entry.name < asOf)
      .map((entry) => entry.name)
      .sort();
    for (const date of previousDates.reverse()) {
      const payload = await readJsonIfExists(path.join(rootDir, "model_outputs", date, "sector_watchlist_state.json"));
      if (payload) return payload;
    }
  } catch {
    return null;
  }
  return null;
}

function flattenDailyRows(dailyAnalysis) {
  const tiers = dailyAnalysis?.tiers ?? {};
  return [
    ...(tiers.priority_watch ?? []),
    ...(tiers.confirm_next ?? []),
    ...(tiers.avoid_watch ?? [])
  ];
}

function sectorId(row) {
  return row?.sector_id ?? String(row?.pool_id ?? "").replace(/^a_share_/, "");
}

function displayName(name) {
  return name ? String(name).replace(/^A-share /, "").replace(/ Pool$/, "") : null;
}

function collectSectorIds(maps) {
  return [...new Set(Object.values(maps).flatMap((map) => [...map.keys()]).filter(Boolean))];
}

function buildRotationMap(rotationHistory, dailyRows) {
  const map = new Map();
  for (const row of dailyRows) {
    const diagnostic = row.rotation_diagnostic ?? {};
    map.set(row.sector_id, {
      label: diagnostic.label ?? null,
      state: diagnostic.state ?? null,
      role: diagnostic.latest_role ?? null,
      score: row.score ?? null,
      streak_days: row.streak_days ?? diagnostic.leader_days ?? diagnostic.laggard_days ?? null
    });
  }
  for (const row of rotationHistory?.latest?.leaders ?? []) {
    map.set(row.sector_id, { ...(map.get(row.sector_id) ?? {}), label: map.get(row.sector_id)?.label ?? "领先", role: "leader", score: row.score });
  }
  for (const row of rotationHistory?.latest?.laggards ?? []) {
    map.set(row.sector_id, { ...(map.get(row.sector_id) ?? {}), label: map.get(row.sector_id)?.label ?? "弱势", role: "laggard", score: row.score });
  }
  return map;
}

function classifyWatchState({ daily, attribution, etf, rotation, module, flow }) {
  const conflicts = attribution.conflict_notes ?? [];
  if (daily.tier === "priority_watch" && conflicts.length) return "conflict_review";
  if (daily.tier === "priority_watch") return "confirmed_watch";
  if (conflicts.length) return "conflict_review";
  if (isFlowOnlyCandidate({ etf, daily })) return "flow_only_candidate";
  if (isRotationOnlyCandidate({ etf, rotation, daily })) return "rotation_only_candidate";
  if (isDeteriorating({ daily, etf, module, flow, rotation })) return "deteriorating_watch";
  if (daily.tier === "avoid_watch") return "avoid_watch";
  return "blocked_execution";
}

function isFlowOnlyCandidate({ etf, daily }) {
  const flow = numberOrNull(etf.estimated_flow);
  const rank = numberOrNull(etf.estimated_flow_rank);
  return flow > 0 && rank !== null && rank <= 3 && (!daily.tier || daily.tier === "unranked" || daily.tier === "avoid_watch" || numberOrNull(daily.score) < 0);
}

function isRotationOnlyCandidate({ etf, rotation, daily }) {
  const flow = numberOrNull(etf.estimated_flow);
  return isStrongRotation({ rotation, daily }) && (flow === null || flow <= 0);
}

function isDeteriorating({ daily, etf, module, flow, rotation }) {
  const negativeFlow = numberOrNull(etf.estimated_flow) < 0 || numberOrNull(flow.score ?? daily.score) < -0.08;
  const formerlyStrong = ["confirm_next", "priority_watch"].includes(daily.tier)
    || isStrongRotation({ rotation, daily })
    || ["balanced_candidate", "cheap_with_flow", "undervalued_turning", "expensive_momentum"].includes(module.decision?.label);
  const downgradedTier = ["avoid_watch"].includes(daily.tier) || daily.rotation_diagnostic?.state === "leader_to_laggard_reversal";
  return formerlyStrong && (negativeFlow || downgradedTier);
}

function isStrongRotation({ rotation, daily }) {
  const label = `${rotation.label ?? daily.rotation_diagnostic?.label ?? ""}${rotation.state ?? daily.rotation_diagnostic?.state ?? ""}`;
  return rotation.role === "leader"
    || daily.rotation_diagnostic?.latest_role === "leader"
    || /领先|强势|leader|strengthening/i.test(label)
    || numberOrNull(rotation.score ?? daily.score) > 0.18;
}

function stateChangeLabel({ previousState, watchState, hasPrevious }) {
  if (!hasPrevious) return "new";
  if (!previousState) return "new";
  if (previousState === watchState) return "unchanged";
  return statePriority(watchState) < statePriority(previousState) ? "upgraded" : "downgraded";
}

function statePriority(state) {
  const order = {
    confirmed_watch: 0,
    conflict_review: 1,
    flow_only_candidate: 2,
    rotation_only_candidate: 3,
    deteriorating_watch: 4,
    avoid_watch: 5,
    blocked_execution: 6
  };
  return order[state] ?? 7;
}

function priorityLevel({ watchState, daily, attribution, etf }) {
  if (watchState === "confirmed_watch") return "high";
  if (watchState === "conflict_review") return "manual_review";
  if (["flow_only_candidate", "rotation_only_candidate"].includes(watchState)) return "medium";
  if (watchState === "deteriorating_watch") return "risk_review";
  if (daily.tier === "avoid_watch") return "low";
  if ((attribution.final_rank ?? 99) <= 5 || (etf.estimated_flow_rank ?? 99) <= 3) return "medium";
  return "background";
}

function evidenceSummary({ watchState, daily, attribution, etf, rotation }) {
  const parts = [
    `state=${watchState}`,
    `daily=${daily.tier ?? "unranked"}`,
    `ETF flow rank=${etf.estimated_flow_rank ?? attribution.signal_components?.etf_flow_rank ?? "--"}`,
    `rotation=${rotation.label ?? attribution.signal_components?.rotation_label ?? "--"}`
  ];
  if (attribution.conflict_notes?.length) parts.push("conflict=manual review");
  return parts.join(" · ");
}

function buildPositiveEvidence({ daily, attribution, etf, rotation, flow }) {
  const items = [...(attribution.positive_reasons ?? [])];
  if (numberOrNull(etf.estimated_flow) > 0) items.push(`ETF estimated_flow positive; rank ${etf.estimated_flow_rank ?? "--"}.`);
  if (["priority_watch", "confirm_next"].includes(daily.tier)) items.push(`daily tier ${daily.tier}.`);
  if (isStrongRotation({ rotation, daily })) items.push(`rotation strong: ${rotation.label ?? daily.rotation_diagnostic?.label ?? "--"}.`);
  if (numberOrNull(flow.score ?? daily.score) > 0.18) items.push("flow review score positive.");
  return [...new Set(items)];
}

function buildNegativeEvidence({ daily, attribution, etf, rotation, module, flow }) {
  const items = [...(attribution.negative_reasons ?? [])];
  if (numberOrNull(etf.estimated_flow) < 0) items.push("ETF estimated_flow negative.");
  if (daily.tier === "avoid_watch") items.push("daily tier avoid_watch.");
  if (rotation.role === "laggard" || daily.rotation_diagnostic?.latest_role === "laggard") items.push(`rotation weak: ${rotation.label ?? daily.rotation_diagnostic?.label ?? "--"}.`);
  if (numberOrNull(flow.score ?? daily.score) < -0.08) items.push("flow review score weak.");
  if (["value_trap_risk", "expensive_deteriorating", "expensive_flow_fading"].includes(module.decision?.label)) items.push(`module risk label: ${module.decision.text ?? module.decision.label}.`);
  return [...new Set(items)];
}

function upgradeConditions({ watchState, guidanceState }) {
  const base = ["Resolve attribution conflicts.", "Confirm ETF flow and rotation persistence on the next run."];
  if (guidanceState !== "decision_support_ready") base.push("ETF readiness must leave watch-only/not-ready state before execution language.");
  if (watchState === "flow_only_candidate") return ["Daily tier must improve from absent/weak to confirmation.", ...base];
  if (watchState === "rotation_only_candidate") return ["ETF estimated_flow must turn positive or become available.", ...base];
  if (watchState === "conflict_review") return base;
  return ["Maintain positive evidence without new conflicts.", ...base.slice(1)];
}

function downgradeConditions({ watchState }) {
  if (watchState === "avoid_watch") return ["Remain in avoid_watch until flow, rotation, or module evidence improves."];
  if (watchState === "deteriorating_watch") return ["Further negative flow or weak module label keeps the row in risk review."];
  return ["Negative ETF flow, weaker rotation, avoid_watch tier, or new attribution conflict."];
}

function buildGroups(rows, executionBlocked) {
  const groups = Object.fromEntries(WATCH_STATES.map((state) => [state, []]));
  for (const row of rows) {
    groups[row.watch_state].push(row.sector_id);
    if (executionBlocked) groups.blocked_execution.push(row.sector_id);
  }
  groups.blocked_execution = [...new Set(groups.blocked_execution)];
  return groups;
}

function rowSort(a, b) {
  return statePriority(a.watch_state) - statePriority(b.watch_state)
    || prioritySort(a.priority_level) - prioritySort(b.priority_level)
    || String(a.sector_id).localeCompare(String(b.sector_id));
}

function prioritySort(priority) {
  const order = { high: 0, manual_review: 1, medium: 2, risk_review: 3, low: 4, background: 5 };
  return order[priority] ?? 6;
}

function buildHeadline({ rows, groups, guidanceState }) {
  const confirmed = groups.confirmed_watch.length;
  const conflicts = groups.conflict_review.length;
  const flowOnly = groups.flow_only_candidate.length;
  return `观察清单状态：${confirmed} 个确认观察，${conflicts} 个冲突复核，${flowOnly} 个资金流单线候选；当前 ${guidanceState}，不是交易指令。`;
}

function nextAction({ groups, guidanceState }) {
  if (groups.conflict_review.length) return "先处理 attribution 冲突复核，再调整观察清单解释。";
  if (groups.flow_only_candidate.length) return "复核资金流单线候选是否得到日结论和轮动确认。";
  if (guidanceState !== "decision_support_ready") return "保持观察清单边界，等待 ETF readiness 解锁。";
  return "继续记录观察状态，不输出交易指令。";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || value === "None") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildMarkdown(payload) {
  const lines = [
    `# Sector Watchlist State ${payload.as_of}`,
    "",
    `Status: ${payload.status}`,
    `Guidance state: ${payload.guidance_state}`,
    "",
    payload.headline,
    "",
    "Observation watchlist only. Not a trading instruction.",
    "",
    "| State | Sector | Priority | Change | Evidence | Boundary |",
    "| --- | --- | --- | --- | --- | --- |"
  ];
  for (const row of payload.rows) {
    lines.push(`| ${row.watch_state} | ${row.name} | ${row.priority_level} | ${row.state_change} | ${row.evidence_summary} | ${row.execution_boundary} |`);
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
  const result = await runSectorWatchlistState({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Sector watchlist state written: ${result.jsonPath}`);
  console.log(`Sector watchlist state report written: ${result.mdPath}`);
  console.log(result.payload.headline);
}
