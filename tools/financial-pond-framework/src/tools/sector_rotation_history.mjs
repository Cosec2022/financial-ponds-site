// FP-HIST-01 Sector Rotation History
// Input: sector_rotation_intelligence.json and previous sector_rotation_history.json
// Output: sector_rotation_history.json and sector_rotation_history.md
// Boundary: stores rotation history and tentative changes; trend confirmation needs enough samples.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const maxHistoryDays = 60;
const minTrendDays = 3;

export async function runSectorRotationHistory({
  rootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const rotation = await readRotationIntelligence({ rootDir, asOf: resolvedAsOf });
  const previousHistory = await readPreviousHistory({ rootDir });
  const payload = buildSectorRotationHistory({ rotation, previousHistory });

  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "sector_rotation_history.json");
  const mdPath = path.join(outDir, "sector_rotation_history.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return { payload, jsonPath, mdPath };
}

export function buildSectorRotationHistory({ rotation, previousHistory = null }) {
  const daily = compactDailyRotation(rotation);
  const history = mergeHistory(previousHistory?.history ?? [], daily);
  const sectorSeries = buildSectorSeries(history);
  const latest = history.at(-1) ?? null;
  const previous = history.at(-2) ?? null;
  const changes = latest && previous ? compareDays({ latest, previous }) : [];
  const trendState = history.length >= minTrendDays ? "history_ready" : "insufficient_history";

  return {
    as_of: daily.as_of,
    generated_at: new Date().toISOString(),
    module_id: "sector_rotation_history_v0_10_7",
    status: "history_available",
    sample_days: history.length,
    min_required_days_for_trend: minTrendDays,
    trend_state: trendState,
    headline: buildHeadline({ latest, previous, changes, trendState }),
    latest,
    previous,
    changes,
    sector_series: sectorSeries,
    history,
    watch_points: buildWatchPoints({ history, changes, trendState }),
    interpretation_boundary: [
      "History stores daily rotation snapshots; it is not a trading instruction.",
      "Trend labels need enough consecutive samples.",
      "If the CI workflow does not persist generated data, history cannot accumulate.",
      "Fallback news remains degraded context even when stored in history."
    ]
  };
}

async function readRotationIntelligence({ rootDir, asOf }) {
  const candidates = [
    path.join(rootDir, "model_outputs", asOf, "sector_rotation_intelligence.json"),
    path.join(rootDir, "..", "..", "financial-pond", "data", "sector_rotation_intelligence.json")
  ];
  for (const candidate of candidates) {
    const payload = await readJsonIfExists(candidate);
    if (payload?.status === "rotation_available" || payload?.leaders) return payload;
  }
  throw new Error(`No sector_rotation_intelligence.json found for ${asOf}`);
}

async function readPreviousHistory({ rootDir }) {
  const candidates = [
    path.join(rootDir, "..", "..", "financial-pond", "data", "sector_rotation_history.json"),
    path.join(rootDir, "data", "sector_rotation_history.json")
  ];
  for (const candidate of candidates) {
    const payload = await readJsonIfExists(candidate);
    if (payload?.history) return payload;
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

function compactDailyRotation(rotation) {
  return {
    as_of: rotation.as_of,
    rotation_state: rotation.rotation_state,
    evidence_level: rotation.evidence_level,
    confidence: numberOrNull(rotation.confidence),
    data_completeness: numberOrNull(rotation.data_completeness),
    score_spread: numberOrNull(rotation.score_spread),
    leaders: compactSectors(rotation.leaders ?? []),
    laggards: compactSectors(rotation.laggards ?? []),
    cluster_reviews: (rotation.cluster_reviews ?? []).map((cluster) => ({
      cluster_id: cluster.cluster_id,
      name: cluster.name,
      score: numberOrNull(cluster.score),
      label: cluster.label,
      strongest_sector_id: cluster.strongest_sector?.sector_id ?? null,
      weakest_sector_id: cluster.weakest_sector?.sector_id ?? null
    })),
    counts: rotation.counts ?? {}
  };
}

function compactSectors(sectors) {
  return sectors.map((sector, index) => ({
    rank: index + 1,
    sector_id: sector.sector_id,
    name: sector.name,
    score: numberOrNull(sector.score),
    label: sector.label,
    confirmation_inputs: sector.confirmation_inputs ?? []
  }));
}

function mergeHistory(existing, daily) {
  const byDate = new Map();
  for (const item of existing) {
    if (!item?.as_of) continue;
    byDate.set(item.as_of, item);
  }
  if (daily?.as_of) byDate.set(daily.as_of, daily);
  return [...byDate.values()]
    .sort((a, b) => a.as_of.localeCompare(b.as_of))
    .slice(-maxHistoryDays);
}

function buildSectorSeries(history) {
  const series = {};
  for (const day of history) {
    const ranked = [
      ...(day.leaders ?? []),
      ...(day.laggards ?? [])
    ];
    for (const sector of ranked) {
      if (!sector?.sector_id) continue;
      series[sector.sector_id] = series[sector.sector_id] ?? [];
      series[sector.sector_id].push({
        as_of: day.as_of,
        rank: sector.rank,
        side: (day.leaders ?? []).some((item) => item.sector_id === sector.sector_id) ? "leader" : "laggard",
        score: sector.score,
        label: sector.label
      });
    }
  }
  return series;
}

function compareDays({ latest, previous }) {
  const previousBySector = new Map([
    ...(previous.leaders ?? []),
    ...(previous.laggards ?? [])
  ].map((sector) => [sector.sector_id, sector]));

  return [
    ...(latest.leaders ?? []),
    ...(latest.laggards ?? [])
  ].map((sector) => {
    const prev = previousBySector.get(sector.sector_id);
    const score_change = prev && typeof sector.score === "number" && typeof prev.score === "number"
      ? Number((sector.score - prev.score).toFixed(4))
      : null;
    return {
      sector_id: sector.sector_id,
      name: sector.name,
      latest_side: (latest.leaders ?? []).some((item) => item.sector_id === sector.sector_id) ? "leader" : "laggard",
      previous_side: prev
        ? (previous.leaders ?? []).some((item) => item.sector_id === sector.sector_id) ? "leader" : "laggard"
        : "not_tracked",
      latest_score: sector.score,
      previous_score: prev?.score ?? null,
      score_change,
      change_label: changeLabel(score_change)
    };
  });
}

function changeLabel(scoreChange) {
  if (typeof scoreChange !== "number") return "new_or_untracked";
  if (scoreChange >= 0.08) return "strengthening";
  if (scoreChange <= -0.08) return "weakening";
  return "stable";
}

function buildHeadline({ latest, previous, changes, trendState }) {
  if (!latest) return "暂无轮动历史。";
  if (!previous) return `已记录 ${latest.as_of} 的第一天行业轮动快照，暂不能判断趋势。`;
  const strengthening = changes.filter((item) => item.change_label === "strengthening").map((item) => item.name).slice(0, 3);
  const weakening = changes.filter((item) => item.change_label === "weakening").map((item) => item.name).slice(0, 3);
  if (trendState === "insufficient_history") {
    return `已有 ${previous.as_of} 到 ${latest.as_of} 的轮动对比，但样本仍不足，趋势暂不确认。`;
  }
  if (strengthening.length || weakening.length) {
    return `轮动历史可读：增强 ${strengthening.join("、") || "暂无"}；转弱 ${weakening.join("、") || "暂无"}。`;
  }
  return "轮动历史可读：主要跟踪行业暂时稳定。";
}

function buildWatchPoints({ history, changes, trendState }) {
  const points = [];
  points.push(`当前已保存 ${history.length} 个交易日快照。`);
  if (trendState === "insufficient_history") {
    points.push(`至少需要 ${minTrendDays} 个交易日，才升级为趋势确认。`);
  }
  const strengthening = changes.filter((item) => item.change_label === "strengthening");
  const weakening = changes.filter((item) => item.change_label === "weakening");
  if (strengthening[0]) points.push(`观察 ${strengthening[0].name} 是否继续增强。`);
  if (weakening[0]) points.push(`观察 ${weakening[0].name} 是否继续转弱。`);
  points.push("历史只记录模型输出，不直接生成交易指令。");
  return points;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildMarkdown(payload) {
  const lines = [
    "# A-share Sector Rotation History",
    "",
    `- as_of: ${payload.as_of}`,
    `- sample_days: ${payload.sample_days}`,
    `- trend_state: ${payload.trend_state}`,
    "",
    "## Headline",
    "",
    payload.headline,
    "",
    "## Watch Points",
    ""
  ];
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
  const { payload, jsonPath, mdPath } = await runSectorRotationHistory({
    rootDir,
    asOf: args.asOf
  });
  console.log(`Sector rotation history written: ${jsonPath}`);
  console.log(`Sector rotation history markdown written: ${mdPath}`);
  console.log(`Sample days: ${payload.sample_days}`);
  console.log(`Headline: ${payload.headline}`);
}
