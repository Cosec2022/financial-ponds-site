import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const historyDir = resolve(dataDir, "history", "observations");
const ledger = await readJson(resolve(dataDir, "observation_candidate_ledger.json"));
const schedule = await readJson(resolve(dataDir, "candidate_review_schedule.json"));
const currentMarket = await readJson(resolve(dataDir, "pool_market_signals.json"));
const priceBasis = await readJson(resolve(dataDir, "candidate_price_basis.json"));
const currentAsOf = schedule.as_of ?? currentMarket.as_of;
const archives = await readArchives();
const basisByCandidate = new Map((priceBasis.rows ?? []).map((row) => [`${row.candidate_as_of}|${row.pool_id}`, row]));
const generatedAt = new Date().toISOString();
const horizons = [
  ["T+1", "review_t1_due"],
  ["T+3", "review_t3_due"],
  ["T+5", "review_t5_due"],
  ["T+20", "review_t20_due"]
];

const rows = (ledger.rows ?? []).flatMap((candidate) =>
  horizons.map(([horizon, dueField]) => reviewCandidate(candidate, horizon, candidate[dueField]))
).sort((a, b) =>
  a.candidate_as_of.localeCompare(b.candidate_as_of)
  || a.pool_id.localeCompare(b.pool_id)
  || horizonDays(a.horizon) - horizonDays(b.horizon)
);

const statusCounts = countBy(rows, "review_status");
const directionCounts = countBy(rows, "direction_result");
const dueReviewCount = rows.filter((row) => row.review_as_of <= currentAsOf && row.review_status !== "pending").length;
const nextDueReviews = nextDue(rows);
const report = {
  module_id: "outcome_review_report_v0_10_61",
  as_of: currentAsOf,
  generated_at: generatedAt,
  total_candidates: (ledger.rows ?? []).length,
  due_review_count: dueReviewCount,
  reviewed_count: statusCounts.reviewed ?? 0,
  pending_count: statusCounts.pending ?? 0,
  unavailable_count: statusCounts.unavailable ?? 0,
  insufficient_count: statusCounts.insufficient_data ?? 0,
  aligned_count: directionCounts.aligned ?? 0,
  opposite_count: directionCounts.opposite ?? 0,
  neutral_count: directionCounts.neutral ?? 0,
  reviewed_horizons: [...new Set(rows.filter((row) => row.review_status === "reviewed").map((row) => row.horizon))],
  next_due_reviews: nextDueReviews,
  boundary_notes: [
    "observe_only",
    "Future review dates remain pending.",
    "Observed returns are calculated only from archived market close values.",
    "Missing market levels or history never produce fabricated outcomes."
  ]
};
const output = {
  module_id: "candidate_outcome_reviews_v0_10_61",
  as_of: currentAsOf,
  generated_at: generatedAt,
  rows
};
const reviewHistory = {
  module_id: "candidate_review_history_v0_10_61",
  as_of: currentAsOf,
  generated_at: generatedAt,
  rows: buildReviewHistory(rows),
  boundary_notes: [
    "observe_only",
    "History preserves candidate-date model state and review status.",
    "Future horizons remain pending until due date and source data are available."
  ]
};

await writeJson(resolve(dataDir, "candidate_outcome_reviews.json"), output);
await writeJson(resolve(dataDir, "outcome_review_report.json"), report);
await writeJson(resolve(dataDir, "candidate_review_history.json"), reviewHistory);
await updateSchedule(report);
console.log(`Candidate outcome reviews written: reviewed=${report.reviewed_count}, pending=${report.pending_count}, due=${report.due_review_count}`);

function reviewCandidate(candidate, horizon, reviewAsOf) {
  const base = {
    candidate_as_of: candidate.as_of,
    review_as_of: reviewAsOf,
    horizon,
    pool_id: candidate.pool_id,
    pool_name: candidate.pool_name,
    original_observation_tier: candidate.observation_tier,
    original_observation_score: candidate.observation_score,
    original_direction: candidate.direction,
    original_capped_confidence: candidate.capped_confidence,
    original_evidence_quality: candidate.evidence_quality,
    original_proxy_risk: candidate.proxy_risk,
    candidate_state: candidate.candidate_state ?? "Noise",
    overheat_score: valueOrUnavailable(candidate.overheat_score),
    major_wave_score: valueOrUnavailable(candidate.major_wave_score),
    risk_gate_status: candidate.risk_gate_status ?? "insufficient_data",
    state_reason: candidate.state_reason ?? "State unavailable.",
    overheat_reason: candidate.overheat_reason ?? "Overheat unavailable.",
    major_wave_reason: candidate.major_wave_reason ?? "Major-wave unavailable.",
    risk_gate_reason: candidate.risk_gate_reason ?? "Risk gate unavailable.",
    review_status: "pending",
    outcome_available: false,
    observed_return: null,
    benchmark_return: null,
    relative_return: null,
    direction_result: "unavailable",
    confidence_result: "not_reviewed",
    evidence_result: "not_reviewed",
    review_note: `Scheduled for ${reviewAsOf}; review date has not arrived.`,
    boundary: "observe_only; outcome review only"
  };

  if (!reviewAsOf || reviewAsOf > currentAsOf) return base;
  const basis = basisByCandidate.get(`${candidate.as_of}|${candidate.pool_id}`);
  const reviewArchive = archives.get(reviewAsOf);
  if (!reviewArchive) {
    return {
      ...base,
      review_status: "insufficient_data",
      review_note: "The exact review-date observation archive is missing."
    };
  }

  if (!basis?.baseline_available) {
    return {
      ...base,
      review_status: "unavailable",
      review_note: "Candidate price basis is unavailable; no return was calculated."
    };
  }

  const reviewMarket = marketRow(reviewArchive, candidate.pool_id);
  if (!reviewMarket) {
    return {
      ...base,
      review_status: "unavailable",
      review_note: "Mapped market data is unavailable for the candidate or review date."
    };
  }
  const reviewPriceDate = reviewMarket.price_date ?? reviewMarket.source_date ?? reviewArchive.as_of;
  if (!reviewPriceDate || reviewPriceDate < reviewAsOf) {
    return {
      ...base,
      review_status: "insufficient_data",
      review_note: "Review-date archive exists, but mapped market close is stale for the due date."
    };
  }

  const originalClose = numberOrNull(basis.baseline_price);
  const reviewClose = numberOrNull(reviewMarket.price_close ?? reviewMarket.market_close);
  if (originalClose === null || reviewClose === null || originalClose <= 0) {
    return {
      ...base,
      review_status: "insufficient_data",
      review_note: "Candidate basis or review market row lacks an exact close level."
    };
  }

  const observedReturn = round(reviewClose / originalClose - 1);
  const directionResult = directionResultFor(candidate.direction, observedReturn);
  return {
    ...base,
    review_status: "reviewed",
    outcome_available: true,
    observed_return: observedReturn,
    direction_result: directionResult,
    confidence_result: directionResult === "aligned" ? "supported" : directionResult === "opposite" ? "not_supported" : "neutral",
    evidence_result: `${candidate.evidence_quality}_evidence_reviewed`,
    review_note: `Observed return calculated from candidate price basis (${basis.baseline_as_of}) and archived review close; benchmark data is unavailable.`,
    boundary: "observe_only; reviewed observation outcome"
  };
}

function marketRow(archive, poolId) {
  return (archive?.pool_market_signals?.rows ?? []).find((row) => row.pool_id === poolId) ?? null;
}

function directionResultFor(direction, observedReturn) {
  if (observedReturn === 0 || direction === "neutral") return "neutral";
  if ((direction === "inward" && observedReturn > 0) || (direction === "outward" && observedReturn < 0)) return "aligned";
  if (["inward", "outward"].includes(direction)) return "opposite";
  return "unavailable";
}

function nextDue(reviewRows) {
  const future = reviewRows.filter((row) => row.review_status === "pending");
  const earliest = future.map((row) => row.review_as_of).filter(Boolean).sort().at(0);
  if (!earliest) return [];
  return horizons.map(([horizon]) => ({
    date: earliest,
    horizon,
    count: future.filter((row) => row.review_as_of === earliest && row.horizon === horizon).length
  })).filter((row) => row.count > 0);
}

async function updateSchedule(reportValue) {
  const updated = {
    ...schedule,
    module_id: "candidate_review_schedule_v0_10_61",
    generated_at: generatedAt,
    reviewed_count: reportValue.reviewed_count,
    pending_count: reportValue.pending_count,
    unavailable_count: reportValue.unavailable_count,
    insufficient_count: reportValue.insufficient_count,
    next_due_reviews: reportValue.next_due_reviews
  };
  await writeJson(resolve(dataDir, "candidate_review_schedule.json"), updated);
}

function buildReviewHistory(reviewRows) {
  const grouped = new Map();
  for (const row of reviewRows) {
    const basis = basisByCandidate.get(`${row.candidate_as_of}|${row.pool_id}`) ?? {};
    const key = `${row.candidate_as_of}|${row.pool_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        as_of: row.candidate_as_of,
        symbol: basis.instrument_code ?? null,
        name: row.pool_name,
        pool_id: row.pool_id,
        baseline_price: basis.baseline_price ?? null,
        candidate_score: row.original_observation_score,
        candidate_state: row.candidate_state,
        overheat_score: row.overheat_score,
        major_wave_score: row.major_wave_score,
        risk_gate_status: row.risk_gate_status,
        state_reason: row.state_reason,
        overheat_reason: row.overheat_reason,
        major_wave_reason: row.major_wave_reason,
        risk_gate_reason: row.risk_gate_reason,
        t1_review_result: null,
        t3_review_result: null,
        t5_review_result: null,
        t20_review_result: null,
        outcome_status: "pending",
        review_notes: [],
        boundary: "observe_only; review history only"
      });
    }
    const item = grouped.get(key);
    const result = {
      review_as_of: row.review_as_of,
      review_status: row.review_status,
      outcome_available: row.outcome_available,
      observed_return: row.observed_return,
      benchmark_return: row.benchmark_return,
      relative_return: row.relative_return,
      direction_result: row.direction_result
    };
    if (row.horizon === "T+1") item.t1_review_result = result;
    if (row.horizon === "T+3") item.t3_review_result = result;
    if (row.horizon === "T+5") item.t5_review_result = result;
    if (row.horizon === "T+20") item.t20_review_result = result;
    item.review_notes.push(`${row.horizon}: ${row.review_note}`);
    if (row.review_status === "reviewed") item.outcome_status = "reviewed";
    else if (item.outcome_status !== "reviewed" && ["unavailable", "insufficient_data"].includes(row.review_status)) item.outcome_status = row.review_status;
  }
  return [...grouped.values()].sort((a, b) => a.as_of.localeCompare(b.as_of) || a.pool_id.localeCompare(b.pool_id));
}

async function readArchives() {
  const result = new Map();
  const entries = await readdir(historyDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name)) continue;
    const archive = await readJson(resolve(historyDir, entry.name));
    result.set(archive.as_of, archive);
  }
  return result;
}

function horizonDays(value) {
  return Number(String(value).replace("T+", "")) || 0;
}

function countBy(items, field) {
  return items.reduce((counts, row) => {
    counts[row[field]] = (counts[row[field]] ?? 0) + 1;
    return counts;
  }, {});
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function valueOrUnavailable(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : "unavailable";
}

function round(value) {
  return Number(value.toFixed(6));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
