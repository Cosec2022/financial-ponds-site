// FP-ATTR-01 Sector Signal Attribution
// Input: daily sector analysis, flow review, rotation history, module review,
// ETF readiness, ETF flow leaderboard, and optional graph snapshot.
// Output: sector_signal_attribution.json and sector_signal_attribution.md
// Boundary: explains observed signals and conflicts. It is not a trading instruction.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_ID = "sector_signal_attribution_v0_10_44";
const ETF_FLOW_DAILY_LEADER_CONFLICT = "etf_flow_leader_differs_from_daily_leader";
const POSITIVE_FLOW_WEAK_DAILY_CONFLICT = "positive_flow_weak_daily_tier";
const STRONG_ROTATION_WEAK_FLOW_CONFLICT = "strong_rotation_zero_or_negative_flow";

export async function runSectorSignalAttribution({
  rootDir = defaultRootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const inputs = await readInputs({ rootDir, asOf: resolvedAsOf });
  const payload = buildSectorSignalAttribution({ asOf: resolvedAsOf, inputs });
  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "sector_signal_attribution.json");
  const mdPath = path.join(outDir, "sector_signal_attribution.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));
  return { payload, jsonPath, mdPath };
}

export async function readInputs({ rootDir = defaultRootDir, asOf }) {
  const modelDir = path.join(rootDir, "model_outputs", asOf);
  const [flowReview, rotationHistory, moduleReview, etfReadiness, dailyAnalysis, etfFlowLeaderboard, graphSnapshot] = await Promise.all([
    readJsonIfExists(path.join(modelDir, "sector_flow_review.json")),
    readJsonIfExists(path.join(modelDir, "sector_rotation_history.json")),
    readJsonIfExists(path.join(modelDir, "sector_module_review.json")),
    readJsonIfExists(path.join(modelDir, "etf_decision_readiness.json")),
    readJsonIfExists(path.join(modelDir, "daily_sector_analysis.json")),
    readJsonIfExists(path.join(modelDir, "etf_flow_leaderboard.json")),
    readJsonIfExists(path.join(rootDir, "snapshots", asOf, "graph_scores.json"))
  ]);
  return { flowReview, rotationHistory, moduleReview, etfReadiness, dailyAnalysis, etfFlowLeaderboard, graphSnapshot };
}

export function buildSectorSignalAttribution({ asOf, inputs }) {
  const dailyRows = flattenDailyRows(inputs.dailyAnalysis);
  const dailyBySector = new Map(dailyRows.map((row) => [row.sector_id, row]));
  const flowBySector = new Map((inputs.flowReview?.sector_reviews ?? []).map((row) => [sectorId(row), row]));
  const moduleBySector = new Map((inputs.moduleReview?.sectors ?? []).map((row) => [row.sector_id, row]));
  const etfBySector = new Map((inputs.etfFlowLeaderboard?.rows ?? []).map((row) => [row.sector_id, row]));
  const graphBySector = buildGraphScoreMap(inputs.graphSnapshot);
  const rotationBySector = buildRotationMap(inputs.rotationHistory, dailyRows);
  const sectors = collectSectorIds({ dailyBySector, flowBySector, moduleBySector, etfBySector, graphBySector });
  const etfFlowLeader = topEtfFlowLeader(inputs.etfFlowLeaderboard);
  const dailyLeader = topDailyLeader(dailyRows);
  const globalConflictNotes = new Map();

  if (etfFlowLeader && dailyLeader && etfFlowLeader.sector_id !== dailyLeader.sector_id) {
    const note = "ETF 份额变化流第一与综合日结论第一不一致，需要人工复核。";
    pushNote(globalConflictNotes, etfFlowLeader.sector_id, note);
    pushNote(globalConflictNotes, dailyLeader.sector_id, note);
  }

  const rows = sectors.map((sectorId) => {
    const daily = dailyBySector.get(sectorId) ?? {};
    const flow = flowBySector.get(sectorId) ?? {};
    const module = moduleBySector.get(sectorId) ?? {};
    const etf = etfBySector.get(sectorId) ?? {};
    const rotation = rotationBySector.get(sectorId) ?? {};
    const signalComponents = {
      etf_estimated_flow: numberOrNull(etf.estimated_flow),
      etf_flow_rank: etf.estimated_flow_rank ?? null,
      etf_amount: numberOrNull(etf.amount),
      etf_amount_rank: etf.amount_rank ?? null,
      flow_review_score: numberOrNull(flow.score ?? daily.current_flow_score),
      rotation_label: rotation.label ?? daily.rotation_diagnostic?.label ?? null,
      rotation_score: numberOrNull(rotation.score ?? daily.score),
      rotation_streak_days: rotation.streak_days ?? daily.streak_days ?? daily.rotation_diagnostic?.leader_days ?? daily.rotation_diagnostic?.laggard_days ?? null,
      module_label: module.decision?.label ?? daily.module_decision_label ?? null,
      module_text: module.decision?.text ?? daily.module_decision_text ?? null,
      graph_score: graphBySector.get(sectorId) ?? null,
      valuation_fundamental_status: valuationFundamentalStatus(module, daily)
    };
    const conflictNotes = [...(globalConflictNotes.get(sectorId) ?? [])];
    const positiveReasons = buildPositiveReasons({ daily, flow, etf, rotation, signalComponents });
    const negativeReasons = buildNegativeReasons({ daily, flow, etf, rotation, signalComponents });

    if (isPositiveFlowWeakDaily({ etf, daily })) {
      conflictNotes.push("正向 ETF 份额变化流与偏弱/回避日结论不一致，需要人工复核。");
    }
    if (isStrongRotationWeakFlow({ etf, rotation, daily })) {
      conflictNotes.push("轮动强势与零流或负向 ETF 份额变化流不一致，需要人工复核。");
    }

    return {
      sector_id: sectorId,
      name: daily.name ?? displayName(module.name) ?? flow.name ?? etf.name ?? sectorId,
      daily_tier: daily.tier ?? "unranked",
      daily_score: numberOrNull(daily.score ?? flow.score),
      final_rank: null,
      signal_components: signalComponents,
      positive_reasons: positiveReasons,
      negative_reasons: negativeReasons,
      conflict_notes: [...new Set(conflictNotes)],
      manual_review_boundary: manualReviewBoundary({ guidanceState: inputs.etfReadiness?.guidance_state ?? inputs.dailyAnalysis?.gate_summary?.guidance_state, conflictNotes })
    };
  });

  rows.sort(rowSort);
  rows.forEach((row, index) => {
    row.final_rank = index + 1;
  });
  const conflicts = buildConflicts(rows, etfFlowLeader, dailyLeader);
  const guidanceState = inputs.etfReadiness?.guidance_state ?? inputs.dailyAnalysis?.gate_summary?.guidance_state ?? "unknown";

  return {
    module_id: MODULE_ID,
    as_of: inputs.dailyAnalysis?.as_of ?? inputs.flowReview?.as_of ?? asOf,
    generated_at: new Date().toISOString(),
    status: rows.length ? "attribution_available" : "no_sector_rows",
    guidance_state: guidanceState,
    headline: buildHeadline({ rows, conflicts, guidanceState }),
    rows,
    conflicts,
    next_action: nextAction({ conflicts, guidanceState })
  };
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
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

function buildGraphScoreMap(snapshot) {
  const map = new Map();
  for (const row of snapshot?.results ?? []) {
    if (row.kind !== "pool") continue;
    const id = String(row.id ?? "");
    if (id.startsWith("a_share_")) map.set(id.slice("a_share_".length), numberOrNull(row.score));
    map.set(id, numberOrNull(row.score));
  }
  return map;
}

function buildRotationMap(rotationHistory, dailyRows) {
  const map = new Map();
  for (const row of dailyRows) {
    const diagnostic = row.rotation_diagnostic ?? {};
    map.set(row.sector_id, {
      label: diagnostic.label ?? null,
      score: row.score ?? null,
      streak_days: row.streak_days ?? diagnostic.leader_days ?? diagnostic.laggard_days ?? null,
      role: diagnostic.latest_role ?? null,
      state: diagnostic.state ?? null
    });
  }
  for (const row of rotationHistory?.latest?.leaders ?? []) {
    map.set(row.sector_id, { ...(map.get(row.sector_id) ?? {}), label: map.get(row.sector_id)?.label ?? "领先", score: row.score, role: "leader" });
  }
  for (const row of rotationHistory?.latest?.laggards ?? []) {
    map.set(row.sector_id, { ...(map.get(row.sector_id) ?? {}), label: map.get(row.sector_id)?.label ?? "弱势", score: row.score, role: "laggard" });
  }
  return map;
}

function topEtfFlowLeader(leaderboard) {
  return (leaderboard?.rows ?? [])
    .filter((row) => typeof row.estimated_flow_rank === "number")
    .sort((a, b) => a.estimated_flow_rank - b.estimated_flow_rank)[0] ?? null;
}

function topDailyLeader(rows) {
  return [...rows].sort(rowSort)[0] ?? null;
}

function rowSort(a, b) {
  return tierPriority(a.daily_tier ?? a.tier) - tierPriority(b.daily_tier ?? b.tier)
    || (b.daily_score ?? b.score ?? -Infinity) - (a.daily_score ?? a.score ?? -Infinity)
    || (a.signal_components?.etf_flow_rank ?? 999) - (b.signal_components?.etf_flow_rank ?? 999)
    || String(a.sector_id).localeCompare(String(b.sector_id));
}

function tierPriority(tier) {
  if (tier === "priority_watch") return 0;
  if (tier === "confirm_next") return 1;
  if (tier === "avoid_watch") return 3;
  return 2;
}

function valuationFundamentalStatus(module, daily) {
  const valuation = module.modules?.valuation?.status ?? daily.blockers?.find((item) => String(item).startsWith("valuation_")) ?? null;
  const fundamental = module.modules?.fundamental?.status ?? daily.blockers?.find((item) => String(item).startsWith("fundamental_")) ?? null;
  if ([valuation, fundamental].some((item) => String(item).includes("manual_seed"))) return "manual_seed";
  if ([valuation, fundamental].some((item) => String(item).includes("profile_missing"))) return "profile_missing";
  if (!valuation && !fundamental) return "unknown";
  return "reviewed_or_non_manual";
}

function buildPositiveReasons({ daily, flow, etf, rotation, signalComponents }) {
  const reasons = [];
  if (numberOrNull(etf.estimated_flow) > 0) reasons.push(`ETF estimated_flow 为正，流排名 ${etf.estimated_flow_rank ?? "--"}。`);
  if ((daily.tier ?? "") === "priority_watch" || (daily.tier ?? "") === "confirm_next") reasons.push(`日结论分层为 ${daily.tier}。`);
  if (isStrongRotation({ rotation, daily })) reasons.push(`轮动标签偏强：${signalComponents.rotation_label ?? "--"}。`);
  if (numberOrNull(flow.score ?? daily.score) > 0.18) reasons.push("资金量价 review 分数偏正。");
  if (["balanced_candidate", "cheap_with_flow", "undervalued_turning"].includes(signalComponents.module_label)) reasons.push(`三模块标签偏正：${signalComponents.module_text ?? signalComponents.module_label}。`);
  return reasons;
}

function buildNegativeReasons({ daily, flow, etf, signalComponents }) {
  const reasons = [];
  if (numberOrNull(etf.estimated_flow) < 0) reasons.push("ETF estimated_flow 为负。");
  if ((daily.tier ?? "") === "avoid_watch") reasons.push("日结论分层为 avoid_watch。");
  if (numberOrNull(flow.score ?? daily.score) < -0.08) reasons.push("资金量价 review 分数偏弱。");
  if (String(signalComponents.valuation_fundamental_status).includes("manual_seed")) reasons.push("估值/基本面仍包含手工种子。");
  if (["value_trap_risk", "expensive_deteriorating", "expensive_flow_fading"].includes(signalComponents.module_label)) reasons.push(`三模块风险标签：${signalComponents.module_text ?? signalComponents.module_label}。`);
  return reasons;
}

function isPositiveFlowWeakDaily({ etf, daily }) {
  return numberOrNull(etf.estimated_flow) > 0 && (daily.tier === "avoid_watch" || numberOrNull(daily.score) < 0);
}

function isStrongRotationWeakFlow({ etf, rotation, daily }) {
  const flow = numberOrNull(etf.estimated_flow);
  return isStrongRotation({ rotation, daily }) && (flow === null || flow <= 0);
}

function isStrongRotation({ rotation, daily }) {
  const label = `${rotation.label ?? daily.rotation_diagnostic?.label ?? ""}${rotation.state ?? daily.rotation_diagnostic?.state ?? ""}`;
  return rotation.role === "leader"
    || daily.rotation_diagnostic?.latest_role === "leader"
    || /领先|强势|leader|strengthening/i.test(label)
    || numberOrNull(rotation.score ?? daily.score) > 0.18;
}

function manualReviewBoundary({ guidanceState, conflictNotes }) {
  if (conflictNotes.length) return "manual_review_required";
  if (guidanceState === "watch_only") return "watch_only";
  return "observation_only";
}

function buildConflicts(rows, etfFlowLeader, dailyLeader) {
  const conflicts = [];
  if (etfFlowLeader && dailyLeader && etfFlowLeader.sector_id !== dailyLeader.sector_id) {
    conflicts.push({
      id: ETF_FLOW_DAILY_LEADER_CONFLICT,
      reading: "ETF 份额变化流第一与综合日结论第一不一致，需要人工复核。",
      sectors: [etfFlowLeader.sector_id, dailyLeader.sector_id]
    });
  }
  const positiveFlowWeak = rows.filter((row) => row.conflict_notes.some((note) => note.includes("正向 ETF 份额变化流")));
  if (positiveFlowWeak.length) {
    conflicts.push({
      id: POSITIVE_FLOW_WEAK_DAILY_CONFLICT,
      reading: "有行业 ETF 份额变化流为正，但综合日结论偏弱或进入回避观察。",
      sectors: positiveFlowWeak.map((row) => row.sector_id)
    });
  }
  const strongRotationWeakFlow = rows.filter((row) => row.conflict_notes.some((note) => note.includes("轮动强势与零流或负向")));
  if (strongRotationWeakFlow.length) {
    conflicts.push({
      id: STRONG_ROTATION_WEAK_FLOW_CONFLICT,
      reading: "有行业轮动偏强，但 ETF 份额变化流为零、缺失或负向。",
      sectors: strongRotationWeakFlow.map((row) => row.sector_id)
    });
  }
  return conflicts;
}

function buildHeadline({ rows, conflicts, guidanceState }) {
  const top = rows[0];
  const conflictText = conflicts.length ? `${conflicts.length} 个跨模块冲突需要人工复核` : "暂未发现关键跨模块冲突";
  return `行业信号归因：${top?.name ?? "暂无行业"} 排名第一；${conflictText}；当前 ${guidanceState}，只解释观察结果。`;
}

function nextAction({ conflicts, guidanceState }) {
  if (conflicts.length) return "先复核跨模块冲突，再更新日报解释。";
  if (guidanceState === "watch_only") return "继续补估值/基本面真实来源，保持观察边界。";
  return "继续记录信号归因，不输出交易指令。";
}

function pushNote(map, sectorId, note) {
  const notes = map.get(sectorId) ?? [];
  notes.push(note);
  map.set(sectorId, notes);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || value === "None") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildMarkdown(payload) {
  const lines = [
    `# Sector Signal Attribution ${payload.as_of}`,
    "",
    `Status: ${payload.status}`,
    `Guidance state: ${payload.guidance_state}`,
    "",
    payload.headline,
    "",
    "Explanation-only observation layer. Not a trading instruction.",
    "",
    "| Rank | Sector | Tier | Daily score | ETF flow rank | ETF flow | Rotation | Module | Graph | Conflicts |",
    "| ---: | --- | --- | ---: | ---: | ---: | --- | --- | ---: | --- |"
  ];
  for (const row of payload.rows) {
    lines.push(`| ${row.final_rank} | ${row.name} | ${row.daily_tier} | ${row.daily_score ?? ""} | ${row.signal_components.etf_flow_rank ?? ""} | ${row.signal_components.etf_estimated_flow ?? ""} | ${row.signal_components.rotation_label ?? ""} | ${row.signal_components.module_text ?? row.signal_components.module_label ?? ""} | ${row.signal_components.graph_score ?? ""} | ${row.conflict_notes.join("<br>")} |`);
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
  const result = await runSectorSignalAttribution({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Sector signal attribution written: ${result.jsonPath}`);
  console.log(`Sector signal attribution report written: ${result.mdPath}`);
  console.log(result.payload.headline);
}
