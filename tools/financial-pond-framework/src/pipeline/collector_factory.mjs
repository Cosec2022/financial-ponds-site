import path from "node:path";
import { readJsonFile } from "../core/config_loader.mjs";
import { MockObservationCollector } from "../collectors/mock/mock_observation_collector.mjs";
import { HttpCsvCollector } from "../collectors/http_csv_collector.mjs";
import { LocalCsvCollector } from "../collectors/local_csv_collector.mjs";
import { HttpJsonCollector } from "../collectors/http_json_collector.mjs";
import { RssNewsCollector } from "../collectors/rss_news_collector.mjs";
import { NewsSearchCollector } from "../collectors/news_search_collector.mjs";

export async function buildCollectorsFromConfig(rootDir) {
  const hardDataConfig = await readJsonFile(path.join(rootDir, "config", "collectors", "hard_data_sources.json"));
  const rssConfig = await readJsonFile(path.join(rootDir, "config", "news", "rss_sources.json"));
  const searchConfig = await readJsonFile(path.join(rootDir, "config", "news", "search_queries.json"));
  const newsRules = await readJsonFile(path.join(rootDir, "config", "news", "news_rules.json"));
  const normalization = await readJsonFile(path.join(rootDir, "config", "model", "normalization_profiles.json"));

  const collectors = [];

  if (hardDataConfig.sources.some((source) => source.enabled && source.collector === "mock")) {
    collectors.push(new MockObservationCollector(rootDir));
  }

  if (hardDataConfig.sources.some((source) => source.enabled && source.collector === "http_csv")) {
    collectors.push(new HttpCsvCollector({
      rootDir,
      sources: hardDataConfig.sources,
      normalizationProfiles: normalization.profiles
    }));
  }

  if (hardDataConfig.sources.some((source) => source.enabled && source.collector === "local_csv")) {
    collectors.push(new LocalCsvCollector({
      rootDir,
      sources: hardDataConfig.sources,
      normalizationProfiles: normalization.profiles
    }));
  }

  if (hardDataConfig.sources.some((source) => source.enabled && source.collector === "http_json")) {
    collectors.push(new HttpJsonCollector({
      rootDir,
      sources: hardDataConfig.sources,
      normalizationProfiles: normalization.profiles
    }));
  }

  if (rssConfig.sources.some((source) => source.enabled)) {
    collectors.push(new RssNewsCollector({
      rootDir,
      sources: rssConfig.sources,
      rules: newsRules.rules
    }));
  }

  if ((searchConfig.queries ?? []).some((query) => query.enabled)) {
    collectors.push(new NewsSearchCollector({
      rootDir,
      searchConfig,
      rules: newsRules.rules
    }));
  }

  return collectors;
}
