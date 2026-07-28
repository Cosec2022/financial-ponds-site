import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseCsv } from "./lib/sector-observation-panel.mjs";
import {
  MARKET_HISTORY_TARGET,
  buildMarketHistoryQuality,
  validateMarketHistoryQuality
} from "./lib/market-history-quality.mjs";

const root = resolve(import.meta.dirname, "..");
const asOf = readArg("--as-of") ?? process.env.AS_OF ?? "2026-07-28";
const targetWindow = Number(readArg("--target-window") ?? MARKET_HISTORY_TARGET);
const [etfCsv, benchmark, instrumentMap, breadth] = await Promise.all([
  readFile(resolve(root, "tools/financial-pond-framework/data/provider_exports/a_share_etf_daily.csv"), "utf8"),
  readJson("tools/financial-pond-framework/data/provider_exports/a_share_benchmark_daily.json", { rows: [] }),
  readJson("financial-pond/data/pool_instrument_map.json", { rows: [] }),
  readJson("financial-pond/data/sector_breadth_daily.json", null)
]);
const instruments = [...new Map(
  instrumentMap.rows
    .filter((row) => row.mapping_status === "direct_etf" && row.instrument_code)
    .map((row) => [String(row.instrument_code), row])
).values()];
const report = buildMarketHistoryQuality({
  asOf,
  targetWindow,
  etfRows: parseCsv(etfCsv),
  benchmarkRows: benchmark.rows ?? [],
  instruments,
  breadth
});
if (!validateMarketHistoryQuality(report)) throw new Error("Generated market history quality report is invalid");
await writeJson("financial-pond/data/market_history_quality.json", report);
await writeJson("tools/financial-pond-framework/model_outputs/market_history_quality.json", report);
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--strict") && report.hard_failures.length) {
  throw new Error(`Market history quality hard failures: ${report.hard_failures.join(", ")}`);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(resolve(root, path), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path, payload) {
  await writeFile(resolve(root, path), `${JSON.stringify(payload, null, 2)}\n`);
}
