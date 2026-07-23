import {
  STRUCTURAL_OBSERVATION_LIMIT,
  buildCoreBasis,
  buildNextObservation,
  describePublishedChange,
  metricLevel,
  structuralObservationRows,
  visibleLabel
} from "./structural-observation-contract.mjs";

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
  instrumentMap: null,
  scores: null,
  marketRows: null,
  deltaRows: null,
  candidateStateModel: null,
  outcomeReviews: null,
  outcomeReport: null,
  reviewReadiness: null,
  reviewAnalytics: null,
  marketPenetrationBrief: null,
  selectedPoolId: null
};

const REVIEW_REASONS = [
  "pending_not_due",
  "pending_market_open",
  "awaiting_eod_data",
  "stale_data",
  "missing_price",
  "missing_benchmark",
  "calendar_unknown",
  "invalid_baseline"
];

const POOL_NAME_MAP = {
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
  a_share_real_estate_infra: "地产基建",
  a_share_energy: "能源",
  a_share_media: "传媒",
  a_share_machinery: "机械",
  a_share_transportation: "交通运输",
  a_share_environmental_protection: "环保",
  a_share_utilities: "公用事业"
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

function latestAsOf() {
  return state.pointer?.latest_as_of ?? state.summary?.as_of ?? state.ledger?.as_of ?? "--";
}

function rowsForToday() {
  return structuralObservationRows(state.summary, state.ledger);
}

function selectedCandidate() {
  const rows = rowsForToday();
  return rows.find((row) => row.pool_id === state.selectedPoolId) ?? rows[0] ?? null;
}

function scoreRow(poolId) {
  return (state.scores?.rows ?? []).find((row) => row.pool_id === poolId) ?? null;
}

function currentStateRows() {
  const asOf = state.candidateStateModel?.as_of ?? latestAsOf();
  return (state.candidateStateModel?.rows ?? []).filter((row) => row.as_of === asOf);
}

function renderHeaderAndHero() {
  const date = latestAsOf();
  const brief = state.marketPenetrationBrief;
  const freshness = briefFreshness(brief, date);
  document.getElementById("headerDataDate").textContent = date;
  const freshEl = document.getElementById("headerFreshness");
  freshEl.className = `freshness-pill ${freshness.className}`;
  freshEl.textContent = freshness.label;

  const headline = brief?.headline || deriveHeadline(rowsForToday());
  document.getElementById("marketConclusionTitle").textContent = headline;

  const summary = brief?.market_summary ?? deriveMarketSummary(rowsForToday());
  const cards = [
    ["↗", "市场环境", summary.market_regime ?? "仅观察"],
    ["◔", "主导风格", summary.dominant_style ?? "多线轮动"],
    ["▤", "资金状态", summary.capital_state ?? "等待确认"],
    ["⚑", "行动边界", summary.action_boundary ?? "仅观察，不追高"]
  ];
  document.getElementById("marketStatusCards").innerHTML = cards.map(([icon, label, value]) => `
    <article class="market-status-card">
      <span class="market-status-icon" aria-hidden="true">${icon}</span>
      <div>
        <span class="market-status-label">${escapeHtml(label)}</span>
        <strong class="market-status-value">${escapeHtml(value)}</strong>
      </div>
    </article>
  `).join("");
}

function renderMarketPenetration() {
  const brief = state.marketPenetrationBrief;
  const date = latestAsOf();
  const asOfEl = document.getElementById("briefAsOf");
  const warning = document.getElementById("briefStaleWarning");
  asOfEl.textContent = `报告日期 ${brief?.as_of ?? "--"}`;
  const modeBadge = document.getElementById("briefModeBadge");
  const aiGenerated = brief?.ai_synthesis?.status === "generated";
  modeBadge.textContent = aiGenerated ? "AI联网研究" : "规则解释";
  modeBadge.classList.toggle("ai-research-badge", aiGenerated);
  modeBadge.title = aiGenerated
    ? `由 ${brief.ai_synthesis.model ?? "AI"} 联网研究生成；只影响解释文字，不影响模型分数。`
    : "由已发布 FP 数据按确定性规则生成。";

  const freshness = briefFreshness(brief, date);
  if (freshness.className !== "fresh") {
    warning.hidden = false;
    warning.textContent = freshness.message;
  } else {
    warning.hidden = true;
    warning.textContent = "";
  }

  if (!brief) {
    const unavailable = `<div class="error-state">市场穿透报告未加载。候选与证据模块仍可使用，但解释层暂时不可用。</div>`;
    for (const id of ["whatHappened", "whyMarketMoved", "aShareTransmission", "fpCrossChecks", "tomorrowWatch"]) {
      document.getElementById(id).innerHTML = unavailable;
    }
    return;
  }

  const happened = normalizeStatements(brief.what_happened).length
    ? normalizeStatements(brief.what_happened)
    : fallbackFacts(brief);
  document.getElementById("whatHappened").innerHTML = happened.length
    ? happened.slice(0, 5).map((item) => `<div class="insight-row"><span>${escapeHtml(item.statement)}</span>${renderSourceLinks(item.source_ids)}</div>`).join("")
    : `<div class="empty-state">当日没有可用的精确日期市场事实。</div>`;

  const drivers = normalizeDrivers(brief.why_market_moved, brief.media_narratives);
  document.getElementById("whyMarketMoved").innerHTML = drivers.length
    ? drivers.slice(0, 4).map((item) => `
      <div class="driver-row">
        <div><span>${escapeHtml(item.statement)}</span>${item.mechanism ? `<small>${escapeHtml(item.mechanism)}</small>` : ""}${renderSourceLinks(item.source_ids)}</div>
        <span class="confidence-tag ${confidenceClass(item.confidence)}">${escapeHtml(confidenceLabel(item.confidence))}</span>
      </div>
    `).join("")
    : `<div class="empty-state">没有足够证据解释因果；系统不会把媒体标题自动当成事实。</div>`;

  const chains = Array.isArray(brief.a_share_transmission) ? brief.a_share_transmission : [];
  document.getElementById("aShareTransmission").innerHTML = chains.length
    ? chains.slice(0, 3).map(renderTransmissionChain).join("")
    : renderTransmissionChain({
        nodes: ["市场变化", "对应板块", "FP价格与流动性检查", "只形成观察假设"],
        note: "传导链是解释框架，不进入模型评分。"
      });

  const checks = Array.isArray(brief.fp_cross_checks) && brief.fp_cross_checks.length
    ? brief.fp_cross_checks
    : rowsForToday().map((row) => ({
        pool_id: row.pool_id,
        pool_name: poolName(row),
        hard_data_direction: row.candidate_state ?? "观察中",
        interpretation: candidateWhy(row),
        agreement: row.risk_gate_status === "pass" ? "数据支持" : "风险提醒"
      }));
  document.getElementById("fpCrossChecks").innerHTML = checks.length
    ? checks.slice(0, STRUCTURAL_OBSERVATION_LIMIT).map((item) => `
      <div class="cross-check-row">
        <strong>${escapeHtml(item.pool_name ?? displayPoolName(item.pool_id))}</strong>
        <span class="cross-check-copy">${escapeHtml(crossCheckInterpretation(item))}${renderSourceLinks(item.source_ids)}</span>
        <span class="status-badge ${agreementClass(item.agreement)}">${escapeHtml(item.agreement ?? "待验证")}</span>
      </div>
    `).join("")
    : `<div class="empty-state">暂无可交叉验证的候选。</div>`;

  const watch = normalizeStatements(brief.tomorrow_watch);
  document.getElementById("tomorrowWatch").innerHTML = watch.length
    ? watch.slice(0, 5).map((item) => `<div class="watch-row"><span>${escapeHtml(item.statement)}</span>${item.confirmation || item.invalidation ? `<small>${item.confirmation ? `确认：${escapeHtml(item.confirmation)}` : ""}${item.confirmation && item.invalidation ? " · " : ""}${item.invalidation ? `失效：${escapeHtml(item.invalidation)}` : ""}</small>` : ""}${renderSourceLinks(item.source_ids)}</div>`).join("")
    : rowsForToday().slice(0, 4).map((row) => `<div class="watch-row">${escapeHtml(candidateNextStep(row))}</div>`).join("");

  renderResearchSources(brief);
}

function renderSectorStateMap() {
  const groups = state.marketPenetrationBrief?.sector_state_groups ?? deriveSectorGroups();
  const configs = [
    ["strengthening", "↗", "正在增强", "边际状态改善，但仍需持续性和成交确认。"],
    ["cooling", "⌁", "趋势仍强，但正在降温", "趋势尚未破坏，重点观察回落后的承接。"],
    ["overheated", "♨", "强势但过热", "短线拥挤或风险门警告，不把强势直接等同于新机会。"],
    ["weak", "◇", "弱势或证据不足", "缺少增量证据，暂时不进入主要观察序列。"]
  ];
  document.getElementById("sectorStateMap").innerHTML = configs.map(([key, icon, title, note]) => {
    const rows = Array.isArray(groups?.[key]) ? groups[key].slice(0, 4) : [];
    return `
      <article class="sector-state-card ${key}">
        <div class="sector-state-head"><span>${icon}</span>${escapeHtml(title)}</div>
        <div class="sector-state-body">
          ${rows.length ? rows.map((row, index) => renderSectorRow(row, key, index)).join("") : `<div class="sector-empty">今天暂无明确归入此组的板块。</div>`}
        </div>
        <div class="sector-state-note">${escapeHtml(note)}</div>
      </article>
    `;
  }).join("");
}

function renderCandidates() {
  const el = document.getElementById("candidateTable");
  const rows = rowsForToday();
  const countNote = document.getElementById("candidateCountNote");
  if (!rows.length) {
    countNote.textContent = "当前没有行业满足基础观察条件，系统不会补充虚假条目。";
    el.innerHTML = `<div class="error-state">没有加载到今日结构性观察行业。</div>`;
    document.getElementById("selectedCandidate").innerHTML = "";
    return;
  }
  countNote.textContent = rows.length < STRUCTURAL_OBSERVATION_LIMIT
    ? `当前仅有 ${rows.length} 个行业满足基础观察条件。`
    : `当前展示模型已发布排序中的前 ${STRUCTURAL_OBSERVATION_LIMIT} 个行业。`;

  el.innerHTML = `
    <div class="candidate-table-head" aria-hidden="true">
      <span>排名</span><span>行业</span><span>当前状态</span><span>核心依据</span><span>下一步观察</span>
    </div>
    ${rows.map((row, index) => `
      <button class="candidate-row${row.pool_id === selectedCandidate()?.pool_id ? " active" : ""}" data-candidate-id="${escapeHtml(row.pool_id)}" type="button" aria-pressed="${row.pool_id === selectedCandidate()?.pool_id}">
        <span class="candidate-rank" data-label="排名">${index + 1}</span>
        <span class="candidate-name" data-label="行业">${escapeHtml(poolName(row))}</span>
        <span class="status-badge ${candidateStatusClass(row)}" data-label="当前状态">${escapeHtml(candidateStatusLabel(row))}</span>
        <span class="candidate-copy" data-label="核心依据">${escapeHtml(candidateWhy(row))}</span>
        <span class="candidate-copy" data-label="下一步观察">${escapeHtml(candidateNextStep(row))}</span>
      </button>
    `).join("")}
  `;

  el.querySelectorAll("[data-candidate-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPoolId = button.getAttribute("data-candidate-id");
      renderCandidates();
      renderSelectedCandidate();
      renderAdvancedDetails();
    });
  });
  renderSelectedCandidate();
}

function renderSelectedCandidate() {
  const el = document.getElementById("selectedCandidate");
  const candidate = selectedCandidate();
  const score = candidate ? scoreRow(candidate.pool_id) ?? candidate : null;
  if (!candidate || !score) {
    el.innerHTML = "";
    return;
  }
  const context = candidateContext(candidate);
  const history = context.history;
  el.innerHTML = `
    <article class="selected-card">
      <div class="selected-card-head">
        <div>
          <h3>${escapeHtml(poolName(candidate))} · 技术细节</h3>
          <p>分数是模型内部观察尺度，不是概率，也不是交易指令。</p>
        </div>
        <span class="status-badge ${candidateStatusClass(candidate)}">${escapeHtml(candidateStatusLabel(candidate))}</span>
      </div>
      <p class="published-change">${escapeHtml(describePublishedChange({
        currentRank: rowsForToday().findIndex((row) => row.pool_id === candidate.pool_id) + 1,
        previousRank: history.previousRank,
        currentState: candidate.candidate_state,
        previousState: history.previousState
      }))}</p>
      <div class="selected-card-summary">
        ${miniMetric("综合观察分", fmt(candidate.observation_score), metricLevel(candidate.observation_score), "汇总多个观察维度的相对强度，不等于上涨概率。")}
        ${miniMetric("过热／拥挤度", fmt(candidate.overheat_score), metricLevel(candidate.overheat_score), "衡量短期拥挤、连续高位和追涨风险；数值越高，回撤风险通常越值得关注。")}
        ${miniMetric("中期主趋势强度", fmt(candidate.major_wave_score), metricLevel(candidate.major_wave_score), "衡量趋势、持续性和扩散证据，不代表未来一定上涨。")}
        ${miniMetric("风险闸门", visibleLabel(candidate.risk_gate_status), "", "检查数据质量、过热、冲突和映射风险是否触发硬性限制。")}
        ${miniMetric("数据证据质量", visibleLabel(candidate.evidence_quality), "", "表示核心数据来源、完整度和可验证程度。")}
        ${miniMetric("标的映射风险", visibleLabel(candidate.proxy_risk), "", "表示行业与代表 ETF 的对应是否直接、可靠。")}
        ${miniMetric("强势扩散方向", visibleLabel(candidate.direction), "", "表示强势是否从本行业向相关行业扩散，或只集中在内部。")}
        ${miniMetric("最高置信度", fmt(candidate.capped_confidence), metricLevel(candidate.capped_confidence, { scale: 1 }), "模型允许展示的置信度上限，用于防止少量数据产生假精确。")}
      </div>
      <div class="selected-reasons">
        <div class="selected-reason"><strong>主要依据</strong><br>${escapeHtml(candidateWhy(candidate))}</div>
        <div class="selected-reason caution"><strong>风险与边界</strong><br>${escapeHtml(candidateRiskBoundary(candidate))}</div>
      </div>
    </article>
  `;
}

function renderEvidenceReview() {
  const quality = state.quality ?? {};
  const market = state.market ?? {};
  const flow = state.flow ?? {};
  const mapping = state.mapping ?? {};
  const analytics = state.reviewAnalytics ?? {};
  const outcome = state.outcomeReport ?? {};
  const evidence = state.marketPenetrationBrief?.evidence_summary ?? {};
  const total = number(quality.total_pool_count || mapping.total_pool_count || 67);
  const marketCount = number(evidence.market_ohlcv_count ?? market.momentum_signal_count ?? market.mapped_pool_count);
  const flowCount = number(evidence.flow_available_count ?? ((flow.source_backed_flow_count ?? 0) + (flow.estimated_from_source_count ?? 0)));
  const fullCount = number(evidence.fully_mapped_count ?? quality.high_quality_signal_count ?? mapping.direct_etf_count);
  const directRatio = ratio(evidence.direct_evidence_ratio ?? quality.direct_evidence_ratio);
  const proxyRatio = ratio(evidence.proxy_evidence_ratio ?? quality.proxy_evidence_ratio);
  const reliability = evidence.reliability ?? reliabilityFromData({ total, marketCount, directRatio, reviewed: analytics.reviewed_rows ?? 0 });
  const reliabilityClass = reliability === "较高" ? "high" : reliability === "中等" ? "medium" : "low";

  const metrics = [
    ["OHLCV 可用", marketCount, total, marketCount / Math.max(total, 1)],
    ["Flow 可用", flowCount, total, flowCount / Math.max(total, 1)],
    ["高质量完整证据", fullCount, total, fullCount / Math.max(total, 1)],
    ["直接证据覆盖", `${Math.round(directRatio * 100)}%`, "", directRatio],
    ["代理证据覆盖", `${Math.round(proxyRatio * 100)}%`, "", proxyRatio]
  ];

  document.getElementById("evidenceReview").innerHTML = `
    <div class="reliability-line">
      <span>今天的结论有多可靠</span>
      <strong class="${reliabilityClass}">${escapeHtml(reliability)}</strong>
    </div>
    <div class="evidence-metrics">
      ${metrics.map(([label, value, denominator, progress]) => evidenceMetric(label, value, denominator, progress)).join("")}
    </div>
    <div class="review-mini-grid">
      ${reviewMini("已复盘", analytics.reviewed_rows ?? outcome.reviewed_count ?? 0)}
      ${reviewMini("待复盘", analytics.pending_rows ?? outcome.pending_count ?? 0)}
      ${reviewMini("暂不可用", analytics.unavailable_rows ?? outcome.unavailable_count ?? 0)}
    </div>
    <div class="evidence-note">${escapeHtml(evidence.note ?? state.summary?.main_caution ?? "代理证据仍需谨慎使用。")}</div>
    <div class="review-note">${escapeHtml(reviewBoundaryText(analytics, outcome))}</div>
  `;
}

function renderAdvancedDetails() {
  const candidate = selectedCandidate();
  const score = candidate ? scoreRow(candidate.pool_id) ?? candidate : {};
  const coverage = state.coverage ?? {};
  const flow = state.flow ?? {};
  const market = state.market ?? {};
  const mapping = state.mapping ?? {};
  const delta = state.delta ?? {};
  const outcome = state.outcomeReport ?? {};
  const analytics = state.reviewAnalytics ?? {};
  const reasons = reviewReasonCounts(state.outcomeReviews?.rows ?? []);
  const unavailable = analytics.unavailable_by_reason ?? outcome.unavailable_by_reason ?? {};
  const benchmarkSymbol = outcome.benchmark_proxy?.symbol ?? "510300";

  document.getElementById("dataHealth").innerHTML = `
    <div class="compact-facts">
      <span>总覆盖 ${pct(coverage.coverage_ratio)}</span>
      <span>Flow 可用 ${(flow.source_backed_flow_count ?? 0) + (flow.estimated_from_source_count ?? 0)}</span>
      <span>Flow 缺失 ${flow.missing_flow_count ?? 0}</span>
      <span>动量 ${market.momentum_signal_count ?? 0}</span>
      <span>流动性 ${market.liquidity_signal_count ?? 0}</span>
      <span>映射 ${(mapping.total_pool_count ?? 0) - (mapping.unmapped_count ?? 0)}</span>
      <span>代理 ${(mapping.sector_proxy_count ?? 0) + (mapping.broad_proxy_count ?? 0)}</span>
      <span>日差比较 ${delta.comparison_available ? "可用" : "不足"}</span>
    </div>
  `;

  document.getElementById("signalDetails").innerHTML = candidate ? `
    <div class="compact-facts">
      <span>资金数据 ${escapeHtml(visibleLabel(candidate.flow_status))}</span>
      <span>价格强度 ${escapeHtml(visibleLabel(candidate.momentum_status))}</span>
      <span>流动性 ${escapeHtml(visibleLabel(candidate.liquidity_status))}</span>
      <span>证据质量 ${escapeHtml(visibleLabel(candidate.evidence_quality))}</span>
      <span>映射风险 ${escapeHtml(visibleLabel(candidate.proxy_risk))}</span>
      <span>综合观察分 ${fmt(score.final_score ?? candidate.observation_score)}</span>
    </div>
  ` : "暂无选中候选。";

  document.getElementById("reviewDetails").innerHTML = `
    <p>A股复盘基准代理为 ${escapeHtml(benchmarkSymbol)}；该工具仅用于运营复盘，不代表完整 A 股市场。</p>
    <div class="compact-facts">
      <span>已到复盘期 ${outcome.due_review_count ?? 0}</span>
      <span>已复盘 ${analytics.reviewed_rows ?? outcome.reviewed_count ?? 0}</span>
      <span>等待确认 ${analytics.pending_rows ?? outcome.pending_count ?? 0}</span>
      <span>数据不可用 ${analytics.unavailable_rows ?? outcome.unavailable_count ?? 0}</span>
      ${REVIEW_REASONS.map((reason) => `<span>${escapeHtml(visibleLabel(reason))} ${reasons[reason] ?? unavailable[reason] ?? 0}</span>`).join("")}
    </div>
  `;
}

function deriveMarketSummary(rows) {
  const groups = deriveSectorGroups(rows);
  const avg = rows.length ? rows.reduce((sum, row) => sum + number(row.observation_score), 0) / rows.length : 0;
  const dominantStyle = dominantStyleFromRows(rows);
  const cautious = groups.overheated.length;
  return {
    market_regime: avg >= 65 ? "中性偏进攻" : avg >= 45 ? "中性" : "偏防守",
    dominant_style: dominantStyle,
    capital_state: rows.length >= 3 && number(rows[0]?.observation_score) - number(rows[2]?.observation_score) <= 4 ? "集中轮动" : "分化轮动",
    action_boundary: cautious ? "可跟踪，不追高" : "等待确认后跟踪"
  };
}

function deriveHeadline(rows) {
  if (!rows.length) return "今日候选数据不足，先保持观察，等待市场与资金证据补齐。";
  const names = rows.slice(0, 2).map(poolName).join("、");
  const caution = rows.filter(isOverheated).map(poolName).slice(0, 2);
  const strengthening = rows.filter((row) => row.candidate_state === "Major Candidate").map(poolName).slice(0, 2);
  if (caution.length && strengthening.length) return `${names}仍居前，但${caution.join("、")}过热风险上升；${strengthening.join("、")}进入承接观察区。`;
  if (caution.length) return `${names}保持前列，但${caution.join("、")}存在过热或风险门警告，当前更适合观察承接，不宜追高。`;
  return `${names}保持观察前列，趋势尚在，但仍需成交、相对强度与复盘结果继续确认。`;
}

function deriveSectorGroups(rows = rowsForToday()) {
  const candidates = rows.length ? rows : currentStateRows().slice(0, STRUCTURAL_OBSERVATION_LIMIT);
  const groups = { strengthening: [], cooling: [], overheated: [], weak: [] };
  for (const row of candidates) {
    const item = sectorGroupItem(row);
    if (isOverheated(row)) groups.overheated.push(item);
    else if (row.candidate_state === "Major Candidate" || row.candidate_state === "Early Right") groups.strengthening.push(item);
    else groups.cooling.push(item);
  }
  const selectedIds = new Set(candidates.map((row) => row.pool_id));
  const weakRows = (state.scores?.rows ?? [])
    .filter((row) => isAShareSector(row) && !selectedIds.has(row.pool_id))
    .sort((a, b) => number(a.final_score) - number(b.final_score))
    .slice(0, 4);
  groups.weak = weakRows.map((row) => ({
    pool_id: row.pool_id,
    pool_name: poolName(row),
    score: row.final_score,
    direction: "weak"
  }));
  return groups;
}

function sectorGroupItem(row) {
  return {
    pool_id: row.pool_id,
    pool_name: poolName(row),
    score: row.observation_score ?? row.final_score,
    overheat_score: row.overheat_score,
    candidate_state: row.candidate_state,
    risk_gate_status: row.risk_gate_status
  };
}

function renderSectorRow(row, key, index) {
  const score = number(row.score ?? row.observation_score ?? row.final_score);
  const bars = sparkBars(score, key, index);
  const arrow = key === "strengthening" ? "↗" : key === "cooling" ? "→" : key === "overheated" ? "!" : "↘";
  return `
    <div class="sector-row">
      <strong>${escapeHtml(row.pool_name ?? displayPoolName(row.pool_id))}</strong>
      <span class="sector-mini">
        <span class="sector-spark" aria-hidden="true">${bars.map((height) => `<i style="height:${height}%"></i>`).join("")}</span>
        <span>${arrow}</span>
      </span>
    </div>
  `;
}

function renderTransmissionChain(chain) {
  const nodes = Array.isArray(chain?.nodes) ? chain.nodes : [];
  if (!nodes.length) return "";
  return `
    <div>
      <div class="transmission-chain">
        ${nodes.map((node, index) => `${index ? `<span class="transmission-arrow">→</span>` : ""}<span class="transmission-node">${escapeHtml(node)}</span>`).join("")}
      </div>
      ${chain.note ? `<div class="transmission-note">${escapeHtml(chain.note)}${renderSourceLinks(chain.source_ids)}</div>` : renderSourceLinks(chain.source_ids)}
    </div>
  `;
}

function renderSourceLinks(sourceIds) {
  const ids = Array.isArray(sourceIds) ? sourceIds : [];
  if (!ids.length) return "";
  const sources = new Map((state.marketPenetrationBrief?.research_sources ?? []).map((source) => [source.source_id, source]));
  const links = ids.map((id) => sources.get(id)).filter(Boolean).slice(0, 3);
  if (!links.length) return "";
  return `<span class="inline-sources">${links.map((source, index) => `<a href="${escapeHtml(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(source.title)}">来源${index + 1}</a>`).join("")}</span>`;
}

function renderResearchSources(brief) {
  const el = document.getElementById("researchSources");
  const sources = Array.isArray(brief?.research_sources) ? brief.research_sources : [];
  if (!sources.length || brief?.ai_synthesis?.status !== "generated") {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `<strong>本次联网研究来源</strong><div>${sources.slice(0, 10).map((source) => `<a href="${escapeHtml(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(source.publisher)}</span>${escapeHtml(source.title)}</a>`).join("")}</div>`;
}

function safeUrl(value) {
  const url = String(value ?? "");
  return /^https?:\/\//i.test(url) ? url : "#";
}

function fallbackFacts(brief) {
  return (brief.market_facts ?? []).slice(0, 5).map((fact) => ({
    statement: `${displayPoolName(fact.pool_id) || fact.fact_text || "市场观察"}：代表工具当日变动 ${signedPct(fact.observed_return)}。`
  }));
}

function normalizeStatements(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => typeof item === "string" ? { statement: item } : { ...item, statement: item.statement ?? item.text ?? item.fact_text ?? "" })
    .filter((item) => item.statement);
}

function normalizeDrivers(primary, narratives) {
  const source = Array.isArray(primary) && primary.length
    ? primary
    : (narratives ?? []).slice(0, 4).map((item) => ({ statement: item.title, confidence: "unverified" }));
  return source
    .map((item) => typeof item === "string" ? { statement: item, confidence: "unverified" } : {
      statement: item.statement ?? item.title ?? item.text ?? "",
      mechanism: item.mechanism ?? "",
      source_ids: item.source_ids ?? [],
      confidence: item.confidence ?? item.evidence_status ?? "unverified"
    })
    .filter((item) => item.statement);
}

function candidateWhy(row) {
  return buildCoreBasis(row, candidateContext(row));
}

function candidateNextStep(row) {
  return buildNextObservation(row, candidateContext(row));
}

function candidateStatusLabel(row) {
  if (isOverheated(row)) return "短期偏热";
  return visibleLabel(row.candidate_state ?? row.observation_tier, "观察中");
}

function candidateStatusClass(row) {
  if (row.candidate_state === "Overheated" || number(row.overheat_score) >= 70) return "overheated";
  if (isOverheated(row)) return "warning";
  if (row.candidate_state === "Major Candidate") return "major";
  if (row.candidate_state === "Cooling") return "cooling";
  return "neutral";
}

function isOverheated(row) {
  return row?.candidate_state === "Overheated"
    || number(row?.overheat_score) >= 65
    || (row?.risk_gate_status === "caution" && number(row?.overheat_score) >= 50);
}

function candidateContext(row) {
  return {
    mapping: findPoolRow(state.instrumentMap, row.pool_id),
    market: findPoolRow(state.marketRows, row.pool_id),
    delta: findPoolRow(state.deltaRows, row.pool_id),
    history: publishedHistory(row.pool_id),
    displayName: poolName(row)
  };
}

function publishedHistory(poolId) {
  const rows = state.ledger?.rows ?? [];
  const currentAsOf = state.ledger?.as_of ?? latestAsOf();
  const previousDates = [...new Set(rows.map((row) => row.as_of).filter((date) => date && date < currentAsOf))]
    .sort((a, b) => b.localeCompare(a));
  const previousDate = previousDates[0] ?? null;
  const previousRows = previousDate ? rows.filter((row) => row.as_of === previousDate) : [];
  const previousIndex = previousRows.findIndex((row) => row.pool_id === poolId);
  const previous = previousIndex >= 0 ? previousRows[previousIndex] : null;
  const observedSessions = [currentAsOf, ...previousDates.slice(0, 4)]
    .filter(Boolean)
    .filter((date) => rows.some((row) => row.as_of === date && row.pool_id === poolId)).length;
  return {
    observedSessions,
    previousRank: previousIndex >= 0 ? previousIndex + 1 : null,
    previousState: previous?.candidate_state ?? null
  };
}

function findPoolRow(file, poolId) {
  return (file?.rows ?? []).find((row) => row.pool_id === poolId) ?? {};
}

function candidateRiskBoundary(row) {
  const parts = [];
  const overheat = Number(row.overheat_score);
  if (Number.isFinite(overheat)) {
    parts.push(overheat >= 70
      ? "短期拥挤度较高，回撤风险需要优先观察"
      : overheat >= 45
        ? "短期拥挤度处于中等区间"
        : "当前未触发明显过热警示");
  } else {
    parts.push("过热／拥挤度数据不足");
  }
  parts.push(`风险闸门：${visibleLabel(row.risk_gate_status)}`);
  parts.push(row.proxy_risk === "none" ? "当前未记录标的代理风险" : `标的映射风险：${visibleLabel(row.proxy_risk)}`);
  return `${parts.join("；")}。所有结论均为结构观察，不构成交易指令。`;
}

function crossCheckInterpretation(item) {
  const candidate = rowsForToday().find((row) => row.pool_id === item.pool_id);
  if (candidate) return candidateWhy(candidate);
  const direction = visibleLabel(item.hard_data_direction, "");
  return direction || "等待更多可验证的价格、流动性与连续性证据。";
}

function dominantStyleFromRows(rows) {
  const ids = rows.map((row) => String(row.pool_id ?? ""));
  if (ids.some((id) => /ai|computer|semiconductor|communication|electronics/.test(id))) return "科技成长";
  if (ids.some((id) => /brokerage|bank|insurance/.test(id))) return "大金融";
  if (ids.some((id) => /healthcare|pharma/.test(id))) return "医药防守";
  if (ids.some((id) => /resources|materials|energy|new_energy/.test(id))) return "资源制造";
  return "多线轮动";
}

function reviewBoundaryText(analytics, outcome) {
  const reviewed = number(analytics.reviewed_rows ?? outcome.reviewed_count);
  if (reviewed < 3) return "历史复盘样本仍不足，暂不用于胜率判断；待复盘和不可用记录不会被算作输赢。";
  return `当前已有 ${reviewed} 条有效复盘记录，仍需按状态和市场环境分组解读。`;
}

function reviewReasonCounts(rows) {
  const counts = Object.fromEntries(REVIEW_REASONS.map((reason) => [reason, 0]));
  const legacy = {
    pending_not_due: "pending_not_due",
    unavailable_market_closed: "awaiting_eod_data",
    unavailable_data_stale: "stale_data",
    unavailable_missing_price: "missing_price",
    unavailable_missing_benchmark: "missing_benchmark",
    skipped_invalid_baseline: "invalid_baseline"
  };
  for (const row of rows) {
    const reason = row.review_reason ?? legacy[row.review_status];
    if (reason in counts) counts[reason] += 1;
  }
  return counts;
}

function briefFreshness(brief, date) {
  if (!brief) return { className: "error", label: "穿透缺失", message: "市场穿透报告没有生成；请检查每日构建链路。" };
  if (!brief.as_of || date === "--") return { className: "neutral", label: "日期待确认", message: "无法确认市场穿透报告是否为最新。" };
  if (brief.as_of !== date) return {
    className: "stale",
    label: "穿透已过期",
    message: `市场数据已更新至 ${date}，但市场穿透仍停留在 ${brief.as_of}。页面已明确标记，避免把旧解释当成今晚结论。`
  };
  return { className: "fresh", label: "数据已同步", message: "" };
}

function confidenceClass(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("confirm") || text.includes("primary")) return "confirmed";
  if (text.includes("possible") || text.includes("hypothesis")) return "possible";
  if (text.includes("system") || text.includes("hard_data")) return "system";
  return "unverified";
}

function confidenceLabel(value) {
  const className = confidenceClass(value);
  return className === "confirmed" ? "已确认" : className === "possible" ? "可能" : className === "system" ? "系统数据" : "未证实";
}

function agreementClass(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("支持") || text.includes("confirm") || text.includes("一致")) return "major";
  if (text.includes("风险") || text.includes("caution") || text.includes("分歧")) return "warning";
  return "neutral";
}

function reliabilityFromData({ total, marketCount, directRatio, reviewed }) {
  if (marketCount / Math.max(total, 1) >= 0.9 && directRatio >= 0.6 && reviewed >= 3) return "较高";
  if (marketCount / Math.max(total, 1) >= 0.8 && directRatio >= 0.3) return "中等";
  return "偏低";
}

function evidenceMetric(label, value, denominator, progress) {
  const display = denominator ? `${escapeHtml(value)}/${escapeHtml(denominator)}` : escapeHtml(value);
  const width = Math.max(0, Math.min(100, Math.round(number(progress) * 100)));
  return `
    <div class="evidence-metric">
      <div class="evidence-metric-head"><span>${escapeHtml(label)}</span><strong>${display}</strong></div>
      <div class="progress-track"><i style="width:${width}%"></i></div>
    </div>
  `;
}

function reviewMini(label, value) {
  return `<div class="review-mini"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function miniMetric(label, value, level = "", explanation = "") {
  return `
    <div class="mini-metric"${explanation ? ` title="${escapeHtml(explanation)}"` : ""}>
      <span>${escapeHtml(label)}${explanation ? `<i class="metric-help" aria-label="${escapeHtml(explanation)}">?</i>` : ""}</span>
      <strong>${escapeHtml(value)}${level ? `<small>${escapeHtml(level)}</small>` : ""}</strong>
    </div>
  `;
}

function sparkBars(score, key, index) {
  const base = Math.max(18, Math.min(88, score || (key === "weak" ? 25 : 60)));
  const direction = key === "strengthening" ? 7 : key === "cooling" ? 1 : key === "overheated" ? 5 : -6;
  return [0, 1, 2, 3, 4].map((step) => Math.max(12, Math.min(96, base - 20 + step * direction + ((index + step) % 3) * 4)));
}

function isAShareSector(row) {
  const id = String(row.pool_id ?? "");
  return id.startsWith("a_share_") && !["a_share_a_share", "a_share_btc", "a_share_gold", "a_share_sp500", "a_share_us_equity"].includes(id);
}

function poolName(row) {
  return displayPoolName(row?.pool_id, row?.pool_name);
}

function displayPoolName(poolId, fallback = "") {
  return POOL_NAME_MAP[poolId] ?? fallback ?? poolId ?? "未知板块";
}

function fmt(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "--";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits).replace(/\.00$/, "") : String(value);
}

function pct(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${Math.round(parsed * 100)}%` : "--";
}

function signedPct(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "--";
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(2)}%`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratio(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
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
  const [summary, ledger, schedule, quality, pointer, delta, coverage, flow, market, mapping, instrumentMap, scores, marketRows, deltaRows, candidateStateModel, outcomeReviews, outcomeReport, reviewReadiness, reviewAnalytics, marketPenetrationBrief] = await Promise.all([
    readJson("./data/evening_observation_summary.json", {}),
    readJson("./data/observation_candidate_ledger.json", { rows: [] }),
    readJson("./data/candidate_review_schedule.json", {}),
    readJson("./data/signal_quality_report.json", {}),
    readJson("./data/history/latest_observation_pointer.json", {}),
    readJson("./data/daily_delta_report.json", {}),
    readJson("./data/data_coverage_report.json", {}),
    readJson("./data/flow_channel_report.json", {}),
    readJson("./data/market_signal_report.json", {}),
    readJson("./data/pool_mapping_report.json", {}),
    readJson("./data/pool_instrument_map.json", { rows: [] }),
    readJson("./data/pool_observation_scores.json", { rows: [] }),
    readJson("./data/pool_market_signals.json", { rows: [] }),
    readJson("./data/pool_delta_signals.json", { rows: [] }),
    readJson("./data/candidate_state_model.json", { rows: [] }),
    readJson("./data/candidate_outcome_reviews.json", { rows: [] }),
    readJson("./data/outcome_review_report.json", {}),
    readJson("./data/review_readiness_report.json", {}),
    readJson("./data/candidate_review_analytics.json", {}),
    readJson("./data/market_penetration_brief.json", null)
  ]);

  Object.assign(state, {
    summary,
    ledger,
    schedule,
    quality,
    pointer,
    delta,
    coverage,
    flow,
    market,
    mapping,
    instrumentMap,
    scores,
    marketRows,
    deltaRows,
    candidateStateModel,
    outcomeReviews,
    outcomeReport,
    reviewReadiness,
    reviewAnalytics,
    marketPenetrationBrief
  });
  state.selectedPoolId = rowsForToday()[0]?.pool_id ?? null;

  renderHeaderAndHero();
  renderMarketPenetration();
  renderSectorStateMap();
  renderCandidates();
  renderEvidenceReview();
  renderAdvancedDetails();
}

init().catch((error) => {
  console.error("Financial Ponds dashboard failed to initialize", error);
  const freshEl = document.getElementById("headerFreshness");
  if (freshEl) {
    freshEl.className = "freshness-pill error";
    freshEl.textContent = "页面加载失败";
  }
});
