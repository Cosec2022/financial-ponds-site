import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchUrl, dedupeNewsItems, itemsToNewsObservations } from "../src/collectors/news_search_collector.mjs";

test("news search URL encodes query text", () => {
  const url = buildSearchUrl({
    template: "https://news.example/rss?q={query}",
    query: "gold real rates"
  });

  assert.equal(url, "https://news.example/rss?q=gold%20real%20rates");
});

test("news search deduplicates by normalized link", () => {
  const items = dedupeNewsItems([
    { title: "Gold rises", link: "https://example.com/a?utm=1" },
    { title: "Gold rises again", link: "https://example.com/a?utm=2" },
    { title: "Different", link: "https://example.com/b" }
  ]);

  assert.equal(items.length, 2);
});

test("news search items map to observations through existing news rules", () => {
  const registry = {
    nodes: new Map([
      ["geopolitical_risk_news", { data_type: "news" }]
    ])
  };

  const observations = itemsToNewsObservations({
    asOf: "2026-07-02",
    registry,
    source: { id: "gold_geopolitics", source_type: "search_rss", credibility: 0.45 },
    collectorId: "news_search_collector",
    rawRef: "raw_data/example.json",
    items: [
      {
        title: "Gold market reacts to geopolitical conflict",
        description: "Safe-haven demand rises.",
        link: "https://example.com/news",
        published_at: "Thu, 02 Jul 2026 08:00:00 GMT"
      }
    ],
    rules: [
      {
        id: "geopolitical_gold_risk",
        node_id: "geopolitical_risk_news",
        channel: "geopolitics",
        keywords_any: ["conflict"],
        score: 0.8,
        confidence: 0.55,
        reason: "Geopolitical risk keyword matched."
      }
    ]
  });

  assert.equal(observations.length, 1);
  assert.equal(observations[0].node_id, "geopolitical_risk_news");
  assert.equal(observations[0].events.length, 1);
});
