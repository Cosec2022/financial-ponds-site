import { CollectorContract } from "../contracts/collector_contract.mjs";
import { writeRawRecord } from "../storage/raw_store.mjs";

export class RssNewsCollector extends CollectorContract {
  constructor({ rootDir, sources, rules }) {
    super({
      id: "rss_news_collector",
      description: "Collects enabled RSS/XML feeds and emits rule-based news node observations."
    });
    this.rootDir = rootDir;
    this.sources = sources;
    this.rules = rules;
  }

  async collect({ asOf, registry }) {
    const observationsByNode = new Map();

    for (const source of this.sources.filter((item) => item.enabled)) {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`RSS source ${source.id} failed: ${response.status}`);

      const xml = await response.text();
      const items = parseRssItems(xml);
      const rawRef = await writeRawRecord({
        rootDir: this.rootDir,
        asOf,
        collectorId: this.id,
        sourceId: source.id,
        payload: { source, items }
      });

      for (const item of items) {
        const text = `${item.title} ${item.description}`.toLowerCase();
        for (const rule of this.rules) {
          if (!registry.nodes.has(rule.node_id)) {
            throw new Error(`News rule ${rule.id} references missing node ${rule.node_id}`);
          }
          if (!matchesRule(text, rule)) continue;

          const event = {
            event_id: `${asOf}-${rule.id}-${hashText(item.title + item.link)}`,
            title: item.title,
            source: source.source_type ?? source.id,
            published_at: item.published_at,
            affected_pools: [],
            affected_sectors: [],
            channel: rule.channel,
            direction: Math.sign(rule.score),
            impact: Math.abs(rule.score),
            confidence: rule.confidence ?? source.credibility ?? 0.5,
            duration: rule.duration ?? "short",
            needs_market_confirmation: rule.needs_market_confirmation ?? true,
            reason: rule.reason,
            link: item.link,
            raw_ref: rawRef
          };

          const existing = observationsByNode.get(rule.node_id);
          if (!existing) {
            observationsByNode.set(rule.node_id, {
              node_id: rule.node_id,
              as_of: asOf,
              value: 1,
              unit: "event_count",
              score: rule.score,
              confidence: event.confidence,
              data_type: registry.nodes.get(rule.node_id).data_type,
              source: this.id,
              raw_ref: rawRef,
              reason: rule.reason,
              events: [event]
            });
          } else {
            existing.value += 1;
            existing.score = clampScore(existing.score + rule.score * 0.25);
            existing.confidence = Math.min(1, existing.confidence + 0.05);
            existing.events.push(event);
          }
        }
      }
    }

    return [...observationsByNode.values()];
  }
}

export function parseRssItems(xml) {
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return itemMatches.map((itemXml) => ({
    title: textBetween(itemXml, "title"),
    link: textBetween(itemXml, "link"),
    description: stripTags(textBetween(itemXml, "description")),
    published_at: textBetween(itemXml, "pubDate")
  }));
}

function matchesRule(text, rule) {
  return (rule.keywords_any ?? []).some((keyword) => text.includes(keyword.toLowerCase()));
}

function textBetween(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return "";
  return decodeXml(match[1].replace("<![CDATA[", "").replace("]]>", "").trim());
}

function stripTags(text) {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(text) {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
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
