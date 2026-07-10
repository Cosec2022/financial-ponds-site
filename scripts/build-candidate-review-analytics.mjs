import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const history = await readJson("candidate_review_history.json");
const report = await readJsonOptional("outcome_review_report.json", {});
const generatedAt = new Date().toISOString();
const minSample = 3;
const horizons = ["T+1", "T+3"];
const reviewed = reviewRows(history.rows ?? []);
const reviewChecks = (history.rows ?? []).flatMap((row) => horizons.map((horizon) => ({ row, horizon, result: resultFor(row, horizon) })));
const pendingRows = reviewChecks.filter(({ result }) => result?.review_status === "pending");
const unavailableRows = reviewChecks.filter(({ result }) => result?.review_status === "unavailable");
const insufficientRows = reviewChecks.filter(({ result }) => result?.review_status === "skipped");
const unavailableReasons = ["calendar_unknown", "stale_data", "missing_price", "missing_benchmark", "invalid_baseline"];
const stateUniverse = unique((history.rows ?? []).map((row) => row.candidate_state).filter(Boolean));
const riskUniverse = unique((history.rows ?? []).map((row) => row.risk_gate_status).filter(Boolean));
const overheatBucketUniverse = unique((history.rows ?? []).map((row) => scoreBucket(row.overheat_score)));
const majorBucketUniverse = unique((history.rows ?? []).map((row) => scoreBucket(row.major_wave_score)));

const analytics = {
  module_id: "candidate_review_analytics_v0_10_64",
  as_of: history.as_of ?? report.as_of,
  generated_at: generatedAt,
  status: reviewed.length >= minSample ? "analytics_available" : "insufficient_sample",
  source_files_used: ["financial-pond/data/candidate_review_history.json"],
  sample_policy: {
    horizons,
    minimum_sample_size: minSample,
    reviewed_filter: "review_status reviewed and outcome_available true with numeric observed_return"
  },
  total_reviewed: reviewed.length,
  reviewed_rows: reviewed.length,
  pending_rows: pendingRows.length,
  unavailable_rows: unavailableRows.length + insufficientRows.length,
  unavailable_by_reason: countUnavailableByReason(reviewChecks.map(({ result }) => result).filter(Boolean)),
  insufficient_sample_rows: reviewed.length < minSample ? reviewed.length : 0,
  insufficient_review_rows: insufficientRows.length,
  win_rate_absolute: rateOrInsufficient(reviewed, (row) => row.observed_return > 0),
  win_rate_vs_benchmark: rateOrInsufficient(reviewed.filter((row) => Number.isFinite(row.relative_return)), (row) => row.relative_return > 0),
  average_return: averageOrInsufficient(reviewed.map((row) => row.observed_return)),
  average_excess_return: averageOrInsufficient(reviewed.map((row) => row.relative_return).filter(Number.isFinite)),
  failed_pulse_count: reviewed.filter((row) => row.candidate_state === "Pulse" && isFailure(row)).length,
  overheated_failure_rate: rateOrInsufficient(reviewed.filter((row) => row.candidate_state === "Overheated"), isFailure),
  confirmed_trend_continuation_rate: rateOrInsufficient(reviewed.filter((row) => row.candidate_state === "Confirmed Trend"), isContinuation),
  early_right_continuation_rate: rateOrInsufficient(reviewed.filter((row) => row.candidate_state === "Early Right"), isContinuation),
  by_candidate_state: groupSummary(reviewed, "candidate_state", stateUniverse),
  by_risk_gate_status: groupSummary(reviewed, "risk_gate_status", riskUniverse),
  by_overheat_score_bucket: groupSummary(reviewed.map((row) => ({ ...row, overheat_score_bucket: scoreBucket(row.overheat_score) })), "overheat_score_bucket", overheatBucketUniverse),
  by_major_wave_score_bucket: groupSummary(reviewed.map((row) => ({ ...row, major_wave_score_bucket: scoreBucket(row.major_wave_score) })), "major_wave_score_bucket", majorBucketUniverse),
  boundary_notes: [
    "observe_only",
    "Analytics use reviewed outcomes only.",
    "Pending and unavailable rows are excluded from rates.",
    "Small samples are marked insufficient_sample instead of producing false precision."
  ]
};

await writeJson("candidate_review_analytics.json", analytics);
console.log(`Candidate review analytics written: reviewed=${analytics.total_reviewed}, status=${analytics.status}`);

function reviewRows(rows) {
  return rows.flatMap((row) => horizons.map((horizon) => {
    const result = resultFor(row, horizon);
    if (result?.review_status !== "reviewed" || result.outcome_available !== true) return null;
    const observedReturn = numberOrNull(result.observed_return);
    if (observedReturn === null) return null;
    return {
      as_of: row.as_of,
      pool_id: row.pool_id,
      name: row.name,
      horizon,
      candidate_state: row.candidate_state,
      risk_gate_status: row.risk_gate_status,
      overheat_score: row.overheat_score,
      major_wave_score: row.major_wave_score,
      observed_return: observedReturn,
      benchmark_return: numberOrNull(result.benchmark_return),
      relative_return: numberOrNull(result.relative_return),
      direction_result: result.direction_result
    };
  }).filter(Boolean));
}

function resultFor(row, horizon) {
  const key = horizon.toLowerCase().replace("+", "") + "_review_result";
  return row[key] ?? null;
}

function groupSummary(rows, field, universe = []) {
  const groups = new Map();
  for (const group of universe) groups.set(group, []);
  for (const row of rows) {
    const key = row[field] ?? "unavailable";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([group, items]) => ({
    group,
    sample_size: items.length,
    sample_status: items.length >= minSample ? "available" : "insufficient_sample",
    total_reviewed: items.length,
    win_rate_absolute: rateOrInsufficient(items, (row) => row.observed_return > 0),
    win_rate_vs_benchmark: rateOrInsufficient(items.filter((row) => Number.isFinite(row.relative_return)), (row) => row.relative_return > 0),
    average_return: averageOrInsufficient(items.map((row) => row.observed_return)),
    average_excess_return: averageOrInsufficient(items.map((row) => row.relative_return).filter(Number.isFinite)),
    continuation_rate: rateOrInsufficient(items, isContinuation),
    failure_rate: rateOrInsufficient(items, isFailure)
  })).sort((a, b) => b.total_reviewed - a.total_reviewed || String(a.group).localeCompare(String(b.group)));
}

function unique(values) {
  return [...new Set(values)].sort();
}

function countUnavailableByReason(rows) {
  return unavailableReasons.reduce((counts, reason) => {
    counts[reason] = rows.filter((row) => row.review_reason === reason).length;
    return counts;
  }, {});
}

function rateOrInsufficient(rows, predicate) {
  if (rows.length < minSample) return "insufficient_sample";
  return round(rows.filter(predicate).length / rows.length);
}

function averageOrInsufficient(values) {
  const numbers = values.filter(Number.isFinite);
  if (numbers.length < minSample) return "insufficient_sample";
  return round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

function isContinuation(row) {
  return row.direction_result === "aligned" || row.observed_return > 0;
}

function isFailure(row) {
  return row.direction_result === "opposite" || row.observed_return < 0;
}

function scoreBucket(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "unavailable";
  if (number < 25) return "0-24";
  if (number < 50) return "25-49";
  if (number < 75) return "50-74";
  return "75-100";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return Number(value.toFixed(6));
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(dataDir, file), "utf8"));
}

async function readJsonOptional(file, fallback) {
  try {
    return await readJson(file);
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await writeFile(resolve(dataDir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
