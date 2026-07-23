import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  STRUCTURAL_OBSERVATION_LIMIT,
  USER_VISIBLE_LABELS,
  buildCoreBasis,
  buildNextObservation,
  describePublishedChange,
  hasInternalEnglish,
  structuralObservationRows,
  visibleLabel
} from "../financial-pond/structural-observation-contract.mjs";

const requiredLabels = {
  "Confirmed Trend": "趋势已确认",
  "Major Candidate": "主线候选",
  "Watch Candidate": "观察候选",
  "Emerging Candidate": "新兴候选",
  "Conflict Review": "信号冲突待确认",
  Deteriorating: "状态转弱",
  Avoid: "暂不关注",
  pass: "通过",
  blocked: "未通过",
  pending: "等待确认",
  high: "高",
  medium: "中",
  low: "低",
  none: "无",
  outward: "向相关板块扩散",
  inward: "板块内部集中",
  neutral: "暂无明显扩散",
  insufficient_sample: "样本不足",
  unavailable: "数据不可用",
  reviewed: "已复盘"
};

test("Top 10 contract preserves published model order and never pads missing rows", () => {
  const ranked = Array.from({ length: 12 }, (_, index) => ({
    pool_id: `pool-${index + 1}`,
    observation_score: 100 - index
  }));
  const selected = structuralObservationRows({ top_observation_pools: ranked });
  assert.equal(STRUCTURAL_OBSERVATION_LIMIT, 10);
  assert.deepEqual(selected.map((row) => row.pool_id), ranked.slice(0, 10).map((row) => row.pool_id));
  assert.deepEqual(selected.map((row) => row.observation_score), ranked.slice(0, 10).map((row) => row.observation_score));

  const short = structuralObservationRows({ top_observation_pools: ranked.slice(0, 4) });
  assert.equal(short.length, 4);
  assert.deepEqual(short, ranked.slice(0, 4));
});

test("human-readable explanations use real fields and fail closed when evidence is missing", () => {
  const base = {
    pool_id: "a_share_semiconductor",
    flow_status: "estimated_from_source",
    momentum_status: "derived_from_market",
    liquidity_status: "derived_from_market",
    direction: "outward",
    risk_gate_status: "pass",
    overheat_score: 52
  };
  const evidence = {
    displayName: "半导体",
    mapping: { mapping_status: "direct_etf" },
    market: {
      momentum_value: 2.35,
      liquidity_status: "derived_from_market",
      liquidity_direction: "above_median",
      amount: 12_000_000
    },
    history: { observedSessions: 3 }
  };
  const basis = buildCoreBasis(base, evidence);
  const watch = buildNextObservation(base, evidence);
  assert.match(basis, /直接 ETF 映射/);
  assert.match(basis, /3\/3 项核心观察数据可用/);
  assert.match(basis, /\+2\.35%/);
  assert.match(basis, /成交活跃度高于行业样本中位/);
  assert.match(basis, /向相关板块扩散/);
  assert.match(watch, /半导体/);
  assert.match(watch, /成交额能否维持扩张/);
  assert.equal(hasInternalEnglish(basis), false);
  assert.equal(hasInternalEnglish(watch), false);

  const missing = buildCoreBasis({
    flow_status: "missing",
    momentum_status: "missing",
    liquidity_status: "missing",
    direction: "neutral",
    risk_gate_status: "insufficient_data"
  }, {
    mapping: { mapping_status: "unavailable" },
    market: {},
    history: { observedSessions: 0 }
  });
  assert.match(missing, /行业映射未完全确认/);
  assert.match(missing, /0\/3 项核心观察数据可用/);
  assert.match(missing, /成交额数据不足/);
  assert.match(missing, /连续性样本不足/);
  assert.doesNotMatch(missing, /direct_etf|unavailable|insufficient_data/);
});

test("status labels and published change language stay Chinese and evidence-bound", () => {
  for (const [machine, label] of Object.entries(requiredLabels)) {
    assert.equal(USER_VISIBLE_LABELS[machine], label);
    assert.equal(visibleLabel(machine), label);
  }
  assert.equal(visibleLabel("unknown_internal_enum"), "暂未提供可读解释");
  assert.equal(
    describePublishedChange({ currentRank: 2, previousRank: 5, currentState: "Confirmed Trend", previousState: "Major Candidate" }),
    "排名上升 3 位；状态升级。"
  );
  assert.equal(
    describePublishedChange({ currentRank: 1, previousRank: null, currentState: "Confirmed Trend", previousState: null }),
    "暂无足够历史数据比较排名变化。"
  );
});

test("site implementation uses the shared Top 10 contract, selectable details, mobile cards, sticky offset, and formal brand assets", async () => {
  const [app, html, css, builder, stateModel, mark, favicon] = await Promise.all([
    readFile(new URL("../financial-pond/app.js", import.meta.url), "utf8"),
    readFile(new URL("../financial-pond/index.html", import.meta.url), "utf8"),
    readFile(new URL("../financial-pond/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-evening-observation-summary.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-candidate-state-model.mjs", import.meta.url), "utf8"),
    readFile(new URL("../financial-pond/financial-ponds-mark.svg", import.meta.url), "utf8"),
    readFile(new URL("../financial-pond/favicon.svg", import.meta.url), "utf8")
  ]);

  assert.match(html, /Top 10 结构性观察/);
  assert.match(html, /不等于未来上涨概率/);
  assert.match(html, /financial-ponds-mark\.svg/);
  assert.match(html, /favicon\.svg/);
  assert.match(html, /apple-touch-icon\.png/);
  assert.doesNotMatch(html, /Top 5 候选|observe only/);

  assert.match(app, /structuralObservationRows\(state\.summary, state\.ledger\)/);
  assert.match(app, /state\.selectedPoolId = button\.getAttribute/);
  assert.match(app, /state\.selectedPoolId = rowsForToday\(\)\[0\]\?\.pool_id/);
  for (const name of ["通信电子", "资源材料", "半导体", "AI计算机", "券商", "新能源车", "银行保险", "国防军工", "消费", "医药医疗"]) {
    assert.match(app, new RegExp(name));
  }
  assert.doesNotMatch(app, /function rowsForToday\(\)[\s\S]{0,350}slice\(0,\s*5\)/);
  assert.match(builder, /top_observation_pools: topPools/);
  assert.doesNotMatch(builder, /top_observation_pools:\s*topPools\.slice\(0,\s*5\)/);
  assert.doesNotMatch(stateModel, /STRUCTURAL_OBSERVATION_LIMIT/);
  assert.match(stateModel, /recentTopSessions[\s\S]*?slice\(0,\s*5\)/);

  assert.match(css, /grid-template-areas:[\s\S]*"rank name state"/);
  assert.match(css, /\.candidate-copy::before/);
  assert.match(css, /\.candidates-panel[\s\S]*scroll-margin-top:/);
  assert.doesNotMatch(css, /\.candidate-table\s*\{\s*overflow-x:\s*auto/);
  assert.match(mark, /^<svg/);
  assert.doesNotMatch(mark, /<image\b|data:image\//);
  assert.match(favicon, /^<svg/);
  assert.doesNotMatch(favicon, /<text\b|<image\b|data:image\//);
});
