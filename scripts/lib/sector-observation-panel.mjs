export const SECTOR_OBSERVATION_WINDOW = 20;

export const SECTOR_OBSERVATION_STATUSES = Object.freeze({
  strengthening: "边际增强",
  maintain: "维持观察",
  weakening: "边际转弱",
  price_only: "仅价格异动",
  insufficient: "证据不足",
  exit: "退出观察"
});

const DIRECT_MAPPINGS = new Set(["direct_etf", "direct_index"]);
const POOL_NAMES_ZH = Object.freeze({
  a_share_ai_computer: "AI计算机",
  a_share_communication_electronics: "通信电子",
  a_share_semiconductor: "半导体",
  a_share_healthcare_pharma: "医药医疗",
  a_share_brokerage: "券商",
  a_share_bank_insurance: "银行保险",
  a_share_resources_materials: "资源材料",
  a_share_new_energy_ev: "新能源车",
  a_share_defense_military: "国防军工",
  a_share_consumer: "消费",
  a_share_real_estate_infra: "地产基建"
});

export function buildSectorObservationPanel({
  asOf,
  generatedAt,
  summary,
  instrumentMap,
  etfRows,
  benchmarkRows,
  archiveSummaries = [],
  breadthRows = [],
  breadthStatus = null,
  qualityReport = null
}) {
  const summaries = [
    ...(archiveSummaries ?? []),
    summary
  ]
    .filter((item) => item?.as_of && item.as_of <= asOf)
    .sort((a, b) => a.as_of.localeCompare(b.as_of))
    .filter((item, index, rows) => index === rows.findLastIndex((candidate) => candidate.as_of === item.as_of));
  const current = summaries.find((item) => item.as_of === asOf) ?? summary;
  const previous = summaries.filter((item) => item.as_of < asOf).at(-1) ?? null;
  const previousPrevious = previous
    ? summaries.filter((item) => item.as_of < previous.as_of).at(-1) ?? null
    : null;
  const dates = latestDates(etfRows, asOf, SECTOR_OBSERVATION_WINDOW);
  const mappingByPool = new Map((instrumentMap?.rows ?? []).map((row) => [row.pool_id, row]));
  const currentRows = current?.top_observation_pools ?? [];
  const previousRows = previous?.top_observation_pools ?? [];
  const previousPreviousRows = previousPrevious?.top_observation_pools ?? [];

  const rows = currentRows.map((candidate, index) => {
    const mapping = mappingByPool.get(candidate.pool_id) ?? {};
    const previousIndex = previousRows.findIndex((row) => row.pool_id === candidate.pool_id);
    const previousPreviousIndex = previousPreviousRows.findIndex((row) => row.pool_id === candidate.pool_id);
    const previousCandidate = previousIndex >= 0 ? previousRows[previousIndex] : null;
    const previousPreviousCandidate = previousPreviousIndex >= 0 ? previousPreviousRows[previousPreviousIndex] : null;
    const series = buildSeries({
      asOf,
      dates,
      sectorId: sectorIdFor(candidate, mapping),
      mapping,
      etfRows,
      benchmarkRows,
      breadthRows,
      breadthStatus
    });
    const status = classifyObservationStatus({
      candidate,
      previousCandidate,
      rank: index + 1,
      previousRank: previousIndex >= 0 ? previousIndex + 1 : null,
      series
    });
    const previousStatus = previousCandidate
      ? classifyObservationStatus({
          candidate: previousCandidate,
          previousCandidate: previousPreviousCandidate,
          rank: previousIndex + 1,
          previousRank: previousPreviousIndex >= 0 ? previousPreviousIndex + 1 : null,
          series: buildSeries({
            asOf: previous.as_of,
            dates: latestDates(etfRows, previous.as_of, SECTOR_OBSERVATION_WINDOW),
            sectorId: sectorIdFor(previousCandidate, mapping),
            mapping,
            etfRows,
            benchmarkRows,
            breadthRows,
            breadthStatus
          })
        })
      : null;
    return panelRow({
      candidate,
      mapping,
      rank: index + 1,
      previousRank: previousIndex >= 0 ? previousIndex + 1 : null,
      previousCandidate,
      status,
      previousStatus,
      series,
      isCurrent: true
    });
  });

  const currentIds = new Set(currentRows.map((row) => row.pool_id));
  const departures = previousRows
    .filter((candidate) => !currentIds.has(candidate.pool_id))
    .map((candidate, index) => {
      const mapping = mappingByPool.get(candidate.pool_id) ?? {};
      const previousRank = previousRows.findIndex((row) => row.pool_id === candidate.pool_id) + 1;
      return panelRow({
        candidate,
        mapping,
        rank: null,
        previousRank,
        previousCandidate: candidate,
        status: "exit",
        previousStatus: null,
        series: buildSeries({
          asOf,
          dates,
          sectorId: sectorIdFor(candidate, mapping),
          mapping,
          etfRows,
          benchmarkRows,
          breadthRows,
          breadthStatus
        }),
        isCurrent: false,
        departureOrder: index + 1
      });
    });

  const distinctStatuses = [...new Set(rows.map((row) => row.status))];
  const differentiation = distinctStatuses.length <= 1 && rows.length > 1
    ? {
        status: "insufficient",
        message: "当前模型区分度不足",
        distinct_statuses: distinctStatuses
      }
    : {
        status: "available",
        message: "状态由真实边际变化按规则区分",
        distinct_statuses: distinctStatuses
      };

  return {
    module_id: "sector_observation_panel_v1",
    as_of: asOf,
    generated_at: generatedAt,
    status: rows.length ? "panel_available" : "no_published_sectors",
    data_quality_summary: qualitySummary(qualityReport, breadthStatus),
    window: {
      target_trading_days: SECTOR_OBSERVATION_WINDOW,
      observed_dates: dates,
      observed_date_count: dates.length,
      complete: dates.length === SECTOR_OBSERVATION_WINDOW
    },
    field_definitions: fieldDefinitions(),
    status_rules: statusRules(),
    differentiation,
    rows,
    departures,
    boundary_notes: [
      "Rows preserve the published Top 10 order; this panel does not rescore or rerank sectors.",
      "Missing observations remain null and are never replaced with zero.",
      "Turnover activity requires 20 valid amount observations before amount / 20-day mean is published.",
      "Relative strength uses only exact-date ETF and CSI 300 benchmark closes.",
      "Internal breadth requires a source-backed constituent ratio; model direction and mock breadth are rejected.",
      "observe_only; not a buy list, return probability, or trading instruction."
    ]
  };
}

export function classifyObservationStatus({
  candidate,
  previousCandidate,
  rank,
  previousRank,
  series
}) {
  const score = finiteOrNull(candidate?.observation_score ?? candidate?.final_score);
  const previousScore = finiteOrNull(previousCandidate?.observation_score ?? previousCandidate?.final_score);
  const scoreDelta = score !== null && previousScore !== null ? score - previousScore : null;
  const rankDelta = Number.isInteger(rank) && Number.isInteger(previousRank) ? previousRank - rank : null;
  const latestPctChange = finiteOrNull(series?.price_strength?.latest_daily_change);
  const pricePoints = series?.price_strength?.available_points ?? 0;
  const mappingStatus = series?.mapping_status ?? null;

  if (score === null || pricePoints < 2 || !DIRECT_MAPPINGS.has(mappingStatus)) return "insufficient";

  const confirmations = confirmationCount(series, latestPctChange);
  if (
    latestPctChange !== null
    && Math.abs(latestPctChange) >= 2
    && confirmations === 0
    && (scoreDelta === null || Math.abs(scoreDelta) < 2.5)
    && (rankDelta === null || Math.abs(rankDelta) < 2)
  ) {
    return "price_only";
  }
  if ((scoreDelta !== null && scoreDelta <= -2.5) || (rankDelta !== null && rankDelta <= -2)) return "weakening";
  if ((scoreDelta !== null && scoreDelta >= 2.5) || (rankDelta !== null && rankDelta >= 2)) return "strengthening";
  return "maintain";
}

export function parseCsv(text) {
  const lines = String(text ?? "").trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function panelRow({
  candidate,
  mapping,
  rank,
  previousRank,
  previousCandidate,
  status,
  previousStatus,
  series,
  isCurrent
}) {
  const score = finiteOrNull(candidate?.observation_score ?? candidate?.final_score);
  const previousScore = finiteOrNull(previousCandidate?.observation_score ?? previousCandidate?.final_score);
  const scoreDelta = score !== null && previousScore !== null && isCurrent
    ? round(score - previousScore, 2)
    : null;
  const rankDelta = Number.isInteger(rank) && Number.isInteger(previousRank)
    ? previousRank - rank
    : null;
  const displayStatus = SECTOR_OBSERVATION_STATUSES[status];
  const statusChange = status === "exit"
    ? "退出当前观察序列"
    : previousStatus === null
      ? "新进入观察"
      : previousStatus === status
        ? "状态未变"
        : `${SECTOR_OBSERVATION_STATUSES[previousStatus]} → ${displayStatus}`;
  const name = POOL_NAMES_ZH[candidate.pool_id] ?? candidate.pool_name ?? mapping.pool_name ?? candidate.pool_id;
  return {
    pool_id: candidate.pool_id,
    sector_id: sectorIdFor(candidate, mapping),
    pool_name: name,
    instrument_code: mapping.instrument_code ?? null,
    mapping_status: mapping.mapping_status ?? "unmapped",
    is_current: isCurrent,
    rank,
    previous_rank: previousRank,
    rank_change: rankDelta,
    score,
    previous_score: isCurrent ? previousScore : null,
    score_change: scoreDelta,
    status,
    status_label: displayStatus,
    status_change: statusChange,
    model_state: candidate.candidate_state ?? null,
    conclusion: conclusionFor({
      name,
      status,
      scoreDelta,
      rankDelta,
      previousRank,
      series
    }),
    series,
    boundary: "observe_only; published order preserved; no synthetic values"
  };
}

function buildSeries({
  asOf,
  dates,
  sectorId,
  mapping,
  etfRows,
  benchmarkRows,
  breadthRows,
  breadthStatus
}) {
  const code = String(mapping.instrument_code ?? "");
  const exactRows = new Map(
    (etfRows ?? [])
      .filter((row) => dateFor(row) <= asOf && String(row.fund_code ?? "") === code)
      .map((row) => [dateFor(row), row])
  );
  const benchmarkByDate = new Map(
    (benchmarkRows ?? [])
      .filter((row) => dateFor(row) <= asOf)
      .map((row) => [dateFor(row), row])
  );
  const breadthByDate = new Map(
    (breadthRows ?? [])
      .filter((row) => dateFor(row) <= asOf && row.sector_id === sectorId && trustedBreadth(row))
      .map((row) => [dateFor(row), row])
  );
  const priceRows = dates.map((date) => ({ date, row: exactRows.get(date) ?? null }));
  const firstClose = priceRows.map(({ row }) => positiveOrNull(row?.close)).find((value) => value !== null) ?? null;
  const priceValues = priceRows.map(({ date, row }) => {
    const close = positiveOrNull(row?.close);
    return { date, value: close !== null && firstClose !== null ? round((close / firstClose - 1) * 100, 4) : null };
  });
  const amountValues = priceRows.map(({ date, row }) => ({ date, amount: positiveOrNull(row?.amount) }));
  const validAmounts = amountValues.map((row) => row.amount).filter((value) => value !== null);
  const amountMean = dates.length === SECTOR_OBSERVATION_WINDOW && validAmounts.length === SECTOR_OBSERVATION_WINDOW
    ? validAmounts.reduce((sum, value) => sum + value, 0) / SECTOR_OBSERVATION_WINDOW
    : null;
  const activityValues = amountValues.map(({ date, amount }) => ({
    date,
    value: amount !== null && amountMean !== null ? round(amount / amountMean, 4) : null
  }));
  const commonBase = priceRows
    .map(({ date, row }) => ({
      date,
      etf: positiveOrNull(row?.close),
      benchmark: positiveOrNull(benchmarkByDate.get(date)?.close)
    }))
    .find((row) => row.etf !== null && row.benchmark !== null) ?? null;
  const relativeValues = priceRows.map(({ date, row }) => {
    const etf = positiveOrNull(row?.close);
    const benchmark = positiveOrNull(benchmarkByDate.get(date)?.close);
    return {
      date,
      value: etf !== null && benchmark !== null && commonBase
        ? round(((etf / commonBase.etf) / (benchmark / commonBase.benchmark) - 1) * 100, 4)
        : null
    };
  });
  const breadthValues = dates.map((date) => ({
    date,
    value: ratioOrNull(
      breadthByDate.get(date)?.advancers_ratio
      ?? breadthByDate.get(date)?.breadth_ratio
      ?? breadthByDate.get(date)?.above_ma20_ratio
    )
  }));
  const latestSource = [...priceRows].reverse().find(({ row }) => row) ?? null;
  return {
    mapping_status: mapping.mapping_status ?? "unmapped",
    price_strength: seriesMetric({
      label: "价格强度",
      unit: "%",
      values: priceValues,
      requiredPoints: 2,
      latestDailyChange: finiteOrNull(latestSource?.row?.pct_change)
    }),
    turnover_activity: seriesMetric({
      label: "成交活跃度",
      unit: "x",
      values: activityValues,
      requiredPoints: SECTOR_OBSERVATION_WINDOW,
      missingReason: amountMean === null ? `积累中：${validAmounts.length}/${SECTOR_OBSERVATION_WINDOW}` : null,
      accumulating: amountMean === null
    }),
    relative_strength: seriesMetric({
      label: "相对沪深300",
      unit: "%",
      values: relativeValues,
      requiredPoints: SECTOR_OBSERVATION_WINDOW,
      missingReason: commonBase === null ? "缺少ETF与沪深300精确同日收盘价" : null
    }),
    internal_breadth: seriesMetric({
      label: breadthStatus?.display_label ?? "内部扩散",
      unit: "%",
      values: breadthValues,
      requiredPoints: 2,
      transformLatest: (value) => round(value * 100, 2),
      missingReason: breadthStatus?.reason ?? "尚未接入可信成分股数据源",
      sourceUnavailable: breadthStatus?.status !== "available"
    })
  };
}

function seriesMetric({
  label,
  unit,
  values,
  requiredPoints,
  latestDailyChange = undefined,
  transformLatest = (value) => value,
  missingReason = null,
  accumulating = false,
  sourceUnavailable = false
}) {
  const available = values.filter((point) => point.value !== null);
  const missingPointCount = values.length - available.length;
  return {
    label,
    unit,
    values,
    available_points: available.length,
    required_points: requiredPoints,
    status: available.length >= requiredPoints ? "available" : "insufficient_data",
    display_status: sourceUnavailable
      ? "source_unavailable"
      : accumulating ? "accumulating" : missingPointCount ? "missing_points" : "available",
    missing_point_count: missingPointCount,
    latest: available.length ? transformLatest(available.at(-1).value) : null,
    ...(latestDailyChange !== undefined ? { latest_daily_change: latestDailyChange } : {}),
    missing_reason: available.length >= requiredPoints ? null : missingReason ?? "有效样本不足"
  };
}

function confirmationCount(series, latestPctChange) {
  if (latestPctChange === null) return 0;
  const direction = Math.sign(latestPctChange);
  let count = 0;
  const relative = finiteOrNull(series?.relative_strength?.latest);
  if (relative !== null && Math.sign(relative) === direction && direction !== 0) count += 1;
  const activity = finiteOrNull(series?.turnover_activity?.latest);
  if (activity !== null && activity >= 1.05) count += 1;
  const breadth = finiteOrNull(series?.internal_breadth?.latest);
  if (breadth !== null && ((direction > 0 && breadth >= 55) || (direction < 0 && breadth <= 45))) count += 1;
  return count;
}

function conclusionFor({ name, status, scoreDelta, rankDelta, previousRank, series }) {
  const priceChange = finiteOrNull(series.price_strength.latest_daily_change);
  const relative = finiteOrNull(series.relative_strength.latest);
  if (status === "exit") {
    return `${name}已离开当前前 10，上一观察日排名第 ${previousRank ?? "—"}；不补位、不推断后续涨跌。`;
  }
  if (status === "insufficient") {
    return `${name}仅有 ${series.price_strength.available_points}/${SECTOR_OBSERVATION_WINDOW} 个可验证价格样本，当前证据不足以形成量价判断。`;
  }
  if (status === "price_only") {
    return `${name}最新价格变动${signed(priceChange, "%")}，但成交、相对强度或内部扩散尚未形成交叉确认。`;
  }
  if (status === "strengthening") {
    const change = scoreDelta !== null ? `综合分${signed(scoreDelta, "分")}` : `排名上升 ${Math.max(rankDelta ?? 0, 0)} 位`;
    return `${name}${change}；${confirmationText(series, priceChange)}。`;
  }
  if (status === "weakening") {
    const change = scoreDelta !== null ? `综合分${signed(scoreDelta, "分")}` : `排名下降 ${Math.abs(Math.min(rankDelta ?? 0, 0))} 位`;
    return `${name}${change}，最新价格变动${signed(priceChange, "%")}，边际证据转弱。`;
  }
  return `${name}综合分与排名未触发显著边际变化；${confirmationText(series, priceChange)}。`;
}

function fieldDefinitions() {
  return {
    price_strength: "近20个可验证交易日内，以窗口首个真实ETF收盘价为100基准计算的累计变化百分比；缺失日期保留null。",
    turnover_activity: "代表ETF当日成交额 / 最近20个真实成交额样本均值；样本不足20个时整条序列不可用。",
    relative_strength: "同一精确日期的ETF与沪深300收盘价归一化比值变化；缺少任一同日价格时该点为null。",
    internal_breadth: "行业上涨成分股比例或站上20日均线比例；只接受明确比例字段和可信来源。",
    score: "正式发布的综合观察分，不在面板内重新计算。",
    score_change: "当前综合观察分减去上一正式观察日同一行业综合分。",
    rank_change: "上一正式观察日排名减去当前排名；正数表示排名上升。",
    status_change: "按同一套状态规则计算的上一观察日状态与当前状态之差。"
  };
}

function statusRules() {
  return [
    { status: "边际增强", rule: "综合分增加至少2.5分，或排名上升至少2位。" },
    { status: "维持观察", rule: "证据可用，但综合分与排名均未达到增强或转弱阈值。" },
    { status: "边际转弱", rule: "综合分下降至少2.5分，或排名下降至少2位。" },
    { status: "仅价格异动", rule: "单日价格绝对变动至少2%，但成交、相对强度、内部扩散及模型边际变化均未确认。" },
    { status: "证据不足", rule: "缺少直接映射、综合分或至少2个真实价格样本。" },
    { status: "退出观察", rule: "上一观察日位于正式前10、当前不在正式前10。" }
  ];
}

function latestDates(rows, asOf, limit) {
  return [...new Set((rows ?? []).map(dateFor).filter((date) => date && date <= asOf))]
    .sort()
    .slice(-limit);
}

function sectorIdFor(candidate, mapping) {
  return String(candidate.sector_id ?? mapping.sector_id ?? candidate.pool_id ?? "").replace(/^a_share_/, "");
}

function trustedBreadth(row) {
  const ratio = ratioOrNull(row?.advancers_ratio ?? row?.breadth_ratio ?? row?.above_ma20_ratio);
  const source = String(row?.constituent_source ?? row?.source_provider ?? row?.source ?? "");
  const metadataComplete = Boolean(
    row?.constituent_source
    && row?.constituent_as_of
    && row?.composition_as_of
    && row?.price_source
    && Number.isInteger(row?.effective_count)
    && Number.isInteger(row?.total_count)
  );
  return ratio !== null
    && (metadataComplete || ["constituent_advancers_ratio", "constituent_above_ma20_ratio"].includes(row?.metric))
    && source
    && !/mock|fixture|manual|model/i.test(source);
}

function dateFor(row) {
  return String(row?.trade_date ?? row?.date ?? "");
}

function confirmationText(series, priceChange) {
  const scoreAndPrice = priceChange === null
    ? "评分变化已有，但该日价格缺失"
    : `评分与价格${priceChange >= 0 ? "增强" : "分化"}`;
  const turnover = series.turnover_activity?.status === "available"
    ? "量能已确认"
    : `量能${series.turnover_activity?.missing_reason ?? "尚未确认"}`;
  const breadth = series.internal_breadth?.status === "available"
    ? `${series.internal_breadth.label}已确认`
    : "内部扩散待接入";
  return `${scoreAndPrice}；${turnover}；${breadth}`;
}

function qualitySummary(quality, breadthStatus) {
  const alignmentCounts = (quality?.per_instrument ?? [])
    .map((item) => item.benchmark_alignment?.aligned_count ?? 0);
  const price = alignmentCounts.length ? Math.min(...alignmentCounts, SECTOR_OBSERVATION_WINDOW) : 0;
  const turnover = quality?.turnover_readiness?.minimum_count ?? 0;
  const alignment = quality?.benchmark_alignment?.minimum_count ?? 0;
  return {
    text: `价格 ${price}/${SECTOR_OBSERVATION_WINDOW}｜成交额 ${turnover}/${SECTOR_OBSERVATION_WINDOW}｜基准对齐 ${alignment}/${SECTOR_OBSERVATION_WINDOW}｜扩散${breadthStatus?.status === "available" ? "已接入" : "未接入"}`,
    price_count: price,
    turnover_count: turnover,
    benchmark_alignment_count: alignment,
    breadth_status: breadthStatus?.status ?? "unavailable",
    overall_status: quality?.overall_status ?? "unavailable"
  };
}

function positiveOrNull(value) {
  const number = finiteOrNull(value);
  return number !== null && number > 0 ? number : null;
}

function ratioOrNull(value) {
  const number = finiteOrNull(value);
  return number !== null && number >= 0 && number <= 1 ? number : null;
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function signed(value, suffix) {
  return value === null ? "数据不足" : `${value > 0 ? "+" : ""}${round(value, 2)}${suffix}`;
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}
