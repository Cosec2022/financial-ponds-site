import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { readJsonFile } from "../core/config_loader.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function buildSourceStatus({ rootDir }) {
  const [hardData, rss, search] = await Promise.all([
    readJsonFile(path.join(rootDir, "config", "collectors", "hard_data_sources.json")),
    readJsonFile(path.join(rootDir, "config", "news", "rss_sources.json")),
    readJsonFile(path.join(rootDir, "config", "news", "search_queries.json"))
  ]);

  const hardDataSources = hardData.sources.map((source) => ({
    id: source.id,
    type: "hard_data",
    collector: source.collector,
    enabled: Boolean(source.enabled),
    node_id: source.node_id ?? null,
    status: source.enabled ? "enabled" : "disabled",
    description: source.description ?? ""
  }));

  const rssSources = rss.sources.map((source) => ({
    id: source.id,
    type: "news_rss",
    collector: "rss_news",
    enabled: Boolean(source.enabled),
    node_id: null,
    status: source.enabled ? "enabled" : "disabled",
    description: source.description ?? ""
  }));

  const searchSources = search.queries.map((query) => ({
    id: query.id,
    type: "news_search",
    collector: "news_search",
    enabled: Boolean(query.enabled),
    node_id: null,
    status: query.enabled ? "enabled" : "disabled",
    description: query.description ?? ""
  }));

  const sources = [...hardDataSources, ...rssSources, ...searchSources];
  const byStatus = countBy(sources, "status");
  const byCollector = countBy(sources, "collector");

  return {
    generated_at: new Date().toISOString(),
    counts: {
      total: sources.length,
      enabled: byStatus.enabled ?? 0,
      disabled: byStatus.disabled ?? 0
    },
    by_collector: byCollector,
    sources
  };
}

export async function writeSourceStatus({ rootDir }) {
  const payload = await buildSourceStatus({ rootDir });
  const outDir = path.join(rootDir, "model_outputs", "source_status");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "source_status.json");
  await atomicWriteFile(outPath, jsonContent(payload));
  return { outPath, payload };
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    const key = item[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { outPath, payload } = await writeSourceStatus({ rootDir });
  console.log(`Source status written: ${outPath}`);
  console.log(`Sources: ${payload.counts.total}, enabled: ${payload.counts.enabled}, disabled: ${payload.counts.disabled}`);
}
