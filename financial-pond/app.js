import { evaluatePublicationFreshness } from "./publication-freshness.mjs";

const ENTRY_LABELS = Object.freeze({
  ready_now: "当前可进入买入评估",
  probe_only: "只适合试探仓",
  wait_confirmation: "等待确认",
  wait_pullback: "等待回撤",
  do_not_chase: "不宜追入",
  invalid: "当前不成立"
});

const STRUCTURE_LABELS = Object.freeze({
  confirmed_trend: "确认趋势",
  major_candidate: "主线候选",
  watch_candidate: "观察候选",
  cooling: "结构降温",
  deteriorating: "结构恶化",
  conflict_review: "冲突复核",
  price_only: "仅价格异动",
  insufficient: "证据不足",
  avoid: "回避"
});

const GROUPS = Object.freeze([
  ["probe_only", "试探候选"],
  ["wait_confirmation", "等待确认"],
  ["wait_pullback", "等待回撤"],
  ["do_not_chase", "不宜追入"],
  ["invalid", "当前不成立"]
]);

let manifest;
let assessment;
let decision;
let penetration;
let review;
let tradingCalendar;

async function init() {
  [manifest, tradingCalendar] = await Promise.all([
    readRequired("./data/daily_manifest.json"),
    readRequired("./data/a-share-trading-calendar.json")
  ]);
  validateManifest(manifest);

  // Publication conclusions are intentionally loaded only after the manifest passes.
  [assessment, decision, penetration, review] = await Promise.all([
    readOfficial("sector_assessment"),
    readOfficial("entry_decision"),
    readOfficial("market_penetration"),
    readOfficial("review_analytics")
  ]);
  validateBundle();
  render();
}

async function readOfficial(role) {
  const filename = manifest.artifacts[role];
  if (!filename) throw new Error(`Manifest does not declare ${role}`);
  if (filename.includes("/") || filename.includes("..")) throw new Error(`Unsafe artifact path: ${filename}`);
  return readRequired(`./data/${filename}`);
}

async function readRequired(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Required artifact ${path} returned HTTP ${response.status}`);
  return response.json();
}

function validateManifest(value) {
  const required = ["sector_assessment", "entry_decision", "market_penetration", "review_analytics"];
  if (value?.status !== "validated" || value.validation_status !== "passed") throw new Error("Daily manifest is not validated");
  if (!value.as_of || !value.model_version || !value.input_snapshot_id) throw new Error("Daily manifest provenance is incomplete");
  if (!required.every((key) => value.artifacts?.[key])) throw new Error("Daily manifest is missing an official artifact");
}

function validateBundle() {
  const files = [assessment, decision, penetration, review];
  if (files.some((file) => file?.as_of !== manifest.as_of)) throw new Error("Mixed as_of dates rejected");
  if (assessment.model_version !== manifest.model_version || decision.model_version !== manifest.model_version) {
    throw new Error("Mixed model versions rejected");
  }
  if (assessment.input_snapshot_id !== manifest.input_snapshot_id || decision.input_snapshot_id !== manifest.input_snapshot_id) {
    throw new Error("Mixed input snapshots rejected");
  }
}

function render() {
  text("headerDataDate", manifest.as_of);
  text("headerMode", manifest.mode === "offline" ? "离线可复现" : "正式日更");
  const bundleStatus = document.getElementById("headerBundleStatus");
  bundleStatus.textContent = "Bundle 同步";
  bundleStatus.className = "freshness-pill fresh";

  const publicationFreshness = evaluatePublicationFreshness({
    asOf: manifest.as_of,
    calendar: tradingCalendar
  });
  const freshness = document.getElementById("headerFreshness");
  freshness.textContent = publicationFreshness.label;
  freshness.className = `freshness-pill ${publicationFreshness.state === "unknown" ? "neutral" : publicationFreshness.state}`;

  const degraded = manifest.degraded_channels ?? [];
  document.getElementById("degradedChannels").innerHTML = degraded.length
    ? `<strong>受限证据：</strong>${degraded.map(channelLabel).join("、")}。受限渠道降低确认覆盖与最高入场状态，不会被补成零。`
    : "所有正式证据渠道均可用。";

  renderHeadline();
  renderCandidateSpotlight();
  renderGroups();
  renderUniverse();
  renderReview();
}

function renderHeadline() {
  const title = document.getElementById("guidanceHeadline");
  const copy = document.getElementById("guidanceSummary");
  if (decision.no_qualified_candidate) {
    title.textContent = "当前没有满足条件的 ETF 买入候选。";
    copy.textContent = "系统完成淘汰与入场资格检查后没有强行选择对象。继续等待方向、确认、持续性或风险条件改善。";
    return;
  }
  const primary = decision.primary_entry_candidate;
  title.textContent = primary
    ? `首选候选：${primary.etf_name}（${primary.etf_symbol}）`
    : "存在入场合格对象，但决策维度并列，未强行指定首选。";
  copy.textContent = primary?.thesis ?? decision.selection_note;
}

function renderCandidateSpotlight() {
  const container = document.getElementById("candidateSpotlight");
  const candidates = [
    ["首选候选", decision.primary_entry_candidate],
    ["次选候选", decision.secondary_entry_candidate]
  ].filter(([, row]) => row);
  container.innerHTML = candidates.length
    ? candidates.map(([label, summary]) => {
        const row = decision.rows.find((item) => item.pool_id === summary.pool_id);
        return guidanceCard(row, label, true);
      }).join("")
    : `<div class="no-candidate-card"><span>有效结论</span><strong>不强行选出 ETF</strong><p>当前没有对象通过淘汰与入场资格门槛，系统没有强行指定候选。</p></div>`;
}

function renderGroups() {
  const target = document.getElementById("guidanceGroups");
  target.innerHTML = GROUPS.map(([state, label]) => {
    const rows = decision.rows.filter((row) => row.entry_state === state);
    return `
      <section class="guidance-group">
        <div class="group-heading"><h3>${label}</h3><span>${rows.length} 个</span></div>
        <div class="guidance-card-list">
          ${rows.length ? rows.map((row) => guidanceCard(row)).join("") : `<p class="empty-state">当前没有此状态的 ETF。</p>`}
        </div>
      </section>
    `;
  }).join("");
}

function guidanceCard(row, label = null, expanded = false) {
  const limitations = row.data_limitations ?? [];
  const failureMode = row.explanation_mode === "failure_recovery";
  const explanationColumns = failureMode
    ? `
          ${evidenceList("当前失败闸门", row.current_failed_gates, "contrary")}
          ${evidenceList("重获观察资格", row.watch_eligibility_requirements, "next")}
          ${evidenceList("重获入场资格", row.entry_eligibility_requirements, "support")}
        `
    : `
          ${evidenceList("支持证据", row.supporting_evidence, "support")}
          ${evidenceList("反对证据", row.contrary_evidence, "contrary")}
          ${evidenceList("下一确认", row.next_confirmation, "next")}
          ${evidenceList("未来失效条件", row.invalidation, "invalid")}
        `;
  return `
    <article class="guidance-card state-${escapeHtml(row.entry_state)}">
      <div class="guidance-card-head">
        <div>
          ${label ? `<span class="card-eyebrow">${escapeHtml(label)}</span>` : ""}
          <h4>${escapeHtml(row.etf_name)} <small>${escapeHtml(row.etf_symbol)}</small></h4>
          <p>${escapeHtml(row.thesis)}</p>
        </div>
        <span class="entry-pill ${escapeHtml(row.entry_state)}">${escapeHtml(ENTRY_LABELS[row.entry_state] ?? row.entry_state)}</span>
      </div>
      <div class="metric-strip">
        ${metric("结构", STRUCTURE_LABELS[row.structure_state] ?? row.structure_state)}
        ${metric("方向", signed(row.direction_score))}
        ${metric("确认", `${format(row.confirmation_score)} / 覆盖 ${percent(row.confirmation_coverage)}`)}
        ${metric("证据", `${format(row.evidence_score)} · ${evidenceLabel(row.evidence_level)}`)}
      </div>
      <details ${expanded ? "open" : ""}>
        <summary>${failureMode ? "查看当前失败与恢复条件" : "查看依据、反证与未来失效条件"}</summary>
        <div class="evidence-columns">
          ${explanationColumns}
        </div>
        ${limitations.length ? `<p class="limitations"><strong>数据限制：</strong>${limitations.map(escapeHtml).join("；")}</p>` : ""}
      </details>
    </article>
  `;
}

function renderUniverse() {
  const target = document.getElementById("universeTable");
  target.innerHTML = assessment.rows.map((row) => `
    <div class="universe-row">
      <div><strong>${escapeHtml(row.etf_name)}</strong><small>${escapeHtml(row.etf_symbol)} · ${escapeHtml(row.pool_id)}</small></div>
      <span>${escapeHtml(STRUCTURE_LABELS[row.structure_state] ?? row.structure_state)}</span>
      <span class="${row.direction_score >= 0 ? "positive" : "negative"}">${signed(row.direction_score)}</span>
      <span>${format(row.confirmation_score)} / ${percent(row.confirmation_coverage)}</span>
      <span>${format(row.evidence_score)} · ${evidenceLabel(row.evidence_level)}</span>
      <span>${escapeHtml(ENTRY_LABELS[decision.rows.find((item) => item.pool_id === row.pool_id)?.entry_state] ?? "--")}</span>
    </div>
  `).join("");
}

function renderReview() {
  const legacy = review.preserved_legacy_review_summary ?? {};
  const counts = review.status_counts ?? {};
  document.getElementById("reviewSummary").innerHTML = `
    <div class="review-metrics">
      ${metric("正式周期", review.review_horizons.join(" / "))}
      ${metric("新模型已复盘", format(counts.reviewed))}
      ${metric("新模型待复盘", format(counts.pending))}
      ${metric("新模型不可用", format((counts.unavailable ?? 0) + (counts.skipped ?? 0)))}
      ${metric("已保留旧复盘", format(legacy.reviewed_rows))}
    </div>
    <p>复盘只使用精确交易会话价格，不使用最新收盘价替代。pending、reviewed、unavailable、skipped 保持独立。</p>
  `;
}

function evidenceList(title, items = [], className) {
  return `
    <div class="evidence-list ${className}">
      <h5>${title}</h5>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>暂无</li>"}</ul>
    </div>
  `;
}

function metric(label, value) {
  return `<div class="guidance-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function format(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1).replace(/\.0$/, "") : "--";
}

function signed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number > 0 ? "+" : ""}${format(number)}` : "--";
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100)}%` : "--";
}

function evidenceLabel(value) {
  return ({ high: "高", medium: "中", low: "低", insufficient: "不足" })[value] ?? value ?? "--";
}

function channelLabel(value) {
  return ({ breadth: "内部扩散", direct_flow: "独立ETF份额流" })[value] ?? value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

init().catch((error) => {
  console.error("Financial Ponds failed closed", error);
  document.body.classList.add("publication-error");
  text("headerBundleStatus", "Bundle 校验失败");
  text("headerFreshness", "发布合同失败");
  text("guidanceHeadline", "今日指导不可用");
  text("guidanceSummary", "正式清单或同日数据未通过验证，页面拒绝显示旧结论。");
});
