// FP-DAILY-01 Daily Sector Analysis
// Input: sector flow review, rotation history, module review, and ETF readiness.
// Output: daily_sector_analysis.json and daily_sector_analysis.md
// Boundary: analysis tiers only; it never emits buy, sell, or allocation orders.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runDailySectorAnalysis({
  rootDir = defaultRootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const inputs = {
    flow: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_flow_review.json" }),
    rotationHistory: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_rotation_history.json" }),
    moduleReview: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_module_review.json" }),
    etfReadiness: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "etf_decision_readiness.json" }),
    realityAudit: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "data_reality_audit.json" })
  };
  const payload = buildDailySectorAnalysis({ asOf: resolvedAsOf, inputs });

  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "daily_sector_analysis.json");
  const mdPath = path.join(outDir, "daily_sector_analysis.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return { payload, jsonPath, mdPath };
}

export function buildDailySectorAnalysis({ asOf, inputs }) {
  const flowRows = inputs.flow?.sector_reviews ?? [];
  const flowBySector = new Map(flowRows.map((row) => [sectorId(row), row]));
  const modulesBySector = new Map((inputs.moduleReview?.sectors ?? []).map((row) => [sectorId(row), row]));
  const readinessBySector = new Map((inputs.etfReadiness?.sectors ?? []).map((row) => [sectorId(row), row]));
  const persistentLeaders = inputs.rotationHistory?.trend_confirmations?.persistent_leaders ?? [];
  const persistentLaggards = inputs.rotationHistory?.trend_confirmations?.persistent_laggards ?? [];
  const latestLeaders = inputs.rotationHistory?.latest?.leaders ?? [];
  const latestLaggards = inputs.rotationHistory?.latest?.laggards ?? [];

  const context = buildContext({ asOf, inputs });
  const priorityWatch = uniqueBySector(persistentLeaders
    .map((row) => sectorAnalysisRow({ row, tier: "priority_watch", flowBySector, modulesBySector, readinessBySector, context }))
    .filter((row) => row.score >= 0.08));
  const confirmNext = uniqueBySector([
    ...latestLeaders,
    ...(inputs.flow?.sector_reviews ?? []).slice(0, 6)
  ]
    .map((row) => sectorAnalysisRow({ row, tier: "confirm_next", flowBySector, modulesBySector, readinessBySector, context }))
    .filter((row) => row.score >= 0.12 && !priorityWatch.some((item) => item.sector_id === row.sector_id)))
    .slice(0, 6);
  const avoidWatch = uniqueBySector([
    ...persistentLaggards,
    ...(inputs.moduleReview?.risks ?? []),
    ...latestLaggards
  ]
    .map((row) => sectorAnalysisRow({ row, tier: "avoid_watch", flowBySector, modulesBySector, readinessBySector, context }))
    .filter((row) => row.score <= 0.08 || riskDecision(row.module_decision_label)))
    .slice(0, 6);

  return {
    as_of: inputs.flow?.as_of ?? inputs.etfReadiness?.as_of ?? asOf,
    generated_at: new Date().toISOString(),
    module_id: "daily_sector_analysis_v0_10_31",
    status: "daily_sector_analysis_available",
    analysis_mode: context.analysisMode,
    headline: buildHeadline({ context, priorityWatch, confirmNext, avoidWatch }),
    gate_summary: {
      guidance_state: context.guidanceState,
      provider_run: context.providerRun,
      provider_flow_readiness: context.providerFlowReadiness,
      true_flow_coverage: context.trueFlowCoverage,
      sample_days: context.sampleDays,
      trend_state: context.trendState,
      data_reality: context.dataReality,
      market_use_confidence: context.marketUseConfidence
    },
    tiers: {
      priority_watch: priorityWatch,
      confirm_next: confirmNext,
      avoid_watch: avoidWatch
    },
    counts: {
      priority_watch: priorityWatch.length,
      confirm_next: confirmNext.length,
      avoid_watch: avoidWatch.length
    },
    next_unlock: inputs.etfReadiness?.progress?.next_unlock ?? null,
    interpretation_boundary: [
      "Daily sector analysis is an observation layer, not a trading instruction.",
      "When ETF decision readiness is not_ready, all strong sectors remain watch-only.",
      "A sector can be a priority watch item before it becomes an ETF execution candidate.",
      "Manual valuation or fundamental seeds must not be treated as live market valuation evidence."
    ]
  };
}

async function readModelJson({ rootDir, asOf, fileName }) {
  const candidates = [
    path.join(rootDir, "model_outputs", asOf, fileName),
    path.join(rootDir, "..", "..", "financial-pond", "data", fileName)
  ];
  for (const candidate of candidates) {
    const payload = await readJsonIfExists(candidate);
    if (payload) return payload;
  }
  return null;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function buildContext({ inputs }) {
  const gates = inputs.etfReadiness?.gates ?? {};
  const guidanceState = inputs.etfReadiness?.guidance_state ?? gates.guidance_state ?? "unknown";
  return {
    guidanceState,
    providerRun: gates.provider_run ?? "unknown",
    providerFlowReadiness: gates.provider_flow_readiness ?? "unknown",
    trueFlowCoverage: numberOrNull(gates.true_flow_coverage) ?? 0,
    sampleDays: gates.sample_days ?? inputs.rotationHistory?.sample_days ?? 0,
    trendState: inputs.rotationHistory?.trend_state ?? "unknown",
    dataReality: inputs.realityAudit?.overall_reality ?? gates.flow_source_reality ?? inputs.flow?.data_availability?.source_reality ?? "unknown",
    marketUseConfidence: gates.market_use_confidence ?? inputs.flow?.data_availability?.market_use_confidence ?? "unknown",
    analysisMode: guidanceState === "decision_support_ready" ? "decision_review" : guidanceState === "watch_only" ? "watch_only" : "analysis_only"
  };
}

function sectorAnalysisRow({ row, tier, flowBySector, modulesBySector, readinessBySector, context }) {
  const id = sectorId(row);
  const flow = flowBySector.get(id) ?? row;
  const moduleRow = modulesBySector.get(id) ?? {};
  const readiness = readinessBySector.get(id) ?? {};
  const score = numberOrNull(flow.score ?? row.score) ?? 0;
  const streakDays = row.streak_days ?? null;
  return {
    sector_id: id,
    name: row.name ?? moduleRow.display_name ?? moduleRow.name ?? flow.display_name ?? flow.name ?? id,
    tier,
    score: round(score),
    label: flow.label ?? row.label ?? null,
    streak_days: streakDays,
    readiness_score: readiness.readiness_score ?? null,
    action_label: readiness.action?.label ?? null,
    action_text: readiness.action?.text ?? null,
    module_decision_label: moduleRow.decision?.label ?? readiness.evidence?.module_decision?.label ?? null,
    module_decision_text: moduleRow.decision?.text ?? readiness.evidence?.module_decision?.text ?? null,
    evidence: {
      observed_direct_flow: readiness.evidence?.observed_direct_flow ?? hasObservedComponent(flow, "direct_flow"),
      observed_price_volume: readiness.evidence?.observed_price_volume ?? hasObservedComponent(flow, "market_confirmation"),
      confirmation_inputs: flow.confirmation_inputs ?? row.confirmation_inputs ?? confirmationInputs(flow),
      valuation_label: moduleRow.modules?.valuation?.label ?? readiness.evidence?.valuation_label ?? null,
      valuation_position_score: numberOrNull(moduleRow.modules?.valuation?.position_score ?? readiness.evidence?.valuation_position_score),
      fundamental_label: moduleRow.modules?.fundamental?.label ?? readiness.evidence?.fundamental_label ?? null,
      fundamental_score: numberOrNull(moduleRow.modules?.fundamental?.score ?? readiness.evidence?.fundamental_score),
      flow_price_label: moduleRow.modules?.flow_price?.label ?? readiness.evidence?.flow_price_label ?? flow.label ?? null,
      flow_price_score: numberOrNull(moduleRow.modules?.flow_price?.score ?? readiness.evidence?.flow_price_score ?? score)
    },
    reading: buildSectorReading({ tier, row, score, readiness, context }),
    blockers: readiness.blockers ?? []
  };
}

function buildSectorReading({ tier, row, score, readiness, context }) {
  const prefix = context.analysisMode === "decision_review" ? "可进入人工复核" : "仍是观察项";
  if (tier === "priority_watch") {
    return `${prefix}：${row.name ?? row.sector_id} 已出现连续领先，当前分数 ${round(score)}。${watchOnlyReason(context)}`;
  }
  if (tier === "avoid_watch") {
    return `回避观察：分数或三模块组合偏弱，先等资金和基本面修复。${watchOnlyReason(context)}`;
  }
  return `${prefix}：当日强度靠前，但连续性或真实份额流还要继续确认。${readiness.action?.reading ?? watchOnlyReason(context)}`;
}

function watchOnlyReason(context) {
  if (context.guidanceState === "decision_support_ready") return "不是自动下单，仍需仓位和回撤规则。";
  if (context.providerFlowReadiness === "baseline_only") return "当前 ETF 份额流仍处于基线阶段。";
  if (context.trueFlowCoverage <= 0) return "当前真实 ETF 直接资金流覆盖仍为 0。";
  return "ETF 决策门尚未完全打开。";
}

function buildHeadline({ context, priorityWatch, confirmNext, avoidWatch }) {
  const top = priorityWatch[0] ?? confirmNext[0] ?? null;
  const gate = context.analysisMode === "decision_review" ? "可进入人工复核" : "只做观察，不做 ETF 执行建议";
  if (!top) return `今日行业结论：暂无清晰优先方向，${gate}。`;
  return `今日行业结论：${top.name} 领头；${priorityWatch.length} 个优先观察，${confirmNext.length} 个继续确认，${avoidWatch.length} 个回避观察。当前${gate}。`;
}

function confirmationInputs(row) {
  const names = [];
  if (row?.components?.direct_flow?.available) names.push("ETF流");
  if (row?.components?.market_confirmation?.available) names.push("价量");
  if (row?.components?.market_liquidity?.available) names.push("总水位");
  if (row?.components?.policy_sentiment?.available) names.push("新闻");
  if (row?.components?.fundamental_proxy?.available) names.push("基本面代理");
  return names;
}

function hasObservedComponent(row, componentName) {
  return (row?.components?.[componentName]?.nodes ?? []).some((node) => {
    const source = typeof node === "string" ? "" : node.source ?? "";
    return /akshare|provider|observed|exchange|real|local_csv/i.test(source) && !/mock|fixture/i.test(source);
  });
}

function riskDecision(label) {
  return new Set(["value_trap_risk", "expensive_deteriorating", "expensive_flow_fading"]).has(label);
}

function uniqueBySector(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    if (!row.sector_id || seen.has(row.sector_id)) continue;
    seen.add(row.sector_id);
    result.push(row);
  }
  return result;
}

function sectorId(row) {
  return row?.sector_id ?? String(row?.pool_id ?? "").replace(/^a_share_/, "");
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value, digits = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function buildMarkdown(payload) {
  const rows = [
    ["优先观察", payload.tiers.priority_watch],
    ["继续确认", payload.tiers.confirm_next],
    ["回避观察", payload.tiers.avoid_watch]
  ].map(([title, items]) => `## ${title}

${items.length ? items.map((row) => `- ${row.name}: ${row.reading}`).join("\n") : "- 暂无。"}
`).join("\n");
  return `# Daily Sector Analysis ${payload.as_of}

${payload.headline}

Analysis mode: ${payload.analysis_mode}

${rows}
## Boundary

${payload.interpretation_boundary.map((item) => `- ${item}`).join("\n")}
`;
}

function parseArgs(argv) {
  const args = {
    asOf: new Date().toISOString().slice(0, 10)
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runDailySectorAnalysis({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Daily sector analysis written: ${result.jsonPath}`);
  console.log(`Analysis mode: ${result.payload.analysis_mode}`);
  console.log(`Headline: ${result.payload.headline}`);
}
