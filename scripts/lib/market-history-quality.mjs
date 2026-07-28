export const MARKET_HISTORY_TARGET = 60;
export const PANEL_WINDOW = 20;
export const REQUIRED_BAR_FIELDS = Object.freeze(["open", "high", "low", "close", "volume", "amount"]);

export function buildMarketHistoryQuality({
  asOf,
  etfRows,
  benchmarkRows,
  instruments,
  breadth = null,
  targetWindow = MARKET_HISTORY_TARGET
}) {
  const benchmarkDatesAll = uniqueSortedDates(
    benchmarkRows.filter((row) => codeFor(row) === "510300" && dateFor(row) <= asOf && validBar(row))
  );
  const expectedTradeDates = benchmarkDatesAll.slice(-targetWindow);
  const expectedSet = new Set(expectedTradeDates);
  const windowStart = expectedTradeDates[0] ?? null;
  const targetEnd = expectedTradeDates.at(-1) ?? null;
  const futureDates = uniqueSorted((etfRows.concat(benchmarkRows))
    .map(dateFor)
    .filter((date) => date && date > asOf));
  const instrumentCodes = [...new Set(instruments.map((item) => String(item.instrument_code ?? item.fund_code ?? "")))]
    .filter(Boolean)
    .sort();
  const perInstrument = instrumentCodes.map((instrumentCode) => {
    const raw = etfRows.filter((row) => codeFor(row) === instrumentCode);
    const duplicates = duplicateDates(raw);
    const nonTradingDates = uniqueSorted(raw
      .map(dateFor)
      .filter((date) => date && windowStart && date >= windowStart && date <= asOf && !expectedSet.has(date)));
    const pollutedDates = uniqueSorted(raw
      .filter((row) => expectedSet.has(dateFor(row)) && !validBar(row))
      .map(dateFor));
    const observedTradeDates = uniqueSortedDates(raw.filter((row) => expectedSet.has(dateFor(row)) && validBar(row)));
    const missingDates = expectedTradeDates.filter((date) => !observedTradeDates.includes(date));
    const latestDate = observedTradeDates.at(-1) ?? null;
    const alignmentDates = expectedTradeDates.slice(-PANEL_WINDOW)
      .filter((date) => observedTradeDates.includes(date));
    const amountDates = expectedTradeDates.slice(-PANEL_WINDOW)
      .filter((date) => raw.some((row) => dateFor(row) === date && positive(row.amount)));
    const hardFailure = duplicates.length || nonTradingDates.length || pollutedDates.length;
    return {
      instrument_code: instrumentCode,
      status: hardFailure
        ? "unavailable"
        : missingDates.length ? (observedTradeDates.length ? "partial" : "unavailable") : "complete",
      expected_trade_days: expectedTradeDates.length,
      observed_trade_days: observedTradeDates.length,
      coverage_ratio: expectedTradeDates.length ? round(observedTradeDates.length / expectedTradeDates.length) : 0,
      observed_trade_dates: observedTradeDates,
      missing_dates: missingDates,
      duplicated_dates: duplicates,
      non_trading_dates: nonTradingDates,
      polluted_dates: pollutedDates,
      latest_date: latestDate,
      stale: Boolean(targetEnd && latestDate !== targetEnd),
      benchmark_alignment: {
        target: PANEL_WINDOW,
        aligned_dates: alignmentDates,
        aligned_count: alignmentDates.length,
        status: alignmentDates.length === PANEL_WINDOW ? "complete" : alignmentDates.length ? "partial" : "unavailable"
      },
      turnover_readiness: {
        target: PANEL_WINDOW,
        amount_dates: amountDates,
        sample_count: amountDates.length,
        status: amountDates.length === PANEL_WINDOW ? "complete" : amountDates.length ? "partial" : "unavailable"
      }
    };
  });
  const duplicatedDates = uniqueSorted(perInstrument.flatMap((item) => item.duplicated_dates));
  const nonTradingDates = uniqueSorted(perInstrument.flatMap((item) => item.non_trading_dates));
  const pollutedDates = uniqueSorted(perInstrument.flatMap((item) => item.polluted_dates));
  const staleInstruments = perInstrument.filter((item) => item.stale).map((item) => item.instrument_code);
  const missingDates = uniqueSorted(perInstrument.flatMap((item) => item.missing_dates));
  const hardFailures = [
    ...(duplicatedDates.length ? ["duplicated_dates"] : []),
    ...(futureDates.length ? ["future_dates"] : []),
    ...(nonTradingDates.length ? ["non_trading_dates"] : []),
    ...(pollutedDates.length ? ["field_pollution"] : [])
  ];
  const complete = expectedTradeDates.length === targetWindow
    && perInstrument.length > 0
    && perInstrument.every((item) => item.status === "complete")
    && hardFailures.length === 0
    && breadth?.status === "available";
  const observedTradeDates = uniqueSorted(perInstrument.flatMap((item) => item.observed_trade_dates));
  return {
    module_id: "market_history_quality_v0_10_77",
    as_of: asOf,
    target_window: targetWindow,
    expected_trade_dates: expectedTradeDates,
    observed_trade_dates: observedTradeDates,
    missing_dates: missingDates,
    duplicated_dates: duplicatedDates,
    future_dates: futureDates,
    non_trading_dates: nonTradingDates,
    polluted_dates: pollutedDates,
    stale_instruments: staleInstruments,
    per_instrument: perInstrument,
    benchmark_alignment: aggregateReadiness(perInstrument, "benchmark_alignment"),
    turnover_readiness: aggregateReadiness(perInstrument, "turnover_readiness"),
    breadth_readiness: breadthReadiness(breadth),
    hard_failures: hardFailures,
    overall_status: complete ? "complete" : expectedTradeDates.length && perInstrument.some((item) => item.observed_trade_days)
      ? "partial"
      : "unavailable",
    boundary: "quality-only; no score/rank changes; missing values remain null"
  };
}

export function validateMarketHistoryQuality(report) {
  return report?.module_id === "market_history_quality_v0_10_77"
    && ["complete", "partial", "unavailable"].includes(report.overall_status)
    && Number.isInteger(report.target_window)
    && Array.isArray(report.expected_trade_dates)
    && Array.isArray(report.observed_trade_dates)
    && Array.isArray(report.missing_dates)
    && Array.isArray(report.duplicated_dates)
    && Array.isArray(report.future_dates)
    && Array.isArray(report.non_trading_dates)
    && Array.isArray(report.stale_instruments)
    && Array.isArray(report.per_instrument)
    && report.per_instrument.every((item) => (
      Boolean(item.instrument_code)
      && ["complete", "partial", "unavailable"].includes(item.status)
      && Array.isArray(item.missing_dates)
      && Array.isArray(item.duplicated_dates)
      && Array.isArray(item.non_trading_dates)
      && Number.isInteger(item.observed_trade_days)
    ))
    && Boolean(report.benchmark_alignment)
    && Boolean(report.turnover_readiness)
    && Boolean(report.breadth_readiness);
}

function aggregateReadiness(items, key) {
  const sampleCounts = items.map((item) => item[key].sample_count ?? item[key].aligned_count ?? 0);
  const minimum = sampleCounts.length ? Math.min(...sampleCounts) : 0;
  return {
    target: PANEL_WINDOW,
    minimum_count: minimum,
    complete_instruments: items.filter((item) => item[key].status === "complete").length,
    total_instruments: items.length,
    status: items.length && items.every((item) => item[key].status === "complete")
      ? "complete"
      : items.some((item) => item[key].status !== "unavailable") ? "partial" : "unavailable"
  };
}

function breadthReadiness(breadth) {
  if (!breadth || breadth.status !== "available") {
    return {
      status: "unavailable",
      reason: breadth?.reason ?? "尚未接入可信成分股数据源",
      source_kind: null,
      available_sectors: 0
    };
  }
  return {
    status: "complete",
    reason: null,
    source_kind: breadth.source_kind,
    available_sectors: breadth.rows?.length ?? 0
  };
}

function duplicateDates(rows) {
  const counts = new Map();
  rows.map(dateFor).filter(Boolean).forEach((date) => counts.set(date, (counts.get(date) ?? 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1).map(([date]) => date).sort();
}

function uniqueSortedDates(rows) {
  return uniqueSorted(rows.map(dateFor).filter(Boolean));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function dateFor(row) {
  return String(row?.trade_date ?? row?.date ?? "");
}

function codeFor(row) {
  return String(row?.instrument_code ?? row?.fund_code ?? row?.symbol ?? "");
}

function validBar(row) {
  return REQUIRED_BAR_FIELDS.every((field) => positive(row?.[field]))
    && Number(row.low) <= Math.min(Number(row.open), Number(row.close))
    && Math.max(Number(row.open), Number(row.close)) <= Number(row.high);
}

function positive(value) {
  if (value === null || value === undefined || value === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function round(value) {
  return Number(value.toFixed(4));
}
