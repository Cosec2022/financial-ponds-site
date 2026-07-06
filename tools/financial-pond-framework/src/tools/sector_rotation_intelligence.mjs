// FP-ROT-01 Sector Rotation Intelligence
// Input: sector_flow_review.json and optional news_review.json
// Output: sector_rotation_intelligence.json and sector_rotation_intelligence.md
// Boundary: explains relative rotation only; not a trading instruction.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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
  real_estate_infra: "地产基建"
};

const clusters = [
  {
    id: "technology_growth",
    name: "科技成长",
    sector_ids: ["semiconductor", "ai_computer", "communication_electronics"]
  },
  {
    id: "financial_beta",
    name: "金融弹性",
    sector_ids: ["brokerage", "bank_insurance"]
  },
  {
    id: "cyclical_value",
    name: "顺周期价值",
    sector_ids: ["real_estate_infra", "resources_materials", "new_energy_ev"]
  },
  {
    id: "defensive_domestic",
    name: "防御内需",
    sector_ids: ["consumer", "healthcare_pharma", "defense_military"]
  }
];

export async function runSectorRotationIntelligence({
  rootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const sectorReview = await readSectorReview({ rootDir, asOf: resolvedAsOf });
  const newsReview = await readNewsReview({ rootDir, asOf: sectorReview.as_of ?? resolvedAsOf });
  const payload = buildSectorRotationIntelligence({ sectorReview, newsReview });

  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "sector_rotation_intelligence.json");
  const mdPath = path.join(outDir, "sector_rotation_intelligence.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return { payload, jsonPath, mdPath };
}

export function buildSectorRotationIntelligence({ sectorReview, newsReview = null }) {
  const rows = [...(sectorReview?.sector_reviews ?? [])]
    .map(normalizeSector)
    .sort((a, b) => b.score - a.score);

  if (!rows.length) {
    return {
      as_of: sectorReview?.as_of ?? null,
      generated_at: new Date().toISOString(),
      module_id: "sector_rotation_intelligence_v0_10_5",
      status: "no_sector_review",
      headline: "暂无行业轮动数据。",
      rotation_state: "unavailable",
      confidence: 0,
      evidence_level: "none",
      leaders: [],
      laggards: [],
      rotation_pairs: [],
      cluster_reviews: [],
      watch_points: ["等待 sector_flow_review.json 生成。"],
      interpretation_boundary: boundary()
    };
  }

  const leaders = rows.slice(0, 3);
  const laggards = [...rows].reverse().slice(0, 3);
  const topScore = leaders[0]?.score ?? 0;
  const bottomScore = laggards[0]?.score ?? 0;
  const spread = Number((topScore - bottomScore).toFixed(4));
  const positiveCount = rows.filter((row) => row.score >= 0.18).length;
  const negativeCount = rows.filter((row) => row.score <= -0.18).length;
  const availableDirectFlowCount = rows.filter((row) => componentAvailable(row, "direct_flow")).length;
  const availableConfirmationCount = rows.filter((row) => componentAvailable(row, "market_confirmation")).length;
  const avgConfidence = average(rows.map((row) => row.confidence)) ?? 0;
  const avgCompleteness = average(rows.map((row) => row.data_completeness)) ?? 0;
  const clusterReviews = buildClusterReviews(rows);
  const strongestCluster = clusterReviews[0];
  const weakestCluster = clusterReviews.at(-1);
  const newsFallback = Boolean(newsReview?.collection?.fallback_used);
  const rotationState = classifyRotation({
    spread,
    positiveCount,
    negativeCount,
    avgCompleteness,
    topScore,
    bottomScore
  });
  const evidenceLevel = classifyEvidence({
    availableDirectFlowCount,
    availableConfirmationCount,
    sectorCount: rows.length,
    avgCompleteness,
    newsFallback
  });

  return {
    as_of: sectorReview.as_of,
    generated_at: new Date().toISOString(),
    module_id: "sector_rotation_intelligence_v0_10_5",
    status: "rotation_available",
    headline: buildHeadline({ rotationState, leaders, laggards, strongestCluster, weakestCluster }),
    rotation_state: rotationState,
    confidence: Number(avgConfidence.toFixed(4)),
    data_completeness: Number(avgCompleteness.toFixed(4)),
    evidence_level: evidenceLevel,
    counts: {
      sectors: rows.length,
      positive_bias_sectors: positiveCount,
      negative_bias_sectors: negativeCount,
      direct_flow_inputs: availableDirectFlowCount,
      price_volume_confirmations: availableConfirmationCount,
      news_fallback: newsFallback
    },
    score_spread: spread,
    leaders: leaders.map((row) => sectorBrief(row)),
    laggards: laggards.map((row) => sectorBrief(row)),
    rotation_pairs: buildRotationPairs({ leaders, laggards }),
    cluster_reviews: clusterReviews,
    watch_points: buildWatchPoints({
      rows,
      leaders,
      laggards,
      clusterReviews,
      newsFallback,
      avgCompleteness
    }),
    interpretation_boundary: boundary()
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

async function readNewsReview({ rootDir, asOf }) {
  const candidates = [
    path.join(rootDir, "model_outputs", asOf, "news_review.json"),
    path.join(rootDir, "..", "..", "financial-pond", "data", "news_review.json")
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

function normalizeSector(row) {
  const sectorId = row.sector_id ?? String(row.pool_id ?? "").replace(/^a_share_/, "");
  return {
    ...row,
    sector_id: sectorId,
    name_cn: sectorNames[sectorId] ?? row.display_name ?? row.name ?? sectorId,
    score: numberOrZero(row.score),
    confidence: numberOrZero(row.confidence),
    data_completeness: numberOrZero(row.data_completeness)
  };
}

function componentAvailable(row, componentName) {
  return Boolean(row?.components?.[componentName]?.available);
}

function average(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function classifyRotation({ spread, positiveCount, negativeCount, avgCompleteness, topScore, bottomScore }) {
  if (avgCompleteness < 0.35) return "low_visibility";
  if (spread >= 0.45 && positiveCount >= 2 && negativeCount >= 1) return "clear_rotation";
  if (topScore > 0.16 && bottomScore < -0.12) return "early_rotation";
  if (positiveCount === 0 && negativeCount >= 2) return "risk_off_diffusion";
  if (spread < 0.22) return "no_clear_rotation";
  return "selective_rotation";
}

function classifyEvidence({
  availableDirectFlowCount,
  availableConfirmationCount,
  sectorCount,
  avgCompleteness,
  newsFallback
}) {
  if (availableDirectFlowCount === sectorCount && availableConfirmationCount === sectorCount && avgCompleteness >= 0.55 && !newsFallback) {
    return "hard_data_plus_live_news";
  }
  if (availableDirectFlowCount >= Math.ceil(sectorCount * 0.7) && availableConfirmationCount >= Math.ceil(sectorCount * 0.7)) {
    return newsFallback ? "hard_data_with_news_fixture" : "hard_data_confirmed";
  }
  if (availableDirectFlowCount > 0 || availableConfirmationCount > 0) return "partial_hard_data";
  return "thin_data";
}

function buildClusterReviews(rows) {
  return clusters
    .map((cluster) => {
      const sectorRows = cluster.sector_ids
        .map((id) => rows.find((row) => row.sector_id === id))
        .filter(Boolean);
      const score = average(sectorRows.map((row) => row.score)) ?? 0;
      const confidence = average(sectorRows.map((row) => row.confidence)) ?? 0;
      const strongest = [...sectorRows].sort((a, b) => b.score - a.score)[0] ?? null;
      const weakest = [...sectorRows].sort((a, b) => a.score - b.score)[0] ?? null;
      return {
        cluster_id: cluster.id,
        name: cluster.name,
        score: Number(score.toFixed(4)),
        confidence: Number(confidence.toFixed(4)),
        label: clusterLabel(score),
        strongest_sector: strongest ? sectorBrief(strongest) : null,
        weakest_sector: weakest ? sectorBrief(weakest) : null,
        sector_ids: cluster.sector_ids
      };
    })
    .sort((a, b) => b.score - a.score);
}

function clusterLabel(score) {
  if (score >= 0.16) return "cluster_inflow_bias";
  if (score <= -0.16) return "cluster_outflow_watch";
  return "cluster_neutral";
}

function buildHeadline({ rotationState, leaders, laggards, strongestCluster, weakestCluster }) {
  const leaderText = leaders.map((item) => item.name_cn).join("、");
  const laggardText = laggards.map((item) => item.name_cn).join("、");
  const map = {
    clear_rotation: `行业轮动较清晰：强势集中在${leaderText}，弱势观察为${laggardText}。`,
    early_rotation: `行业轮动出现早期信号：${leaders[0]?.name_cn}领先，${laggards[0]?.name_cn}承压。`,
    selective_rotation: `市场呈结构性选择：${strongestCluster?.name ?? "强势组"}强于${weakestCluster?.name ?? "弱势组"}。`,
    risk_off_diffusion: `风险偏好偏弱：多个行业处于流出观察，暂未形成健康轮动。`,
    no_clear_rotation: "行业分化不明显：暂时看不到清晰轮动方向。",
    low_visibility: "数据可见度偏低：当前只适合作为流程检查，不适合下强结论。"
  };
  return map[rotationState] ?? "行业轮动状态已生成。";
}

function sectorBrief(row) {
  return {
    sector_id: row.sector_id,
    pool_id: row.pool_id,
    name: row.name_cn,
    score: Number(row.score.toFixed(4)),
    label: row.label,
    confidence: Number(row.confidence.toFixed(4)),
    data_completeness: Number(row.data_completeness.toFixed(4)),
    confirmation_inputs: confirmationInputs(row),
    top_drivers: (row.top_drivers ?? []).slice(0, 3).map((driver) => ({
      component: driver.component,
      contribution: Number(numberOrZero(driver.contribution).toFixed(4)),
      score: Number(numberOrZero(driver.score).toFixed(4)),
      available: Boolean(driver.available)
    }))
  };
}

function confirmationInputs(row) {
  const parts = [];
  if (componentAvailable(row, "direct_flow")) parts.push("ETF流");
  if (componentAvailable(row, "market_confirmation")) parts.push("价量确认");
  if (componentAvailable(row, "market_liquidity")) parts.push("总水位");
  if (componentAvailable(row, "policy_sentiment")) parts.push("新闻压力");
  if (componentAvailable(row, "fundamental_proxy")) parts.push("基本面代理");
  return parts;
}

function buildRotationPairs({ leaders, laggards }) {
  return leaders.map((leader, index) => {
    const laggard = laggards[index] ?? laggards[0];
    const spread = numberOrZero(leader.score) - numberOrZero(laggard?.score);
    return {
      from_sector: laggard ? sectorBrief(laggard) : null,
      to_sector: sectorBrief(leader),
      score_gap: Number(spread.toFixed(4)),
      reading: laggard
        ? `${laggard.name_cn}相对弱，${leader.name_cn}相对强，观察资金是否继续从弱势池切向强势池。`
        : `${leader.name_cn}相对强，等待弱势池确认。`
    };
  });
}

function buildWatchPoints({ rows, leaders, laggards, clusterReviews, newsFallback, avgCompleteness }) {
  const points = [];
  points.push(`优先看${leaders[0]?.name_cn ?? "强势行业"}能否连续保持ETF流和价量确认。`);
  points.push(`弱势端观察${laggards[0]?.name_cn ?? "弱势行业"}是否从流出观察转为中性。`);
  points.push(`${clusterReviews[0]?.name ?? "强势组"}目前相对领先，${clusterReviews.at(-1)?.name ?? "弱势组"}相对落后。`);
  if (newsFallback) points.push("新闻层当前为样例/回退数据，不能把新闻分数当成真实催化。");
  if (avgCompleteness < 0.65) points.push("数据完整度仍不足，下一阶段应补连续历史和更多确认输入。");
  if (rows.some((row) => !componentAvailable(row, "market_liquidity"))) {
    points.push("A股总水位尚未稳定进入所有行业评分，轮动结论仍以相对强弱为主。");
  }
  return points;
}

function boundary() {
  return [
    "行业轮动情报只解释相对强弱和资金压力，不是买卖指令。",
    "新闻压力不能替代ETF份额、价量、成交额和市场宽度等硬数据。",
    "单日轮动只代表当前快照，连续多日确认后才适合升级为趋势判断。",
    "观察池或样例数据必须明确标注，不能当作真实行业覆盖。"
  ];
}

function buildMarkdown(payload) {
  const lines = [
    "# A-share Sector Rotation Intelligence",
    "",
    `- as_of: ${payload.as_of}`,
    `- status: ${payload.status}`,
    `- state: ${payload.rotation_state}`,
    `- evidence_level: ${payload.evidence_level}`,
    "",
    "## Headline",
    "",
    payload.headline,
    "",
    "## Leaders",
    "",
    "| Rank | Sector | Score | Evidence |",
    "|---:|---|---:|---|"
  ];

  payload.leaders.forEach((item, index) => {
    lines.push(`| ${index + 1} | ${item.name} | ${item.score.toFixed(3)} | ${item.confirmation_inputs.join(" + ") || "none"} |`);
  });

  lines.push("", "## Laggards", "", "| Rank | Sector | Score | Evidence |", "|---:|---|---:|---|");
  payload.laggards.forEach((item, index) => {
    lines.push(`| ${index + 1} | ${item.name} | ${item.score.toFixed(3)} | ${item.confirmation_inputs.join(" + ") || "none"} |`);
  });

  lines.push("", "## Watch Points", "");
  payload.watch_points.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { asOf: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const { payload, jsonPath, mdPath } = await runSectorRotationIntelligence({
    rootDir,
    asOf: args.asOf
  });
  console.log(`Sector rotation intelligence written: ${jsonPath}`);
  console.log(`Sector rotation markdown written: ${mdPath}`);
  console.log(`Rotation state: ${payload.rotation_state}`);
  console.log(`Headline: ${payload.headline}`);
}
