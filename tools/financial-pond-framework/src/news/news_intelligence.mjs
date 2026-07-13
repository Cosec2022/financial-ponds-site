import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readJsonFile, loadConfig } from "../core/config_loader.mjs";
import { buildRegistry } from "../core/registry.mjs";
import { parseRssItems } from "../collectors/rss_news_collector.mjs";
import { buildSearchUrl, dedupeNewsItems } from "../collectors/news_search_collector.mjs";

export async function runNewsIntelligence({
  rootDir,
  asOf = new Date().toISOString().slice(0, 10),
  fixture = false,
  ci = false,
  historical = false
}) {
  const [config, appConfig] = await Promise.all([
    readJsonFile(path.join(rootDir, "config", "news", "news_daily_v1.json")),
    loadConfig(rootDir)
  ]);
  const registry = buildRegistry(appConfig);

  const collection = await collectNewsItems({ config, asOf, fixture, ci, historical });
  const analysis = analyseNewsItems({
    config,
    registry,
    asOf,
    items: collection.items,
    collectionMeta: collection.meta
  });

  const outObsDir = path.join(rootDir, "observations", asOf);
  const outModelDir = path.join(rootDir, "model_outputs", asOf);
  await mkdir(outObsDir, { recursive: true });
  await mkdir(outModelDir, { recursive: true });

  const observationsPath = path.join(outObsDir, "news_observations.json");
  const reviewPath = path.join(outModelDir, "news_review.json");
  const reviewMarkdownPath = path.join(outModelDir, "news_review.md");

  await writeJson(observationsPath, {
    as_of: asOf,
    generated_at: new Date().toISOString(),
    module_id: config.id,
    source: "news_intelligence_v1",
    observations: analysis.observations,
    collection: collection.meta
  });
  await writeJson(reviewPath, analysis.review);
  await writeFile(reviewMarkdownPath, buildNewsMarkdown(analysis.review), "utf8");

  return {
    ...analysis,
    observationsPath,
    reviewPath,
    reviewMarkdownPath
  };
}

async function collectNewsItems({ config, asOf, fixture, ci, historical }) {
  if (fixture) {
    return {
      items: normalizeFixtureItems(config.fixture_items ?? []),
      meta: {
        mode: "fixture",
        fallback_used: true,
        fallback_reason: "Fixture news items were requested explicitly.",
        errors: []
      }
    };
  }

  const items = [];
  const errors = [];
  const queries = (config.queries ?? []).filter((query) => query.enabled);

  for (const query of queries) {
    const template = config.provider_templates?.[query.provider];
    if (!template) {
      errors.push({ query_id: query.id, error: `Missing provider template: ${query.provider}` });
      continue;
    }
    const url = buildSearchUrl({ template, query: query.query });
    try {
      const response = await fetch(url, { headers: { "user-agent": "financial-ponds-news-intelligence/1.0" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      const parsed = dedupeNewsItems(parseRssItems(xml))
        .slice(0, config.max_items_per_query ?? 8)
        .map((item) => ({ ...item, query_id: query.id, bucket: query.bucket, query }));
      items.push(...parsed);
    } catch (error) {
      errors.push({ query_id: query.id, error: error.message });
    }
  }

  const filtered = historical ? filterHistoricalNewsItems(items, asOf) : { items, excluded_after_cutoff: 0, excluded_missing_timestamp: 0 };
  if (!filtered.items.length && ci && !historical) {
    return {
      items: normalizeFixtureItems(config.fixture_items ?? []),
      meta: {
        mode: "ci_fallback",
        fallback_used: true,
        fallback_reason: "Real news search returned no usable items or failed. CI used deterministic fixture news so the site can still publish with an explicit fallback marker.",
        errors
      }
    };
  }

  return {
    items: filtered.items,
    meta: {
      mode: historical ? "historical_backfill" : "real",
      fallback_used: false,
      errors,
      historical_cutoff_as_of: historical ? asOf : null,
      excluded_after_cutoff: filtered.excluded_after_cutoff,
      excluded_missing_timestamp: filtered.excluded_missing_timestamp
    }
  };
}

export function filterHistoricalNewsItems(items, asOf) {
  let excludedAfterCutoff = 0;
  let excludedMissingTimestamp = 0;
  const filtered = (items ?? []).filter((item) => {
    const timestamp = item.published_at ?? item.pubDate ?? null;
    const date = timestamp ? new Date(timestamp) : null;
    if (!date || Number.isNaN(date.getTime())) {
      excludedMissingTimestamp += 1;
      return false;
    }
    if (date.toISOString().slice(0, 10) > asOf) {
      excludedAfterCutoff += 1;
      return false;
    }
    return true;
  });
  return {
    items: filtered,
    excluded_after_cutoff: excludedAfterCutoff,
    excluded_missing_timestamp: excludedMissingTimestamp
  };
}

function normalizeFixtureItems(items) {
  return items.map((item) => ({
    ...item,
    bucket: item.bucket ?? item.query_id ?? "fixture",
    query: { id: item.query_id ?? "fixture", credibility: 0.35, source_type: "fixture" }
  }));
}

export function analyseNewsItems({ config, registry, asOf, items, collectionMeta }) {
  const matchedEvents = [];
  const observationMap = new Map();
  const sectorPressure = new Map();
  const bucketPressure = new Map();
  const rules = config.rules ?? [];

  for (const item of items ?? []) {
    const text = `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase();
    for (const rule of rules) {
      if (!matchesKeywords(text, rule.keywords_any ?? [])) continue;

      const confidence = Math.min(1, Math.max(0.1, item.query?.credibility ?? 0.4));
      const event = {
        event_id: `${asOf}-${item.query_id ?? "news"}-${rule.id}-${hashText(`${item.title}${item.link}`)}`,
        title: item.title ?? "Untitled news item",
        description: item.description ?? "",
        link: item.link ?? "",
        published_at: item.published_at ?? item.pubDate ?? null,
        bucket: item.bucket ?? item.query_id ?? "news",
        rule_id: rule.id,
        display_name: rule.display_name,
        channel: rule.channel,
        direction: rule.direction,
        score: rule.score,
        confidence,
        reason: rule.reason,
        affected_sector_ids: rule.affected_sector_ids ?? [],
        needs_market_confirmation: true
      };
      matchedEvents.push(event);

      addObservation({
        observationMap,
        registry,
        nodeId: rule.node_id,
        asOf,
        score: rule.score,
        confidence,
        event,
        reason: rule.reason
      });

      for (const sectorId of rule.affected_sector_ids ?? []) {
        const sectorNodeId = `${sectorId}_policy_news`;
        addSectorPressure(sectorPressure, sectorId, rule.score * confidence, event);
        addObservation({
          observationMap,
          registry,
          nodeId: sectorNodeId,
          asOf,
          score: rule.score,
          confidence: Math.min(0.55, confidence),
          event,
          reason: `${rule.reason} Sector mapping is broad and requires market confirmation.`
        });
      }

      addBucketPressure(bucketPressure, event.bucket, rule.score * confidence, event);
    }
  }

  const observations = [...observationMap.values()].sort((a, b) => a.node_id.localeCompare(b.node_id));
  const sector_news_pressure = [...sectorPressure.entries()]
    .map(([sector_id, record]) => ({
      sector_id,
      score: round(record.score),
      event_count: record.events.length,
      top_events: record.events.slice(0, 3).map(compactEvent)
    }))
    .sort((a, b) => b.score - a.score);
  const pressure_buckets = [...bucketPressure.entries()]
    .map(([bucket, record]) => ({
      bucket,
      score: round(record.score),
      event_count: record.events.length,
      top_events: record.events.slice(0, 3).map(compactEvent)
    }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const headline = buildHeadline({ matchedEvents, sector_news_pressure, collectionMeta });
  const review = {
    as_of: asOf,
    generated_at: new Date().toISOString(),
    module_id: config.id,
    status: matchedEvents.length ? "news_available" : "no_news_matches",
    headline,
    counts: {
      collected_items: items?.length ?? 0,
      matched_events: matchedEvents.length,
      observations: observations.length,
      affected_sectors: sector_news_pressure.length
    },
    collection: collectionMeta,
    summary: {
      top_positive_sectors: sector_news_pressure.filter((item) => item.score > 0).slice(0, 3),
      top_negative_sectors: sector_news_pressure.filter((item) => item.score < 0).slice(-3).reverse(),
      pressure_buckets: pressure_buckets.slice(0, 5)
    },
    sector_news_pressure,
    pressure_buckets,
    top_events: matchedEvents.slice(0, 12).map(compactEvent),
    interpretation_boundary: [
      "News is expectation pressure, not proof of capital flow.",
      "Sector news mappings are intentionally broad; they are not precise single-stock causal edges.",
      "Market confirmation must come from price, turnover, breadth, ETF share change, or other hard data."
    ]
  };

  return { observations, review };
}

function addObservation({ observationMap, registry, nodeId, asOf, score, confidence, event, reason }) {
  if (!registry.nodes.has(nodeId)) return;
  const existing = observationMap.get(nodeId);
  if (!existing) {
    observationMap.set(nodeId, {
      node_id: nodeId,
      as_of: asOf,
      value: 1,
      unit: "event_count",
      score: round(score),
      confidence,
      data_type: registry.nodes.get(nodeId).data_type,
      source: "news_intelligence_v1",
      reason,
      events: [event]
    });
    return;
  }
  existing.value += 1;
  existing.score = round(clamp(existing.score + score * 0.25, -2, 2));
  existing.confidence = Math.min(1, Math.max(existing.confidence, confidence));
  existing.events.push(event);
}

function addSectorPressure(map, sectorId, score, event) {
  const existing = map.get(sectorId) ?? { score: 0, events: [] };
  existing.score = clamp(existing.score + score, -2, 2);
  existing.events.push(event);
  map.set(sectorId, existing);
}

function addBucketPressure(map, bucket, score, event) {
  const existing = map.get(bucket) ?? { score: 0, events: [] };
  existing.score = clamp(existing.score + score, -2, 2);
  existing.events.push(event);
  map.set(bucket, existing);
}

function buildHeadline({ matchedEvents, sector_news_pressure, collectionMeta }) {
  if (collectionMeta.fallback_used) {
    return "News collector used fallback data; treat today’s news layer as a pipeline check, not live news.";
  }
  if (!matchedEvents.length) return "No rule-matched news pressure found.";
  const strongest = [...sector_news_pressure].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  if (!strongest) return `${matchedEvents.length} news events matched rules, but no sector pressure was mapped.`;
  return `${matchedEvents.length} rule-matched news events; strongest mapped pressure is ${strongest.sector_id} (${strongest.score.toFixed(2)}).`;
}

function compactEvent(event) {
  return {
    title: event.title,
    bucket: event.bucket,
    channel: event.channel,
    score: round(event.score * event.confidence),
    direction: event.direction,
    reason: event.reason,
    affected_sector_ids: event.affected_sector_ids,
    link: event.link
  };
}

function buildNewsMarkdown(review) {
  const lines = [
    "# News Intelligence Review",
    "",
    `- as_of: ${review.as_of}`,
    `- status: ${review.status}`,
    `- headline: ${review.headline}`,
    `- fallback_used: ${review.collection.fallback_used}`,
    "",
    "## Sector news pressure",
    "",
    "| Sector | Score | Events |",
    "|---|---:|---:|"
  ];
  for (const row of review.sector_news_pressure) {
    lines.push(`| ${row.sector_id} | ${row.score.toFixed(2)} | ${row.event_count} |`);
  }
  lines.push("", "## Boundary", "");
  for (const item of review.interpretation_boundary) lines.push(`- ${item}`);
  lines.push("");
  return lines.join("\n");
}

function matchesKeywords(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
