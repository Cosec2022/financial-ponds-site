// FP-GEN-01 General Pool Analysis
// Input: graph_scores.json, config/pools, config/edges, pool_internal_models.json, general_pool_input_contract.json
// Output: general_pool_analysis.json and general_pool_analysis.md
// Boundary: compares explainable pool state across markets; it is not a trading instruction.

import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, readJsonFile } from "../core/config_loader.mjs";
import { buildRegistry } from "../core/registry.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runGeneralPoolAnalysis({
  rootDir,
  asOf,
  poolIds = null
}) {
  const resolvedAsOf = asOf ?? await latestSnapshotDate(rootDir) ?? new Date().toISOString().slice(0, 10);
  const [config, poolModels, inputContract, snapshot] = await Promise.all([
    loadConfig(rootDir),
    readJsonFile(path.join(rootDir, "config", "model", "pool_internal_models.json")),
    readJsonFile(path.join(rootDir, "config", "model", "general_pool_input_contract.json")),
    readSnapshot({ rootDir, asOf: resolvedAsOf })
  ]);
  const registry = buildRegistry(config);
  const targetPoolIds = poolIds?.length ? poolIds : defaultTargetPools(registry, inputContract);
  const payload = buildGeneralPoolAnalysis({
    asOf: resolvedAsOf,
    registry,
    poolModels,
    inputContract,
    snapshot,
    targetPoolIds
  });

  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "general_pool_analysis.json");
  const mdPath = path.join(outDir, "general_pool_analysis.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return { payload, jsonPath, mdPath };
}

export function buildGeneralPoolAnalysis({
  asOf,
  registry,
  poolModels,
  inputContract,
  snapshot,
  targetPoolIds
}) {
  const normalizedContract = normalizeInputContract(inputContract);
  const resultById = new Map((snapshot.results ?? []).map((item) => [item.id, item]));
  const reviews = targetPoolIds
    .map((poolId) => buildPoolReview({
      pool: registry.pools.get(poolId),
      result: resultById.get(poolId),
      poolModels,
      inputContract: normalizedContract
    }))
    .filter(Boolean);

  return {
    as_of: asOf,
    generated_at: new Date().toISOString(),
    module_id: "general_pool_analysis_v0_10_11",
    status: reviews.length ? "analysis_available" : "no_target_pools",
    input_contract_id: normalizedContract.id,
    model_scope: {
      target: "S&P 500 and A-share industry pools",
      required_components: ["capital_flow", "network_influence", "price_volume", "news_pressure"],
      supplemental_components: ["fundamental_value"]
    },
    counts: {
      pools: reviews.length,
      sp500: reviews.some((item) => item.pool_id === "sp500") ? 1 : 0,
      a_share_industries: reviews.filter((item) => item.parent_pool === "a_share").length
    },
    headline: buildHeadline(reviews),
    pool_reviews: reviews,
    group_summary: buildGroupSummary(reviews),
    watch_points: buildWatchPoints(reviews),
    interpretation_boundary: [
      "General pool analysis is an explainable model layer, not a trading instruction.",
      "A pool can join this output through config without adding market-specific core code.",
      "S&P 500 and A-share industry pools share the same component contract, but each pool declares different concrete inputs in config.",
      "Missing or fallback observations reduce component availability and must not be treated as confirmed trend."
    ]
  };
}

async function readSnapshot({ rootDir, asOf }) {
  const filePath = path.join(rootDir, "snapshots", asOf, "graph_scores.json");
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    throw new Error(`No graph_scores.json found for ${asOf}. Run npm run cycle -- ${asOf} first.`);
  }
}

async function latestSnapshotDate(rootDir) {
  try {
    const entries = await readdir(path.join(rootDir, "snapshots"), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .at(-1) ?? null;
  } catch {
    return null;
  }
}

function normalizeInputContract(inputContract) {
  const components = {};
  for (const [componentId, definition] of Object.entries(inputContract.components ?? {})) {
    components[componentId] = {
      ...definition,
      channels: new Set(definition.channels ?? [])
    };
  }
  return {
    ...inputContract,
    components
  };
}

function defaultTargetPools(registry, inputContract) {
  const ids = [];
  for (const rule of inputContract.target_pool_rules ?? []) {
    if (rule.type === "pool_id" && registry.pools.has(rule.pool_id)) {
      ids.push(rule.pool_id);
    }
    if (rule.type === "parent_pool") {
      ids.push(
        ...[...registry.pools.values()]
          .filter((pool) => pool.parent_pool === rule.parent_pool)
          .map((pool) => pool.id)
          .sort()
      );
    }
  }
  return [...new Set(ids)];
}

function resolveInputProfile({ pool, inputContract }) {
  for (const profile of inputContract.pool_profiles ?? []) {
    const match = profile.match ?? {};
    if (match.pool_ids?.includes(pool.id)) return profile;
    if (match.parent_pool && match.parent_pool === pool.parent_pool) return profile;
  }
  return null;
}

function buildPoolReview({ pool, result, poolModels, inputContract }) {
  if (!pool || !result) return null;
  const model = poolModels.pools?.[pool.id] ?? { components: poolModels.default_components ?? {} };
  const inputProfile = resolveInputProfile({ pool, inputContract });
  const components = buildComponents({
    contributors: result.contributors ?? [],
    weights: model.components ?? poolModels.default_components ?? {},
    componentDefinitions: inputContract.components
  });
  const availability = dataCompleteness({
    components,
    weights: model.components ?? poolModels.default_components ?? {},
    componentDefinitions: inputContract.components
  });
  const expectedInputs = buildExpectedInputs({
    pool,
    components,
    inputProfile,
    componentDefinitions: inputContract.components
  });

  return {
    pool_id: pool.id,
    name: pool.name,
    region: pool.region ?? null,
    currency: pool.currency ?? null,
    parent_pool: pool.parent_pool ?? null,
    pool_type: pool.pool_type ?? null,
    score: numberOrNull(result.score),
    label: labelForScore(result.score),
    confidence: numberOrNull(result.confidence),
    data_completeness: availability,
    input_profile: inputProfile?.id ?? "unprofiled",
    expected_inputs: expectedInputs,
    model_components: model.components ?? {},
    components,
    top_drivers: topDrivers(result.contributors ?? []),
    summary: summarizePool({ pool, result, components })
  };
}

function buildExpectedInputs({
  pool,
  components,
  inputProfile,
  componentDefinitions
}) {
  const expectedByComponent = expectedInputMap({ pool, inputProfile });
  const result = {};
  for (const componentId of Object.keys(componentDefinitions)) {
    const expectedNodes = expectedByComponent[componentId] ?? [];
    const observedNodes = new Set((components[componentId]?.drivers ?? []).map((driver) => driver.from));
    const missingNodes = expectedNodes.filter((nodeId) => !observedNodes.has(nodeId));
    result[componentId] = {
      expected_nodes: expectedNodes,
      observed_nodes: expectedNodes.filter((nodeId) => observedNodes.has(nodeId)),
      missing_nodes: missingNodes,
      coverage: expectedNodes.length === 0
        ? null
        : Number(((expectedNodes.length - missingNodes.length) / expectedNodes.length).toFixed(4))
    };
  }
  return result;
}

function expectedInputMap({ pool, inputProfile }) {
  if (!inputProfile) return {};
  if (inputProfile.expected_inputs) return inputProfile.expected_inputs;
  const poolShort = inputProfile.pool_short_prefix_to_strip && pool.id.startsWith(inputProfile.pool_short_prefix_to_strip)
    ? pool.id.slice(inputProfile.pool_short_prefix_to_strip.length)
    : pool.id;
  const expected = {};
  for (const [componentId, templates] of Object.entries(inputProfile.expected_input_templates ?? {})) {
    expected[componentId] = templates.map((template) => template.replaceAll("{pool_short}", poolShort));
  }
  return expected;
}

function buildComponents({ contributors, weights, componentDefinitions }) {
  const grouped = {};
  for (const [componentId, definition] of Object.entries(componentDefinitions)) {
    const matching = contributors.filter((item) => definition.channels.has(item.channel));
    grouped[componentId] = componentFromContributors({
      componentId,
      name: definition.name,
      contributors: matching,
      configured_weight: configuredWeight(definition.model_components, weights)
    });
  }

  const knownChannels = new Set(Object.values(componentDefinitions).flatMap((definition) => [...definition.channels]));
  const other = contributors.filter((item) => !knownChannels.has(item.channel));
  if (other.length) {
    grouped.other = componentFromContributors({
      componentId: "other",
      name: "其他图谱影响",
      contributors: other,
      configured_weight: 0
    });
  }
  return grouped;
}

function componentFromContributors({
  componentId,
  name,
  contributors,
  configured_weight
}) {
  const available = contributors.length > 0;
  const weightSum = contributors.reduce((sum, item) => sum + Math.abs(item.weight ?? 0), 0);
  const contributionSum = contributors.reduce((sum, item) => sum + (item.contribution ?? 0), 0);
  const score = available && weightSum > 0 ? contributionSum / weightSum : null;
  return {
    component_id: componentId,
    name,
    score: numberOrNull(score),
    contribution: Number(contributionSum.toFixed(4)),
    configured_weight,
    available,
    drivers: contributors
      .map((item) => ({
        from: item.from,
        channel: item.channel,
        contribution: Number((item.contribution ?? 0).toFixed(4)),
        source_score: numberOrNull(item.source_score),
        description: item.description ?? ""
      }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  };
}

function configuredWeight(modelComponents, weights) {
  return Number(modelComponents.reduce((sum, key) => sum + Math.abs(weights[key] ?? 0), 0).toFixed(4));
}

function dataCompleteness({ components, weights, componentDefinitions }) {
  const total = Object.entries(componentDefinitions)
    .reduce((sum, [, definition]) => sum + configuredWeight(definition.model_components, weights), 0);
  if (total === 0) return 0;
  const available = Object.entries(componentDefinitions)
    .filter(([componentId]) => components[componentId]?.available)
    .reduce((sum, [, definition]) => sum + configuredWeight(definition.model_components, weights), 0);
  return Number((available / total).toFixed(4));
}

function labelForScore(score) {
  if (typeof score !== "number") return "unavailable";
  if (score >= 0.3) return "constructive";
  if (score >= 0.12) return "mild_positive";
  if (score <= -0.3) return "pressure";
  if (score <= -0.12) return "mild_pressure";
  return "neutral";
}

function topDrivers(contributors) {
  return [...contributors]
    .sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0))
    .slice(0, 5)
    .map((item) => ({
      from: item.from,
      channel: item.channel,
      contribution: Number((item.contribution ?? 0).toFixed(4)),
      description: item.description ?? ""
    }));
}

function summarizePool({ pool, result, components }) {
  const positives = Object.values(components)
    .filter((component) => typeof component.score === "number" && component.score > 0.12)
    .map((component) => component.name);
  const negatives = Object.values(components)
    .filter((component) => typeof component.score === "number" && component.score < -0.12)
    .map((component) => component.name);
  const scoreText = typeof result.score === "number" ? result.score.toFixed(2) : "--";
  return `${pool.name} 当前综合分 ${scoreText}，正向项：${positives.join("、") || "暂无"}；压力项：${negatives.join("、") || "暂无"}。`;
}

function buildHeadline(reviews) {
  if (!reviews.length) return "暂无通用池分析。";
  const sp500 = reviews.find((item) => item.pool_id === "sp500");
  const aShareIndustries = reviews.filter((item) => item.parent_pool === "a_share");
  const strongestA = [...aShareIndustries].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))[0];
  const spText = sp500 ? `标普500 ${formatScore(sp500.score)}（${sp500.label}）` : "标普500暂无";
  const aText = strongestA ? `A股行业最强 ${strongestA.name} ${formatScore(strongestA.score)}` : "A股行业暂无";
  return `${spText}；${aText}。`;
}

function buildGroupSummary(reviews) {
  const aShareIndustries = reviews.filter((item) => item.parent_pool === "a_share");
  return {
    sp500: brief(reviews.find((item) => item.pool_id === "sp500")),
    a_share_market: brief(reviews.find((item) => item.pool_id === "a_share")),
    a_share_industries: {
      count: aShareIndustries.length,
      top_positive: aShareIndustries
        .slice()
        .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
        .slice(0, 3)
        .map(brief),
      top_pressure: aShareIndustries
        .slice()
        .sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity))
        .slice(0, 3)
        .map(brief)
    }
  };
}

function brief(review) {
  if (!review) return null;
  return {
    pool_id: review.pool_id,
    name: review.name,
    score: review.score,
    label: review.label,
    data_completeness: review.data_completeness
  };
}

function buildWatchPoints(reviews) {
  const points = [];
  const sp500 = reviews.find((item) => item.pool_id === "sp500");
  if (sp500) {
    points.push(`标普500：观察 ${leadingComponentName(sp500)} 是否继续主导综合分。`);
  }
  const weakData = reviews.filter((item) => item.data_completeness < 0.5).slice(0, 3);
  if (weakData.length) {
    points.push(`数据完整度偏低：${weakData.map((item) => item.name).join("、")}。`);
  }
  const strongestA = reviews
    .filter((item) => item.parent_pool === "a_share")
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))[0];
  if (strongestA) {
    points.push(`A股行业：继续跟踪 ${strongestA.name} 的资金流和量价确认是否一致。`);
  }
  points.push("通用池分析只解释状态，不输出买卖指令。");
  return points;
}

function leadingComponentName(review) {
  const components = Object.values(review.components ?? {})
    .filter((item) => item.available)
    .sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0));
  return components[0]?.name ?? "主要驱动项";
}

function buildMarkdown(payload) {
  const lines = [
    "# General Pool Analysis",
    "",
    `- as_of: ${payload.as_of}`,
    `- module_id: ${payload.module_id}`,
    `- pools: ${payload.counts.pools}`,
    "",
    "## Headline",
    "",
    payload.headline,
    "",
    "## Pool Reviews",
    "",
    "| Pool | Score | Label | Completeness | Top driver |",
    "|---|---:|---|---:|---|"
  ];

  for (const review of payload.pool_reviews) {
    const top = review.top_drivers[0];
    lines.push(
      `| ${review.pool_id} | ${formatScore(review.score)} | ${review.label} | ${formatScore(review.data_completeness)} | ${top?.from ?? "none"}:${top?.channel ?? ""} |`
    );
  }

  lines.push("", "## Watch Points", "");
  payload.watch_points.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  return lines.join("\n");
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

function formatScore(value) {
  return typeof value === "number" ? value.toFixed(2) : "--";
}

function parseArgs(argv) {
  const args = { asOf: null, poolIds: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
    if (argv[index] === "--pools") {
      args.poolIds = String(argv[index + 1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const { payload, jsonPath, mdPath } = await runGeneralPoolAnalysis({
    rootDir,
    asOf: args.asOf,
    poolIds: args.poolIds
  });
  console.log(`General pool analysis written: ${jsonPath}`);
  console.log(`General pool markdown written: ${mdPath}`);
  console.log(`Pools: ${payload.counts.pools}`);
  console.log(payload.headline);
}
