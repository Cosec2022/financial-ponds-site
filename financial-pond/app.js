const SIGNAL_ORDER = ["flow", "price_momentum", "liquidity", "rotation", "news", "valuation", "fundamental", "risk"];
const SIGNAL_LABELS = {
  flow: "流",
  price_momentum: "动",
  liquidity: "量",
  rotation: "轮",
  news: "新闻",
  valuation: "估",
  fundamental: "基",
  risk: "风"
};
const REALITY_SHORT = {
  real_provider: "real",
  real_provider_derived: "derived",
  source_backed: "source_backed",
  estimated_from_source: "estimated_from_source",
  derived_from_market: "derived_from_market",
  manual_seed: "seed",
  mock: "mock",
  fixture: "mock",
  missing: "missing",
  planned: "planned",
  insufficient_history: "insufficient",
  unknown: "missing"
};
const DIRECTION_LABEL = { inward: "inward", outward: "outward", neutral: "neutral" };

const state = {
  snapshot: null,
  outcomes: null,
  explainability: null,
  vault: null,
  readiness: null,
  coverage: null,
  flowChannel: null,
  marketChannel: null,
  mappingReport: null,
  qualityReport: null,
  delta: null,
  pointer: null,
  pools: [],
  view: "today",
  selectedPoolId: null,
  selectedMetric: "flow",
  traceOpen: false,
  query: ""
};

async function readJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`not loaded: ${path}`, error);
    return fallback;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(value) {
  const n = numberOrNull(value);
  if (n === null) return "--";
  return `${Math.round(n * 100)}%`;
}

function fmt(value, digits = 2) {
  const n = numberOrNull(value);
  if (n === null) return value === null || value === undefined || value === "" ? "--" : String(value);
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿`;
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万`;
  return n.toFixed(digits);
}

function statusOf(signal) {
  const raw = firstDefined(signal?.reality, signal?.status, signal?.data_reality, signal?.trace_status, "missing");
  return REALITY_SHORT[raw] ?? raw;
}

function displaySignalStatus(signal, key) {
  const reality = fullStatusOf(signal);
  if (reality === "real_provider") return "real";
  if (reality === "source_backed") return "source_backed";
  if (reality === "estimated_from_source") return "estimated_from_source";
  if (reality === "derived_from_market") return "derived_from_market";
  if (key === "flow" && reality === "real_provider_derived" && numberOrNull(signalValue(signal)) !== null) return "estimated";
  if (reality === "real_provider_derived") return "derived";
  if (reality === "manual_seed") return "derived";
  if (reality === "insufficient_history") return "insufficient";
  if (reality === "planned") return "planned";
  return "missing";
}

function fullStatusOf(signal) {
  return firstDefined(signal?.reality, signal?.status, signal?.data_reality, signal?.trace_status, "missing");
}

function signalValue(signal) {
  return firstDefined(signal?.value, signal?.score, signal?.status_value, null);
}

function poolId(pool) {
  return String(firstDefined(pool.pool_id, pool.entity_id, pool.id, pool.sector_id, pool.name, "unknown"));
}

function poolName(pool) {
  return firstDefined(pool.pool_name, pool.entity_name, pool.display_name, pool.name, poolId(pool));
}

function normalizeSignals(rawSignals = {}) {
  const out = {};
  for (const key of SIGNAL_ORDER) {
    const signal = rawSignals[key] ?? rawSignals[SIGNAL_LABELS[key]] ?? null;
    if (signal && typeof signal === "object") out[key] = { ...signal };
    else if (signal !== undefined && signal !== null) out[key] = { value: signal, reality: "real_provider_derived" };
    else out[key] = { value: null, reality: key === "news" || key === "valuation" || key === "fundamental" ? "planned" : "missing" };
  }
  return out;
}

function normalizeVector(pool, signals) {
  const vector = pool.vector_forecast ?? pool.vector ?? {};
  const flow = numberOrNull(signalValue(signals.flow));
  const direction = firstDefined(vector.direction, flow > 0 ? "inward" : flow < 0 ? "outward" : "neutral");
  return {
    flow,
    direction,
    magnitude: firstDefined(vector.magnitude, vector.strength, null),
    velocity: firstDefined(vector.velocity, null),
    velocity_status: firstDefined(vector.velocity_status, vector.velocity === null ? "insufficient_history" : null),
    acceleration: firstDefined(vector.acceleration, null),
    acceleration_status: firstDefined(vector.acceleration_status, vector.acceleration === null ? "insufficient_history" : null),
    confidence: firstDefined(vector.confidence, null),
    boundary: firstDefined(vector.boundary, pool.boundary, "observe_only")
  };
}

function extractPools(snapshot) {
  const rows = asArray(snapshot?.pools).length ? snapshot.pools
    : asArray(snapshot?.observed_pools).length ? snapshot.observed_pools
    : asArray(snapshot?.observations).length ? snapshot.observations
    : asArray(snapshot?.rows).length ? snapshot.rows
    : [];

  return rows.map((pool) => {
    const signals = normalizeSignals(pool.signals ?? pool.signal_matrix_row ?? {});
    const vector = normalizeVector(pool, signals);
    return {
      ...pool,
      id: poolId(pool),
      label: poolName(pool),
      universe: firstDefined(pool.universe, "a_share"),
      signals,
      vector,
      watch_state: firstDefined(pool.watch_state, pool.review_status, pool.state, "review_later"),
      trace_refs: pool.trace_refs ?? {}
    };
  });
}

function selectedPool() {
  return state.pools.find((pool) => pool.id === state.selectedPoolId) ?? state.pools[0] ?? null;
}

function visiblePools() {
  const q = state.query.trim().toLowerCase();
  if (!q) return state.pools;
  return state.pools.filter((pool) => `${pool.label} ${pool.id} ${pool.universe}`.toLowerCase().includes(q));
}

function traceIdFor(pool, metric) {
  return firstDefined(
    pool.trace_refs?.[metric],
    pool.signals?.[metric]?.trace_id,
    `${pool.universe}.${pool.id}.${metric}.${state.snapshot?.as_of ?? "latest"}`
  );
}

function findExplainability(traceId, pool, metric) {
  const indexes = asArray(state.explainability?.indexes);
  return indexes.find((item) => item.index_id === traceId)
    ?? indexes.find((item) => item.related_sector_id === pool.id && item.category === metric)
    ?? indexes.find((item) => String(item.index_id ?? "").includes(pool.id) && String(item.index_id ?? "").includes(metric))
    ?? null;
}

function formulaFor(metric) {
  const map = {
    flow: "F = provider estimated_flow when source-backed channel is available",
    price_momentum: "M = close_t / close_{t-1} - 1",
    liquidity: "L = rank_normalize(amount)",
    rotation: "R = rank_{t-1} - rank_t",
    news: "N = Σ(K × D × R × S × U × decay)",
    valuation: "V = normalize(v_1, v_2, ..., v_n)",
    fundamental: "B = normalize(g_rev, g_profit, roe, q)",
    risk: "Risk = normalize(volatility, drawdown, gate)"
  };
  return map[metric] ?? "Y = f(x)";
}

function generatedTrace(pool, metric) {
  const signal = pool.signals?.[metric] ?? { value: null, reality: "missing" };
  const value = signalValue(signal);
  const traceStatus = signal?.trace_id ? "available" : "generated_from_snapshot";
  const reality = fullStatusOf(signal);
  const source = firstDefined(signal?.source_file, signal?.source, signal?.provider, "observation_snapshot.json");
  return {
    trace_id: traceIdFor(pool, metric),
    trace_status: traceStatus,
    title: `${pool.label} / ${SIGNAL_LABELS[metric] ?? metric}`,
    result: `${SIGNAL_LABELS[metric] ?? metric} = ${fmt(value)}`,
    formula: firstDefined(signal.formula, formulaFor(metric)),
    variables: signal.variables ? Object.entries(signal.variables).map(([symbol, item]) => ({
      symbol,
      name: symbol,
      value: fmt(item),
      source_field: symbol,
      reality
    })) : [
      { symbol: "Y", name: SIGNAL_LABELS[metric] ?? metric, value: fmt(value), source_field: metric, reality },
      { symbol: "status", name: "data reality", value: reality, source_field: "signals", reality }
    ],
    calculation: signal.calculation ? [signal.calculation] : value === null
      ? [`${metric} = --`, `status = ${reality}`]
      : [`read ${metric} = ${fmt(value)}`, `status = ${reality}`, `output ${SIGNAL_LABELS[metric] ?? metric} = ${fmt(value)}`],
    sources: [source],
    reality: firstDefined(signal.reality_note, reality),
    boundary: firstDefined(signal.boundary, pool.vector.boundary, "observe_only")
  };
}

function buildTrace(pool, metric) {
  const traceId = traceIdFor(pool, metric);
  const found = findExplainability(traceId, pool, metric);
  if (!found) return generatedTrace(pool, metric);
  return {
    trace_id: found.index_id ?? traceId,
    trace_status: "available",
    title: `${pool.label} / ${found.label ?? SIGNAL_LABELS[metric] ?? metric}`,
    result: `${found.display_value ?? fmt(found.value)}`,
    formula: firstDefined(found.formula?.formula_machine, found.formula?.formula_human, found.formula_machine, formulaFor(metric)),
    variables: asArray(found.inputs).length ? found.inputs.map((item, index) => ({
      symbol: item.symbol ?? item.field ?? `x${index + 1}`,
      name: item.name ?? item.label ?? item.field ?? "input",
      value: fmt(firstDefined(item.value, item.raw_value, "--")),
      source_field: item.source_field ?? item.field ?? "--",
      reality: item.reality ?? found.data_reality?.real_provider ?? found.data_reality?.manual_seed ?? "unknown"
    })) : generatedTrace(pool, metric).variables,
    calculation: asArray(found.calculation_steps).length ? found.calculation_steps : generatedTrace(pool, metric).calculation,
    sources: asArray(found.source_files).length ? found.source_files : ["index_explainability.json"],
    reality: firstDefined(found.data_reality?.real_provider && "real_provider", found.data_reality?.manual_seed && "manual_seed", fullStatusOf(pool.signals?.[metric])),
    boundary: pool.vector.boundary ?? "observe_only"
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function badgeClass(status) {
  return `badge ${statusOf({ reality: status })}`;
}

function boundaryLabel(value) {
  return value === "blocked" ? "observe_only / blocked boundary" : (value ?? "observe_only");
}

function observationState() {
  return "observe_only";
}

function poolDataStatus(pool) {
  const flow = pool.signals.flow;
  const flowStatus = displaySignalStatus(flow, "flow");
  if (flowStatus === "real") return "real";
  if (flowStatus === "estimated") return "estimated";
  if (SIGNAL_ORDER.some((key) => displaySignalStatus(pool.signals[key], key) === "derived")) return "derived";
  return "missing";
}

function importantGaps(pool) {
  const gaps = [];
  const status = (key) => displaySignalStatus(pool.signals[key], key);
  if (!["real", "estimated"].includes(status("flow"))) gaps.push("missing real flow");
  if (!["real", "estimated", "estimated_from_source", "derived", "derived_from_market"].includes(status("price_momentum"))) gaps.push("missing momentum");
  if (!["real", "estimated", "estimated_from_source", "derived", "derived_from_market"].includes(status("liquidity"))) gaps.push("missing liquidity");
  if (status("rotation") === "insufficient") gaps.push("rotation insufficient");
  if (["planned", "missing"].includes(status("valuation")) || ["planned", "missing"].includes(status("fundamental"))) gaps.push("valuation/fundamental planned");
  if (status("risk") === "derived") gaps.push("risk derived");
  return gaps;
}

function renderSummaryStrip() {
  const el = document.getElementById("summaryStrip");
  if (!el) return;
  const pending = asArray(state.outcomes?.pending).length;
  const coverage = firstDefined(state.readiness?.gates?.true_flow_coverage, state.snapshot?.true_flow_coverage, null);
  el.innerHTML = `
    <article class="summary-card"><span>Observation State</span><strong>${observationState()}</strong></article>
    <article class="summary-card"><span>Real Flow Coverage</span><strong>${pct(coverage)}</strong></article>
    <article class="summary-card"><span>Observed Pools</span><strong>${state.snapshot?.observed_pool_count ?? state.pools.length}</strong></article>
    <article class="summary-card"><span>Pending Reviews</span><strong>${pending}</strong></article>
  `;
}

function renderCoverageStrip() {
  const el = document.getElementById("coverageStrip");
  if (!el) return;
  const report = state.coverage;
  if (!report) {
    el.innerHTML = `
      <div class="coverage-head"><span>Data Coverage</span><strong>--</strong></div>
      <div class="coverage-counts">data_coverage_report not loaded</div>
      <div class="coverage-gaps">Flow Channel unavailable. Market Channel unavailable. Mapping unavailable. Quality unavailable.</div>
    `;
    return;
  }
  const gaps = asArray(report.priority_gaps).slice(0, 3);
  const flow = state.flowChannel ?? report.flow_channel ?? {};
  const market = state.marketChannel ?? report.market_channel ?? {};
  const mapping = state.mappingReport ?? {};
  const quality = state.qualityReport ?? report.quality ?? {};
  const baseline = state.delta?.baseline_state ?? (state.pointer?.latest_as_of ? "today archived / insufficient history" : "insufficient history");
  el.innerHTML = `
    <div class="coverage-head"><span>Data Coverage</span><strong>${pct(report.coverage_ratio)}</strong></div>
    <div class="coverage-counts">
      real ${report.real_count ?? 0} · estimated ${report.estimated_count ?? 0} · derived ${report.derived_count ?? 0} · missing ${report.missing_count ?? 0} · planned ${report.planned_count ?? 0}
    </div>
    <div class="coverage-gaps">
      <span>Flow Channel: source_backed ${flow.source_backed_flow_count ?? 0} / estimated ${flow.estimated_from_source_count ?? 0} / missing ${flow.missing_flow_count ?? 0}</span>
      <span>Market Channel: momentum ${market.momentum_signal_count ?? 0} / liquidity ${market.liquidity_signal_count ?? 0} / missing ${(market.missing_momentum_count ?? 0) + (market.missing_liquidity_count ?? 0)}</span>
      <span>Mapping: mapped ${(mapping.total_pool_count ?? 0) - (mapping.unmapped_count ?? 0)} / proxy ${(mapping.sector_proxy_count ?? 0) + (mapping.broad_proxy_count ?? 0)} / unmapped ${mapping.unmapped_count ?? 0}</span>
      <span>Quality: high ${quality.high_quality_signal_count ?? 0} / medium ${quality.medium_quality_signal_count ?? 0} / low ${quality.low_quality_signal_count ?? 0} / proxy risk ${quality.proxy_risk_level ?? "--"}</span>
      <span>Daily Delta: Baseline: ${escapeHtml(baseline)}</span>
      ${gaps.length ? gaps.map((gap) => `<span>${escapeHtml(gap.priority_label ?? gap.signal_type)} ${gap.affected_pool_count ?? 0}</span>`).join("") : "<span>no priority data gap</span>"}
    </div>
  `;
}

function renderHeader() {
  const asOf = state.snapshot?.as_of ?? state.vault?.as_of ?? "--";
  setText("asOfBadge", `as_of ${asOf}`);
  setText("poolCountBadge", `observed_pool_count ${state.snapshot?.observed_pool_count ?? state.pools.length}`);
  const pending = asArray(state.outcomes?.pending).length;
  setText("pendingBadge", `pending_outcome_count ${pending}`);
  setText("executionBadge", boundaryLabel(firstDefined(state.snapshot?.execution_state, state.snapshot?.boundary, "observe_only")));
}

function renderPools() {
  const el = document.getElementById("poolList");
  const pools = visiblePools();
  if (!el) return;
  if (!pools.length) {
    el.innerHTML = `<div class="empty">No pools.</div>`;
    return;
  }
  el.innerHTML = pools.map((pool) => {
    const active = pool.id === state.selectedPoolId ? " active" : "";
    const vector = pool.vector;
    const dataStatus = poolDataStatus(pool);
    return `
      <button class="pool-row${active}" data-pool-card="${escapeHtml(pool.id)}" type="button">
        <span class="pool-row-name">${escapeHtml(pool.label)}</span>
        <span>${escapeHtml(DIRECTION_LABEL[vector.direction] ?? vector.direction)}</span>
        <span>${pct(vector.magnitude)}</span>
        <span>${fmt(vector.confidence)}</span>
        <span class="badge ${dataStatus}">${dataStatus}</span>
      </button>
    `;
  }).join("");

  el.querySelectorAll("[data-pool-card]").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedPoolId = card.getAttribute("data-pool-card");
      state.traceOpen = false;
      render();
    });
  });
}

function renderToday(pool) {
  if (!pool) return `<div class="empty">observation_snapshot not loaded</div>`;
  const v = pool.vector;
  const gaps = importantGaps(pool);
  return `
    <div class="panel-head">
      <div>
        <p class="eyebrow">Today</p>
        <h2>${escapeHtml(pool.label)}</h2>
      </div>
      <span class="badge muted">${escapeHtml(boundaryLabel(v.boundary))}</span>
    </div>
    <section class="selected-summary">
      <article><span>F</span><strong>${fmt(v.flow)}</strong></article>
      <article><span>direction</span><strong>${escapeHtml(v.direction)}</strong></article>
      <article><span>magnitude</span><strong>${pct(v.magnitude)}</strong></article>
      <article><span>confidence</span><strong>${fmt(v.confidence)}</strong></article>
      <article><span>evidence_quality</span><strong>${escapeHtml(pool.signals.price_momentum?.evidence_quality ?? "unavailable")}</strong></article>
      <article><span>proxy_risk</span><strong>${escapeHtml(pool.signals.price_momentum?.proxy_risk ?? "none")}</strong></article>
      <article><span>confidence cap</span><strong>${fmt(pool.signals.price_momentum?.confidence_cap)}</strong></article>
      <article><span>boundary</span><strong>${escapeHtml(boundaryLabel(v.boundary))}</strong></article>
    </section>
    <section class="health-section">
      <div class="section-title">Signal Health</div>
      <div class="signal-health-grid">
        ${SIGNAL_ORDER.map((key) => {
          const status = displaySignalStatus(pool.signals[key], key);
          return `<button class="health-cell ${status}" data-signal-metric="${key}" type="button">
            <span>${SIGNAL_LABELS[key]}</span>
            <strong>${status}</strong>
          </button>`;
        }).join("")}
      </div>
    </section>
    <section class="gap-section">
      <div class="section-title">Data Gap</div>
      <div class="gap-list">
        ${gaps.length ? gaps.map((gap) => `<span>${escapeHtml(gap)}</span>`).join("") : `<span>no priority data gap</span>`}
      </div>
    </section>
  `;
}

function renderRawSignalTable(pool) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Signal</th><th>Value</th><th>Status</th><th>Trace</th></tr></thead>
        <tbody>${SIGNAL_ORDER.map((key) => {
          const signal = pool.signals[key];
          const status = displaySignalStatus(signal, key);
          return `<tr>
            <td><button class="metric-button" data-signal-metric="${key}">${SIGNAL_LABELS[key] ?? key}</button></td>
            <td>${fmt(signalValue(signal))}</td>
            <td><span class="badge ${status}">${status}</span></td>
            <td>${escapeHtml(traceIdFor(pool, key))}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderMatrix() {
  return `
    <div class="panel-head"><div><p class="eyebrow">Matrix</p><h2>信号矩阵</h2></div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pool</th>${SIGNAL_ORDER.map((key) => `<th>${SIGNAL_LABELS[key]}</th>`).join("")}</tr></thead>
        <tbody>${state.pools.map((pool) => `<tr>
          <td><button class="row-button" data-row-pool="${escapeHtml(pool.id)}">${escapeHtml(pool.label)}</button></td>
          ${SIGNAL_ORDER.map((key) => {
            const status = displaySignalStatus(pool.signals[key], key);
            return `<td><button class="signal-chip ${status}" data-row-pool="${escapeHtml(pool.id)}" data-row-metric="${key}" type="button">${status}</button></td>`;
          }).join("")}
        </tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderVector() {
  return `
    <div class="panel-head"><div><p class="eyebrow">Vector</p><h2>资金矢量</h2></div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Pool</th><th>F</th><th>Direction</th><th>Magnitude</th><th>Velocity</th><th>Acceleration</th><th>Confidence</th><th>Boundary</th></tr></thead>
        <tbody>${state.pools.map((pool) => {
          const v = pool.vector;
          return `<tr>
            <td><button class="row-button" data-row-pool="${escapeHtml(pool.id)}">${escapeHtml(pool.label)}</button></td>
            <td><button class="metric-button" data-row-pool="${escapeHtml(pool.id)}" data-row-metric="flow">${fmt(v.flow)}</button></td>
            <td>${escapeHtml(v.direction)}</td>
            <td>${pct(v.magnitude)}</td>
            <td>${v.velocity === null ? escapeHtml(v.velocity_status ?? "--") : fmt(v.velocity)}</td>
            <td>${v.acceleration === null ? escapeHtml(v.acceleration_status ?? "--") : fmt(v.acceleration)}</td>
            <td>${fmt(v.confidence)}</td>
            <td>${escapeHtml(boundaryLabel(v.boundary))}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

function horizonStatus(pending, poolId, horizon) {
  const item = pending.find((row) => String(row.pool_id ?? row.entity_id) === String(poolId) && row.horizon === horizon);
  return item?.status ?? "--";
}

function renderReview() {
  const pending = asArray(state.outcomes?.pending);
  return `
    <div class="panel-head"><div><p class="eyebrow">Review</p><h2>复盘记录</h2></div><span class="badge muted">pending ${pending.length}</span></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Forecast Date</th><th>Pool</th><th>Direction</th><th>T+1</th><th>T+3</th><th>T+5</th><th>T+20</th></tr></thead>
        <tbody>${state.pools.map((pool) => `<tr>
          <td>${escapeHtml(state.snapshot?.as_of ?? "--")}</td>
          <td><button class="row-button" data-row-pool="${escapeHtml(pool.id)}">${escapeHtml(pool.label)}</button></td>
          <td>${escapeHtml(pool.vector.direction)}</td>
          <td>${horizonStatus(pending, pool.id, "T+1")}</td>
          <td>${horizonStatus(pending, pool.id, "T+3")}</td>
          <td>${horizonStatus(pending, pool.id, "T+5")}</td>
          <td>${horizonStatus(pending, pool.id, "T+20")}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderMain() {
  const el = document.getElementById("mainPanel");
  if (!el) return;
  const pool = selectedPool();
  if (state.view === "matrix") el.innerHTML = renderMatrix();
  else if (state.view === "vector") el.innerHTML = renderVector();
  else if (state.view === "review") el.innerHTML = renderReview();
  else el.innerHTML = renderToday(pool);

  el.querySelectorAll("[data-signal-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMetric = button.getAttribute("data-signal-metric");
      state.traceOpen = true;
      render();
    });
  });
  el.querySelectorAll("[data-vector-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      const metric = button.getAttribute("data-vector-metric");
      state.selectedMetric = metric === "flow" ? "flow" : metric;
      state.traceOpen = true;
      render();
    });
  });
  el.querySelectorAll("[data-row-pool]").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedPoolId = node.getAttribute("data-row-pool");
      const metric = node.getAttribute("data-row-metric");
      if (metric) state.selectedMetric = metric;
      state.traceOpen = Boolean(metric);
      render();
    });
  });
}

function renderTrace() {
  const pool = selectedPool();
  const el = document.getElementById("traceDrawer");
  if (!pool || !el) {
    if (el) el.innerHTML = `<div class="empty">点击指标查看公式溯源</div>`;
    return;
  }
  if (!state.traceOpen) {
    setText("traceStatus", "secondary");
    el.classList.add("trace-empty");
    el.innerHTML = `点击指标查看公式溯源`;
    return;
  }
  el.classList.remove("trace-empty");
  const metric = SIGNAL_ORDER.includes(state.selectedMetric) ? state.selectedMetric : "flow";
  const trace = buildTrace(pool, metric);
  setText("traceStatus", trace.trace_status ?? "missing");
  el.innerHTML = `
    <section class="trace-block">
      <div class="trace-label">Result</div>
      <strong>${escapeHtml(trace.title)}</strong><br>
      <span>${escapeHtml(trace.result)}</span>
    </section>
    <section class="trace-block">
      <div class="trace-label">Formula</div>
      <div class="formula">${escapeHtml(trace.formula)}</div>
    </section>
    <section class="trace-block">
      <div class="trace-label">Variables</div>
      <div class="table-wrap">
        <table class="var-table">
          <thead><tr><th>Symbol</th><th>Name</th><th>Value</th><th>Field</th><th>Reality</th></tr></thead>
          <tbody>${asArray(trace.variables).map((row) => `<tr>
            <td>${escapeHtml(row.symbol ?? "--")}</td>
            <td>${escapeHtml(row.name ?? "--")}</td>
            <td>${escapeHtml(row.value ?? "--")}</td>
            <td>${escapeHtml(row.source_field ?? "--")}</td>
            <td>${escapeHtml(row.reality ?? "--")}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
    <section class="trace-block">
      <div class="trace-label">Calculation</div>
      <ol class="step-list">${asArray(trace.calculation).map((step) => `<li>${escapeHtml(String(step))}</li>`).join("")}</ol>
    </section>
    <section class="trace-block">
      <div class="trace-label">Sources</div>
      <ul class="source-list">${asArray(trace.sources).map((source) => `<li>${escapeHtml(String(source))}</li>`).join("")}</ul>
    </section>
    <section class="trace-block">
      <div class="trace-label">Reality</div>
      <span class="badge ${statusOf({ reality: trace.reality })}">${escapeHtml(trace.reality ?? "missing")}</span>
    </section>
    <section class="trace-block">
      <div class="trace-label">Boundary</div>
      <span>${escapeHtml(boundaryLabel(trace.boundary ?? "observe_only"))}</span>
    </section>
  `;
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.getAttribute("data-view") === state.view);
  });
}

function render() {
  renderHeader();
  renderSummaryStrip();
  renderCoverageStrip();
  renderTabs();
  renderPools();
  renderMain();
  renderTrace();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function init() {
  const [snapshot, outcomes, explainability, vault, readiness, coverage, flowChannel, marketChannel, mappingReport, qualityReport, delta, pointer] = await Promise.all([
    readJson("./data/observation_snapshot.json", null),
    readJson("./data/outcome_labels.json", { pending: [], labels: [] }),
    readJson("./data/index_explainability.json", { indexes: [] }),
    readJson("./data/daily_data_vault.json", null),
    readJson("./data/etf_decision_readiness.json", null),
    readJson("./data/data_coverage_report.json", null),
    readJson("./data/flow_channel_report.json", null),
    readJson("./data/market_signal_report.json", null),
    readJson("./data/pool_mapping_report.json", null),
    readJson("./data/signal_quality_report.json", null),
    readJson("./data/daily_delta_report.json", null),
    readJson("./data/history/latest_observation_pointer.json", null)
  ]);
  state.snapshot = snapshot;
  state.outcomes = outcomes;
  state.explainability = explainability;
  state.vault = vault;
  state.readiness = readiness;
  state.coverage = coverage;
  state.flowChannel = flowChannel;
  state.marketChannel = marketChannel;
  state.mappingReport = mappingReport;
  state.qualityReport = qualityReport;
  state.delta = delta;
  state.pointer = pointer;
  state.pools = extractPools(snapshot);
  state.selectedPoolId = state.pools[0]?.id ?? null;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.view = tab.getAttribute("data-view") ?? "today";
      render();
    });
  });
  document.getElementById("poolSearch")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderPools();
  });
  render();
}

init();
