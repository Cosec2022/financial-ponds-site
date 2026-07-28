import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildSectorObservationPanel,
  parseCsv
} from "./lib/sector-observation-panel.mjs";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const historyDir = resolve(dataDir, "history", "observations");
const asOf = process.env.AS_OF ?? JSON.parse(await readFile(resolve(dataDir, "evening_observation_summary.json"), "utf8")).as_of;
const generatedAt = process.env.GENERATED_AT ?? new Date().toISOString();

const [summary, instrumentMap, etfCsv, benchmarkStore, archiveSummaries, breadthStore, qualityReport] = await Promise.all([
  readJson(resolve(dataDir, "evening_observation_summary.json")),
  readJson(resolve(dataDir, "pool_instrument_map.json")),
  readFile(resolve(root, "tools/financial-pond-framework/data/provider_exports/a_share_etf_daily.csv"), "utf8"),
  readJson(resolve(root, "tools/financial-pond-framework/data/provider_exports/a_share_benchmark_daily.json")),
  readArchiveSummaries(),
  readOptionalJson(resolve(dataDir, "sector_breadth_daily.json"), { status: "unavailable", rows: [] }),
  readOptionalJson(resolve(dataDir, "market_history_quality.json"), null)
]);

const panel = buildSectorObservationPanel({
  asOf,
  generatedAt,
  summary,
  instrumentMap,
  etfRows: parseCsv(etfCsv),
  benchmarkRows: benchmarkStore.rows ?? [],
  archiveSummaries,
  breadthRows: breadthStore.rows ?? [],
  breadthStatus: breadthStore,
  qualityReport
});

await writeFile(
  resolve(dataDir, "sector_observation_panel.json"),
  `${JSON.stringify(panel, null, 2)}\n`,
  "utf8"
);

console.log(`Sector observation panel written: current=${panel.rows.length}, departures=${panel.departures.length}, observed_dates=${panel.window.observed_date_count}`);

async function readArchiveSummaries() {
  const summaries = [];
  try {
    const entries = await readdir(historyDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
      const archive = await readJson(resolve(historyDir, entry.name));
      if (archive?.evening_observation_summary?.as_of) summaries.push(archive.evening_observation_summary);
    }
  } catch {
    // First-run repositories may not have observation archives yet.
  }
  return summaries;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function readOptionalJson(file, fallback) {
  try {
    return await readJson(file);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
