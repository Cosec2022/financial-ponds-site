import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildMarketPenetrationBrief, renderMarketPenetrationMarkdown } from "./lib/market-penetration-brief.mjs";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const marketSignals = await readJson(resolve(dataDir, "pool_market_signals.json"));
const asOf = process.env.AS_OF ?? marketSignals.as_of;

const [
  marketReport,
  newsReview,
  sourceRegistry,
  eveningSummary,
  candidateLedger,
  candidateStateModel,
  poolScores,
  qualityReport,
  coverageReport,
  mappingReport,
  flowReport,
  reviewAnalytics,
  outcomeReport
] = await Promise.all([
  readJson(resolve(dataDir, "market_signal_report.json")),
  readJson(resolve(dataDir, "news_review.json")),
  readJson(resolve(root, "config", "market-penetration-source-registry.v1.json")),
  readJson(resolve(dataDir, "evening_observation_summary.json")),
  readJson(resolve(dataDir, "observation_candidate_ledger.json")),
  readJson(resolve(dataDir, "candidate_state_model.json")),
  readJson(resolve(dataDir, "pool_observation_scores.json")),
  readJson(resolve(dataDir, "signal_quality_report.json")),
  readJson(resolve(dataDir, "data_coverage_report.json")),
  readJson(resolve(dataDir, "pool_mapping_report.json")),
  readJson(resolve(dataDir, "flow_channel_report.json")),
  readJson(resolve(dataDir, "candidate_review_analytics.json")),
  readJson(resolve(dataDir, "outcome_review_report.json"))
]);

const generatedAt = process.env.BRIEF_GENERATED_AT
  ?? process.env.GENERATED_AT
  ?? newsReview.generated_at
  ?? marketSignals.generated_at
  ?? `${asOf}T00:00:00.000Z`;

const brief = buildMarketPenetrationBrief({
  asOf,
  generatedAt,
  marketSignals,
  marketReport,
  newsReview,
  sourceRegistry,
  eveningSummary,
  candidateLedger,
  candidateStateModel,
  poolScores,
  qualityReport,
  coverageReport,
  mappingReport,
  flowReport,
  reviewAnalytics,
  outcomeReport
});

const reportDir = resolve(root, "reports", "market-penetration");
await mkdir(reportDir, { recursive: true });
await writeFile(resolve(dataDir, "market_penetration_brief.json"), `${JSON.stringify(brief, null, 2)}\n`);
await writeFile(resolve(reportDir, `${asOf}.md`), `${renderMarketPenetrationMarkdown(brief)}\n`);
console.log(`Market penetration report written: as_of=${asOf}, candidates=${brief.fp_cross_checks.length}, facts=${brief.market_facts.length}, narratives=${brief.media_narratives.length}`);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
