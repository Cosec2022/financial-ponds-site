import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const historyDir = resolve(dataDir, "history", "observations");
const ledger = await readJson(resolve(dataDir, "observation_candidate_ledger.json"));
const schedule = await readJson(resolve(dataDir, "candidate_review_schedule.json"));
const currentMarket = await readJson(resolve(dataDir, "pool_market_signals.json"));
const priceBasis = await readJson(resolve(dataDir, "candidate_price_basis.json"));
const currentAsOf = process.env.AS_OF ?? maxDate(schedule.as_of, hongKongDate());
const archives = await readArchives();
const basisByCandidate = new Map((priceBasis.rows ?? []).map((row) => [`${row.candidate_as_of}|${row.pool_id}`, row]));
const generatedAt = new Date().toISOString();
const unavailableStatuses = ["unavailable_market_closed", "unavailable_missing_price", "unavailable_missing_benchmark", "unavailable_data_stale", "skipped_invalid_baseline"];
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
const dueReviewCount = rows.filter((row) => row.review_as_of <= currentAsOf && row.review_status !== "pending_not_due").length;
const nextDueReviews = nextDue(rows);
const unavailableByReason = countUnavailableByReason(rows);
const report = {
  module_id: "outcome_review_report_v0_10_64",
  as_of: currentAsOf,
  generated_at: generatedAt,
  total_candidates: (ledger.rows ?? []).length,
  due_review_count: dueReviewCount,
  reviewed_count: statusCounts.reviewed ?? 0,
  pending_count: statusCounts.pending_not_due ?? 0,
  unavailable_count: unavailableCount(rows),
  unavailable_by_reason: unavailableByReason,
  insufficient_count: statusCounts.skipped_invalid_baseline ?? 0,
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
  module_id: "candidate_outcome_reviews_v0_10_64",
  as_of: currentAsOf,
  generated_at: generatedAt,
  rows
};
const reviewHistory = {
  module_id: "candidate_review_history_v0_10_64",
  as_of: currentAsOf,
  generated_at: generatedAt,
  rows: buildReviewHistory(rows),
  boundary_notes: [
    "observe_only",
    "History preserves candidate-date model state and review status.",
    "Future horizons remain pending until due date and source data are available."
  ]
};
const dueVerificationRows = rows.filter((row) => ["T+1", "T+3"].includes(row.horizon)).map((row) => ({
  as_of: row.candidate_as_of,
  candidate_as_of: row.candidate_as_of,
  symbol: row.symbol,
  name: row.instrument_name ?? row.pool_name,
  pool_id: row.pool_id,
  pool_name: row.pool_name,
  due_date: row.review_as_of,
  review_due_date: row.review_as_of,
  review_horizon: row.horizon,
  expected_review_price_date: row.expected_review_price_date,
  latest_available_price_date: row.latest_available_price_date,
  is_due: row.is_due,
  required_market_data_exists: row.required_market_data_exists,
  review_completed: row.review_completed,
  review_status: row.review_status,
  reviewed_at_data_date: row.reviewed_at_data_date,
  baseline_price: row.baseline_price,
  review_price: row.review_price,
  benchmark_symbol: row.benchmark_symbol,
  benchmark_latest_available_date: row.benchmark_latest_available_date,
  absolute_return: row.absolute_return,
  benchmark_return: row.benchmark_return,
  excess_return: row.excess_return,
  unavailable_reason: row.unavailable_reason,
  diagnostic_note: row.diagnostic_note,
  boundary: "observe_only; due review verification only"
}));
const dueVerification = {
  module_id: "candidate_due_review_verification_v0_10_64",
  as_of: currentAsOf,
  generated_at: generatedAt,
  due_review_count: dueVerificationRows.filter((row) => row.is_due).length,
  reviewed_count: dueVerificationRows.filter((row) => row.review_status === "reviewed").length,
  pending_count: dueVerificationRows.filter((row) => row.review_status === "pending_not_due").length,
  unavailable_count: dueVerificationRows.filter((row) => isUnavailableStatus(row.review_status)).length,
  unavailable_by_reason: countUnavailableByReason(dueVerificationRows),
  expected_review_price_date: currentAsOf,
  latest_available_price_date: latestPriceDate(currentMarket?.rows ?? []),
  rows: dueVerificationRows,
  boundary_notes: [
    "observe_only",
    "Due reviews are explicit even when market data is unavailable.",
    "Unavailable rows are not counted as reviewed outcomes."
  ]
};

await writeJson(resolve(dataDir, "candidate_outcome_reviews.json"), output);
await writeJson(resolve(dataDir, "outcome_review_report.json"), report);
await writeJson(resolve(dataDir, "candidate_review_history.json"), reviewHistory);
await writeJson(resolve(dataDir, "candidate_due_review_verification.json"), dueVerification);
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
    symbol: null,
    instrument_name: null,
    review_status: "pending_not_due",
    outcome_available: false,
    review_completed: false,
    is_due: Boolean(reviewAsOf && reviewAsOf <= currentAsOf),
    required_market_data_exists: false,
    reviewed_at_data_date: null,
    expected_review_price_date: reviewAsOf ?? null,
    latest_available_price_date: null,
    benchmark_symbol: null,
    benchmark_latest_available_date: null,
    baseline_price: null,
    review_price: null,
    absolute_return: null,
    excess_return: null,
    unavailable_reason: null,
    diagnostic_note: reviewAsOf ? "Review is scheduled for a future date." : "Review due date is unavailable.",
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
  const basisPrice = numberOrNull(basis?.baseline_price);
  const basisValid = Boolean(basis?.baseline_available && basisPrice !== null && basisPrice > 0);
  const basisFields = {
    symbol: basis?.instrument_code ?? null,
    instrument_name: basis?.instrument_name ?? candidate.pool_name,
    baseline_price: basisPrice
  };
  if (!basisValid) {
    return unavailable(base, "skipped_invalid_baseline", "Candidate baseline price is invalid or unavailable.", {
      ...basisFields,
      diagnostic_note: "Baseline is malformed, so no review return can be calculated."
    });
  }

  const reviewArchive = archives.get(reviewAsOf);
  if (isTodayBeforeMarketClose(reviewAsOf)) {
    return unavailable(base, "unavailable_market_closed", "Expected review date is today and the market has not closed yet.", {
      ...basisFields,
      latest_available_price_date: latestPriceDate(currentMarket?.rows ?? []),
      diagnostic_note: "Wait for market close and provider refresh before calculating the due review."
    });
  }

  if (!reviewArchive) {
    const status = isWeekend(reviewAsOf) ? "unavailable_market_closed" : "unavailable_missing_price";
    const reason = isWeekend(reviewAsOf)
      ? "Review date falls on a weekend; market data is unavailable."
      : "No review-date market price archive is available.";
    return unavailable(base, status, reason, {
      ...basisFields,
      latest_available_price_date: latestPriceDate(currentMarket?.rows ?? []),
      diagnostic_note: isWeekend(reviewAsOf)
        ? "The expected review date is not a trading day."
        : "No archive exists for the expected review date."
    });
  }

  const reviewMarket = marketRow(reviewArchive, candidate.pool_id);
  if (!reviewMarket) {
    return unavailable(base, "unavailable_missing_price", "Mapped market price is missing for the due date.", {
      ...basisFields,
      latest_available_price_date: latestPriceDate(reviewArchive.pool_market_signals?.rows ?? []),
      diagnostic_note: "The review archive exists but does not contain this candidate instrument."
    });
  }
  const reviewPriceDate = reviewMarket.price_date ?? reviewMarket.source_date ?? reviewArchive.as_of;
  if (!reviewPriceDate || reviewPriceDate < reviewAsOf) {
    return unavailable(base, "unavailable_data_stale", "Provider latest price date is before the expected review date.", {
      ...basisFields,
      required_market_data_exists: true,
      reviewed_at_data_date: reviewPriceDate,
      latest_available_price_date: reviewPriceDate,
      diagnostic_note: "Provider data exists, but it is stale for this due review."
    });
  }

  const reviewClose = numberOrNull(reviewMarket.price_close ?? reviewMarket.market_close);
  if (reviewClose === null || reviewClose <= 0) {
    return unavailable(base, "unavailable_missing_price", "Review market row lacks an exact close level.", {
      ...basisFields,
      required_market_data_exists: true,
      reviewed_at_data_date: reviewPriceDate,
      latest_available_price_date: reviewPriceDate,
      diagnostic_note: "Provider has the expected date row, but the candidate close price is missing."
    });
  }

  const benchmark = benchmarkRow(reviewArchive);
  const benchmarkDate = benchmark?.price_date ?? benchmark?.source_date ?? null;
  const benchmarkClose = numberOrNull(benchmark?.price_close ?? benchmark?.market_close);
  if (!benchmark || !benchmarkDate || benchmarkDate < reviewAsOf || benchmarkClose === null || benchmarkClose <= 0) {
    return unavailable(base, "unavailable_missing_benchmark", "Candidate review price exists, but benchmark price is unavailable.", {
      ...basisFields,
      required_market_data_exists: true,
      reviewed_at_data_date: reviewPriceDate,
      latest_available_price_date: reviewPriceDate,
      review_price: reviewClose,
      benchmark_symbol: benchmark?.instrument_code ?? benchmark?.pool_id ?? null,
      benchmark_latest_available_date: benchmarkDate,
      diagnostic_note: "Candidate price is present; benchmark is missing, so excess return is not calculated."
    });
  }

  const observedReturn = round(reviewClose / basisPrice - 1);
  const benchmarkBasis = numberOrNull(benchmark.baseline_price) ?? benchmarkClose;
  const benchmarkReturn = round(benchmarkClose / benchmarkBasis - 1);
  const excessReturn = round(observedReturn - benchmarkReturn);
  const directionResult = directionResultFor(candidate.direction, observedReturn);
  return {
    ...base,
    ...basisFields,
    review_status: "reviewed",
    outcome_available: true,
    review_completed: true,
    required_market_data_exists: true,
    reviewed_at_data_date: reviewPriceDate,
    latest_available_price_date: reviewPriceDate,
    review_price: reviewClose,
    benchmark_symbol: benchmark.instrument_code ?? benchmark.pool_id ?? null,
    benchmark_latest_available_date: benchmarkDate,
    absolute_return: observedReturn,
    benchmark_return: benchmarkReturn,
    excess_return: excessReturn,
    observed_return: observedReturn,
    relative_return: excessReturn,
    direction_result: directionResult,
    confidence_result: directionResult === "aligned" ? "supported" : directionResult === "opposite" ? "not_supported" : "neutral",
    evidence_result: `${candidate.evidence_quality}_evidence_reviewed`,
    diagnostic_note: "Candidate and benchmark review prices are available.",
    review_note: `Observed return calculated from candidate price basis (${basis.baseline_as_of}) and archived review close.`,
    boundary: "observe_only; reviewed observation outcome"
  };
}

function unavailable(base, status, note, extra = {}) {
  return {
    ...base,
    ...extra,
    review_status: status,
    outcome_available: false,
    review_completed: false,
    unavailable_reason: note,
    review_note: note
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
  const future = reviewRows.filter((row) => row.review_status === "pending_not_due");
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
    module_id: "candidate_review_schedule_v0_10_63",
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
        due_review_verifications: [],
        outcome_status: "pending",
        review_notes: [],
        boundary: "observe_only; review history only"
      });
    }
    const item = grouped.get(key);
    const result = {
      review_horizon: row.horizon,
      review_due_date: row.review_as_of,
      reviewed_at_data_date: row.reviewed_at_data_date,
      expected_review_price_date: row.expected_review_price_date,
      latest_available_price_date: row.latest_available_price_date,
      baseline_price: row.baseline_price,
      review_price: row.review_price,
      benchmark_symbol: row.benchmark_symbol,
      benchmark_latest_available_date: row.benchmark_latest_available_date,
      absolute_return: row.absolute_return,
      benchmark_return: row.benchmark_return,
      excess_return: row.excess_return,
      unavailable_reason: row.unavailable_reason,
      diagnostic_note: row.diagnostic_note,
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
    if (["T+1", "T+3"].includes(row.horizon)) {
      item.due_review_verifications.push({
        as_of: row.candidate_as_of,
        due_date: row.review_as_of,
        review_horizon: row.horizon,
        expected_review_price_date: row.expected_review_price_date,
        latest_available_price_date: row.latest_available_price_date,
        is_due: row.is_due,
        required_market_data_exists: row.required_market_data_exists,
        review_completed: row.review_completed,
        review_status: row.review_status,
        unavailable_reason: row.unavailable_reason,
        diagnostic_note: row.diagnostic_note
      });
    }
    if (row.review_status === "reviewed") item.outcome_status = "reviewed";
    else if (item.outcome_status !== "reviewed" && isUnavailableStatus(row.review_status)) item.outcome_status = row.review_status;
  }
  return [...grouped.values()].sort((a, b) => a.as_of.localeCompare(b.as_of) || a.pool_id.localeCompare(b.pool_id));
}

function unavailableCount(rows) {
  return rows.filter((row) => isUnavailableStatus(row.review_status)).length;
}

function countUnavailableByReason(rows) {
  return unavailableStatuses.reduce((counts, status) => {
    counts[status] = rows.filter((row) => row.review_status === status).length;
    return counts;
  }, {});
}

function isUnavailableStatus(status) {
  return unavailableStatuses.includes(status);
}

function benchmarkRow(archive) {
  return (archive?.pool_market_signals?.rows ?? []).find((row) =>
    row.pool_id === "a_share_a_share" && numberOrNull(row.price_close ?? row.market_close) !== null
  ) ?? null;
}

function latestPriceDate(rows) {
  return rows.map((row) => row.price_date ?? row.source_date).filter(Boolean).sort().at(-1) ?? null;
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

function maxDate(...dates) {
  return dates.filter(Boolean).sort().at(-1);
}

function isWeekend(dateString) {
  const day = new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function isTodayBeforeMarketClose(dateString) {
  if (dateString !== hongKongDate()) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const minutes = Number(byType.hour) * 60 + Number(byType.minute);
  return minutes < 16 * 60;
}

function hongKongDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
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
