import { CollectorContract } from "../contracts/collector_contract.mjs";
import { writeRawRecord } from "../storage/raw_store.mjs";
import { parseRssItems } from "./rss_news_collector.mjs";

export class NewsSearchCollector extends CollectorContract {
  constructor({ rootDir, searchConfig, rules }) {
    super({
      id: "news_search_collector",
      description: "Runs configured news search RSS queries and emits rule-based news node observations."
    });
    this.rootDir = rootDir;
    this.searchConfig = searchConfig;
    this.rules = rules;
  }

  async collect({ asOf, registry }) {
    const observationsByNode = new Map();
    const queries = (this.searchConfig.queries ?? []).filter((query) => query.enabled);

    for (const query of queries) {
      const url = buildSearchUrl({
        template: this.searchConfig.provider_templates?.[query.provider],
        query: query.query
      });
      const response = await fetch(url);
      if (!response.ok) throw new Error(`News search query ${query.id} failed: ${response.status}`);

      const xml = await response.text();
      const items = dedupeNewsItems(parseRssItems(xml));
      const rawRef = await writeRawRecord({
        rootDir: this.rootDir,
        asOf,
        collectorId: this.id,
        sourceId: query.id,
        payload: { query, url, items }
      });

      const observations = itemsToNewsObservations({
        items,
        rules: this.rules,
        asOf,
        registry,
        source: query,
        collectorId: this.id,
        rawRef
      });

      mergeObservations(observationsByNode, observations);
    }

    return [...observationsByNode.values()];
  }
}

export function buildSearchUrl({ template, query }) {
  if (!template) throw new Error("News search provider template is required");
  return template.replace("{query}", encodeURIComponent(query));
}

export function dedupeNewsItems(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const key = normalizeNewsKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export function itemsToNewsObservations({ items, rules, asOf, registry, source, collectorId, rawRef }) {
  const observationsByNode = new Map();

  for (const item of items) {
    const text = `${item.title} ${item.description}`.toLowerCase();
    for (const rule of rules) {
      if (!registry.nodes.has(rule.node_id)) {
        throw new Error(`News rule ${rule.id} references missing node ${rule.node_id}`);
      }
      if (!matchesRule(text, rule)) continue;

      const confidence = Math.min(1, rule.confidence ?? source.credibility ?? 0.5);
      const event = {
        event_id: `${asOf}-${source.id}-${rule.id}-${hashText(item.title + item.link)}`,
        title: item.title,
        source: source.source_type ?? source.id,
        published_at: item.published_at,
        affected_pools: [],
        affected_sectors: [],
        channel: rule.channel,
        direction: Math.sign(rule.score),
        impact: Math.abs(rule.score),
        confidence,
        duration: rule.duration ?? "short",
        needs_market_confirmation: rule.needs_market_confirmation ?? true,
        reason: rule.reason,
        link: item.link,
        raw_ref: rawRef
      };

      const node = registry.nodes.get(rule.node_id);
      const observation = {
        node_id: rule.node_id,
        as_of: asOf,
        value: 1,
        unit: "event_count",
        score: rule.score,
        confidence,
        data_type: node.data_type,
        source: collectorId,
        raw_ref: rawRef,
        reason: rule.reason,
        events: [event]
      };

      mergeObservation(observationsByNode, observation);
    }
  }

  return [...observationsByNode.values()];
}

function mergeObservations(target, observations) {
  for (const observation of observations) {
    mergeObservation(target, observation);
  }
}

function mergeObservation(target, observation) {
  const existing = target.get(observation.node_id);
  if (!existing) {
    target.set(observation.node_id, observation);
    return;
  }

  existing.value += observation.value;
  existing.score = clampScore(existing.score + observation.score * 0.25);
  existing.confidence = Math.min(1, Math.max(existing.confidence, observation.confidence));
  existing.events.push(...observation.events);
}

function matchesRule(text, rule) {
  return (rule.keywords_any ?? []).some((keyword) => text.includes(keyword.toLowerCase()));
}

function normalizeNewsKey(item) {
  const title = (item.title ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const link = (item.link ?? "").toLowerCase().split("?")[0].trim();
  return link || title;
}

function clampScore(value) {
  return Math.max(-2, Math.min(2, value));
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

