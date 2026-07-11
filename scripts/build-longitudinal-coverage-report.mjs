import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson } from "./lib/daily-longitudinal-snapshot.mjs";

const root = resolve(import.meta.dirname, "..");
const base = resolve(root, "financial-pond/data/history/daily");
const index = await readJson(resolve(base, "index.json"), { records: [] });
const labels = await readJson(resolve(base, "daily_outcome_labels_v1.json"), { rows: [] });
const records = index.records ?? [];
const current = Object.values(index.current_by_date ?? {});
const snapshots = await Promise.all(current.map(async (record) => readJson(resolve(root, record.path), null)));
const rows = snapshots.flatMap((snapshot) => snapshot?.rows ?? []);
const report = {
  schema_version: "longitudinal_coverage_report_v1",
  first_date: current.at(0)?.as_of ?? null,
  last_date: current.at(-1)?.as_of ?? null,
  trading_dates: current.map((record) => record.as_of),
  snapshot_count: records.length,
  final_snapshot_count: records.filter((record) => record.finality_status === "final").length,
  provisional_snapshot_count: records.filter((record) => record.finality_status === "provisional").length,
  corrected_snapshot_count: records.filter((record) => record.finality_status === "corrected" || record.revision > 1).length,
  total_pool_rows: rows.length,
  candidate_rows: rows.filter((row) => row.candidate_qualified).length,
  non_candidate_rows: rows.filter((row) => !row.candidate_qualified).length,
  direct_mapping_rows: rows.filter((row) => row.mapping_type === "direct").length,
  proxy_mapping_rows: rows.filter((row) => row.mapping_type === "sector_proxy").length,
  missing_mapping_rows: rows.filter((row) => row.mapping_type === "missing").length,
  real_flow_rows: rows.filter((row) => row.flow_reality_label === "real").length,
  estimated_flow_rows: rows.filter((row) => row.flow_reality_label === "estimated").length,
  proxy_flow_rows: rows.filter((row) => row.flow_reality_label === "proxy").length,
  missing_flow_rows: rows.filter((row) => row.flow_reality_label === "missing").length,
  model_versions: [...new Set(current.map((record) => record.model_version))].sort(),
  schema_versions: [...new Set(snapshots.filter(Boolean).map((snapshot) => snapshot.schema_version))].sort(),
  date_gaps: [], provider_failures: [],
  outcome_label_counts: count(labels.rows ?? [], "outcome_status"),
  review_status_counts: count(labels.rows ?? [], "outcome_status"),
  warnings: rows.length ? [] : ["No immutable longitudinal snapshots have been published yet."]
};
await mkdir(resolve(root, "financial-pond/data"), { recursive: true });
await writeFile(resolve(root, "financial-pond/data/longitudinal_coverage_report.json"), `${canonicalJson(report)}\n`);
console.log(`Longitudinal coverage: snapshots=${report.snapshot_count}, rows=${report.total_pool_rows}`);

async function readJson(file, fallback) { try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; } }
function count(rows, key) { return rows.reduce((out, row) => ({ ...out, [row[key] ?? "unknown"]: (out[row[key] ?? "unknown"] ?? 0) + 1 }), {}); }
