import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const requiredFiles = [
  ["dashboard.json", (json) => Boolean(json.entities)],
  ["general_pool_analysis.json", (json) => json.module_id === "general_pool_analysis_v0_10_11"],
  ["sector_flow_review.json", (json) => Boolean(json.data_availability?.mode) && Array.isArray(json.sector_reviews)],
  ["sector_rotation_intelligence.json", (json) => json.module_id === "sector_rotation_intelligence_v0_10_5"],
  ["sector_rotation_history.json", (json) => json.module_id === "sector_rotation_history_v0_10_19"],
  ["sector_module_review.json", (json) => json.module_id === "sector_module_review_v0_1"],
  ["etf_decision_readiness.json", (json) => json.status === "readiness_available" && Boolean(json.gates) && Boolean(json.gates.share_change_diagnostics)],
  ["data_reality_audit.json", (json) => json.status === "audit_available" && Array.isArray(json.layers)],
  ["daily_sector_analysis.json", (json) => json.status === "daily_sector_analysis_available" && Boolean(json.tiers) && Array.isArray(json.decision_gap?.checks) && Boolean(json.decision_ticket?.groups)],
  ["module_maturity_audit.json", (json) => json.status === "module_maturity_available" && Array.isArray(json.modules) && Boolean(json.recommended_mainline)],
  ["etf_flow_leaderboard.json", (json) => json.status === "leaderboard_available" && json.module_id === "etf_flow_leaderboard_v0_10_43" && Array.isArray(json.rows)],
  ["news_review.json", (json) => Array.isArray(json.interpretation_boundary)],
  ["pond_map.json", (json) => json.schema_version === "pond_map_v2_adaptive_graph"]
];

const failures = [];

for (const [fileName, validate] of requiredFiles) {
  const filePath = resolve(root, "financial-pond", "data", fileName);
  try {
    const json = JSON.parse(await readFile(filePath, "utf8"));
    if (!validate(json)) failures.push(`${fileName}: contract check failed`);
  } catch (error) {
    failures.push(`${fileName}: ${error.message}`);
  }
}

if (failures.length) {
  console.error("Published Financial Ponds data is incomplete:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Published Financial Ponds data complete: ${requiredFiles.length} files`);
