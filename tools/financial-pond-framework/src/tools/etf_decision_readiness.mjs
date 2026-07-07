// FP-ETF-01 ETF Decision Readiness
// Input: sector module review, sector flow review, rotation history, provider run status
// Output: etf_decision_readiness.json and etf_decision_readiness.md
// Boundary: decides whether the model may support ETF decisions; it is not a trade order.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runEtfDecisionReadiness({
  rootDir = defaultRootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const inputs = {
    moduleReview: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_module_review.json" }),
    sectorFlow: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_flow_review.json" }),
    rotationHistory: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_rotation_history.json" }),
    providerFlow: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "akshare_provider_flow_observations.json" }),
    providerRun: await readJsonIfExists(path.join(rootDir, "model_outputs", "provider_runs", `akshare_etf_bridge_${resolvedAsOf}.json`))
  };
  const payload = buildEtfDecisionReadiness({ asOf: resolvedAsOf, inputs });

  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "etf_decision_readiness.json");
  const mdPath = path.join(outDir, "etf_decision_readiness.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return { payload, jsonPath, mdPath };
}

export function buildEtfDecisionReadiness({ asOf, inputs }) {
  const moduleReview = inputs.moduleReview ?? {};
  const sectorFlow = inputs.sectorFlow ?? {};
  const flowBySector = new Map((sectorFlow.sector_reviews ?? []).map((row) => [sectorId(row), row]));
  const gates = buildGlobalGates({ inputs });
  const sectors = (moduleReview.sectors ?? []).map((row) => {
    const flowRow = flowBySector.get(row.sector_id) ?? {};
    return buildSectorReadiness({ row, flowRow, gates });
  });
  const sorted = sectors.sort((a, b) => actionPriority(a.action.label) - actionPriority(b.action.label) || b.readiness_score - a.readiness_score);
  const counts = countActions(sorted);
  const actionReadyCount = (counts.small_position_candidate ?? 0) + (counts.confirmation_candidate ?? 0);

  return {
    as_of: moduleReview.as_of ?? sectorFlow.as_of ?? asOf,
    generated_at: new Date().toISOString(),
    module_id: "etf_decision_readiness_v0_2",
    status: "readiness_available",
    guidance_state: gates.guidance_state,
    headline: buildHeadline({ gates, sorted, actionReadyCount }),
    gates,
    progress: buildProgress({ gates }),
    counts: {
      sectors: sorted.length,
      small_position_candidate: counts.small_position_candidate ?? 0,
      confirmation_candidate: counts.confirmation_candidate ?? 0,
      watch_for_persistence: counts.watch_for_persistence ?? 0,
      wait_for_real_flow: counts.wait_for_real_flow ?? 0,
      wait_for_confirmation: counts.wait_for_confirmation ?? 0,
      blocked_non_real_source: counts.blocked_non_real_source ?? 0,
      not_covered: counts.not_covered ?? 0,
      avoid_or_reduce_watch: counts.avoid_or_reduce_watch ?? 0
    },
    top_watchlist: topWatchlist(sorted),
    blockers: gates.blockers,
    sectors: sorted,
    interpretation_boundary: [
      "ETF decision readiness is a gatekeeper. It can block guidance even when sector scores look strong.",
      "A buyable label requires observed ETF flow, enough rotation history, and acceptable valuation/fundamental context.",
      "manual_seed valuation or fundamental fields can structure thinking but cannot prove a live market bargain.",
      "The output is a checklist for human review, not an order to buy, sell, or allocate capital."
    ],
    next_steps: nextSteps(gates)
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

function buildGlobalGates({ inputs }) {
  const flow = inputs.sectorFlow ?? {};
  const availability = flow.data_availability ?? {};
  const counts = availability.counts ?? {};
  const providerRun = inputs.providerRun ?? {};
  const providerFlow = inputs.providerFlow ?? {};
  const sourceReality = availability.source_reality ?? availability.mode ?? "unknown";
  const representativeSectors = counts.representative_sectors ?? 0;
  const observedDirect = counts.representative_observed_direct_flow_inputs ?? 0;
  const observedConfirmation = counts.representative_observed_price_volume_confirmations ?? 0;
  const trueFlowCoverage = representativeSectors ? observedDirect / representativeSectors : 0;
  const trueConfirmationCoverage = representativeSectors ? observedConfirmation / representativeSectors : 0;
  const sampleDays = inputs.rotationHistory?.sample_days ?? 0;
  const providerRunOk = providerRun.mode === "real" && providerRun.status === "ok";
  const providerReadiness = providerReadinessLabel(providerFlow);
  const hasManualModules = hasManualSeed(inputs.moduleReview);
  const blockers = [];

  if (!providerRunOk) blockers.push(blocker("provider_run_missing", "AKShare 真实 provider 今天还没有确认跑通。"));
  if (isNonRealSource(sourceReality)) blockers.push(blocker("non_real_flow_source", "行业资金量价仍来自 mock、fixture 或未验证来源。"));
  if (providerReadiness === "baseline_only") blockers.push(blocker("baseline_only", "当前只有 ETF 份额基线，份额变化流需要至少下一个交易日。"));
  if (observedDirect < Math.max(1, Math.ceil(representativeSectors * 0.6))) blockers.push(blocker("true_flow_coverage_low", "真实 ETF 直接资金流覆盖不足。"));
  if (sampleDays < 3) blockers.push(blocker("trend_history_short", "轮动历史至少需要 3 个交易日样本。"));
  if (hasManualModules) blockers.push(blocker("manual_valuation_fundamental", "估值和基本面模块仍包含手工种子输入。"));

  const guidanceState = blockers.some((item) => ["provider_run_missing", "non_real_flow_source", "baseline_only", "true_flow_coverage_low"].includes(item.id))
    ? "not_ready"
    : blockers.length
      ? "watch_only"
      : "decision_support_ready";

  return {
    guidance_state: guidanceState,
    provider_run: providerRunOk ? "real_ok" : "missing_or_not_ok",
    provider_flow_readiness: providerReadiness,
    flow_source_reality: sourceReality,
    market_use_confidence: availability.market_use_confidence ?? "unknown",
    representative_sectors: representativeSectors,
    observed_direct_flow_inputs: observedDirect,
    observed_price_volume_confirmations: observedConfirmation,
    true_flow_coverage: round(trueFlowCoverage),
    true_confirmation_coverage: round(trueConfirmationCoverage),
    sample_days: sampleDays,
    min_sample_days: 3,
    valuation_fundamental_source: hasManualModules ? "manual_seed" : "non_manual_or_missing",
    blockers
  };
}

function buildSectorReadiness({ row, flowRow, gates }) {
  const action = sectorAction({ row, flowRow, gates });
  const score = readinessScore({ row, flowRow, gates, action });
  return {
    sector_id: row.sector_id,
    pool_id: row.pool_id,
    name: row.display_name ?? row.name,
    coverage_status: row.coverage_status,
    classification: row.classification,
    readiness_score: score,
    action,
    evidence: {
      observed_direct_flow: hasObservedComponent(flowRow, "direct_flow"),
      observed_price_volume: hasObservedComponent(flowRow, "market_confirmation"),
      direct_flow_sources: componentSources(flowRow, "direct_flow"),
      price_volume_sources: componentSources(flowRow, "market_confirmation"),
      module_decision: row.decision,
      valuation_label: row.modules?.valuation?.label,
      valuation_position_score: row.modules?.valuation?.position_score,
      fundamental_label: row.modules?.fundamental?.label,
      fundamental_score: row.modules?.fundamental?.score,
      flow_price_label: row.modules?.flow_price?.label,
      flow_price_score: row.modules?.flow_price?.score,
      flow_confidence: row.modules?.flow_price?.confidence,
      data_completeness: row.modules?.flow_price?.data_completeness
    },
    blockers: sectorBlockers({ row, flowRow, gates })
  };
}

function sectorAction({ row, flowRow, gates }) {
  const label = row.decision?.label;
  const covered = row.coverage_status === "provider_mapped_representative";
  const observedDirect = hasObservedComponent(flowRow, "direct_flow");
  const risk = ["value_trap_risk", "expensive_deteriorating", "expensive_flow_fading"].includes(label);
  const candidate = ["undervalued_turning", "cheap_with_flow", "balanced_candidate"].includes(label);

  if (!covered) return action("not_covered", "未接入代表ETF", "该行业还没有通过代表 ETF provider 映射，暂不进入买入候选。");
  if (gates.guidance_state === "not_ready" && isNonRealSource(gates.flow_source_reality)) {
    return action("blocked_non_real_source", "数据非真实，禁止指导", "资金量价仍含 mock/fixture/source-unverified，不能用于买 ETF。");
  }
  if (!observedDirect || gates.provider_flow_readiness === "baseline_only") {
    return action("wait_for_real_flow", "等真实资金流", "已可观察价格和份额基线，但买入判断需要第二个交易日的份额变化。");
  }
  if (risk) return action("avoid_or_reduce_watch", "风险优先", row.decision?.reading ?? "估值、基本面或资金组合偏风险。");
  if (gates.sample_days < gates.min_sample_days) {
    return action("watch_for_persistence", "观察持续性", "真实输入开始出现，但轮动样本不足，先看是否连续。");
  }
  if (candidate && row.decision?.label === "undervalued_turning") {
    return action("small_position_candidate", "小仓候选", "估值、基本面、资金量价同时较顺，可进入人工复核的小仓候选。");
  }
  if (candidate) return action("confirmation_candidate", "确认候选", "组合标签较好，但仍需要人工检查估值来源、仓位上限和回撤风险。");
  return action("wait_for_confirmation", "等待确认", row.decision?.reading ?? "三条线没有形成足够清晰的组合。");
}

function sectorBlockers({ row, flowRow, gates }) {
  const blockers = [];
  if (row.coverage_status !== "provider_mapped_representative") blockers.push("no_representative_provider_mapping");
  if (isNonRealSource(gates.flow_source_reality)) blockers.push("non_real_flow_source");
  if (!hasObservedComponent(flowRow, "direct_flow")) blockers.push("no_observed_direct_etf_flow");
  if (gates.provider_flow_readiness === "baseline_only") blockers.push("baseline_only");
  if (gates.sample_days < gates.min_sample_days) blockers.push("trend_history_short");
  if (["manual_seed", "profile_missing"].includes(row.modules?.valuation?.status)) blockers.push(`valuation_${row.modules?.valuation?.status ?? "unknown"}`);
  if (["manual_seed", "profile_missing"].includes(row.modules?.fundamental?.status)) blockers.push(`fundamental_${row.modules?.fundamental?.status ?? "unknown"}`);
  return blockers;
}

function readinessScore({ row, flowRow, gates, action }) {
  const valuation = numberOrZero(row.modules?.valuation?.position_score);
  const fundamental = numberOrZero(row.modules?.fundamental?.score);
  const flow = numberOrZero(row.modules?.flow_price?.score);
  let score = 40;
  if (row.coverage_status === "provider_mapped_representative") score += 10;
  score += clamp(-valuation, -0.4, 0.4) * 25;
  score += clamp(fundamental, -0.4, 0.4) * 25;
  score += clamp(flow, -0.4, 0.4) * 25;
  if (hasObservedComponent(flowRow, "direct_flow")) score += 15;
  if (hasObservedComponent(flowRow, "market_confirmation")) score += 8;
  score += Math.min(gates.sample_days, 5) * 2;

  if (gates.guidance_state === "not_ready") score = Math.min(score, 42);
  if (action.label === "not_covered") score = Math.min(score, 28);
  if (action.label === "blocked_non_real_source") score = Math.min(score, 32);
  if (action.label === "avoid_or_reduce_watch") score = Math.min(score, 45);
  return round(clamp(score, 0, 100), 1);
}

function hasObservedComponent(row, componentName) {
  return componentSources(row, componentName).some((source) => isObservedSource(source));
}

function componentSources(row, componentName) {
  return (row?.components?.[componentName]?.nodes ?? [])
    .map((node) => typeof node === "string" ? "string_node" : node.source ?? "no_source");
}

function isObservedSource(source) {
  return /akshare|provider|observed|exchange|real|local_csv/i.test(source) && !/mock|fixture/i.test(source);
}

function isNonRealSource(source) {
  return /mock|fixture|unknown|unverified/i.test(source ?? "");
}

function providerReadinessLabel(payload) {
  const value = payload?.readiness?.status ?? payload?.flow_readiness?.status ?? payload?.readiness ?? payload?.status;
  if (typeof value === "string") return value;
  return "unknown";
}

function hasManualSeed(payload) {
  return (payload?.sectors ?? []).some((row) => (
    row.modules?.valuation?.status === "manual_seed" ||
    row.modules?.fundamental?.status === "manual_seed"
  ));
}

function buildHeadline({ gates, sorted, actionReadyCount }) {
  if (gates.guidance_state === "not_ready") {
    const firstBlocker = gates.blockers[0]?.reading ?? "核心数据门槛未满足。";
    return `暂不能指导买入 ETF：${firstBlocker}`;
  }
  const first = sorted[0];
  if (gates.guidance_state === "watch_only") {
    return `可以做观察清单，但还不能做买入指令。优先复核 ${first?.name ?? "--"}。`;
  }
  return `ETF 决策支持已通过基础门槛，${actionReadyCount} 个行业进入人工复核候选。`;
}

function buildProgress({ gates }) {
  const milestones = [
    milestone({
      id: "provider_environment",
      label: "AKShare通道",
      done: gates.provider_run === "real_ok",
      current: gates.provider_run,
      reading: gates.provider_run === "real_ok"
        ? "真实 provider 已跑通，系统不再只停留在样例数据。"
        : "先跑通 AKShare provider，确认本机能取真实 ETF 数据。"
    }),
    milestone({
      id: "baseline_snapshot",
      label: "ETF基线",
      done: ["baseline_only", "flow_ready", "ready", "ok"].includes(gates.provider_flow_readiness),
      current: gates.provider_flow_readiness,
      reading: ["baseline_only", "flow_ready", "ready", "ok"].includes(gates.provider_flow_readiness)
        ? "已经有代表 ETF 的价格、成交额和份额基线。"
        : "等待代表 ETF 的首个有效基线快照。"
    }),
    milestone({
      id: "share_change_flow",
      label: "份额变化流",
      done: gates.true_flow_coverage >= 0.6,
      current: gates.true_flow_coverage,
      reading: gates.true_flow_coverage >= 0.6
        ? "代表行业已经有足够的真实 ETF 份额变化输入。"
        : "还需要下一个交易日，才能由份额差计算真实资金流。"
    }),
    milestone({
      id: "trend_history",
      label: "趋势样本",
      done: gates.sample_days >= gates.min_sample_days,
      current: `${gates.sample_days}/${gates.min_sample_days}`,
      reading: gates.sample_days >= gates.min_sample_days
        ? "轮动历史样本已达到基础趋势确认门槛。"
        : "继续累计交易日样本，避免被一天的波动误导。"
    }),
    milestone({
      id: "valuation_source",
      label: "估值来源",
      done: gates.valuation_fundamental_source !== "manual_seed",
      current: gates.valuation_fundamental_source,
      reading: gates.valuation_fundamental_source !== "manual_seed"
        ? "估值/基本面不再依赖手工种子。"
        : "估值和基本面还需要接入 PE/PB/股息/ROE 等真实来源。"
    })
  ];
  const doneCount = milestones.filter((item) => item.done).length;
  const completionRatio = milestones.length ? doneCount / milestones.length : 0;
  return {
    completion_ratio: round(completionRatio),
    completed_milestones: doneCount,
    total_milestones: milestones.length,
    stage: progressStage({ gates, doneCount, total: milestones.length }),
    sleep_note: sleepNote({ gates, doneCount, total: milestones.length }),
    next_unlock: nextUnlock(milestones),
    milestones
  };
}

function milestone({ id, label, done, current, reading }) {
  return {
    id,
    label,
    status: done ? "done" : "pending",
    current,
    reading
  };
}

function progressStage({ gates, doneCount, total }) {
  if (gates.guidance_state === "decision_support_ready") return "decision_support";
  if (doneCount >= Math.ceil(total * 0.6)) return "near_watchlist";
  if (doneCount >= 2) return "real_data_foundation";
  if (doneCount >= 1) return "provider_started";
  return "model_contract_ready";
}

function sleepNote({ gates, doneCount, total }) {
  if (gates.guidance_state === "decision_support_ready") {
    return "今晚可以收工：系统已经具备基础决策支持，但实际下单仍要人工复核仓位。";
  }
  if (doneCount >= 2) {
    return `今晚不是原地踏步：${doneCount}/${total} 个关键关卡已完成，下一步主要等真实交易日差分。`;
  }
  if (doneCount >= 1) {
    return `今晚已经从结构验证推进到真实数据入口：${doneCount}/${total} 个关键关卡完成。`;
  }
  return "今晚至少把纪律层搭好了：系统知道什么时候不能乱给 ETF 建议。";
}

function nextUnlock(milestones) {
  const pending = milestones.find((item) => item.status !== "done");
  if (!pending) {
    return {
      milestone_id: "manual_review",
      label: "人工复核",
      reading: "下一步是仓位、回撤和交易计划复核。"
    };
  }
  return {
    milestone_id: pending.id,
    label: pending.label,
    reading: pending.reading
  };
}

function nextSteps(gates) {
  const steps = [];
  if (gates.provider_run !== "real_ok") steps.push("先跑通目标日期的 AKShare provider。");
  if (gates.provider_flow_readiness === "baseline_only" || gates.true_flow_coverage < 0.6) steps.push("在下一个交易日继续运行 AKShare provider，让系统能计算 ETF 份额变化流。");
  if (gates.sample_days < gates.min_sample_days) steps.push("累计至少 3 个交易日的轮动历史快照。");
  if (gates.valuation_fundamental_source === "manual_seed") steps.push("接入 PE/PB/股息/ROE 等真实估值和基本面来源，再使用配置候选标签。");
  return steps.length ? steps : ["候选 ETF 仍需人工复核仓位上限、回撤和交易计划。"];
}

function countActions(rows) {
  return rows.reduce((acc, row) => {
    acc[row.action.label] = (acc[row.action.label] ?? 0) + 1;
    return acc;
  }, {});
}

function sectorBrief(row) {
  return {
    sector_id: row.sector_id,
    name: row.name,
    readiness_score: row.readiness_score,
    action: row.action,
    evidence: {
      valuation_label: row.evidence.valuation_label,
      valuation_position_score: row.evidence.valuation_position_score,
      fundamental_label: row.evidence.fundamental_label,
      fundamental_score: row.evidence.fundamental_score,
      flow_price_label: row.evidence.flow_price_label,
      flow_price_score: row.evidence.flow_price_score,
      observed_direct_flow: row.evidence.observed_direct_flow
    },
    blockers: row.blockers
  };
}

function topWatchlist(sorted) {
  const actionableOrNear = sorted.filter((row) => (
    ["small_position_candidate", "confirmation_candidate", "watch_for_persistence", "wait_for_real_flow"].includes(row.action.label)
  ));
  const fallbackBlocked = sorted.filter((row) => row.coverage_status === "provider_mapped_representative");
  const rows = actionableOrNear.length ? actionableOrNear : fallbackBlocked;
  return rows.slice(0, 6).map(sectorBrief);
}

function buildMarkdown(payload) {
  const rows = payload.sectors.map((row, index) => (
    `| ${index + 1} | ${row.name} | ${row.readiness_score} | ${row.action.text} | ${row.blockers.join(", ") || "none"} |`
  )).join("\n");
  return `# ETF Decision Readiness ${payload.as_of}

${payload.headline}

Guidance state: ${payload.guidance_state}

| Rank | Sector | Readiness | Action | Blockers |
| --- | --- | ---: | --- | --- |
${rows}

## Boundary

${payload.interpretation_boundary.map((item) => `- ${item}`).join("\n")}
`;
}

function action(label, text, reading) {
  return { label, text, reading };
}

function blocker(id, reading) {
  return { id, reading };
}

function sectorId(row) {
  return row.sector_id ?? String(row.pool_id ?? "").replace(/^a_share_/, "");
}

function actionPriority(label) {
  const priorities = {
    small_position_candidate: 1,
    confirmation_candidate: 2,
    watch_for_persistence: 3,
    wait_for_real_flow: 4,
    wait_for_confirmation: 5,
    avoid_or_reduce_watch: 6,
    blocked_non_real_source: 7,
    not_covered: 8
  };
  return priorities[label] ?? 99;
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
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
  const result = await runEtfDecisionReadiness({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`ETF decision readiness written: ${result.jsonPath}`);
  console.log(`Guidance state: ${result.payload.guidance_state}`);
  console.log(`Headline: ${result.payload.headline}`);
}
