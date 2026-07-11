import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketPenetrationBrief, renderMarketPenetrationMarkdown } from "../scripts/lib/market-penetration-brief.mjs";

const input = { asOf: "2026-07-10", generatedAt: "2026-07-10T12:00:00.000Z", marketSignals: { rows: [{ pool_id: "a_share_semiconductor", pool_name: "Semiconductor", instrument_code: "512480", price_close: 1.2, price_date: "2026-07-10", momentum_value: 3, momentum_status: "derived_from_market", source_file: "provider.csv" }] }, marketReport: { as_of: "2026-07-10" }, newsReview: { as_of: "2026-07-10", status: "news_available", collection: { fallback_used: false }, top_events: [{ title: "Policy support expands", description: "media", link: "https://news.example/a", published_at: "2026-07-10T08:00:00Z" }, { title: "Policy support expands", link: "https://news.example/b", published_at: "2026-07-09T08:00:00Z" }] }, sourceRegistry: { sources: [] } };

test("brief keeps media narratives outside verified facts and groups repeats", () => {
  const brief = buildMarketPenetrationBrief(input);
  assert.equal(brief.verified_facts.length, 0);
  assert.equal(brief.media_narratives.length, 2);
  assert.equal(brief.repeated_or_stale_items.some((item) => item.count === 2), true);
  assert.equal(brief.unsupported_narratives.length, 2);
  assert.equal(brief.market_facts[0].source_date, "2026-07-10");
});

test("brief is deterministic and keeps hypotheses separate from facts", () => {
  const first = buildMarketPenetrationBrief(input);
  const second = buildMarketPenetrationBrief(input);
  assert.deepEqual(first, second);
  assert.equal(first.possible_3_20_session_implications[0].kind, "hypothesis");
  assert.equal(renderMarketPenetrationMarkdown(first).includes("## 8. 哪些变化可能与未来 3–20 个交易日有关"), true);
});

test("source unavailability and empty unexplained moves are explicit", () => {
  const brief = buildMarketPenetrationBrief({ ...input, marketSignals: { rows: [] }, newsReview: {} });
  assert.equal(brief.source_status[0].status, "source_unavailable");
  assert.deepEqual(brief.unexplained_moves, []);
});
