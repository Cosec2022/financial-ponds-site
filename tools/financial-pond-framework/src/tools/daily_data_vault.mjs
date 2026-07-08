// FP-OBS-01 Daily Data Vault
// Captures the data files visible to the observation framework for one AS_OF.

import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SignalReality } from "../core/observation_schema.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_ID = "daily_data_vault_v0_10_48";

const publishedJsonFiles = [
  "dashboard.json",
  "general_pool_analysis.json",
  "sector_flow_review.json",
  "sector_rotation_intelligence.json",
  "sector_rotation_history.json",
  "sector_module_review.json",
  "etf_decision_readiness.json",
  "data_reality_audit.json",
  "daily_sector_analysis.json",
  "module_maturity_audit.json",
  "etf_flow_leaderboard.json",
  "sector_signal_attribution.json",
  "sector_watchlist_state.json",
  "decision_gate_ledger.json",
  "index_explainability.json",
  "observation_snapshot.json",
  "manual_review_log.json",
  "outcome_labels.json",
  "daily_data_vault.json",
  "news_review.json",
  "pond_map.json"
];

const modelJsonFiles = [
  "sector_flow_review.json",
  "sector_rotation_intelligence.json",
  "sector_rotation_history.json",
  "sector_module_review.json",
  "etf_decision_readiness.json",
  "data_reality_audit.json",
  "daily_sector_analysis.json",
  "module_maturity_audit.json",
  "etf_flow_leaderboard.json",
  "sector_signal_attribution.json",
  "sector_watchlist_state.json",
  "decision_gate_ledger.json",
  "index_explainability.json",
  "observation_snapshot.json",
  "akshare_provider_flow_observations.json",
  "news_review.json",
  "general_pool_analysis.json"
];

export async function runDailyDataVault({ rootDir = defaultRootDir, asOf }) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const payload = await buildDailyDataVault({ rootDir, asOf: resolvedAsOf });
  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  await mkdir(path.join(rootDir, "model_outputs"), { recursive: true });
  const jsonPath = path.join(outDir, "daily_data_vault.json");
  const manifestPath = path.join(rootDir, "model_outputs", "daily_data_vault_manifest.jsonl");
  const publishedPath = path.join(repoRootFor(rootDir), "financial-pond", "data", "daily_data_vault.json");
  await mkdir(path.dirname(publishedPath), { recursive: true });
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await appendFile(manifestPath, `${JSON.stringify({
    as_of: payload.as_of,
    collected_at: payload.collected_at,
    files_seen: payload.files_seen.length,
    files_missing: payload.files_missing.length,
    data_reality_summary: payload.data_reality_summary
  })}\n`, "utf8");
  await atomicWriteFile(publishedPath, jsonContent(payload));
  return { payload, jsonPath, manifestPath, publishedPath };
}

export async function buildDailyDataVault({ rootDir = defaultRootDir, asOf }) {
  const repoRoot = repoRootFor(rootDir);
  const expected = [
    ...publishedJsonFiles.map((file) => rel(repoRoot, "financial-pond", "data", file)),
    ...modelJsonFiles.map((file) => rel(rootDir, "model_outputs", asOf, file)),
    ...(await listProviderExports(rootDir))
  ];
  const uniqueExpected = [...new Set(expected)];
  const filesSeen = [];
  const filesMissing = [];
  const fileHashes = {};

  for (const filePath of uniqueExpected) {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
    const relativePath = path.relative(repoRoot, fullPath);
    const info = await fileInfo(fullPath, relativePath);
    if (info) {
      filesSeen.push(info);
      fileHashes[relativePath] = info.sha256;
    } else {
      filesMissing.push(relativePath);
    }
  }

  const availableModules = await readAvailableModules(filesSeen, repoRoot);
  const missingModules = modelJsonFiles
    .filter((file) => !filesSeen.some((item) => item.path.endsWith(`/model_outputs/${asOf}/${file}`) || item.path === `tools/financial-pond-framework/model_outputs/${asOf}/${file}`))
    .map((file) => file.replace(/\.json$/, ""));

  return {
    module_id: MODULE_ID,
    as_of: asOf,
    collected_at: new Date().toISOString(),
    status: "vault_available",
    files_seen: filesSeen,
    files_missing: filesMissing,
    file_hashes: fileHashes,
    available_modules: availableModules,
    missing_modules: missingModules,
    data_reality_summary: dataRealitySummary({ filesSeen, filesMissing, availableModules })
  };
}

async function listProviderExports(rootDir) {
  const exportDir = path.join(rootDir, "data", "provider_exports");
  try {
    const files = await readdir(exportDir);
    return files
      .filter((file) => file.endsWith(".csv"))
      .map((file) => path.join(exportDir, file));
  } catch {
    return [
      path.join(exportDir, "a_share_etf_daily.csv"),
      path.join(exportDir, "a_share_sector_flow.csv")
    ];
  }
}

async function fileInfo(fullPath, relativePath) {
  try {
    const [buffer, stats] = await Promise.all([readFile(fullPath), stat(fullPath)]);
    return {
      path: relativePath,
      kind: kindFor(relativePath),
      bytes: stats.size,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex")
    };
  } catch {
    return null;
  }
}

async function readAvailableModules(filesSeen, repoRoot) {
  const modules = [];
  for (const file of filesSeen.filter((item) => item.path.endsWith(".json"))) {
    try {
      const json = JSON.parse(await readFile(path.join(repoRoot, file.path), "utf8"));
      modules.push({
        file: file.path,
        module_id: json.module_id ?? path.basename(file.path, ".json"),
        status: json.status ?? "available",
        as_of: json.as_of ?? null
      });
    } catch {
      modules.push({
        file: file.path,
        module_id: path.basename(file.path, ".json"),
        status: "unreadable_json",
        as_of: null
      });
    }
  }
  return modules;
}

function dataRealitySummary({ filesSeen, filesMissing, availableModules }) {
  const providerCsvCount = filesSeen.filter((file) => file.kind === "provider_csv").length;
  const audit = availableModules.find((module) => module.module_id === "data_reality_audit_v0_1");
  return {
    provider_csv_files: providerCsvCount,
    json_files: filesSeen.filter((file) => file.kind === "json").length,
    missing_files: filesMissing.length,
    vault_reality: providerCsvCount ? SignalReality.REAL_PROVIDER_DERIVED : SignalReality.INSUFFICIENT_HISTORY,
    audit_status: audit?.status ?? "missing"
  };
}

function kindFor(relativePath) {
  if (relativePath.endsWith(".csv")) return "provider_csv";
  if (relativePath.endsWith(".json")) return "json";
  return "other";
}

function repoRootFor(rootDir) {
  const maybeRepo = path.resolve(rootDir, "..", "..");
  if (rootDir.endsWith(path.join("tools", "financial-pond-framework"))) return maybeRepo;
  return rootDir;
}

function rel(...parts) {
  return path.join(...parts);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runDailyDataVault({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Daily data vault written: ${result.jsonPath}`);
  console.log(`Daily data vault published: ${result.publishedPath}`);
}
