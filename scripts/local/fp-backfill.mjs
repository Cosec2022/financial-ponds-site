// FP-HIST-MKT-01 Historical Market Replay
// Input: immutable normalized market-input snapshot or bounded historical provider fetch.
// Output: replayed market evidence and daily persistence; never uses a latest quote for AS_OF.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const framework = path.join(root, "tools", "financial-pond-framework");
const args = process.argv.slice(2);
const asOf = value("--as-of") ?? process.env.AS_OF;
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf ?? "")) throw new Error("fp:backfill requires --as-of YYYY-MM-DD");
const offline = args.includes("--offline");
const noNews = args.includes("--no-news");
const providerArgs = ["providers/akshare_etf_bridge/archive_historical_market_inputs.py", "--as-of", asOf];
for (const flag of ["--offline", "--refresh-inputs", "--strict-exact-date", "--allow-market-closed-fallback"]) if (args.includes(flag)) providerArgs.push(flag);
const env = { ...process.env, AS_OF: asOf, REVIEW_NOW: `${asOf}T23:59:59+08:00`, GENERATED_AT: process.env.GENERATED_AT ?? new Date().toISOString() };

run("python3", providerArgs, framework);
run("npm", ["run", "provider:akshare:to-flow", "--", "--as-of", asOf], framework);
run("npm", ["run", "etf:flow-leaderboard", "--", "--as-of", asOf], framework);
copyFileSync(path.join(framework, "model_outputs", asOf, "etf_flow_leaderboard.json"), path.join(root, "financial-pond", "data", "etf_flow_leaderboard.json"));
run("node", ["scripts/build-pool-instrument-map.mjs"], root);
run("node", ["scripts/build-market-signal-channel.mjs"], root);
if (!noNews) run("node", ["src/tools/news_daily_review.mjs", "--historical", "--as-of", asOf], framework);
run("npm", ["run", "fp:daily", "--", asOf], root);

const manifest = path.join(root, "financial-pond", "history", "market-inputs", asOf, "manifest.json");
if (!existsSync(manifest)) throw new Error(`market input manifest was not created: ${manifest}`);
console.log(`Historical replay complete for ${asOf}${offline ? " (offline snapshot)" : ""}`);

function value(flag) { const i = args.indexOf(flag); return i < 0 ? null : args[i + 1]; }
function run(command, commandArgs, cwd) {
  const result = spawnSync(command, commandArgs, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed with ${result.status}`);
}
