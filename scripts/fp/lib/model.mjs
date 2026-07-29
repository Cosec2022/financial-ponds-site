import {
  COMMAND_CONTRACT_VERSION,
  DIRECTION_FORMULA,
  MODEL_VERSION,
  SCHEMA_VERSION,
  THRESHOLDS
} from "./contracts.mjs";

const POSITIVE_STATES = new Set(["watch_candidate", "major_candidate", "confirmed_trend"]);
const DIRECT_MAPPINGS = new Set(["direct_etf", "direct_index"]);

export function canonicalPoolId(value) {
  let id = String(value ?? "").trim().toLowerCase().replaceAll("-", "_");
  while (id.startsWith("a_share_a_share_")) id = id.replace(/^a_share_a_share_/, "a_share_");
  return id === "a_share_a_share" ? "a_share" : id;
}

export function assertUniqueCanonical(rows) {
  const seen = new Map();
  for (const row of rows) {
    const canonical = canonicalPoolId(row.pool_id);
    if (seen.has(canonical)) {
      throw new Error(`Duplicate canonical identity: ${seen.get(canonical)} and ${row.pool_id} -> ${canonical}`);
    }
    seen.set(canonical, row.pool_id);
  }
  return rows;
}

export function normalizeInputs({ asOf, etfRows, benchmarkRows, breadth, inputSnapshotId }) {
  const future = [...etfRows, ...benchmarkRows].filter((row) => dateFor(row) > asOf);
  if (future.length) throw new Error(`Future market data rejected: ${dateFor(future[0])} > ${asOf}`);

  const exactEtf = etfRows
    .filter((row) => dateFor(row) <= asOf && row.sector_id && row.fund_code)
    .map(normalizeMarketRow);
  const exactBenchmark = benchmarkRows
    .filter((row) => dateFor(row) <= asOf)
    .map(normalizeMarketRow);

  const latestBySector = new Map();
  for (const row of exactEtf) {
    const current = latestBySector.get(row.sector_id);
    if (!current || row.date > current.date || (row.date === current.date && row.fund_code < current.fund_code)) {
      latestBySector.set(row.sector_id, row);
    }
  }
  const universe = [...latestBySector.values()]
    .map((row) => ({
      pool_id: `a_share_${row.sector_id}`,
      sector_id: row.sector_id,
      etf_symbol: row.fund_code,
      etf_name: row.fund_name,
      mapping_status: "direct_etf",
      mapping_source: "committed representative ETF OHLCVA history"
    }))
    .sort((a, b) => a.pool_id.localeCompare(b.pool_id));
  assertUniqueCanonical(universe);
  if (!universe.length) throw new Error("Canonical representative ETF universe is empty");

  const latestEtfDate = maxDate(exactEtf);
  const latestBenchmarkDate = maxDate(exactBenchmark);
  return {
    schema_version: SCHEMA_VERSION,
    model_version: MODEL_VERSION,
    command_contract_version: COMMAND_CONTRACT_VERSION,
    as_of: asOf,
    input_snapshot_id: inputSnapshotId,
    universe,
    etf_rows: exactEtf,
    benchmark_rows: exactBenchmark,
    breadth: breadth ?? { status: "unavailable", rows: [], reason: "source-backed breadth unavailable" },
    alignment: {
      latest_etf_date: latestEtfDate,
      latest_benchmark_date: latestBenchmarkDate,
      exact_date_valid: latestEtfDate === asOf && latestBenchmarkDate === asOf
    }
  };
}

export function buildObservations(normalized) {
  const benchmarkByDate = new Map(normalized.benchmark_rows.map((row) => [row.date, row]));
  const breadthByPool = new Map((normalized.breadth?.rows ?? []).map((row) => [`${row.date}|${canonicalPoolId(row.pool_id ?? `a_share_${row.sector_id}`)}`, row]));
  const rows = normalized.universe.map((pool) => {
    const series = normalized.etf_rows
      .filter((row) => row.fund_code === pool.etf_symbol)
      .sort((a, b) => a.date.localeCompare(b.date));
    const exact = series.filter((row) => benchmarkByDate.has(row.date));
    const latest = series.at(-1) ?? null;
    const last20 = series.slice(-20);
    const last5 = series.slice(-5);
    const amount20 = mean(last20.map((row) => row.amount));
    const amount5 = mean(last5.map((row) => row.amount));
    const turnoverRatio = amount20 && amount5 ? amount5 / amount20 : null;
    const breadthRow = breadthByPool.get(`${normalized.as_of}|${pool.pool_id}`) ?? null;
    return {
      pool_id: pool.pool_id,
      etf_symbol: pool.etf_symbol,
      etf_name: pool.etf_name,
      as_of: normalized.as_of,
      channels: {
        price: channel({
          value: latest?.close ?? null,
          source: "representative_etf_ohlcva",
          sourceDate: latest?.date ?? null,
          coverage: Math.min(series.length / 21, 1),
          missingReason: series.length >= 21 ? null : "fewer than 21 exact ETF sessions"
        }),
        relative_strength: channel({
          value: exact.length >= 21 ? 1 : null,
          source: "exact_date_csi300_proxy",
          sourceDate: exact.at(-1)?.date ?? null,
          coverage: Math.min(exact.length / 21, 1),
          missingReason: exact.length >= 21 ? null : "fewer than 21 exact ETF/benchmark sessions"
        }),
        turnover: channel({
          value: finite(turnoverRatio),
          source: "mean_amount_5_over_mean_amount_20",
          sourceDate: latest?.date ?? null,
          coverage: Math.min(last20.filter((row) => row.amount !== null).length / 20, 1),
          missingReason: turnoverRatio === null ? "insufficient amount history" : null,
          formula: "mean(amount, latest 5 sessions) / mean(amount, latest 20 sessions)"
        }),
        direct_flow: channel({
          value: null,
          source: null,
          sourceDate: null,
          coverage: 0,
          missingReason: "independent ETF share-flow history unavailable"
        }),
        breadth: channel({
          value: finite(breadthRow?.advancers_ratio ?? breadthRow?.breadth_ratio ?? breadthRow?.above_ma20_ratio),
          source: breadthRow?.source_provider ?? null,
          sourceDate: breadthRow ? dateFor(breadthRow) : null,
          coverage: breadthRow ? 1 : 0,
          missingReason: breadthRow ? null : normalized.breadth?.reason ?? "source-backed breadth unavailable"
        }),
        risk: channel({
          value: latest?.pct_change ?? null,
          source: "representative_etf_ohlcva",
          sourceDate: latest?.date ?? null,
          coverage: latest ? 1 : 0,
          missingReason: latest ? null : "latest ETF row unavailable"
        }),
        news_policy_events: channel({
          value: null,
          source: null,
          sourceDate: null,
          coverage: 0,
          missingReason: "narrative is handled by penetration and cannot alter hard fields"
        })
      },
      price_series: series,
      benchmark_series: exact.map((row) => benchmarkByDate.get(row.date))
    };
  });
  return envelope(normalized, {
    schema_version: "fp-observations-v1",
    rows,
    coverage: {
      canonical_universe_count: rows.length,
      degraded_channels: degradedChannels(rows)
    }
  });
}

export function assessObservations(observations, previousAssessments = []) {
  const previousByPool = new Map((previousAssessments ?? []).map((row) => [row.pool_id, row]));
  const rows = observations.rows.map((observation) => {
    const metrics = directionMetrics(observation.price_series, observation.benchmark_series);
    const direction = directionFromMetrics(metrics);
    const turnoverRatio = observation.channels.turnover.value;
    const turnoverScore = turnoverConfirmation(turnoverRatio);
    const confirmationCoverage = coverageFraction([
      turnoverRatio,
      observation.channels.breadth.value,
      observation.channels.direct_flow.value
    ]);
    const confirmationScore = turnoverScore;
    const evidenceScore = evidenceFrom(observation);
    const evidenceLevel = evidenceLevelFor(evidenceScore);
    const persistenceSessions = positivePersistence(observation.price_series, observation.benchmark_series);
    const riskOverlays = riskFrom(metrics, observation.price_series);
    const previous = previousByPool.get(observation.pool_id) ?? null;
    const conflict = metrics.price_direction !== null
      && metrics.relative_direction !== null
      && Math.sign(metrics.price_direction) !== Math.sign(metrics.relative_direction)
      && Math.abs(metrics.price_direction - metrics.relative_direction) >= THRESHOLDS.direction.material_conflict;
    const exactDateValid = observation.as_of === observation.channels.price.source_date
      && observation.as_of === observation.channels.relative_strength.source_date;
    const structureState = structureStateFor({
      directionScore: direction,
      confirmationScore,
      confirmationCoverage,
      evidenceScore,
      persistenceSessions,
      riskOverlays,
      conflict,
      oneDayReturn: metrics.return_1,
      metrics,
      previous,
      exactDateValid
    });
    const marginal = marginalChangeFor({ direction, metrics, previous, structureState, conflict });
    return {
      pool_id: observation.pool_id,
      etf_symbol: observation.etf_symbol,
      etf_name: observation.etf_name,
      guidance_as_of: observation.as_of,
      direction_score: direction,
      direction_components: metrics,
      confirmation_score: confirmationScore,
      confirmation_coverage: confirmationCoverage,
      confirmation_components: {
        turnover_activity_ratio: turnoverRatio,
        turnover_confirmation: turnoverScore,
        confirmation_direction: direction === null ? null : direction >= 0 ? "positive" : "negative",
        breadth: observation.channels.breadth.value,
        direct_flow: observation.channels.direct_flow.value
      },
      evidence_score: evidenceScore,
      evidence_level: evidenceLevel,
      evidence_components: evidenceComponents(observation),
      structure_state: structureState,
      marginal_change: marginal.value,
      marginal_components: marginal.components,
      direction_change: previous?.direction_score === null || previous?.direction_score === undefined || direction === null
        ? null
        : round(direction - previous.direction_score),
      persistence_sessions: persistenceSessions,
      risk_overlays: riskOverlays,
      material_conflict: conflict,
      exact_date_valid: exactDateValid,
      data_limitations: limitationsFor(observation),
      model_version: MODEL_VERSION,
      input_snapshot_id: observations.input_snapshot_id,
      direction_formula: DIRECTION_FORMULA
    };
  });
  assertUniqueCanonical(rows);
  return envelope(observations, {
    schema_version: "sector-assessment-v1",
    artifact_role: "official_structural_source_of_truth",
    rows
  });
}

export function decideEntries(assessment) {
  const rows = assessment.rows.map((row) => {
    const entryState = entryStateFor(row);
    const invalidation = invalidationFor(row);
    return {
      etf_symbol: row.etf_symbol,
      etf_name: row.etf_name,
      pool_id: row.pool_id,
      guidance_as_of: assessment.as_of,
      valid_until: "next_published_trading_session",
      review_due: "T+1,T+3,T+5,T+20",
      structure_state: row.structure_state,
      entry_state: entryState,
      direction_score: row.direction_score,
      direction_components: row.direction_components,
      confirmation_score: row.confirmation_score,
      confirmation_coverage: row.confirmation_coverage,
      confirmation_components: row.confirmation_components,
      evidence_score: row.evidence_score,
      evidence_level: row.evidence_level,
      persistence_sessions: row.persistence_sessions,
      risk_overlays: row.risk_overlays,
      material_conflict: row.material_conflict,
      exact_date_valid: row.exact_date_valid,
      thesis: thesisFor(row, entryState),
      supporting_evidence: supportFor(row),
      contrary_evidence: contraryFor(row),
      next_confirmation: nextFor(row),
      invalidation,
      data_limitations: row.data_limitations,
      selection_dimensions: selectionDimensions(row, entryState, invalidation),
      model_version: MODEL_VERSION,
      input_snapshot_id: assessment.input_snapshot_id
    };
  });
  const selection = selectCandidates(rows);
  return envelope(assessment, {
    schema_version: "entry-decision-v1",
    artifact_role: "official_entry_decision_source_of_truth",
    boundary: {
      mode: "decision_support",
      horizon: "medium_term_10_20_sessions",
      automated_execution: false,
      human_confirmation_required: true
    },
    ...selection,
    rows
  });
}

export function selectCandidates(rows) {
  const eligible = rows.filter((row) => ["ready_now", "probe_only"].includes(row.entry_state)
    && !["insufficient", "deteriorating", "conflict_review", "avoid"].includes(row.structure_state)
    && row.risk_overlays.risk_gate !== "block"
    && row.exact_date_valid !== false
    && row.invalidation.length > 0);
  const remaining = [...eligible];
  const primary = uniqueBest(remaining);
  if (primary) remaining.splice(remaining.indexOf(primary), 1);
  const secondary = uniqueBest(remaining);
  return {
    primary_entry_candidate: primary ? candidateSummary(primary) : null,
    secondary_entry_candidate: secondary ? candidateSummary(secondary) : null,
    probe_only_candidates: rows.filter((row) => row.entry_state === "probe_only").map(candidateSummary),
    waiting_candidates: rows.filter((row) => row.entry_state === "wait_confirmation").map(candidateSummary),
    wait_pullback_candidates: rows.filter((row) => row.entry_state === "wait_pullback").map(candidateSummary),
    do_not_chase_candidates: rows.filter((row) => row.entry_state === "do_not_chase").map(candidateSummary),
    invalid_candidates: rows.filter((row) => row.entry_state === "invalid").map(candidateSummary),
    no_qualified_candidate: eligible.length === 0,
    selection_note: eligible.length === 0
      ? "No ETF passed elimination and entry-eligibility gates; no candidate was forced."
      : primary
        ? "Primary/secondary selection uses persisted entry dimensions after elimination; no universe rank is generated."
        : "Eligible assessments are tied on all decision dimensions; no arbitrary primary was forced."
  };
}

export function validateOfficialArtifacts({ manifest, assessment, decision, penetration, review }) {
  const required = { assessment, decision, penetration, review };
  const dates = new Set(Object.values(required).map((item) => item?.as_of));
  const models = new Set([assessment?.model_version, decision?.model_version].filter(Boolean));
  const snapshots = new Set([assessment?.input_snapshot_id, decision?.input_snapshot_id].filter(Boolean));
  if (dates.size !== 1 || dates.has(undefined)) throw new Error(`Mixed or absent as_of dates: ${[...dates].join(",")}`);
  if (models.size !== 1 || snapshots.size !== 1) throw new Error("Mixed model versions or input snapshots");
  if (manifest.status !== "validated") throw new Error("Manifest status must be validated");
  if (manifest.as_of !== assessment.as_of) throw new Error("Manifest date differs from official artifacts");
  if (assessment.rows.length === 0 || assessment.rows.length !== decision.rows.length) throw new Error("Official full-universe row counts differ");
  assertUniqueCanonical(assessment.rows);
  assertUniqueCanonical(decision.rows);
  if (assessment.rows.some((row) => "rank" in row || "observation_score" in row)) throw new Error("Legacy score/rank leaked into official structural artifact");
  if (decision.rows.some((row) => "rank" in row || "observation_score" in row)) throw new Error("Legacy score/rank leaked into official decision artifact");
  if (decision.primary_entry_candidate && !["ready_now", "probe_only"].includes(decision.primary_entry_candidate.entry_state)) {
    throw new Error("Primary candidate is not entry eligible");
  }
  return true;
}

function directionMetrics(etf, benchmark) {
  const aligned = etf.map((row, index) => ({ etf: row, benchmark: benchmark[index] }))
    .filter((item) => item.benchmark?.date === item.etf.date);
  const closes = aligned.map((item) => item.etf.close);
  const benchmarkCloses = aligned.map((item) => item.benchmark.close);
  const daily = returns(closes);
  const dailyVol = stddev(daily.slice(-20));
  const return5 = periodReturn(closes, 5);
  const return20 = periodReturn(closes, 20);
  const benchmark5 = periodReturn(benchmarkCloses, 5);
  const benchmark20 = periodReturn(benchmarkCloses, 20);
  const excess5 = return5 === null || benchmark5 === null ? null : return5 - benchmark5;
  const excess20 = return20 === null || benchmark20 === null ? null : return20 - benchmark20;
  const risk5 = riskAdjust(return5, dailyVol, 5);
  const risk20 = riskAdjust(return20, dailyVol, 20);
  const riskExcess5 = riskAdjust(excess5, dailyVol, 5);
  const riskExcess20 = riskAdjust(excess20, dailyVol, 20);
  const priceDirection = normalize(weighted(risk20, risk5));
  const relativeDirection = normalize(weighted(riskExcess20, riskExcess5));
  return {
    return_1: daily.at(-1) === undefined ? null : round(daily.at(-1) * 100),
    return_5: pctValue(return5),
    return_20: pctValue(return20),
    benchmark_return_5: pctValue(benchmark5),
    benchmark_return_20: pctValue(benchmark20),
    excess_return_5: pctValue(excess5),
    excess_return_20: pctValue(excess20),
    daily_volatility: pctValue(dailyVol),
    risk_adjusted_return_5: finite(risk5),
    risk_adjusted_return_20: finite(risk20),
    risk_adjusted_excess_5: finite(riskExcess5),
    risk_adjusted_excess_20: finite(riskExcess20),
    price_direction: finite(priceDirection),
    relative_direction: finite(relativeDirection)
  };
}

function directionFromMetrics(metrics) {
  if (metrics.price_direction === null || metrics.relative_direction === null) return null;
  return round(clamp(0.6 * metrics.price_direction + 0.4 * metrics.relative_direction, -100, 100));
}

function structureStateFor(input) {
  const { directionScore, confirmationScore, confirmationCoverage, evidenceScore, persistenceSessions, riskOverlays, conflict, oneDayReturn, metrics, previous, exactDateValid } = input;
  if (!exactDateValid || directionScore === null || evidenceScore < THRESHOLDS.evidence.insufficient) return "insufficient";
  if (riskOverlays.risk_gate === "block") return "avoid";
  if (conflict) return "conflict_review";
  const mediumAgreement = metrics.price_direction !== null && metrics.relative_direction !== null
    && Math.sign(metrics.price_direction) === Math.sign(metrics.relative_direction);
  if (directionScore <= THRESHOLDS.direction.deteriorating
    || (POSITIVE_STATES.has(previous?.structure_state) && directionScore < 0)) return "deteriorating";
  if (Math.abs(oneDayReturn ?? 0) >= THRESHOLDS.risk.daily_move_pct
    && (!mediumAgreement || confirmationScore < 50)) return "price_only";
  if (POSITIVE_STATES.has(previous?.structure_state)
    && directionScore > 0
    && ((previous.direction_score ?? directionScore) - directionScore >= 15
      || (previous.confirmation_score ?? confirmationScore) - confirmationScore >= 20)) return "cooling";
  if (directionScore >= THRESHOLDS.direction.confirmed
    && confirmationScore >= THRESHOLDS.confirmation.confirmed
    && confirmationCoverage >= THRESHOLDS.confirmation.full_coverage
    && persistenceSessions >= 3) return "confirmed_trend";
  if (directionScore >= THRESHOLDS.direction.major && mediumAgreement && confirmationCoverage > 0 && persistenceSessions >= 2) return "major_candidate";
  if (directionScore >= THRESHOLDS.direction.watch) return "watch_candidate";
  return directionScore < 0 ? "deteriorating" : "watch_candidate";
}

function marginalChangeFor({ direction, metrics, previous, structureState, conflict }) {
  if (direction === null) return { value: "insufficient", components: [] };
  if (structureState === "price_only") return { value: "price_only", components: [] };
  if (!previous) return { value: "unchanged", components: [] };
  const components = [
    deltaComponent("price_direction", metrics.price_direction, previous.direction_components?.price_direction),
    deltaComponent("relative_direction", metrics.relative_direction, previous.direction_components?.relative_direction),
    deltaComponent("confirmation", null, null)
  ].filter(Boolean);
  const directionDelta = direction - previous.direction_score;
  const improving = components.filter((item) => item.change > 0).length;
  const deteriorating = components.filter((item) => item.change < 0).length;
  if (directionDelta >= THRESHOLDS.direction.marginal_change && improving >= 2 && !conflict) return { value: "strengthening", components };
  if (directionDelta <= -THRESHOLDS.direction.marginal_change && deteriorating >= 2) return { value: "weakening", components };
  if (previous.structure_state !== structureState) {
    const positive = ["watch_candidate", "major_candidate", "confirmed_trend"];
    return { value: positive.indexOf(structureState) > positive.indexOf(previous.structure_state) ? "state_upgrade" : "state_downgrade", components };
  }
  return { value: "unchanged", components };
}

function evidenceComponents(observation) {
  const priceCoverage = observation.channels.price.coverage;
  const benchmarkCoverage = observation.channels.relative_strength.coverage;
  const turnoverCoverage = observation.channels.turnover.coverage;
  return {
    direct_mapping: DIRECT_MAPPINGS.has("direct_etf") ? 25 : 0,
    price_history: round(priceCoverage * 25),
    exact_date_benchmark: round(benchmarkCoverage * 20),
    turnover_history: round(turnoverCoverage * 15),
    source_backed_breadth: observation.channels.breadth.value === null ? 0 : 15
  };
}

function evidenceFrom(observation) {
  return round(Object.values(evidenceComponents(observation)).reduce((sum, value) => sum + value, 0));
}

function evidenceLevelFor(score) {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  if (score >= 40) return "low";
  return "insufficient";
}

function riskFrom(metrics, series) {
  const dailyVol = (metrics.daily_volatility ?? 0) / 100;
  const return5 = (metrics.return_5 ?? 0) / 100;
  const extension = dailyVol > 0 ? return5 / (dailyVol * Math.sqrt(5)) : null;
  const latest = series.at(-1);
  const invalidationDistance = latest?.close && series.length >= 11
    ? (latest.close / Math.min(...series.slice(-10).map((row) => row.low ?? row.close)) - 1) * 100
    : null;
  const severe = extension !== null && extension >= THRESHOLDS.risk.severe_extension;
  return {
    risk_gate: severe ? "caution" : "pass",
    extension_z: finite(extension),
    overheated: extension !== null && extension >= THRESHOLDS.risk.extended,
    severe_overheat: severe,
    invalidation_distance_pct: finite(invalidationDistance),
    volatility_20_pct: metrics.daily_volatility
  };
}

function entryStateFor(row) {
  if (!row.exact_date_valid || row.evidence_level === "insufficient"
    || ["insufficient", "deteriorating", "conflict_review", "avoid", "price_only"].includes(row.structure_state)
    || row.risk_overlays.risk_gate === "block") return "invalid";
  if (row.risk_overlays.severe_overheat) return "do_not_chase";
  if (row.risk_overlays.overheated && ["major_candidate", "confirmed_trend"].includes(row.structure_state)) return "wait_pullback";
  const formal = ["major_candidate", "confirmed_trend"].includes(row.structure_state)
    && row.direction_score >= 30
    && row.confirmation_score >= THRESHOLDS.confirmation.entry
    && row.evidence_score >= THRESHOLDS.evidence.entry;
  if (formal && row.confirmation_coverage >= THRESHOLDS.confirmation.full_coverage
    && row.confirmation_components.direct_flow !== null) return "ready_now";
  if (formal && row.risk_overlays.risk_gate === "pass") return "probe_only";
  return "wait_confirmation";
}

function thesisFor(row, entryState) {
  if (entryState === "invalid") return "当前结构或数据合同未通过，买入论点不成立。";
  if (entryState === "wait_pullback") return "中期结构保持正向，但短期延伸削弱当前入场质量。";
  if (entryState === "do_not_chase") return "短期过热使收益风险不对称，不宜追入。";
  if (entryState === "probe_only") return "中期方向可信且风险有界，但确认渠道不完整，只适合试探仓评估。";
  if (entryState === "ready_now") return "方向、确认、证据与风险闸门共同通过，可进入人工买入评估。";
  return "方向偏正但确认、覆盖或持续性尚不足，需要继续等待。";
}

function supportFor(row) {
  const items = [];
  if (row.direction_score > 0) items.push(`签名中期方向为正（${row.direction_score}）。`);
  if ((row.direction_components.excess_return_20 ?? 0) > 0) items.push(`20日相对沪深300超额为正（${row.direction_components.excess_return_20}%）。`);
  if (row.confirmation_components.turnover_activity_ratio >= 1) items.push(`近5日平均成交额为自身20日均值的${round(row.confirmation_components.turnover_activity_ratio)}倍。`);
  if (row.persistence_sessions >= 2) items.push(`正向结构已持续${row.persistence_sessions}个可观察会话。`);
  if (row.risk_overlays.risk_gate === "pass") items.push("风险闸门通过。");
  return items.length ? items : ["没有足够的正向硬证据。"];
}

function contraryFor(row) {
  const items = [];
  if (row.confirmation_components.breadth === null) items.push("缺少来源可验证的内部扩散数据。");
  if (row.confirmation_components.direct_flow === null) items.push("缺少独立ETF份额流历史。");
  if (row.confirmation_components.turnover_activity_ratio < 1) items.push("近5日平均成交额低于自身20日均值，量能未确认。");
  if (row.material_conflict) items.push("价格方向与相对强度存在实质冲突。");
  if (row.risk_overlays.overheated) items.push("短期延伸已进入过热区间。");
  return items.length ? items : ["当前未发现实质性反向证据。"];
}

function nextFor(row) {
  const items = [];
  if (row.confirmation_components.turnover_activity_ratio < 1) items.push("近5日平均成交额回升至自身20日均值以上。");
  if (row.confirmation_components.breadth === null) items.push("接入来源可验证的成分股扩散数据。");
  if (row.confirmation_components.direct_flow === null) items.push("取得独立ETF份额流确认。");
  if (row.persistence_sessions < 3) items.push("正向方向继续保持至至少3个观察会话。");
  if (row.risk_overlays.overheated) items.push("短期延伸回落至过热阈值以下且结构不破坏。");
  return items.length ? items : ["下一交易会话重新验证方向、确认与风险闸门。"];
}

function invalidationFor(row) {
  const items = ["direction_score跌破0。", "20日相对沪深300超额持续转负。"];
  if (row.risk_overlays.invalidation_distance_pct !== null) {
    items.push(`代表ETF跌破近10会话低点（当前距离约${row.risk_overlays.invalidation_distance_pct}%）。`);
  }
  return items;
}

function selectionDimensions(row, entryState, invalidation) {
  return {
    entry_quality: entryState === "ready_now" ? 2 : entryState === "probe_only" ? 1 : 0,
    structural_persistence: row.persistence_sessions,
    signed_relative_strength: row.direction_components.relative_direction,
    confirmation_completeness: row.confirmation_coverage,
    distance_from_overheat: row.risk_overlays.extension_z === null ? null : round(THRESHOLDS.risk.severe_extension - row.risk_overlays.extension_z),
    invalidation_distance: row.risk_overlays.invalidation_distance_pct,
    evidence_trust: row.evidence_score,
    measurable_invalidation: invalidation.length > 0
  };
}

function uniqueBest(rows) {
  if (!rows.length) return null;
  const sorted = [...rows].sort(compareDimensions);
  return sorted.length > 1 && compareDimensions(sorted[0], sorted[1]) === 0 ? null : sorted[0];
}

function compareDimensions(a, b) {
  const keys = ["entry_quality", "structural_persistence", "signed_relative_strength", "confirmation_completeness", "distance_from_overheat", "invalidation_distance", "evidence_trust"];
  for (const key of keys) {
    const left = Number(a.selection_dimensions[key] ?? -Infinity);
    const right = Number(b.selection_dimensions[key] ?? -Infinity);
    if (left !== right) return right - left;
  }
  return 0;
}

function candidateSummary(row) {
  return {
    pool_id: row.pool_id,
    etf_symbol: row.etf_symbol,
    etf_name: row.etf_name,
    structure_state: row.structure_state,
    entry_state: row.entry_state,
    thesis: row.thesis,
    selection_dimensions: row.selection_dimensions
  };
}

function positivePersistence(etf, benchmark) {
  let count = 0;
  const max = Math.min(etf.length, benchmark.length);
  for (let offset = 0; offset < Math.min(10, max - 20); offset += 1) {
    const end = max - offset;
    const metrics = directionMetrics(etf.slice(0, end), benchmark.slice(0, end));
    const direction = directionFromMetrics(metrics);
    if (direction !== null && direction >= THRESHOLDS.direction.watch) count += 1;
    else break;
  }
  return count;
}

function turnoverConfirmation(value) {
  if (value === null) return 0;
  if (value >= 1.2) return 100;
  if (value >= 1) return 70;
  if (value >= 0.8) return 35;
  return 10;
}

function channel({ value, source, sourceDate, coverage, missingReason, formula = null }) {
  return {
    value: value ?? null,
    direction: value === null || value === undefined ? null : Number(value) > 0 ? "positive" : Number(value) < 0 ? "negative" : "neutral",
    source,
    source_date: sourceDate,
    reality_status: value === null || value === undefined ? "unavailable" : "source_backed",
    confidence_cap: value === null || value === undefined ? 0 : 1,
    coverage: finite(coverage) ?? 0,
    missing_reason: missingReason,
    formula
  };
}

function normalizeMarketRow(row) {
  return {
    date: dateFor(row),
    sector_id: row.sector_id ? String(row.sector_id).replace(/^a_share_/, "") : null,
    fund_code: row.fund_code ? String(row.fund_code) : String(row.symbol ?? ""),
    fund_name: row.fund_name ?? row.instrument_name ?? null,
    open: numberOrNull(row.open),
    high: numberOrNull(row.high),
    low: numberOrNull(row.low),
    close: numberOrNull(row.close),
    volume: numberOrNull(row.volume),
    amount: numberOrNull(row.amount),
    pct_change: numberOrNull(row.pct_change),
    turnover: numberOrNull(row.turnover),
    source_provider: row.source_provider ?? null,
    source_endpoint: row.source_endpoint ?? null
  };
}

function envelope(source, extra) {
  return {
    as_of: source.as_of,
    generated_at: new Date().toISOString(),
    model_version: MODEL_VERSION,
    command_contract_version: COMMAND_CONTRACT_VERSION,
    input_snapshot_id: source.input_snapshot_id,
    ...extra
  };
}

function degradedChannels(rows) {
  const keys = ["direct_flow", "breadth"];
  return keys.filter((key) => rows.some((row) => row.channels[key]?.value === null));
}

function limitationsFor(observation) {
  return Object.entries(observation.channels)
    .filter(([, channel]) => channel.value === null && channel.missing_reason)
    .map(([key, channel]) => `${key}: ${channel.missing_reason}`);
}

function deltaComponent(name, current, previous) {
  if (current === null || previous === null || current === undefined || previous === undefined) return null;
  return { component: name, change: round(current - previous) };
}

function returns(values) {
  return values.slice(1).map((value, index) => value && values[index] ? value / values[index] - 1 : null).filter((value) => value !== null);
}

function periodReturn(values, sessions) {
  if (values.length < sessions + 1) return null;
  const latest = values.at(-1);
  const base = values.at(-(sessions + 1));
  return latest && base ? latest / base - 1 : null;
}

function riskAdjust(value, dailyVol, sessions) {
  if (value === null || dailyVol === null || dailyVol === 0) return null;
  return value / Math.max(dailyVol * Math.sqrt(sessions), 0.005);
}

function weighted(long, short) {
  return long === null || short === null ? null : 0.6 * long + 0.4 * short;
}

function normalize(value) {
  return value === null ? null : 100 * Math.tanh(value / 2);
}

function coverageFraction(values) {
  return round(values.filter((value) => value !== null && value !== undefined).length / values.length);
}

function mean(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length === values.length && valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function stddev(values) {
  if (values.length < 5) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function dateFor(row) {
  return String(row?.date ?? row?.trade_date ?? row?.as_of ?? "");
}

function maxDate(rows) {
  return rows.map(dateFor).filter(Boolean).sort().at(-1) ?? null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pctValue(value) {
  return value === null ? null : round(value * 100);
}

function finite(value) {
  return Number.isFinite(value) ? round(value) : null;
}

function round(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
