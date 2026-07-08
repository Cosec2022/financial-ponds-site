import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runAShareDailyCi({
  rootDir,
  asOf = new Date().toISOString().slice(0, 10)
}) {
  const summary = {
    runner_id: "a_share_daily_ci_v0_10_27",
    as_of: asOf,
    started_at: new Date().toISOString(),
    fallback_used: false,
    steps: []
  };

  await runStep(summary, "akshare_provider_doctor", "python3", [
    "providers/akshare_etf_bridge/doctor.py"
  ], { rootDir });

  await runStep(summary, "akshare_etf_snapshot", "python3", [
    "providers/akshare_etf_bridge/export_a_share_etf_daily.py",
    "--as-of",
    asOf
  ], { rootDir });

  const waterLevel = await runStep(summary, "a_share_water_level_real", "python3", [
    "providers/a_share_water_level/export_a_share_water_level.py",
    "--as-of",
    asOf
  ], { rootDir, allowFailure: true });

  if (!waterLevel.ok) {
    summary.fallback_used = true;
    summary.fallback_reason = "Real A-share water-level provider failed. CI used deterministic fixture water-level data so the site can still build and publish with an explicit fallback marker.";
    await runStep(summary, "a_share_water_level_fixture_fallback", "python3", [
      "providers/a_share_water_level/export_a_share_water_level.py",
      "--fixture",
      "--as-of",
      asOf
    ], { rootDir });
  }

  await runStep(summary, "akshare_validate", "python3", [
    "providers/akshare_etf_bridge/validate_exports.py"
  ], { rootDir });

  await runStep(summary, "akshare_inspect", "python3", [
    "providers/akshare_etf_bridge/inspect_exports.py",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "akshare_to_flow", "node", [
    "src/tools/akshare_flow_observations.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "etf_flow_leaderboard", "node", [
    "src/tools/etf_flow_leaderboard.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "daily_data_vault_initial", "node", [
    "src/tools/daily_data_vault.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "water_level_to_observations", "node", [
    "src/tools/a_share_water_observations.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "news_intelligence", "node", [
    "src/tools/news_daily_review.mjs",
    "--ci",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "graph_cycle", "node", [
    "src/pipeline/run_cycle.mjs",
    asOf
  ], { rootDir });

  await runStep(summary, "sector_flow_review", "node", [
    "src/tools/sector_flow_review.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "sector_rotation_intelligence", "node", [
    "src/tools/sector_rotation_intelligence.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "sector_rotation_history", "node", [
    "src/tools/sector_rotation_history.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "sector_module_review", "node", [
    "src/tools/sector_module_review.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "etf_decision_readiness", "node", [
    "src/tools/etf_decision_readiness.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "daily_sector_analysis", "node", [
    "src/tools/daily_sector_analysis.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "sector_signal_attribution", "node", [
    "src/tools/sector_signal_attribution.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "sector_watchlist_state", "node", [
    "src/tools/sector_watchlist_state.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "decision_gate_ledger", "node", [
    "src/tools/decision_gate_ledger.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "index_explainability", "node", [
    "src/tools/index_explainability.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "observation_snapshot", "node", [
    "src/tools/observation_snapshot.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  await runStep(summary, "daily_data_vault_final", "node", [
    "src/tools/daily_data_vault.mjs",
    "--as-of",
    asOf
  ], { rootDir });

  summary.status = "ok";
  summary.finished_at = new Date().toISOString();
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function runStep(summary, name, command, args, {
  rootDir,
  allowFailure = false
}) {
  const startedAt = new Date().toISOString();
  console.log(`\n[${name}] ${command} ${args.join(" ")}`);
  const result = await spawnCommand(command, args, rootDir);
  const step = {
    name,
    command: [command, ...args].join(" "),
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: result.code,
    ok: result.code === 0
  };
  summary.steps.push(step);

  if (result.code !== 0 && !allowFailure) {
    const error = new Error(`CI daily step failed: ${name} exited with ${result.code}`);
    error.step = step;
    throw error;
  }
  return step;
}

function spawnCommand(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: false,
    stdio: "inherit",
    env: process.env
  });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code }));
  });
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
  await runAShareDailyCi({ rootDir, asOf: args.asOf });
}
