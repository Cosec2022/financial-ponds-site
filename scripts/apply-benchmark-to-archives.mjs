import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyBenchmarkToArchive, loadBenchmarkConfig } from "./lib/benchmark-proxy.mjs";

const root = resolve(import.meta.dirname, "..");
const historyDir = resolve(root, process.env.BENCHMARK_ARCHIVE_DIR ?? "financial-pond/data/history/observations");
const storePath = resolve(root, process.env.BENCHMARK_STORE_PATH ?? "tools/financial-pond-framework/data/provider_exports/a_share_benchmark_daily.json");
const config = await loadBenchmarkConfig();
const store = JSON.parse(await readFile(storePath, "utf8"));
const requestedDates = process.argv.slice(2).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
if (!requestedDates.length) throw new Error("Pass one or more exact archive dates");

for (const date of requestedDates) {
  const providerRow = (store.rows ?? []).find((row) => row.symbol === config.symbol && row.date === date);
  if (!providerRow) {
    console.log(`Benchmark archive skipped: ${date} exact-date provider row missing`);
    continue;
  }
  const path = resolve(historyDir, `${date}.json`);
  const original = JSON.parse(await readFile(path, "utf8"));
  const result = applyBenchmarkToArchive(original, config, providerRow);
  if (!result.changed) {
    console.log(`Benchmark archive unchanged: ${date}`);
    continue;
  }
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(result.archive, null, 2)}\n`, "utf8");
  await rename(temporary, path);
  console.log(`Benchmark archive updated through formal exact-date flow: ${date}`);
}
