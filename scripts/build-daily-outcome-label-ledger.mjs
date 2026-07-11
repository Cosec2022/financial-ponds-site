import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { appendOutcomeLabels, outcomeLabelsFromReviews } from "./lib/daily-outcome-label-ledger.mjs";

const root = resolve(import.meta.dirname, "..");
const reviews = JSON.parse(await readFile(resolve(root, "financial-pond/data/candidate_outcome_reviews.json"), "utf8"));
const labels = outcomeLabelsFromReviews({ reviews, generatedAt: process.env.GENERATED_AT ?? new Date().toISOString() });
const result = await appendOutcomeLabels({ rootDir: root, labels });
console.log(`Outcome label ledger: appended=${result.appended}, total=${result.output.rows.length}`);
