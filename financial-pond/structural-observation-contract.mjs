export const STRUCTURAL_OBSERVATION_LIMIT = 10;

export const USER_VISIBLE_LABELS = Object.freeze({
  "Confirmed Trend": "趋势已确认",
  "Major Candidate": "主线候选",
  "Watch Candidate": "观察候选",
  "Emerging Candidate": "新兴候选",
  "Conflict Review": "信号冲突待确认",
  Deteriorating: "状态转弱",
  Avoid: "暂不关注",
  "Early Right": "新兴候选",
  Pulse: "观察候选",
  Noise: "证据不足",
  Overheated: "短期偏热",
  Cooling: "状态降温",
  Failed: "暂不关注",
  pass: "通过",
  blocked: "未通过",
  block: "未通过",
  caution: "谨慎观察",
  pending: "等待确认",
  insufficient_data: "数据不足",
  high: "高",
  medium: "中",
  low: "低",
  none: "无",
  outward: "向相关板块扩散",
  inward: "板块内部集中",
  neutral: "暂无明显扩散",
  insufficient_sample: "样本不足",
  unavailable: "数据不可用",
  reviewed: "已复盘",
  direct_etf: "直接 ETF 映射",
  direct_index: "直接指数映射",
  sector_proxy: "行业代理映射",
  broad_proxy: "宽基代理映射",
  exact: "精确对应",
  source_backed: "来源数据直接支持",
  estimated_from_source: "依据来源数据估算",
  derived_from_market: "依据市场数据计算",
  real_provider: "Provider 实际数据",
  real_provider_derived: "由 Provider 实际数据计算",
  usable: "可用",
  missing: "数据缺失",
  changed: "相比上一交易日发生变化",
  stable: "相比上一交易日保持稳定",
  new_signal: "出现新的观察信号",
  improved_data: "数据完整度改善",
  confidence_change: "置信度发生变化",
  strong_observe: "重点观察",
  moderate_observe: "持续观察",
  weak_observe: "基础观察",
  insufficient: "证据不足",
  pending_not_due: "尚未到复盘日",
  pending_market_open: "等待收盘数据",
  awaiting_eod_data: "等待日终数据",
  stale_data: "数据日期过旧",
  missing_price: "缺少精确日期价格",
  missing_benchmark: "缺少精确日期基准",
  calendar_unknown: "交易日历不足",
  invalid_baseline: "基准价格无效",
  mapped_ohlcv_only: "仅有价格与成交数据"
});

const KNOWN_STATES = [
  "Noise",
  "Pulse",
  "Early Right",
  "Major Candidate",
  "Confirmed Trend"
];

const AVAILABLE_STATUSES = new Set([
  "source_backed",
  "estimated_from_source",
  "derived_from_market",
  "real_provider",
  "real_provider_derived"
]);

export function visibleLabel(value, fallback = "暂未提供可读解释") {
  if (value === null || value === undefined || value === "") return "数据不可用";
  const key = String(value);
  if (Object.hasOwn(USER_VISIBLE_LABELS, key)) return USER_VISIBLE_LABELS[key];
  if (/[\u3400-\u9fff]/u.test(key)) return key;
  return fallback;
}

export function structuralObservationRows(summary, ledger = {}) {
  const published = Array.isArray(summary?.top_observation_pools)
    ? summary.top_observation_pools
    : [];
  if (published.length) return published.slice(0, STRUCTURAL_OBSERVATION_LIMIT);
  const asOf = ledger?.as_of;
  return (ledger?.rows ?? [])
    .filter((row) => !asOf || row.as_of === asOf)
    .slice(0, STRUCTURAL_OBSERVATION_LIMIT);
}

export function buildCoreBasis(row, context = {}) {
  const mapping = context.mapping ?? {};
  const market = context.market ?? {};
  const history = context.history ?? {};
  const parts = [];

  if (["direct_etf", "direct_index"].includes(mapping.mapping_status)) {
    parts.push(`使用${visibleLabel(mapping.mapping_status)}`);
  } else if (["sector_proxy", "broad_proxy"].includes(mapping.mapping_status)) {
    parts.push(`${visibleLabel(mapping.mapping_status)}，标的映射仍需谨慎`);
  } else {
    parts.push("行业映射未完全确认");
  }

  const statuses = [row.flow_status, row.momentum_status, row.liquidity_status];
  const availableCount = statuses.filter((status) => AVAILABLE_STATUSES.has(status)).length;
  parts.push(`${availableCount}/3 项核心观察数据可用`);

  const momentum = finiteOrNull(market.momentum_value);
  if (momentum === null) {
    parts.push("当前价格强度数据不足");
  } else if (momentum > 0) {
    parts.push(`当日价格强度为 +${trimNumber(momentum)}%`);
  } else if (momentum < 0) {
    parts.push(`当日价格强度为 ${trimNumber(momentum)}%`);
  } else {
    parts.push("当日价格变化暂时持平");
  }

  if (market.liquidity_status === "missing" || finiteOrNull(market.amount ?? market.liquidity_value) === null) {
    parts.push("成交额数据不足");
  } else if (market.liquidity_direction === "above_median") {
    parts.push("成交活跃度高于行业样本中位");
  } else {
    parts.push("成交活跃度尚未明显扩张");
  }

  if ((history.observedSessions ?? 0) >= 2) {
    parts.push(`最近 ${history.observedSessions} 个有记录观察日持续进入结构观察序列`);
  } else {
    parts.push("连续性样本不足");
  }

  if (row.direction === "outward") parts.push("强势正向相关板块扩散");
  if (row.direction === "inward") parts.push("当前强势主要集中在板块内部");
  if (row.direction === "neutral") parts.push("暂未观察到明显板块扩散");

  if (row.risk_gate_status === "pass") parts.push("风险闸门通过");
  else if (row.risk_gate_status) parts.push(`风险闸门为“${visibleLabel(row.risk_gate_status)}”`);

  const overheat = finiteOrNull(row.overheat_score);
  if (overheat !== null && overheat >= 45) parts.push("短期拥挤度已进入需要重点观察的区间");

  return `${parts.slice(0, 6).join("；")}。`;
}

export function buildNextObservation(row, context = {}) {
  const market = context.market ?? {};
  const history = context.history ?? {};
  const name = context.displayName ?? "该行业";
  const checks = [];

  if ((history.observedSessions ?? 0) < 2) checks.push("继续积累排名连续性样本");
  else checks.push("后续交易日能否继续保持结构观察前列");

  if (market.liquidity_status === "missing" || finiteOrNull(market.amount ?? market.liquidity_value) === null) {
    checks.push("补齐成交额确认");
  } else if (market.liquidity_direction === "above_median") {
    checks.push("成交额能否维持扩张");
  } else {
    checks.push("成交活跃度能否回升");
  }

  const momentum = finiteOrNull(market.momentum_value);
  if (momentum === null) checks.push("等待精确日期价格强度");
  else if (momentum <= 0) checks.push("相对强度能否恢复");
  else checks.push("相对强度是否出现回落");

  if (row.direction === "outward") checks.push("相关板块是否继续同步增强");
  else checks.push("强势能否由板块内部向相关行业扩散");

  if (finiteOrNull(row.overheat_score) >= 45) checks.push("过热／拥挤度是否继续快速上升");
  if (row.risk_gate_status !== "pass") checks.push("风险闸门能否恢复为通过");
  else checks.push("若流动性转弱或风险闸门未通过，应下调观察状态");

  return `观察${name}${checks.slice(0, 4).join("，同时确认")}。`;
}

export function describePublishedChange({
  currentRank,
  previousRank,
  currentState,
  previousState
}) {
  if (!Number.isInteger(previousRank)) return "暂无足够历史数据比较排名变化。";
  const changes = [];
  if (currentRank < previousRank) changes.push(`排名上升 ${previousRank - currentRank} 位`);
  else if (currentRank > previousRank) changes.push(`排名下降 ${currentRank - previousRank} 位`);
  else changes.push("排名不变");

  if (currentState && previousState && currentState !== previousState) {
    const currentIndex = KNOWN_STATES.indexOf(currentState);
    const previousIndex = KNOWN_STATES.indexOf(previousState);
    if (currentIndex >= 0 && previousIndex >= 0) {
      changes.push(currentIndex > previousIndex ? "状态升级" : "状态降级");
    } else {
      changes.push(`状态调整为${visibleLabel(currentState)}`);
    }
  }
  return `${changes.join("；")}。`;
}

export function metricLevel(value, { low = 35, high = 70, scale = 100 } = {}) {
  const number = finiteOrNull(value);
  if (number === null) return "数据不足";
  const normalized = scale === 1 ? number * 100 : number;
  if (normalized >= high) return "高";
  if (normalized >= low) return "中";
  return "低";
}

export function hasInternalEnglish(value) {
  const text = String(value ?? "");
  return [
    "direct_etf",
    "delta changed",
    "outward",
    "pass",
    "usable",
    "capped confidence",
    "recent top persistence",
    "Major Candidate",
    "Confirmed Trend"
  ].some((token) => text.includes(token));
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function trimNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}
