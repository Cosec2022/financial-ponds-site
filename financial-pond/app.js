const state = {
  summary: null,
  ledger: null,
  schedule: null,
  quality: null,
  pointer: null,
  delta: null,
  coverage: null,
  flow: null,
  market: null,
  mapping: null,
  scores: null,
  outcomeReviews: null,
  outcomeReport: null,
  reviewReadiness: null,
  reviewAnalytics: null,
  selectedPoolId: null
};

async function readJson(path, fallback = null) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`not loaded: ${path}`, error);
    return fallback;
  }
}

function rowsForToday() {
  const asOf = state.ledger?.as_of;
  return (state.ledger?.rows ?? [])
    .filter((row) => !asOf || row.as_of === asOf)
    .sort((a, b) => b.observation_score - a.observation_score)
    .slice(0, 5);
}

function selectedCandidate() {
  const rows = rowsForToday();
  return rows.find((row) => row.pool_id === state.selectedPoolId) ?? rows[0] ?? null;
}

function scoreRow(poolId) {
  return (state.scores?.rows ?? []).find((row) => row.pool_id === poolId) ?? null;
}

function renderTodayStatus() {
  const el = document.getElementById("todayStatus");
  const summary = state.summary ?? {};
  const pointer = state.pointer ?? {};
  const delta = state.delta ?? {};
  const items = [
    ["Observation State", summary.observation_state ?? "observe_only", "good"],
    ["Data Readiness", summary.data_readiness ?? "not loaded", ""],
    ["Boundary", "observe_only", "good"],
    ["Latest As Of", pointer.latest_as_of ?? summary.as_of ?? "--", ""],
    ["Previous As Of", pointer.previous_as_of ?? "--", ""],
    ["Delta Comparison", delta.comparison_available ? "available" : "insufficient history", delta.comparison_available ? "good" : "warn"]
  ];
  el.innerHTML = items.map(([label, value, className]) => `
    <div class="status-item">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value ${className}">${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function renderCandidates() {
  const el = document.getElementById("candidateList");
  const rows = rowsForToday();
  if (!rows.length) {
    el.innerHTML = `<div class="empty">No observation candidates loaded.</div>`;
    return;
  }
  el.innerHTML = rows.map((row) => `
    <button class="candidate-card${row.pool_id === selectedCandidate()?.pool_id ? " active" : ""}" data-candidate-id="${escapeHtml(row.pool_id)}" type="button">
      <span class="candidate-name">${escapeHtml(row.pool_name)}</span>
      <span class="candidate-cell">Tier · Score<strong>${escapeHtml(row.observation_tier)} · ${fmt(row.observation_score)}</strong></span>
      <span class="candidate-cell">Direction · Confidence<strong>${escapeHtml(row.direction)} · ${fmt(row.capped_confidence)}</strong></span>
      <span class="candidate-cell">Evidence · Proxy Risk<strong>${escapeHtml(row.evidence_quality)} · ${escapeHtml(row.proxy_risk)}</strong></span>
      <span class="candidate-cell">State · Risk Gate<strong>${escapeHtml(row.candidate_state ?? "Noise")} · ${escapeHtml(row.risk_gate_status ?? "insufficient_data")}</strong></span>
    </button>
  `).join("");

  el.querySelectorAll("[data-candidate-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPoolId = button.getAttribute("data-candidate-id");
      renderCandidates();
      renderSelectedCandidate();
      renderCollapsedDetails();
    });
  });
}

function renderSelectedCandidate() {
  const el = document.getElementById("selectedCandidate");
  const candidate = selectedCandidate();
  const score = candidate ? scoreRow(candidate.pool_id) ?? candidate : null;
  if (!candidate || !score) {
    el.innerHTML = `<div class="empty">No selected candidate.</div>`;
    return;
  }
  const components = [
    ["Flow", score.flow_score],
    ["Momentum", score.momentum_score],
    ["Liquidity", score.liquidity_score],
    ["Quality", score.quality_score],
    ["Delta", score.delta_score],
    ["Confidence", score.confidence_score],
    ["Proxy penalty", score.proxy_penalty, true],
    ["Missing penalty", score.missing_data_penalty, true],
    ["Final", score.final_score]
  ];
  const t1Review = (state.outcomeReviews?.rows ?? []).find((row) => row.pool_id === candidate.pool_id && row.candidate_as_of === candidate.as_of && row.horizon === "T+1");
  el.innerHTML = `
    <div class="selected-title">
      <div>
        <h3>${escapeHtml(candidate.pool_name)}</h3>
        <span class="tier">${escapeHtml(candidate.observation_tier)}</span>
      </div>
      <span class="boundary">observe_only</span>
    </div>
    <div class="detail-metrics">
      ${metric("Observation Score", candidate.observation_score)}
      ${metric("State", candidate.candidate_state)}
      ${metric("Overheat", candidate.overheat_score)}
      ${metric("Major Wave", candidate.major_wave_score)}
      ${metric("Risk Gate", candidate.risk_gate_status)}
      ${metric("Direction", candidate.direction)}
      ${metric("Capped Confidence", candidate.capped_confidence)}
      ${metric("Review Status", candidate.review_status)}
      ${metric("T+1 Review", t1Review?.review_status ?? "pending")}
    </div>
    <div class="signal-row">
      ${signalStatus("Flow", candidate.flow_status)}
      ${signalStatus("Momentum", candidate.momentum_status)}
      ${signalStatus("Liquidity", candidate.liquidity_status)}
    </div>
    <div class="reason-grid">
      <div class="reason-block"><strong>Main reason</strong><br>${escapeHtml(candidate.main_reason)}</div>
      <div class="reason-block caution"><strong>Caution</strong><br>${escapeHtml(candidate.caution_reason || "No additional caution recorded.")}</div>
      <div class="reason-block"><strong>Major Wave</strong><br>${escapeHtml(candidate.major_wave_reason || "No major-wave reason recorded.")}</div>
      <div class="reason-block caution"><strong>Overheat / Risk Gate</strong><br>${escapeHtml(`${candidate.overheat_reason || "No overheat reason recorded."} ${candidate.risk_gate_reason || ""}`.trim())}</div>
    </div>
    <div class="component-grid">
      ${components.map(([label, value, penalty]) => `
        <div class="component${penalty ? " penalty" : ""}">
          <span>${escapeHtml(label)}</span>
          <strong>${fmt(value)}</strong>
        </div>
      `).join("")}
    </div>
    <p class="detail-boundary">Boundary: observe_only</p>
  `;
}

function renderEvidenceQuality() {
  const el = document.getElementById("evidenceQuality");
  const quality = state.quality ?? {};
  const total = quality.total_pool_count ?? 0;
  const high = quality.high_quality_signal_count ?? 0;
  const medium = quality.medium_quality_signal_count ?? 0;
  const low = quality.low_quality_signal_count ?? 0;
  const insufficient = Math.max(0, total - high - medium - low);
  el.innerHTML = `
    <div class="quality-counts">
      ${countCell("High", high)}
      ${countCell("Medium", medium)}
      ${countCell("Low", low)}
      ${countCell("Insufficient", insufficient)}
    </div>
    <div class="quality-facts">
      <div class="fact">Direct evidence <strong>${pct(quality.direct_evidence_ratio)}</strong></div>
      <div class="fact">Proxy evidence <strong>${pct(quality.proxy_evidence_ratio)}</strong></div>
      <div class="fact">Confidence caps <strong>${quality.confidence_cap_applied_count ?? 0}</strong></div>
    </div>
    <p class="caution-line">${escapeHtml(state.summary?.main_caution ?? "Evidence quality review required.")}</p>
  `;
}

function renderReviewSchedule() {
  const el = document.getElementById("reviewSchedule");
  const schedule = state.schedule ?? {};
  const outcome = state.outcomeReport ?? {};
  const readiness = state.reviewReadiness ?? {};
  const analytics = state.reviewAnalytics ?? {};
  el.innerHTML = `
    <div class="review-counts">
      ${countCell("T+1 pending", schedule.pending_t1_count ?? 0)}
      ${countCell("T+3 pending", schedule.pending_t3_count ?? 0)}
      ${countCell("T+5 pending", schedule.pending_t5_count ?? 0)}
      ${countCell("T+20 pending", schedule.pending_t20_count ?? 0)}
    </div>
    <div class="review-facts">
      <div class="fact">Next review date <strong>${escapeHtml(nextReviewDate(schedule))}</strong></div>
      <div class="fact">Review status <strong>pending</strong></div>
      <div class="fact">Candidate count <strong>${schedule.candidate_count ?? 0}</strong></div>
    </div>
  `;
  document.getElementById("outcomeReviewLine").textContent = `Outcome Review: reviewed ${outcome.reviewed_count ?? 0} / pending ${outcome.pending_count ?? 0} / next due ${nextOutcomeDue(outcome)}`;
  document.getElementById("reviewReadinessLine").textContent = `Review Readiness: ready ${readiness.baseline_available_count ?? 0} / missing basis ${readiness.baseline_missing_count ?? 0} / next due ${readiness.next_due_date ?? "--"}`;
  document.getElementById("reviewAnalyticsLine").textContent = `Review Analytics: due reviews ${outcome.due_review_count ?? 0} / reviewed ${analytics.reviewed_rows ?? outcome.reviewed_count ?? 0} / pending ${analytics.pending_rows ?? outcome.pending_count ?? 0} / unavailable ${analytics.unavailable_rows ?? outcome.unavailable_count ?? 0} / next due ${nextOutcomeDue(outcome)}`;
}

function renderCollapsedDetails() {
  const candidate = selectedCandidate();
  const score = candidate ? scoreRow(candidate.pool_id) ?? candidate : {};
  const coverage = state.coverage ?? {};
  const flow = state.flow ?? {};
  const market = state.market ?? {};
  const mapping = state.mapping ?? {};
  const delta = state.delta ?? {};

  document.getElementById("dataHealth").innerHTML = `
    <div class="compact-facts">
      <span>Coverage ${pct(coverage.coverage_ratio)}</span>
      <span>Flow estimated ${flow.estimated_from_source_count ?? 0}</span>
      <span>Flow missing ${flow.missing_flow_count ?? 0}</span>
      <span>Momentum ${market.momentum_signal_count ?? 0}</span>
      <span>Liquidity ${market.liquidity_signal_count ?? 0}</span>
      <span>Mapped ${(mapping.total_pool_count ?? 0) - (mapping.unmapped_count ?? 0)}</span>
      <span>Proxy ${(mapping.sector_proxy_count ?? 0) + (mapping.broad_proxy_count ?? 0)}</span>
      <span>Delta ${delta.comparison_available ? "available" : "insufficient"}</span>
    </div>
  `;
  document.getElementById("signalDetails").innerHTML = candidate ? `
    <div class="compact-facts">
      <span>Flow ${escapeHtml(candidate.flow_status)}</span>
      <span>Momentum ${escapeHtml(candidate.momentum_status)}</span>
      <span>Liquidity ${escapeHtml(candidate.liquidity_status)}</span>
      <span>Quality ${escapeHtml(candidate.evidence_quality)}</span>
      <span>Proxy risk ${escapeHtml(candidate.proxy_risk)}</span>
      <span>Final score ${fmt(score.final_score)}</span>
    </div>
  ` : "No selected candidate.";
  document.getElementById("reviewDetails").innerHTML = `
    <div class="compact-facts">
      <span>Latest ${escapeHtml(state.pointer?.latest_as_of ?? "--")}</span>
      <span>Previous ${escapeHtml(state.pointer?.previous_as_of ?? "--")}</span>
      <span>Baseline ${escapeHtml(delta.baseline_state ?? "--")}</span>
      <span>T+1 ${escapeHtml(nextDates(state.schedule, "t1"))}</span>
      <span>T+3 ${escapeHtml(nextDates(state.schedule, "t3"))}</span>
      <span>T+5 ${escapeHtml(nextDates(state.schedule, "t5"))}</span>
      <span>T+20 ${escapeHtml(nextDates(state.schedule, "t20"))}</span>
    </div>
  `;
}

function metric(label, value) {
  return `<div class="detail-metric"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(fmt(value))}</strong></div>`;
}

function signalStatus(label, value) {
  return `<div class="signal-status"><span class="metric-label">${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "missing")}</strong></div>`;
}

function countCell(label, value) {
  return `<div class="count-cell"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function nextReviewDate(schedule) {
  const dates = Object.values(schedule?.next_review_dates ?? {}).flat().filter(Boolean).sort();
  return dates[0] ?? "--";
}

function nextOutcomeDue(report) {
  const dates = (report?.next_due_reviews ?? []).map((row) => row.date).filter(Boolean).sort();
  return dates[0] ?? "--";
}

function nextDates(schedule, key) {
  return (schedule?.next_review_dates?.[key] ?? []).join(", ") || "--";
}

function fmt(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "--";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits).replace(/\.00$/, "") : String(value);
}

function pct(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100)}%` : "--";
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
  const [summary, ledger, schedule, quality, pointer, delta, coverage, flow, market, mapping, scores, outcomeReviews, outcomeReport, reviewReadiness, reviewAnalytics] = await Promise.all([
    readJson("./data/evening_observation_summary.json"),
    readJson("./data/observation_candidate_ledger.json", { rows: [] }),
    readJson("./data/candidate_review_schedule.json", {}),
    readJson("./data/signal_quality_report.json", {}),
    readJson("./data/history/latest_observation_pointer.json", {}),
    readJson("./data/daily_delta_report.json", {}),
    readJson("./data/data_coverage_report.json", {}),
    readJson("./data/flow_channel_report.json", {}),
    readJson("./data/market_signal_report.json", {}),
    readJson("./data/pool_mapping_report.json", {}),
    readJson("./data/pool_observation_scores.json", { rows: [] }),
    readJson("./data/candidate_outcome_reviews.json", { rows: [] }),
    readJson("./data/outcome_review_report.json", {}),
    readJson("./data/review_readiness_report.json", {}),
    readJson("./data/candidate_review_analytics.json", {})
  ]);
  Object.assign(state, { summary, ledger, schedule, quality, pointer, delta, coverage, flow, market, mapping, scores, outcomeReviews, outcomeReport, reviewReadiness, reviewAnalytics });
  state.selectedPoolId = rowsForToday()[0]?.pool_id ?? null;
  renderTodayStatus();
  renderCandidates();
  renderSelectedCandidate();
  renderEvidenceQuality();
  renderReviewSchedule();
  renderCollapsedDetails();
}

init();
