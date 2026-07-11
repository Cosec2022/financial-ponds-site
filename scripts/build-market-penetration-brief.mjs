import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildMarketPenetrationBrief, renderMarketPenetrationMarkdown } from "./lib/market-penetration-brief.mjs";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const asOf = process.env.AS_OF ?? (await readJson(resolve(dataDir, "pool_market_signals.json"))).as_of;
const [marketSignals, marketReport, newsReview, sourceRegistry] = await Promise.all([
  readJson(resolve(dataDir, "pool_market_signals.json")), readJson(resolve(dataDir, "market_signal_report.json")), readJson(resolve(dataDir, "news_review.json")), readJson(resolve(root, "config", "market-penetration-source-registry.v1.json"))
]);
const generatedAt = process.env.BRIEF_GENERATED_AT ?? newsReview.generated_at ?? marketSignals.generated_at ?? `${asOf}T00:00:00.000Z`;
const brief = buildMarketPenetrationBrief({ asOf, generatedAt, marketSignals, marketReport, newsReview, sourceRegistry });
const reportDir = resolve(root, "reports", "market-penetration");
await mkdir(reportDir, { recursive: true });
await writeFile(resolve(dataDir, "market_penetration_brief.json"), `${JSON.stringify(brief, null, 2)}\n`);
await writeFile(resolve(reportDir, `${asOf}.md`), `${renderMarketPenetrationMarkdown(brief)}\n`);
console.log(`Market penetration brief written: facts=${brief.market_facts.length}, narratives=${brief.media_narratives.length}`);
async function readJson(path) { return JSON.parse(await readFile(path, "utf8")); }
