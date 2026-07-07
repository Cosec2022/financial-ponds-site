// FP-MOD-01 Independent Sector Module Review
// Input: sector_flow_review.json + editable sector_module_profiles.json
// Output: sector_module_review.json and sector_module_review.md
// Boundary: combines independent module labels; it is not a trading instruction.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../core/config_loader.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runSectorModuleReview({
  rootDir = defaultRootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const [sectorReview, sectorCatalog, profiles] = await Promise.all([
    readSectorReview({ rootDir, asOf: resolvedAsOf }),
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json")),
    readJsonFile(path.join(rootDir, "config", "model", "sector_module_profiles.json"))
  ]);

  const payload = buildSectorModuleReview({
    sectorReview,
    sectorCatalog,
    profiles
  });

  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "sector_module_review.json");
  const mdPath = path.join(outDir, "sector_module_review.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return { payload, jsonPath, mdPath };
}

export function buildSectorModuleReview({
  sectorReview,
  sectorCatalog,
  profiles
}) {
  const profileBySector = new Map((profiles.sectors ?? []).map((item) => [item.sector_id, item]));
  const reviewBySector = new Map((sectorReview.sector_reviews ?? []).map((row) => [sectorId(row), row]));
  const sectors = (sectorCatalog.sectors ?? []).map((sector) => {
    const flowRow = reviewBySector.get(sector.id) ?? {};
    const profile = profileBySector.get(sector.id) ?? {};
    const valuation = buildValuationModule(profile.valuation);
    const fundamental = buildFundamentalModule(profile.fundamental);
    const flowPrice = buildFlowPriceModule(flowRow);
    const decision = buildDecision({ valuation, fundamental, flowPrice });

    return {
      sector_id: sector.id,
      pool_id: flowRow.pool_id ?? `a_share_${sector.id}`,
      name: sector.name,
      display_name: sector.display_name,
      coverage_status: sector.coverage_status,
      classification: sector.classification,
      modules: {
        valuation,
        fundamental,
        flow_price: flowPrice
      },
      decision
    };
  });

  const sorted = [...sectors].sort((a, b) => decisionPriority(a.decision) - decisionPriority(b.decision) || scoreForRanking(b) - scoreForRanking(a));
  const counts = countDecisions(sectors);
  const moduleAverages = {
    valuation_position_score: round(average(sectors.map((row) => row.modules.valuation.position_score))),
    fundamental_score: round(average(sectors.map((row) => row.modules.fundamental.score))),
    flow_price_score: round(average(sectors.map((row) => row.modules.flow_price.score)))
  };

  return {
    as_of: sectorReview.as_of,
    generated_at: new Date().toISOString(),
    module_id: "sector_module_review_v0_1",
    input_contract_id: profiles.id,
    status: "module_review_available",
    headline: buildHeadline({ counts, sorted }),
    module_averages: moduleAverages,
    counts: {
      sectors: sectors.length,
      provider_mapped_representative_sectors: sectors.filter((row) => row.coverage_status === "provider_mapped_representative").length,
      framework_only_sectors: sectors.filter((row) => row.coverage_status === "framework_only").length,
      ...counts
    },
    leaders: sorted.slice(0, 5).map(sectorBrief),
    risks: sectors
      .filter((row) => ["value_trap_risk", "expensive_deteriorating", "expensive_flow_fading"].includes(row.decision.label))
      .sort((a, b) => decisionPriority(a.decision) - decisionPriority(b.decision))
      .slice(0, 5)
      .map(sectorBrief),
    sectors: sorted,
    interpretation_boundary: [
      "The valuation module is independent from flow and price. It should not change because a sector rises today.",
      "The fundamental module is independent from short-term price action. It should change only after earnings, ROE, margin, policy transmission, order, inventory, or cycle evidence updates.",
      "The flow_price module is imported from sector_flow_review.json and keeps the existing ETF flow / price-volume logic.",
      "The decision label is a readable cross-tab, not a buy or sell instruction."
    ],
    update_notes: [
      "Nightly manual update path: edit config/model/sector_module_profiles.json, then run npm run module:review -- --as-of YYYY-MM-DD.",
      "Provider path later: replace manual profile fields with PE/PB/dividend/ROE/earnings trend exports while preserving this JSON contract."
    ]
  };
}

async function readSectorReview({ rootDir, asOf }) {
  const candidates = [
    path.join(rootDir, "model_outputs", asOf, "sector_flow_review.json"),
    path.join(rootDir, "..", "..", "financial-pond", "data", "sector_flow_review.json")
  ];
  for (const candidate of candidates) {
    const payload = await readJsonIfExists(candidate);
    if (payload?.sector_reviews) return payload;
  }
  throw new Error(`No sector_flow_review.json found for ${asOf}`);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function buildValuationModule(input = {}) {
  const positionScore = numberOrNull(input.position_score) ?? 0;
  return {
    status: input.position_score === undefined ? "profile_missing" : "manual_seed",
    position_score: round(positionScore),
    label: valuationLabel(positionScore),
    pe_percentile: numberOrNull(input.pe_percentile),
    pb_percentile: numberOrNull(input.pb_percentile),
    dividend_support: numberOrNull(input.dividend_support),
    note: input.note ?? "No valuation profile yet."
  };
}

function buildFundamentalModule(input = {}) {
  const score = numberOrNull(input.score) ?? 0;
  return {
    status: input.score === undefined ? "profile_missing" : "manual_seed",
    score: round(score),
    label: fundamentalLabel(score),
    earnings_trend: numberOrNull(input.earnings_trend),
    roe_quality: numberOrNull(input.roe_quality),
    cycle_position: numberOrNull(input.cycle_position),
    note: input.note ?? "No fundamental profile yet."
  };
}

function buildFlowPriceModule(row = {}) {
  const flowScore = numberOrNull(row.score) ?? 0;
  return {
    status: row.score === undefined ? "review_missing" : "from_sector_flow_review",
    score: round(flowScore),
    label: row.label ?? flowPriceLabel(flowScore),
    confidence: numberOrNull(row.confidence),
    data_completeness: numberOrNull(row.data_completeness),
    direct_flow_available: componentAvailable(row, "direct_flow"),
    market_confirmation_available: componentAvailable(row, "market_confirmation"),
    confirmation_inputs: confirmationInputs(row),
    top_drivers: (row.top_drivers ?? []).slice(0, 3)
  };
}

function buildDecision({ valuation, fundamental, flowPrice }) {
  const cheap = valuation.position_score <= -0.12;
  const expensive = valuation.position_score >= 0.24;
  const improving = fundamental.score >= 0.08;
  const deteriorating = fundamental.score <= -0.12;
  const strongFlow = flowPrice.score >= 0.18;
  const weakFlow = flowPrice.score <= -0.12;

  if (cheap && deteriorating) {
    return decision("value_trap_risk", "便宜但基本面弱", "估值低不能单独视为机会，先等盈利或现金流改善。");
  }
  if (cheap && improving && strongFlow) {
    return decision("undervalued_turning", "低估且转强", "估值、基本面、资金量价三条线同时较好。");
  }
  if (cheap && strongFlow) {
    return decision("cheap_with_flow", "低估且有资金", "估值有安全边际，市场开始确认，但基本面仍需继续看。");
  }
  if (cheap && weakFlow) {
    return decision("cheap_but_weak", "便宜但未转强", "估值便宜，但资金量价没有认可。");
  }
  if (expensive && deteriorating) {
    return decision("expensive_deteriorating", "贵且基本面弱", "估值和基本面组合不舒服，风险优先。");
  }
  if (expensive && strongFlow) {
    return decision("expensive_momentum", "偏贵但趋势强", "这是趋势机会而不是便宜机会，追高风险要单独控制。");
  }
  if (expensive && weakFlow) {
    return decision("expensive_flow_fading", "偏贵且资金退潮", "估值高、资金弱，属于高风险观察。");
  }
  if (improving && strongFlow) {
    return decision("balanced_candidate", "合理且改善", "没有明显估值便宜，但基本面和资金量价较顺。");
  }
  return decision("wait_for_confirmation", "等待确认", "三条线没有形成足够清晰的组合。");
}

function decision(label, text, reading) {
  return { label, text, reading };
}

function valuationLabel(score) {
  if (score <= -0.30) return "deep_discount";
  if (score <= -0.12) return "cheap";
  if (score < 0.18) return "fair";
  if (score < 0.35) return "expensive";
  return "very_expensive";
}

function fundamentalLabel(score) {
  if (score <= -0.25) return "deteriorating";
  if (score <= -0.06) return "weak";
  if (score < 0.12) return "stable";
  return "improving";
}

function flowPriceLabel(score) {
  if (score >= 0.28) return "strong_inflow_bias";
  if (score >= 0.12) return "constructive_inflow_bias";
  if (score <= -0.18) return "risk_off_pressure";
  if (score <= -0.08) return "outflow_watch";
  return "neutral";
}

function confirmationInputs(row) {
  const parts = [];
  if (componentAvailable(row, "direct_flow")) parts.push("direct_flow");
  if (componentAvailable(row, "market_confirmation")) parts.push("market_confirmation");
  if (componentAvailable(row, "market_liquidity")) parts.push("market_liquidity");
  if (componentAvailable(row, "policy_sentiment")) parts.push("policy_sentiment");
  return parts;
}

function componentAvailable(row, componentName) {
  return Boolean(row?.components?.[componentName]?.available);
}

function sectorId(row) {
  return row.sector_id ?? String(row.pool_id ?? "").replace(/^a_share_/, "");
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function round(value, digits = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function countDecisions(sectors) {
  return sectors.reduce((acc, row) => {
    acc[row.decision.label] = (acc[row.decision.label] ?? 0) + 1;
    return acc;
  }, {});
}

function scoreForRanking(row) {
  const valuationAttractiveness = -row.modules.valuation.position_score;
  return valuationAttractiveness * 0.25 + row.modules.fundamental.score * 0.35 + row.modules.flow_price.score * 0.40;
}

function decisionPriority(decision) {
  const priorities = {
    undervalued_turning: 1,
    cheap_with_flow: 2,
    balanced_candidate: 3,
    expensive_momentum: 4,
    cheap_but_weak: 5,
    wait_for_confirmation: 6,
    value_trap_risk: 7,
    expensive_flow_fading: 8,
    expensive_deteriorating: 9
  };
  return priorities[decision.label] ?? 99;
}

function sectorBrief(row) {
  return {
    sector_id: row.sector_id,
    name: row.display_name ?? row.name,
    valuation_label: row.modules.valuation.label,
    valuation_position_score: row.modules.valuation.position_score,
    fundamental_label: row.modules.fundamental.label,
    fundamental_score: row.modules.fundamental.score,
    flow_price_label: row.modules.flow_price.label,
    flow_price_score: row.modules.flow_price.score,
    decision: row.decision
  };
}

function buildHeadline({ counts, sorted }) {
  const first = sorted[0];
  if (!first) return "暂无三模块判断。";
  const opportunityCount = (counts.undervalued_turning ?? 0) + (counts.cheap_with_flow ?? 0) + (counts.balanced_candidate ?? 0);
  const riskCount = (counts.value_trap_risk ?? 0) + (counts.expensive_flow_fading ?? 0) + (counts.expensive_deteriorating ?? 0);
  return `三模块已分离：${opportunityCount} 个候选，${riskCount} 个风险观察。当前优先观察 ${first.display_name ?? first.name}：${first.decision.text}。`;
}

function buildMarkdown(payload) {
  const rows = payload.sectors.map((row, index) => (
    `| ${index + 1} | ${row.display_name ?? row.name} | ${row.modules.valuation.label} ${row.modules.valuation.position_score} | ${row.modules.fundamental.label} ${row.modules.fundamental.score} | ${row.modules.flow_price.label} ${row.modules.flow_price.score} | ${row.decision.text} |`
  )).join("\n");
  return `# Sector Module Review ${payload.as_of}

${payload.headline}

| Rank | Sector | Valuation | Fundamental | Flow & Price | Decision |
| --- | --- | --- | --- | --- | --- |
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
  const result = await runSectorModuleReview({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Wrote ${result.jsonPath}`);
}
