import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalJson, contentHash } from "./daily-longitudinal-snapshot.mjs";

export const OUTCOME_LABEL_SCHEMA_VERSION = "daily_outcome_labels_v1";
export const SUPPORTED_HORIZONS = ["T+1", "T+3", "T+5", "T+20"];

export function outcomeLabelsFromReviews({ reviews, generatedAt, calculationVersion = "candidate_outcome_reviews_v0_10_65" }) {
  return (reviews?.rows ?? []).filter((row) => SUPPORTED_HORIZONS.includes(row.horizon)).map((row) => ({
    label_id: `${row.candidate_as_of}:${row.pool_id}:${row.horizon}`,
    source_snapshot_id: row.source_snapshot_id ?? null,
    as_of: row.candidate_as_of,
    pool_id: row.pool_id,
    symbol: row.symbol ?? null,
    horizon: row.horizon,
    expected_review_date: row.expected_review_price_date ?? row.review_as_of ?? null,
    actual_review_date: row.reviewed_at_data_date ?? null,
    baseline_price: nullable(row.baseline_price),
    outcome_price: nullable(row.review_price),
    absolute_return: nullable(row.absolute_return),
    benchmark_symbol: row.benchmark_symbol ?? null,
    benchmark_baseline_price: nullable(row.benchmark_baseline_close),
    benchmark_outcome_price: nullable(row.benchmark_review_close),
    benchmark_return: nullable(row.benchmark_return),
    excess_return: nullable(row.excess_return),
    mfe: null, mae: null, max_drawdown: null, trend_duration_sessions: null,
    outcome_status: row.review_status ?? "pending",
    unavailable_reason: row.unavailable_reason ?? null,
    generated_at: generatedAt,
    calculation_version: calculationVersion,
    source_dates: { baseline: row.candidate_as_of ?? null, outcome: row.reviewed_at_data_date ?? null },
    warnings: ["MFE, MAE, maximum drawdown, and trend duration require an observed daily path and remain null when unavailable."]
  })).sort((a, b) => a.label_id.localeCompare(b.label_id));
}

export async function appendOutcomeLabels({ rootDir, labels }) {
  const file = path.join(rootDir, "financial-pond", "data", "history", "daily_outcome_labels_v1.json");
  await mkdir(path.dirname(file), { recursive: true });
  let existing = { schema_version: OUTCOME_LABEL_SCHEMA_VERSION, rows: [] };
  try { existing = JSON.parse(await readFile(file, "utf8")); } catch {}
  const byId = new Map((existing.rows ?? []).map((row) => [row.label_id, row]));
  let appended = 0;
  for (const label of labels) {
    const prior = byId.get(label.label_id);
    if (prior && contentHash(prior) === contentHash(label)) continue;
    if (!prior) { byId.set(label.label_id, label); appended += 1; }
  }
  const output = { schema_version: OUTCOME_LABEL_SCHEMA_VERSION, rows: [...byId.values()].sort((a, b) => a.label_id.localeCompare(b.label_id)) };
  await writeFile(file, `${canonicalJson(output)}\n`);
  return { output, appended };
}

function nullable(value) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
