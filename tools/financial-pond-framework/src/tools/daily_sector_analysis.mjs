// FP-DAILY-01 Daily Sector Analysis
// Input: sector flow review, rotation history, module review, and ETF readiness.
// Output: daily_sector_analysis.json and daily_sector_analysis.md
// Boundary: analysis tiers only; it never emits buy, sell, or allocation orders.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const sectorNames = {
  brokerage: "券商",
  bank_insurance: "银行保险",
  semiconductor: "半导体",
  ai_computer: "AI计算机",
  communication_electronics: "通信电子",
  new_energy_ev: "新能源车",
  healthcare_pharma: "医药医疗",
  consumer: "消费",
  defense_military: "军工",
  resources_materials: "资源材料",
  real_estate_infra: "地产基建",
  electric_power: "电力行业",
  agriculture: "农林牧渔",
  food_beverage: "食品饮料",
  home_appliances: "家用电器",
  textile_apparel: "纺织服饰",
  light_manufacturing: "轻工制造",
  retail: "商贸零售",
  social_services: "社会服务",
  beauty_care: "美容护理",
  transportation: "交通运输",
  utilities: "公用事业",
  environmental_protection: "环保",
  petroleum_petrochemical: "石油石化",
  coal: "煤炭",
  steel: "钢铁",
  nonferrous_metals: "有色金属",
  basic_chemicals: "基础化工",
  building_materials: "建筑材料",
  construction: "建筑装饰",
  machinery: "机械设备",
  media: "传媒"
};

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
    module_id: "daily_sector_analysis_v0_10_35",
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
    decision_gap: buildDecisionGap({ context, inputs }),
    decision_ticket: buildDecisionTicket({ context, priorityWatch, confirmNext, avoidWatch }),
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
  const gateSampleDays = numberOrNull(gates.sample_days) ?? 0;
  const historySampleDays = numberOrNull(inputs.rotationHistory?.sample_days) ?? 0;
  return {
    guidanceState,
    providerRun: gates.provider_run ?? "unknown",
    providerFlowReadiness: gates.provider_flow_readiness ?? "unknown",
    trueFlowCoverage: numberOrNull(gates.true_flow_coverage) ?? 0,
    shareChangeDiagnostics: gates.share_change_diagnostics ?? null,
    sampleDays: Math.max(gateSampleDays, historySampleDays),
    minSampleDays: gates.min_sample_days ?? inputs.rotationHistory?.min_sample_days ?? 3,
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
  const name = sectorDisplayName(id, row, moduleRow, flow, readiness);
  return {
    sector_id: id,
    name,
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
    reading: buildSectorReading({ tier, row, name, score, readiness, context }),
    blockers: readiness.blockers ?? []
  };
}

function buildDecisionGap({ context, inputs }) {
  const blockers = inputs.etfReadiness?.blockers ?? [];
  const blockerIds = new Set(blockers.map((item) => typeof item === "string" ? item : item.id).filter(Boolean));
  const minSampleDays = context.minSampleDays;
  const flowReady = ["flow_ready", "ready", "ok"].includes(context.providerFlowReadiness) && context.trueFlowCoverage >= 0.6;
  const trendReady = context.sampleDays >= minSampleDays && context.trendState === "trend_confirmed";
  const providerReady = context.providerRun === "real_ok";
  const sourceReady = !blockerIds.has("non_real_flow_source") && context.dataReality !== "mock";
  const moduleSeedBlocked = ["manual_valuation_fundamental", "valuation_manual_seed", "fundamental_manual_seed"].some((id) => blockerIds.has(id));

  const checks = [
    {
      id: "provider_run",
      label: "真实Provider",
      status: providerReady ? "passed" : "blocked",
      reading: providerReady ? "AKShare 真实 provider 已跑通。" : "AKShare 真实 provider 还没有确认跑通。"
    },
    {
      id: "share_change_flow",
      label: "份额变化流",
      status: flowReady ? "passed" : context.providerFlowReadiness === "baseline_only" ? "pending" : "blocked",
      reading: flowReady
        ? `真实 ETF 直接资金流覆盖 ${pctText(context.trueFlowCoverage)}。`
        : context.providerFlowReadiness === "baseline_only"
          ? shareChangeGapReading(context)
          : `真实 ETF 直接资金流覆盖 ${pctText(context.trueFlowCoverage)}，未达决策门槛。`
    },
    {
      id: "trend_history",
      label: "趋势样本",
      status: trendReady ? "passed" : context.sampleDays > 0 ? "pending" : "blocked",
      reading: trendReady
        ? `轮动历史 ${context.sampleDays}/${minSampleDays} 天，趋势已确认。`
        : `轮动历史 ${context.sampleDays}/${minSampleDays} 天，暂不能确认连续趋势。`
    },
    {
      id: "source_reality",
      label: "数据真实性",
      status: sourceReady ? "passed" : "blocked",
      reading: sourceReady ? `数据现实层为 ${context.dataReality}。` : "仍有 mock/fixture/source-unverified 输入，不能进入 ETF 执行建议。"
    },
    {
      id: "valuation_fundamental",
      label: "估值/基本面",
      status: moduleSeedBlocked ? "pending" : "passed",
      reading: moduleSeedBlocked ? "估值或基本面仍含手工种子，只能辅助观察。" : "估值和基本面模块未触发手工种子阻塞。"
    }
  ];
  const passed = checks.filter((item) => item.status === "passed");
  const blocked = checks.filter((item) => item.status !== "passed");

  return {
    status: blocked.length ? "blocked" : "review_ready",
    summary: blocked.length
      ? `已通过 ${passed.length}/${checks.length} 个关卡；还差 ${blocked.map((item) => item.label).join("、")}。`
      : "基础关卡通过，可进入人工复核；仍不是自动下单。",
    checks,
    passed_checks: passed.map((item) => item.id),
    blocked_checks: blocked.map((item) => item.id)
  };
}

function shareChangeGapReading(context) {
  const diagnostics = context.shareChangeDiagnostics ?? {};
  const total = diagnostics.total_rows ?? 0;
  const estimated = diagnostics.estimated_flow_rows ?? 0;
  const previous = diagnostics.previous_share_rows;
  const latest = diagnostics.latest_share_rows;
  const history = diagnostics.provider_history;
  if (!total) return "已有首日基线，还需要 provider 行级诊断确认份额字段。";
  if (estimated > 0) return `已有 ${estimated}/${total} 只代表 ETF 可计算份额变化流，但覆盖不足。`;
  if (previous === 0 && history?.previous_available_date) {
    return `CSV 已有上一可用日期 ${history.previous_available_date}，但仍缺 previous_share；检查导出脚本历史回填。`;
  }
  if (previous === 0 && history?.current_date) {
    return `当前真实 provider CSV 只有 ${history.current_date} 的基线；需要下一次真实交易日运行，或补入更早真实 CSV 基线。`;
  }
  if (previous === 0) return `已有 ${latest ?? "--"}/${total} 只代表 ETF 的 latest_share，但缺 previous_share；需要下一个交易日或历史 CSV 基线。`;
  return diagnostics.next_unlock ?? "已有首日基线，还需要下一个交易日才能计算份额变化流。";
}

function buildDecisionTicket({ context, priorityWatch, confirmNext, avoidWatch }) {
  const priorityTickets = priorityWatch.slice(0, 4).map((row) => decisionTicketRow({ row, context, group: "priority_watch" }));
  const confirmTickets = confirmNext.slice(0, 4).map((row) => decisionTicketRow({ row, context, group: "confirm_next" }));
  const avoidTickets = avoidWatch.slice(0, 4).map((row) => decisionTicketRow({ row, context, group: "avoid_watch" }));
  const total = priorityTickets.length + confirmTickets.length + avoidTickets.length;
  const status = context.analysisMode === "decision_review"
    ? "manual_review_ready"
    : priorityTickets.length
      ? "watchlist_ready"
      : "no_priority_ticket";

  return {
    status,
    summary: buildDecisionTicketSummary({ context, priorityTickets, confirmTickets, avoidTickets }),
    trade_boundary: "This ticket is for human review only. It is not a buy, sell, rebalance, or allocation instruction.",
    counts: {
      total,
      priority_watch: priorityTickets.length,
      confirm_next: confirmTickets.length,
      avoid_watch: avoidTickets.length
    },
    groups: {
      priority_watch: priorityTickets,
      confirm_next: confirmTickets,
      avoid_watch: avoidTickets
    }
  };
}

function buildDecisionTicketSummary({ context, priorityTickets, confirmTickets, avoidTickets }) {
  if (context.analysisMode === "decision_review") {
    return `基础 ETF 决策门已打开：${priorityTickets.length + confirmTickets.length} 个方向可进入人工复核。`;
  }
  if (priorityTickets.length) {
    return `当前只做观察：${priorityTickets.map((row) => row.name).join("、")} 是优先观察；ETF 执行语言仍被 ${nextBlockedGate(context)} 阻塞。`;
  }
  if (confirmTickets.length) {
    return `当前没有连续领先优先票；${confirmTickets[0].name} 等方向继续确认。`;
  }
  if (avoidTickets.length) return `当前以风险复核为主：${avoidTickets[0].name} 等方向进入回避观察。`;
  return "当前没有足够清晰的行业票据。";
}

function decisionTicketRow({ row, context, group }) {
  const reviewReady = context.analysisMode === "decision_review" && ["small_position_candidate", "confirmation_candidate"].includes(row.action_label);
  const base = {
    sector_id: row.sector_id,
    name: row.name,
    group,
    score: row.score,
    streak_days: row.streak_days,
    readiness_score: row.readiness_score,
    module_decision_label: row.module_decision_label,
    module_decision_text: row.module_decision_text,
    current_action_label: row.action_label,
    current_action_text: row.action_text,
    current_state: reviewReady ? "manual_review_candidate" : group,
    current_reading: row.reading,
    manual_review_boundary: reviewReady
      ? "可以进入人工复核，但仍需要仓位上限、回撤和交易计划。"
      : "只能作为观察或风险复核，不是 ETF 买入建议。"
  };

  if (group === "avoid_watch") {
    return {
      ...base,
      ticket_label: "回避观察",
      upgrade_conditions: [
        `${row.name} 不再处于连续弱势或风险模块列表`,
        "资金量价从弱势修复为中性以上",
        "基本面或估值模块不再触发风险标签"
      ],
      failure_conditions: [
        "继续处于 persistent_laggards",
        "score 继续低于 0.08 或三模块仍是风险组合",
        "真实 ETF 份额变化流为负且价量未修复"
      ]
    };
  }

  if (group === "priority_watch") {
    return {
      ...base,
      ticket_label: reviewReady ? "人工复核候选" : "优先观察",
      upgrade_conditions: priorityUpgradeConditions({ row, context }),
      failure_conditions: [
        `${row.name} 跌出连续领先组或当日前三强`,
        "真实 ETF 份额变化流为负，或 estimated_flow 覆盖仍不足",
        "三模块标签降级为 value_trap_risk / expensive_deteriorating / expensive_flow_fading"
      ]
    };
  }

  return {
    ...base,
    ticket_label: "继续确认",
    upgrade_conditions: [
      `${row.name} 连续进入领先组并形成 3 日 streak`,
      "真实 ETF 份额变化流覆盖达到 60% 以上",
      "三模块标签维持合理且改善、低估且转强，或至少不转为风险组合"
    ],
    failure_conditions: [
      "跌出当日强势队列",
      "score 回落到 0.12 以下",
      "价量或份额变化流转弱"
    ]
  };
}

function priorityUpgradeConditions({ row, context }) {
  const conditions = [
    "真实 ETF 份额变化流覆盖达到 60% 以上",
    `${row.name} 继续处于 persistent_leaders 或当日前三强`,
    "该行业代表 ETF estimated_flow 为正，或 direct_flow 组件已经可观测",
    "三模块标签不降级为风险组合"
  ];
  if (context.sampleDays < context.minSampleDays) {
    conditions.unshift(`轮动历史达到 ${context.minSampleDays} 个交易日样本`);
  }
  return conditions;
}

function nextBlockedGate(context) {
  if (context.providerRun !== "real_ok") return "真实Provider";
  if (!["flow_ready", "ready", "ok"].includes(context.providerFlowReadiness) || context.trueFlowCoverage < 0.6) return "份额变化流";
  if (context.sampleDays < context.minSampleDays || context.trendState !== "trend_confirmed") return "趋势样本";
  return "估值/基本面";
}

function buildSectorReading({ tier, row, name, score, readiness, context }) {
  const prefix = context.analysisMode === "decision_review" ? "可进入人工复核" : "仍是观察项";
  if (tier === "priority_watch") {
    return `${prefix}：${name} 已出现连续领先，当前分数 ${round(score)}。${watchOnlyReason(context)}`;
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

function sectorDisplayName(id, ...rows) {
  return sectorNames[id] ?? rows.find((row) => row?.display_name)?.display_name ?? rows.find((row) => row?.name)?.name ?? id;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value, digits = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function pctText(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "--";
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

Decision gap: ${payload.decision_gap?.summary ?? "--"}

Decision ticket: ${payload.decision_ticket?.summary ?? "--"}

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
