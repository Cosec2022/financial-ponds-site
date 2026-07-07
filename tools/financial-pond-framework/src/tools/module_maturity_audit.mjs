import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runModuleMaturityAudit({
  rootDir,
  asOf = new Date().toISOString().slice(0, 10)
}) {
  const docsDir = path.join(rootDir, "docs");
  const [modulePlan, projectPlan] = await Promise.all([
    readFile(path.join(docsDir, "MODULE_PLAN.md"), "utf8"),
    readFile(path.join(docsDir, "PROJECT_PLAN.md"), "utf8")
  ]);
  const payload = buildModuleMaturityAudit({
    asOf,
    modulePlan,
    projectPlan
  });

  const outputDir = path.join(rootDir, "model_outputs", asOf);
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "module_maturity_audit.json");
  const mdPath = path.join(outputDir, "module_maturity_audit.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));
  return { payload, jsonPath, mdPath };
}

export function buildModuleMaturityAudit({ asOf, modulePlan, projectPlan }) {
  const priorityRows = parseCurrentPriority(modulePlan);
  const priorityByModule = new Map(priorityRows.map((row) => [row.module_id, row]));
  const modules = parseModuleRows(modulePlan).map((row) => {
    const priority = priorityByModule.get(row.module_id) ?? null;
    return {
      ...row,
      priority_rank: priority?.rank ?? null,
      priority_reading: priority?.reading ?? null,
      focus_lane: focusLane(row.module_id),
      maturity_label: maturityLabel(row.progress),
      urgency: urgencyLabel({ progress: row.progress, priorityRank: priority?.rank ?? null }),
      blockers: moduleBlockers(row),
      next_action: row.next
    };
  });
  const phaseRows = parsePhaseRows(projectPlan);
  const totalProgress = average(modules.map((row) => row.progress));
  const decisionPathIds = ["FP-DATA-01", "FP-FLOW-01", "FP-HIST-01", "FP-ETF-01", "FP-DAILY-01"];
  const decisionPathModules = modules.filter((row) => decisionPathIds.includes(row.module_id));
  const decisionPathProgress = average(decisionPathModules.map((row) => row.progress));
  const lowMaturity = modules
    .filter((row) => row.progress < 40)
    .sort(sortPriorityThenProgress);
  const topPriority = modules
    .filter((row) => row.priority_rank !== null || row.urgency !== "later")
    .sort(sortPriorityThenProgress)
    .slice(0, 8);

  return {
    module_id: "module_maturity_audit_v0_10_39",
    status: "module_maturity_available",
    as_of: asOf,
    generated_at: new Date().toISOString(),
    overall: {
      module_count: modules.length,
      average_progress: round(totalProgress),
      decision_path_progress: round(decisionPathProgress),
      low_maturity_count: lowMaturity.length,
      current_stage: extractProjectLine(projectPlan, "Current stage") ?? "unknown",
      decision_grade_model: extractProjectLine(projectPlan, "Decision-grade model") ?? "unknown"
    },
    recommended_mainline: buildRecommendedMainline({ modules, decisionPathModules }),
    priority_modules: topPriority,
    low_maturity_modules: lowMaturity,
    phase_plan: phaseRows,
    modules,
    boundary: [
      "This audit measures project/module readiness, not market direction.",
      "Low maturity does not mean a sector is bad; it means the system cannot rely on that module yet.",
      "ETF execution language remains controlled by ETF decision readiness, not by this audit."
    ]
  };
}

function parseModuleRows(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^\|\s*FP-[A-Z]+-\d+/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .map(([moduleId, module, role, status, progress, next]) => ({
      module_id: moduleId,
      module,
      role,
      status,
      progress: Number(String(progress).replace("%", "")),
      next
    }))
    .filter((row) => Number.isFinite(row.progress));
}

function parseCurrentPriority(markdown) {
  const rows = [];
  let inBlock = false;
  for (const line of markdown.split("\n")) {
    if (line.trim() === "## Current Priority") {
      inBlock = true;
      continue;
    }
    if (inBlock && line.startsWith("## ")) break;
    const match = line.match(/^(\d+)\.\s+(FP-[A-Z]+-\d+):\s+(.+)$/);
    if (inBlock && match) {
      rows.push({
        rank: Number(match[1]),
        module_id: match[2],
        reading: match[3]
      });
    }
  }
  return rows;
}

function parsePhaseRows(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^\|\s*P\d+\s*\|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .map(([phase, goal, status, progress]) => ({
      phase,
      goal,
      status,
      progress: Number(String(progress).replace("%", ""))
    }))
    .filter((row) => Number.isFinite(row.progress));
}

function extractProjectLine(markdown, label) {
  const pattern = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, "m");
  return markdown.match(pattern)?.[1] ?? null;
}

function buildRecommendedMainline({ modules, decisionPathModules }) {
  const data = modules.find((row) => row.module_id === "FP-DATA-01");
  const etf = modules.find((row) => row.module_id === "FP-ETF-01");
  const valuationBlocked = etf?.next?.includes("manual valuation") || etf?.next?.includes("manual");
  return {
    id: "a_share_real_provider_to_estimated_flow",
    label: "A股真实 Provider -> ETF 份额变化流",
    priority: 1,
    rationale: "ETF readiness cannot unlock until provider history produces observed share-change flow. This is the narrowest path from prototype to usable decision support.",
    current_progress: round(average(decisionPathModules.map((row) => row.progress))),
    immediate_modules: decisionPathModules.map((row) => row.module_id),
    next_actions: [
      data?.next ?? "Preserve real provider history and rerun AKShare on the next trading day.",
      "Run provider:akshare:history before the full model to verify provider CSV continuity.",
      valuationBlocked
        ? "Keep valuation/fundamental outputs as blockers until non-manual sources are connected."
        : "Review ETF readiness gates after estimated_flow appears."
    ]
  };
}

function focusLane(moduleId) {
  if (["FP-DATA-01", "FP-FLOW-01", "FP-HIST-01", "FP-ETF-01", "FP-DAILY-01"].includes(moduleId)) return "decision_path";
  if (["FP-CORE-01", "FP-TEST-01", "FP-MAINT-01", "FP-UI-01"].includes(moduleId)) return "infrastructure";
  if (["FP-NEWS-01", "FP-PV-01", "FP-GRAPH-01", "FP-RPT-01", "FP-GEN-01"].includes(moduleId)) return "quality_expansion";
  return "future_expansion";
}

function maturityLabel(progress) {
  if (progress >= 75) return "strong";
  if (progress >= 55) return "usable";
  if (progress >= 35) return "prototype";
  if (progress >= 15) return "early";
  return "planned";
}

function urgencyLabel({ progress, priorityRank }) {
  if (priorityRank !== null && priorityRank <= 2) return "critical_path";
  if (priorityRank !== null && priorityRank <= 5) return "near_term";
  if (progress < 30) return "weak_module";
  return "later";
}

function moduleBlockers(row) {
  const blockers = [];
  const text = `${row.status} ${row.next}`.toLowerCase();
  if (text.includes("manual")) blockers.push("manual_or_seed_input");
  if (text.includes("real") || text.includes("provider")) blockers.push("real_provider_gap");
  if (text.includes("history") || text.includes("multi-day") || text.includes("trend")) blockers.push("history_depth_gap");
  if (text.includes("news")) blockers.push("news_quality_gap");
  if (text.includes("backend")) blockers.push("backend_state_gap");
  if (text.includes("s&p") || text.includes("sp500")) blockers.push("cross_market_provider_gap");
  if (row.progress < 30) blockers.push("low_maturity");
  return [...new Set(blockers)];
}

function sortPriorityThenProgress(a, b) {
  const rankA = a.priority_rank ?? 99;
  const rankB = b.priority_rank ?? 99;
  return rankA - rankB || a.progress - b.progress || a.module_id.localeCompare(b.module_id);
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMarkdown(payload) {
  const lines = [
    "# Module Maturity Audit",
    "",
    `- as_of: ${payload.as_of}`,
    `- average_progress: ${payload.overall.average_progress}%`,
    `- decision_path_progress: ${payload.overall.decision_path_progress}%`,
    `- low_maturity_count: ${payload.overall.low_maturity_count}`,
    `- mainline: ${payload.recommended_mainline.label}`,
    "",
    "## Priority Modules",
    "",
    "| Module | Progress | Urgency | Next |",
    "|---|---:|---|---|"
  ];
  for (const row of payload.priority_modules) {
    lines.push(`| ${row.module_id} ${row.module} | ${row.progress}% | ${row.urgency} | ${row.next_action} |`);
  }
  lines.push("", "## Low Maturity Modules", "", "| Module | Progress | Blockers |", "|---|---:|---|");
  for (const row of payload.low_maturity_modules) {
    lines.push(`| ${row.module_id} ${row.module} | ${row.progress}% | ${row.blockers.join(", ") || "none"} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { asOf: new Date().toISOString().slice(0, 10) };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runModuleMaturityAudit({ rootDir, asOf: args.asOf });
  console.log(`Module maturity audit written: ${result.jsonPath}`);
  console.log(`Review Markdown written: ${result.mdPath}`);
  console.log(`Average progress: ${result.payload.overall.average_progress}%`);
  console.log(`Decision path progress: ${result.payload.overall.decision_path_progress}%`);
}
