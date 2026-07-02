import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSeries } from "../src/model/normalizer.mjs";
import { parseCsv } from "../src/collectors/http_csv_collector.mjs";
import { parseRssItems } from "../src/collectors/rss_news_collector.mjs";

test("CSV parser handles simple financial series", () => {
  const rows = parseCsv("date,value\n2026-07-01,1.0\n2026-07-02,1.5\n");
  assert.deepEqual(rows, [
    { date: "2026-07-01", value: "1.0" },
    { date: "2026-07-02", value: "1.5" }
  ]);
});

test("normalizer converts change to bounded z-score", () => {
  const rows = [
    { value: "1" },
    { value: "2" },
    { value: "3" },
    { value: "5" }
  ];
  const normalized = normalizeSeries(rows, "value", {
    method: "change_zscore",
    lookback: 3,
    clamp: [-2, 2]
  });
  assert.equal(typeof normalized.score, "number");
  assert.ok(normalized.score <= 2);
  assert.ok(normalized.score >= -2);
});

test("RSS parser extracts items", () => {
  const items = parseRssItems(`
    <rss><channel>
      <item>
        <title>Chip subsidy announced</title>
        <link>https://example.com/chip</link>
        <description><![CDATA[Semiconductor policy update]]></description>
        <pubDate>Thu, 02 Jul 2026 08:00:00 GMT</pubDate>
      </item>
    </channel></rss>
  `);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Chip subsidy announced");
  assert.match(items[0].description, /Semiconductor/);
});
