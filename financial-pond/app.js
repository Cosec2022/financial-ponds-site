const sectorNames = {
  brokerage: "券商",
  bank_insurance: "银行保险",
  semiconductor: "半导体",
  ai_computer: "AI计算机",
  communication_electronics: "通信电子",
  new_energy_ev: "新能源车",
  healthcare_pharma: "医药医疗",
  consumer: "消费",
  defense_military: "军工",
  resources_materials: "资源材料",
  real_estate_infra: "地产基建",
  electric_power: "电力行业",
  a_share: "A股总池",
  agriculture: "农林牧渔",
  food_beverage: "食品饮料",
  home_appliances: "家用电器",
  textile_apparel: "纺织服饰",
  light_manufacturing: "轻工制造",
  retail: "商贸零售",
  social_services: "社会服务",
  beauty_care: "美容护理",
  transportation: "交通运输",
  utilities: "公用事业",
  environmental_protection: "环保",
  petroleum_petrochemical: "石油石化",
  coal: "煤炭",
  steel: "钢铁",
  nonferrous_metals: "有色金属",
  basic_chemicals: "基础化工",
  building_materials: "建筑材料",
  construction: "建筑装饰",
  machinery: "机械设备",
  media: "传媒"
};

const componentNames = {
  direct_flow: "ETF份额/资金流",
  market_confirmation: "价格和成交确认",
  market_liquidity: "A股总水位",
  policy_sentiment: "政策/新闻压力",
  fundamental_proxy: "基本面代理",
  external_factor_effect: "外部风险因子"
};

const state = {
  dashboard: null,
  general: null,
  flow: null,
  rotation: null,
  rotationHistory: null,
  news: null,
  pondMap: null,
  selectedPondId: "a_share"
};

const fallbackDashboard = {
  as_of: "not loaded",
  model_version: "unknown",
  entities: {},
  edges: [],
  groups: { nodes: [], pools: [], assets: [], portfolios: [] }
};

async function readJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load ${path}`, error);
    return fallback;
  }
}

function scoreClass(score) {
  if (typeof score !== "number") return "neutral";
  if (score > 0.18) return "positive";
  if (score < -0.18) return "negative";
  return "neutral";
}

function heatClass(value) {
  if (typeof value !== "number") return "neutral";
  if (value >= 0.6) return "hot";
  if (value <= 0.32) return "cold";
  return "warm";
}

function valuationClass(value) {
  if (typeof value !== "number") return "neutral";
  if (value >= 0.24) return "expensive";
  if (value <= -0.12) return "cheap";
  return "fair";
}

function formatScore(score) {
  return typeof score === "number" ? score.toFixed(2) : "--";
}

function formatPct(score) {
  return typeof score === "number" ? `${Math.round(score * 100)}%` : "--";
}

function plainSectorId(row) {
  return row.sector_id ?? String(row.pool_id ?? "").replace(/^a_share_/, "");
}

function sectorLabel(row) {
  const id = plainSectorId(row);
  return sectorNames[id] ?? row.display_name ?? row.name ?? id;
}

function getReview(pondId) {
  const rows = state.flow?.sector_reviews ?? [];
  if (pondId === "a_share") return null;
  return rows.find((row) => plainSectorId(row) === pondId || row.pool_id === `a_share_${pondId}`) ?? null;
}

function getPond(pondId) {
  return (state.pondMap?.ponds ?? []).find((pond) => pond.id === pondId) ?? null;
}

function getKeywords(pondId) {
  return (state.pondMap?.keyword_groups ?? []).filter((group) => group.pond_id === pondId);
}

function getNewsPressure(pondId) {
  if (!state.news) return null;
  return (state.news.sector_news_pressure ?? []).find((row) => row.sector_id === pondId) ?? null;
}


function graphOverrideKey(pondId) {
  return `financialPonds.graphOverride.${pondId}`;
}

function readGraphOverride(pondId) {
  try {
    return JSON.parse(localStorage.getItem(graphOverrideKey(pondId)) || "{}");
  } catch {
    return {};
  }
}

function writeGraphOverride(pondId, override) {
  localStorage.setItem(graphOverrideKey(pondId), JSON.stringify(override, null, 2));
}

function effectiveUpstream(pond) {
  const base = (pond.upstream ?? []).map((item) => ({ ...item, source: "base" }));
  const override = readGraphOverride(pond.id);
  const removed = new Set(override.removed_nodes ?? []);
  const adjusted = override.adjusted_nodes ?? {};
  const added = override.added_nodes ?? [];
  return base
    .filter((item) => !removed.has(item.id))
    .map((item) => ({ ...item, ...(adjusted[item.id] ?? {}), source: adjusted[item.id] ? "local_adjusted" : item.source }))
    .concat(added.map((item) => ({ ...item, source: "local_added" })));
}

function graphProposals(pondId) {
  return state.pondMap?.graph_adaptation?.pond_proposals?.[pondId] ?? [];
}

function actionLabel(action) {
  const map = {
    add_node: "建议新增节点",
    adjust_weight: "建议调整权重",
    decay_keyword_and_edge: "建议降权/衰减",
    archive_node: "建议归档节点"
  };
  return map[action] ?? action ?? "建议";
}

function statusLabel(status) {
  const map = {
    candidate: "候选",
    active: "活跃",
    cooling: "降温",
    archived: "归档",
    conditional: "条件触发",
    needs_market_confirmation: "等待市场确认"
  };
  return map[status] ?? status ?? "--";
}

function coverageStatusLabel(status) {
  const map = {
    provider_mapped_representative: "代表ETF",
    framework_only: "框架位"
  };
  return map[status] ?? status ?? "--";
}

function renderHeader() {
  document.getElementById("asOfBadge").textContent = `数据日期 ${state.flow?.as_of ?? state.dashboard.as_of}`;
  document.getElementById("modelBadge").textContent = state.flow?.model_id ?? state.dashboard.model_version ?? "model";
}

function componentAvailable(row, componentName) {
  return Boolean(row?.components?.[componentName]?.available);
}

function average(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function dataStatusLabel() {
  const rows = state.flow?.sector_reviews ?? [];
  const dataMode = state.flow?.data_availability?.mode;
  const directFlowCount = rows.filter((row) => componentAvailable(row, "direct_flow")).length;
  const confirmationCount = rows.filter((row) => componentAvailable(row, "market_confirmation")).length;
  const newsFallback = Boolean(state.news?.collection?.fallback_used);
  if (!rows.length) return { label: "无行业数据", className: "negative" };
  if (dataMode === "price_volume_only") return { label: "价量可参考，ETF流缺失", className: "warm" };
  if (dataMode === "partial_etf_flow") return { label: "部分ETF流可参考", className: "warm" };
  if (directFlowCount && confirmationCount && !newsFallback) return { label: "硬数据可参考", className: "positive" };
  if (directFlowCount && confirmationCount) return { label: "硬数据可参考，新闻为样例", className: "warm" };
  return { label: "仅部分可参考", className: "warm" };
}

function availabilityModeLabel(mode) {
  const map = {
    etf_flow_ready: "ETF流可用",
    partial_etf_flow: "ETF流部分可用",
    price_volume_only: "ETF流缺失",
    thin_data: "数据较薄"
  };
  return map[mode] ?? "等待数据";
}

function availabilityHeadlineCn(availability) {
  if (!availability) return "等待 sector_flow_review.json 输出数据可用度。";
  if (availability.mode === "etf_flow_ready") return "代表行业 ETF 流和价量确认都已进入模型。";
  if (availability.mode === "partial_etf_flow") return "只有部分代表行业有 ETF 份额/资金流输入，轮动强度需要打折看。";
  if (availability.mode === "price_volume_only") return "ETF 份额/资金流今天缺失，当前排序主要来自价量、水位和新闻压力。";
  return "行业输入偏薄，只适合检查流程和观察相对变化。";
}

function generalLabel(label) {
  const map = {
    constructive: "正向",
    mild_positive: "温和正向",
    neutral: "中性",
    mild_pressure: "温和压力",
    pressure: "压力",
    unavailable: "暂无"
  };
  return map[label] ?? label ?? "--";
}

function confirmationText(row) {
  const parts = [];
  if (componentAvailable(row, "direct_flow")) parts.push("ETF流");
  if (componentAvailable(row, "market_confirmation")) parts.push("价量");
  if (componentAvailable(row, "market_liquidity")) parts.push("水位");
  if (componentAvailable(row, "policy_sentiment")) parts.push("新闻");
  return parts.length ? parts.join(" + ") : "等待输入";
}

function renderReferencePanel() {
  const rows = [...(state.flow?.sector_reviews ?? [])];
  const panel = document.getElementById("referencePanel");
  const status = dataStatusLabel();
  const statusBadge = document.getElementById("referenceStatus");
  statusBadge.textContent = status.label;
  statusBadge.className = `pill ${status.className}`;

  if (!rows.length) {
    panel.innerHTML = `<div class="empty">暂无可参考行业数据。等待 daily workflow 生成 sector_flow_review.json。</div>`;
    return;
  }

  const sorted = rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = sorted.slice(0, 3);
  const bottom = [...sorted].reverse().slice(0, 3);
  const directFlowCount = rows.filter((row) => componentAvailable(row, "direct_flow")).length;
  const confirmationCount = rows.filter((row) => componentAvailable(row, "market_confirmation")).length;
  const avgConfidence = average(rows.map((row) => row.confidence));
  const avgCompleteness = average(rows.map((row) => row.data_completeness));
  const newsFallback = Boolean(state.news?.collection?.fallback_used);
  const availability = state.flow?.data_availability;
  const representativeCount = availability?.counts?.representative_sectors ?? rows.length;
  const representativeDirectFlowCount = availability?.counts?.representative_direct_flow_inputs ?? directFlowCount;
  const representativeConfirmationCount = availability?.counts?.representative_price_volume_confirmations ?? confirmationCount;
  const techRows = ["semiconductor", "ai_computer", "communication_electronics"]
    .map((id) => rows.find((row) => plainSectorId(row) === id))
    .filter(Boolean);
  const techAvg = average(techRows.map((row) => row.score));
  const strongest = top[0];
  const weakest = bottom[0];
  const general = state.general;
  const sp500 = general?.group_summary?.sp500;
  const aShareMarket = general?.group_summary?.a_share_market;

  panel.innerHTML = `
    <article class="reference-card primary">
      <span>通用模型</span>
      <strong>${general?.counts?.pools ?? 0} 个池</strong>
      <p>${general?.headline ?? "等待 general_pool_analysis.json 生成。"} 同一组件契约覆盖标普500与A股行业。</p>
    </article>
    <article class="reference-card">
      <span>标普500对照</span>
      <strong class="score ${scoreClass(sp500?.score)}">${formatScore(sp500?.score)}</strong>
      <p>${sp500?.name ?? "S&P 500"} · ${generalLabel(sp500?.label)} · 完整度 ${formatPct(sp500?.data_completeness)}；A股总池 ${formatScore(aShareMarket?.score)}。</p>
    </article>
    <article class="reference-card primary">
      <span>今天最强</span>
      <strong>${sectorLabel(strongest)}</strong>
      <p>模型分 <b class="score ${scoreClass(strongest.score)}">${formatScore(strongest.score)}</b> · ${labelText(strongest.label)} · ${confirmationText(strongest)}</p>
    </article>
    <article class="reference-card risk">
      <span>风险观察</span>
      <strong>${sectorLabel(weakest)}</strong>
      <p>模型分 <b class="score ${scoreClass(weakest.score)}">${formatScore(weakest.score)}</b> · ${labelText(weakest.label)} · ${confirmationText(weakest)}</p>
    </article>
    <article class="reference-card">
      <span>科技链合成</span>
      <strong class="score ${scoreClass(techAvg)}">${formatScore(techAvg)}</strong>
      <p>半导体 / AI计算机 / 通信电子。用于观察全球科技风险是否被A股价量确认。</p>
    </article>
    <article class="reference-card">
      <span>数据质量</span>
      <strong>${directFlowCount}/${rows.length}</strong>
      <p>ETF流输入 ${directFlowCount} 个；价量确认 ${confirmationCount} 个；平均置信度 ${formatScore(avgConfidence)}；完整度 ${formatScore(avgCompleteness)}。</p>
    </article>
    <article class="reference-card ${availability?.mode === "price_volume_only" ? "warning" : ""}">
      <span>ETF流状态</span>
      <strong>${availabilityModeLabel(availability?.mode)}</strong>
      <p>代表行业 ETF流 ${representativeDirectFlowCount}/${representativeCount}；价量确认 ${representativeConfirmationCount}/${representativeCount}。${availabilityHeadlineCn(availability)}</p>
    </article>
    <article class="reference-card wide ${newsFallback ? "warning" : ""}">
      <span>新闻层状态</span>
      <strong>${newsFallback ? "样例新闻" : "新闻可用"}</strong>
      <p>${state.news?.headline ?? "暂无新闻层输出"} ${newsFallback ? "因此新闻只用于检查流程，不参与强结论。" : "新闻仍需硬数据确认。"}</p>
    </article>
    <article class="reference-card wide">
      <span>使用边界</span>
      <strong>可做观察，不做买卖指令</strong>
      <p>当前最有参考意义的是通用池状态、行业间相对强弱、ETF流/价量确认、数据完整度。Global Liquidity Graph 的旧 mock 分数只保留为技术视图。</p>
    </article>
    <div class="reference-list">
      <h3>强势候选</h3>
      ${top.map(referenceRowTemplate).join("")}
    </div>
    <div class="reference-list">
      <h3>弱势/流出观察</h3>
      ${bottom.map(referenceRowTemplate).join("")}
    </div>
  `;
}

function renderRotationPanel() {
  const panel = document.getElementById("rotationPanel");
  const statusBadge = document.getElementById("rotationStatus");
  const rotation = state.rotation;

  if (!panel || !statusBadge) return;
  if (!rotation || rotation.status !== "rotation_available") {
    statusBadge.textContent = "等待轮动数据";
    statusBadge.className = "pill warm";
    panel.innerHTML = `<div class="empty">暂无行业轮动情报。等待 sector_rotation_intelligence.json 生成。</div>`;
    return;
  }

  const status = rotationStatusLabel(rotation.rotation_state);
  statusBadge.textContent = status.label;
  statusBadge.className = `pill ${status.className}`;
  const leaders = rotation.leaders ?? [];
  const laggards = rotation.laggards ?? [];
  const clusters = rotation.cluster_reviews ?? [];
  const pairs = rotation.rotation_pairs ?? [];
  const history = state.rotationHistory;

  panel.innerHTML = `
    <article class="rotation-card headline">
      <span>当前判断</span>
      <strong>${rotation.headline}</strong>
      <p>强弱差 ${formatScore(rotation.score_spread)} · 证据层级 ${evidenceLabel(rotation.evidence_level)} · 置信度 ${formatScore(rotation.confidence)} · 完整度 ${formatScore(rotation.data_completeness)}</p>
    </article>
    <article class="rotation-card">
      <span>领先行业</span>
      ${leaders.map(rotationSectorTemplate).join("")}
    </article>
    <article class="rotation-card">
      <span>弱势观察</span>
      ${laggards.map(rotationSectorTemplate).join("")}
    </article>
    <article class="rotation-card">
      <span>风格分组</span>
      ${clusters.map((cluster) => `
        <button class="rotation-row" data-pond-id="${cluster.strongest_sector?.sector_id ?? ""}" type="button">
          <span>${cluster.name}</span>
          <b class="score ${scoreClass(cluster.score)}">${formatScore(cluster.score)}</b>
          <small>${clusterLabel(cluster.label)} · 组内最强 ${cluster.strongest_sector?.name ?? "--"}</small>
        </button>
      `).join("")}
    </article>
    <article class="rotation-card">
      <span>历史确认</span>
      <strong>${historyTrendLabel(history?.trend_state)}</strong>
      <p>已保存 ${history?.sample_days ?? 0} 个交易日；趋势确认至少需要 ${history?.min_required_days_for_trend ?? 3} 个交易日。</p>
      <small>${history?.headline ?? "等待 sector_rotation_history.json 生成。"}</small>
      ${trendConfirmationTemplate(history)}
    </article>
    <article class="rotation-card wide">
      <span>可能的切换路径</span>
      ${pairs.map((pair) => `
        <button class="rotation-pair" data-pond-id="${pair.to_sector?.sector_id ?? ""}" type="button">
          <strong>${pair.from_sector?.name ?? "--"} → ${pair.to_sector?.name ?? "--"}</strong>
          <b class="score ${scoreClass(pair.score_gap)}">${formatScore(pair.score_gap)}</b>
          <small>${pair.reading}</small>
        </button>
      `).join("")}
    </article>
    <article class="rotation-card wide">
      <span>今天要盯的点</span>
      <ul class="watch-list">
        ${(rotation.watch_points ?? []).map((point) => `<li>${point}</li>`).join("")}
      </ul>
    </article>
  `;

  panel.querySelectorAll("[data-pond-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const pondId = button.dataset.pondId;
      if (!pondId) return;
      state.selectedPondId = pondId;
      renderAll();
      document.querySelector(".detail-hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function rotationSectorTemplate(sector) {
  return `
    <button class="rotation-row" data-pond-id="${sector.sector_id}" type="button">
      <span>${sector.name}</span>
      <b class="score ${scoreClass(sector.score)}">${formatScore(sector.score)}</b>
      <small>${labelText(sector.label)} · ${(sector.confirmation_inputs ?? []).join(" + ") || "等待输入"}</small>
    </button>
  `;
}

function rotationStatusLabel(stateName) {
  const map = {
    clear_rotation: { label: "轮动清晰", className: "positive" },
    early_rotation: { label: "早期轮动", className: "warm" },
    selective_rotation: { label: "结构分化", className: "warm" },
    risk_off_diffusion: { label: "风险扩散", className: "negative" },
    no_clear_rotation: { label: "轮动不明显", className: "muted" },
    low_visibility: { label: "可见度偏低", className: "warm" }
  };
  return map[stateName] ?? { label: stateName ?? "未知", className: "muted" };
}

function evidenceLabel(level) {
  const map = {
    hard_data_plus_live_news: "硬数据 + 实时新闻",
    hard_data_with_news_fixture: "硬数据为主，新闻样例",
    hard_data_confirmed: "硬数据确认",
    partial_etf_flow: "部分ETF流",
    price_volume_only: "价量确认，ETF流缺失",
    partial_hard_data: "部分硬数据",
    thin_data: "数据较薄",
    none: "无数据"
  };
  return map[level] ?? level ?? "--";
}

function clusterLabel(label) {
  const map = {
    cluster_inflow_bias: "组内偏强",
    cluster_outflow_watch: "组内偏弱",
    cluster_neutral: "组内中性"
  };
  return map[label] ?? label ?? "--";
}

function historyTrendLabel(stateName) {
  const map = {
    insufficient_history: "样本不足",
    trend_confirmed: "趋势确认",
    history_ready: "历史可读",
    unavailable: "暂无历史"
  };
  return map[stateName] ?? stateName ?? "暂无历史";
}

function trendConfirmationTemplate(history) {
  const trend = history?.trend_confirmations;
  if (!trend) return "";
  const leaders = trend.persistent_leaders ?? [];
  const laggards = trend.persistent_laggards ?? [];
  const strengthening = trend.strengthening ?? [];
  const weakening = trend.weakening ?? [];
  const items = [];
  if (leaders[0]) items.push(`连续领先：${leaders.slice(0, 2).map((item) => `${item.name} ${item.streak_days}天`).join(" / ")}`);
  if (laggards[0]) items.push(`连续弱势：${laggards.slice(0, 2).map((item) => `${item.name} ${item.streak_days}天`).join(" / ")}`);
  if (strengthening[0]) items.push(`增强：${strengthening.slice(0, 2).map((item) => item.name).join(" / ")}`);
  if (weakening[0]) items.push(`转弱：${weakening.slice(0, 2).map((item) => item.name).join(" / ")}`);
  if (!items.length) return `<div class="trend-box muted">等待更多连续样本。</div>`;
  return `
    <div class="trend-box ${trend.confirmed ? "confirmed" : ""}">
      ${items.map((item) => `<span>${item}</span>`).join("")}
    </div>
  `;
}

function referenceRowTemplate(row) {
  return `
    <button class="reference-row" data-pond-id="${plainSectorId(row)}" type="button">
      <span>${sectorLabel(row)}</span>
      <b class="score ${scoreClass(row.score)}">${formatScore(row.score)}</b>
      <small>${labelText(row.label)} · ${confirmationText(row)}</small>
    </button>
  `;
}

function renderPondMap() {
  const container = document.getElementById("pondMap");
  const ponds = state.pondMap?.ponds ?? [];
  if (!ponds.length) {
    container.innerHTML = `<div class="empty">暂无池塘图谱。</div>`;
    return;
  }

  const columns = [
    { title: "总水位", ids: ["a_share"] },
    { title: "金融/红利", ids: ["brokerage", "bank_insurance", "electric_power"] },
    { title: "科技成长", ids: ["semiconductor", "ai_computer", "communication_electronics"] },
    { title: "顺周期/消费", ids: ["consumer", "real_estate_infra", "resources_materials", "new_energy_ev", "healthcare_pharma", "defense_military"] }
  ];

  container.innerHTML = columns.map((column) => `
    <div class="pond-column">
      <h3>${column.title}</h3>
      ${column.ids.map((id) => pondNodeTemplate(resolvePondForColumn(id))).join("")}
    </div>
  `).join("");

  container.querySelectorAll(".pond-node").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPondId = button.dataset.pondId;
      renderAll();
    });
  });
}

function resolvePondForColumn(id) {
  const pond = getPond(id);
  if (pond) return pond;
  const review = getReview(id);
  return {
    id,
    name: sectorNames[id] ?? id,
    type: "industry",
    heat: Math.max(0, Math.min(1, (review?.score ?? 0) + 0.45)),
    valuation: null,
    parent_id: "a_share",
    pool_id: review?.pool_id ?? `a_share_${id}`,
    status: review ? "live_review" : "planned"
  };
}

function pondNodeTemplate(pond) {
  const review = getReview(pond.id);
  const news = getNewsPressure(pond.id);
  const active = pond.id === state.selectedPondId ? "active" : "";
  const statusText = pond.status === "planned" ? "待接入" : pond.status === "watchlist_demo" ? "观察池" : "已接入";
  const heat = typeof pond.heat === "number" ? pond.heat : Math.max(0, Math.min(1, (review?.score ?? 0) + 0.45));
  const valuation = typeof pond.valuation === "number" ? pond.valuation : null;
  return `
    <button class="pond-node ${active}" data-pond-id="${pond.id}" type="button">
      <span class="node-title">${pond.name}</span>
      <span class="node-sub">${statusText}</span>
      <span class="node-metrics">
        <span class="metric-chip ${heatClass(heat)}">热 ${formatPct(heat)}</span>
        <span class="metric-chip ${valuationClass(valuation)}">估 ${formatScore(valuation)}</span>
        <span class="metric-chip ${scoreClass(review?.score)}">分 ${formatScore(review?.score)}</span>
        <span class="metric-chip ${scoreClass(news?.score)}">新闻 ${formatScore(news?.score)}</span>
      </span>
    </button>
  `;
}

function renderSelectedSummary() {
  const pond = getPond(state.selectedPondId) ?? resolvePondForColumn(state.selectedPondId);
  const review = getReview(pond.id);
  const news = getNewsPressure(pond.id);
  const path = pond.id === "a_share" ? "中国宏观水位 / A股总池" : `A股总池 / ${pond.name}`;

  document.getElementById("selectedPath").textContent = path;
  document.getElementById("selectedName").textContent = pond.name;
  document.getElementById("selectedSummary").textContent = buildSummary(pond, review, news);
  document.getElementById("detailHeat").textContent = formatPct(pond.heat);
  document.getElementById("detailValuation").textContent = formatScore(pond.valuation);
  document.getElementById("detailScore").textContent = formatScore(review?.score);
}

function buildSummary(pond, review, news) {
  if (pond.id === "a_share") {
    return "总池用于观察成交额、市场宽度、政策预期和外部流动性。它不是单一行业，而是所有A股行业池的上层水位。";
  }
  const live = review ? `当前模型分 ${formatScore(review.score)}，状态 ${labelText(review.label)}。` : "该行业尚未接入真实ETF review，先作为观察池展示参数结构。";
  const pressure = news ? `新闻压力 ${formatScore(news.score)}。` : "新闻压力暂无实时映射。";
  return `${live}${pressure} 下方可查看上游变量、影响系数、关键词组、半衰期和相关行业。`;
}

function renderFlowDetail() {
  const pond = getPond(state.selectedPondId) ?? resolvePondForColumn(state.selectedPondId);
  const upstream = effectiveUpstream(pond);
  document.getElementById("upstreamPanel").innerHTML = upstream.length ? upstream.map((item) => `
    <article class="metric-row">
      <div>
        <strong>${item.name}</strong>
        <span>${flowTypeLabel(item.flow_type)} · 延迟 ${item.latency_days ?? 0} 天 · ${statusLabel(item.status)} · ${item.source === "local_adjusted" ? "本地调权" : item.source === "local_added" ? "本地新增" : "基础配置"}</span>
      </div>
      <b class="score ${scoreClass(item.impact_coefficient)}">${formatScore(item.impact_coefficient)}</b>
    </article>
  `).join("") : `<div class="empty">暂无上游配置。</div>`;

  const review = getReview(pond.id);
  const components = review?.components ?? null;
  document.getElementById("componentPanel").innerHTML = components ? Object.entries(components).map(([key, component]) => `
    <article class="component-card ${component.available ? "available" : "missing"}">
      <span>${componentNames[key] ?? key}</span>
      <strong class="score ${scoreClass(component.score)}">${formatScore(component.score)}</strong>
      <p>置信度 ${formatScore(component.confidence)} · ${component.available ? "已有输入" : "等待数据"}</p>
      <small>${componentNodeText(component)}</small>
    </article>
  `).join("") : `<div class="empty">观察池暂无真实模型组件，先显示上游影响系数。</div>`;
}

function componentNodeText(component) {
  const nodes = component.nodes ?? [];
  if (!nodes.length) return "无节点";
  return nodes.map((node) => typeof node === "string" ? node : node.node_id).slice(0, 4).join(" / ");
}

function flowTypeLabel(type) {
  const map = {
    expectation: "预期流",
    hard_data: "硬数据",
    external: "外部水位",
    cost: "成本流出",
    fundamental: "基本面流入",
    policy: "政策水花",
    style: "风格流入",
    risk: "风险流出",
    macro: "宏观变量",
    industry_cycle: "产业周期"
  };
  return map[type] ?? type ?? "变量";
}

function renderNewsDetail() {
  const pondId = state.selectedPondId;
  const keywords = getKeywords(pondId);
  document.getElementById("keywordPanel").innerHTML = keywords.length ? keywords.map((group) => `
    <article class="keyword-card">
      <div class="keyword-head">
        <strong>${group.name}</strong>
        <span class="metric-chip ${scoreClass(group.splash_coefficient)}">水花 ${formatScore(group.splash_coefficient)}</span>
      </div>
      <p>${group.keywords.join(" / ")}</p>
      <div class="keyword-bars">
        <span>权重 ${formatPct(group.weight)}</span>
        <span>半衰期 ${group.half_life_days} 天</span>
      </div>
      <small>${group.feedback_rule}</small>
    </article>
  `).join("") : `<div class="empty">该池塘暂无关键词组。下一步由 weekly GPT 审计生成候选关键词。</div>`;

  const pressure = getNewsPressure(pondId);
  const topEvents = pressure?.top_events ?? state.news?.top_events ?? [];
  document.getElementById("newsPanel").innerHTML = `
    <div class="news-headline ${state.news?.collection?.fallback_used ? "warning" : ""}">${state.news?.headline ?? "暂无新闻输出"}</div>
    <div class="event-list">
      ${topEvents.slice(0, 5).map((event) => `
        <article class="event-card">
          <strong>${event.title}</strong>
          <p>${event.reason ?? "规则匹配新闻事件。"}</p>
          <span>${event.bucket ?? "news"} · ${event.direction ?? "neutral"} · ${formatScore(event.score)}</span>
        </article>
      `).join("") || `<p class="muted">暂无匹配事件。</p>`}
    </div>
  `;
}

function renderRelated() {
  const pond = getPond(state.selectedPondId) ?? resolvePondForColumn(state.selectedPondId);
  const ids = pond.related_sectors ?? pond.downstream ?? [];
  document.getElementById("relatedPanel").innerHTML = ids.length ? ids.map((id) => {
    const review = getReview(id);
    const relatedPond = getPond(id) ?? resolvePondForColumn(id);
    return `
      <button class="related-card" data-pond-id="${id}" type="button">
        <span>${relatedPond.name}</span>
        <strong class="score ${scoreClass(review?.score)}">${formatScore(review?.score)}</strong>
        <small>${review ? labelText(review.label) : "待接入"}</small>
      </button>
    `;
  }).join("") : `<div class="empty">暂无相关行业配置。</div>`;

  document.querySelectorAll(".related-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPondId = button.dataset.pondId;
      renderAll();
    });
  });
}

function renderGraphFeedback() {
  const pond = getPond(state.selectedPondId) ?? resolvePondForColumn(state.selectedPondId);
  const proposals = graphProposals(pond.id);
  const adaptation = state.pondMap?.graph_adaptation;
  const upstream = effectiveUpstream(pond);
  const panel = document.getElementById("graphFeedbackPanel");
  const editPanel = document.getElementById("graphEditPanel");
  if (!panel || !editPanel) return;

  panel.innerHTML = `
    <article class="feedback-summary">
      <strong>反馈原则</strong>
      <p>${pond.graph_feedback_summary ?? adaptation?.principle ?? "上下游节点可随新闻和硬数据反馈调整。"}</p>
      <small>${(adaptation?.update_modes ?? []).map((mode) => `${mode.name}：${mode.description}`).join(" / ")}</small>
    </article>
    <div class="proposal-list">
      ${proposals.length ? proposals.map((item) => `
        <article class="proposal-card">
          <div class="proposal-head">
            <strong>${item.name}</strong>
            <span class="metric-chip ${scoreClass(item.suggested_impact_coefficient ?? item.current_impact_coefficient)}">${actionLabel(item.action)}</span>
          </div>
          <p>${item.reason}</p>
          <div class="keyword-bars">
            <span>当前 ${formatScore(item.current_impact_coefficient)}</span>
            <span>建议 ${formatScore(item.suggested_impact_coefficient)}</span>
            <span>置信度 ${formatPct(item.confidence)}</span>
            <span>${statusLabel(item.review_status)}</span>
          </div>
          <small>证据词：${(item.evidence ?? []).join(" / ") || "等待新闻证据"}</small>
          <div class="proposal-actions">
            <button class="button small apply-proposal" data-proposal-id="${item.proposal_id}" type="button">应用到本地</button>
          </div>
        </article>
      `).join("") : `<div class="empty">该池塘暂无图谱反馈建议。等待每日新闻与硬数据验证，或每周GPT审计。</div>`}
    </div>
  `;

  editPanel.innerHTML = `
    <div class="edit-list">
      ${upstream.map((item) => `
        <article class="edit-row">
          <div>
            <strong>${item.name}</strong>
            <span>${item.id} · ${flowTypeLabel(item.flow_type)} · ${item.source}</span>
          </div>
          <label>影响系数 <input class="weight-input" data-node-id="${item.id}" type="number" step="0.01" min="-1" max="1" value="${item.impact_coefficient ?? 0}"></label>
          <button class="button small remove-node" data-node-id="${item.id}" type="button">本地删除</button>
        </article>
      `).join("") || `<div class="empty">暂无可编辑节点。</div>`}
    </div>
    <div class="add-node-form">
      <input id="newNodeName" placeholder="新增节点名称，例如：电网投资/特高压">
      <input id="newNodeImpact" placeholder="影响系数，例如 0.20" type="number" step="0.01" min="-1" max="1">
      <button id="addNodeButton" class="button" type="button">新增到本地</button>
      <button id="exportPatchButton" class="button" type="button">导出 patch</button>
      <button id="resetPatchButton" class="button" type="button">清空本地修改</button>
    </div>
    <pre id="patchPreview" class="patch-preview">${JSON.stringify(readGraphOverride(pond.id), null, 2)}</pre>
  `;

  bindGraphEditor(pond, proposals);
}

function bindGraphEditor(pond, proposals) {
  const override = readGraphOverride(pond.id);
  document.querySelectorAll(".weight-input").forEach((input) => {
    input.addEventListener("change", () => {
      const nodeId = input.dataset.nodeId;
      override.adjusted_nodes = override.adjusted_nodes ?? {};
      override.adjusted_nodes[nodeId] = override.adjusted_nodes[nodeId] ?? {};
      override.adjusted_nodes[nodeId].impact_coefficient = Number(input.value);
      override.adjusted_nodes[nodeId].manual_reason = "front_end_local_adjustment";
      writeGraphOverride(pond.id, override);
      renderAll();
    });
  });

  document.querySelectorAll(".remove-node").forEach((button) => {
    button.addEventListener("click", () => {
      override.removed_nodes = Array.from(new Set([...(override.removed_nodes ?? []), button.dataset.nodeId]));
      writeGraphOverride(pond.id, override);
      renderAll();
    });
  });

  document.querySelectorAll(".apply-proposal").forEach((button) => {
    button.addEventListener("click", () => {
      const proposal = proposals.find((item) => item.proposal_id === button.dataset.proposalId);
      if (!proposal) return;
      if (proposal.action === "add_node") {
        override.added_nodes = override.added_nodes ?? [];
        if (!override.added_nodes.find((item) => item.id === proposal.node_id)) {
          override.added_nodes.push({
            id: proposal.node_id,
            name: proposal.name,
            flow_type: proposal.flow_type ?? "adaptive",
            impact_coefficient: proposal.suggested_impact_coefficient ?? 0,
            confidence: proposal.confidence,
            status: "candidate",
            feedback_rule: proposal.reason
          });
        }
      } else {
        override.adjusted_nodes = override.adjusted_nodes ?? {};
        override.adjusted_nodes[proposal.node_id] = {
          impact_coefficient: proposal.suggested_impact_coefficient ?? proposal.current_impact_coefficient ?? 0,
          confidence: proposal.confidence,
          status: proposal.action === "decay_keyword_and_edge" ? "cooling" : "active",
          feedback_rule: proposal.reason
        };
      }
      writeGraphOverride(pond.id, override);
      renderAll();
    });
  });

  const addButton = document.getElementById("addNodeButton");
  if (addButton) addButton.addEventListener("click", () => {
    const name = document.getElementById("newNodeName").value.trim();
    const impact = Number(document.getElementById("newNodeImpact").value || 0);
    if (!name) return;
    override.added_nodes = override.added_nodes ?? [];
    override.added_nodes.push({
      id: name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_").replace(/^_|_$/g, ""),
      name,
      flow_type: "manual",
      impact_coefficient: impact,
      confidence: 0.3,
      status: "candidate",
      feedback_rule: "用户在前端新增，需通过新闻和硬数据验证。"
    });
    writeGraphOverride(pond.id, override);
    renderAll();
  });

  const exportButton = document.getElementById("exportPatchButton");
  if (exportButton) exportButton.addEventListener("click", async () => {
    const patch = { pond_id: pond.id, created_at: new Date().toISOString(), override: readGraphOverride(pond.id) };
    const text = JSON.stringify(patch, null, 2);
    await navigator.clipboard?.writeText(text).catch(() => {});
    const preview = document.getElementById("patchPreview");
    if (preview) preview.textContent = text;
  });

  const resetButton = document.getElementById("resetPatchButton");
  if (resetButton) resetButton.addEventListener("click", () => {
    localStorage.removeItem(graphOverrideKey(pond.id));
    renderAll();
  });
}

function renderReports() {
  const daily = state.pondMap?.reports?.daily ?? [];
  const weekly = state.pondMap?.reports?.weekly ?? [];
  document.getElementById("dailyPanel").innerHTML = daily.map(reportTemplate).join("");
  document.getElementById("weeklyPanel").innerHTML = weekly.map(reportTemplate).join("") + `
    <article class="report-card planned">
      <strong>反馈机制</strong>
      <p>每日用硬数据验证新闻关键词是否有效；每周由GPT生成关键词新增、降权、归档建议，不直接改交易结论。</p>
    </article>
  `;
}

function reportTemplate(report) {
  return `
    <article class="report-card ${report.status}">
      <strong>${report.title}</strong>
      <p>${report.target}</p>
      <span>${report.status === "enabled" ? "已接入" : "计划中"}</span>
    </article>
  `;
}

function renderSectorTable() {
  const container = document.getElementById("sectorTable");
  const rows = state.flow?.sector_reviews ?? [];
  if (!rows.length) {
    container.innerHTML = `<div class="empty">暂无行业 review。等待下一次 GitHub Actions 或本地 daily cycle。</div>`;
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>排名</th>
          <th>行业</th>
          <th>分数</th>
          <th>状态</th>
          <th>覆盖</th>
          <th>置信度</th>
          <th>完整度</th>
          <th>确认输入</th>
          <th>主要驱动</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row, index) => rowTemplate(row, index)).join("")}
      </tbody>
    </table>
  `;
}

function rowTemplate(row, index) {
  const score = row.score ?? row.flow_score ?? 0;
  const id = plainSectorId(row);
  const drivers = (row.top_drivers ?? [])
    .slice(0, 3)
    .map((driver) => driverLabel(driver))
    .join(" / ") || "暂无明显驱动";

  return `
    <tr>
      <td>${index + 1}</td>
      <td><button class="text-link" data-pond-id="${id}" type="button"><strong>${sectorLabel(row)}</strong><span class="sub">${id}</span></button></td>
      <td class="score ${scoreClass(score)}">${formatScore(score)}</td>
      <td>${labelText(row.label)}</td>
      <td>${coverageStatusLabel(row.coverage_status)}</td>
      <td>${formatScore(row.confidence)}</td>
      <td>${formatScore(row.data_completeness)}</td>
      <td>${confirmationText(row)}</td>
      <td>${drivers}</td>
    </tr>
  `;
}

function driverLabel(driver) {
  const name = componentNames[driver.component] ?? driver.component ?? "driver";
  return `${name} ${formatScore(driver.contribution)}`;
}

function labelText(label) {
  const map = {
    strong_inflow_bias: "强流入倾向",
    constructive_inflow_bias: "偏积极",
    neutral: "中性",
    outflow_watch: "流出观察",
    risk_off_pressure: "风险压力"
  };
  return map[label] ?? label ?? "--";
}

function renderTechnical() {
  const entities = state.dashboard.entities ?? {};
  const pools = Object.values(entities).filter((item) => item.kind === "pool").slice(0, 20);
  const nodes = Object.values(entities).filter((item) => item.kind === "node").slice(0, 20);
  document.getElementById("technicalPanel").innerHTML = `
    <div><h3>Pools</h3>${pools.map((item) => `<p><b>${item.id}</b> · ${item.name ?? ""}</p>`).join("")}</div>
    <div><h3>Nodes</h3>${nodes.map((item) => `<p><b>${item.id}</b> · ${item.category ?? item.data_type ?? ""}</p>`).join("")}</div>
  `;
}

function bindTableLinks() {
  document.querySelectorAll(".text-link").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPondId = button.dataset.pondId;
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  document.querySelectorAll(".reference-row").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPondId = button.dataset.pondId;
      renderAll();
      document.querySelector(".detail-hero")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
    });
  });
}

function renderAll() {
  renderHeader();
  renderReferencePanel();
  renderRotationPanel();
  renderPondMap();
  renderSelectedSummary();
  renderFlowDetail();
  renderNewsDetail();
  renderRelated();
  renderGraphFeedback();
  renderReports();
  renderSectorTable();
  renderTechnical();
  bindTableLinks();
}

async function loadAll() {
  state.dashboard = await readJson("./data/dashboard.json", fallbackDashboard);
  state.general = await readJson("./data/general_pool_analysis.json", null);
  state.flow = await readJson("./data/sector_flow_review.json", null);
  state.rotation = await readJson("./data/sector_rotation_intelligence.json", null);
  state.rotationHistory = await readJson("./data/sector_rotation_history.json", null);
  state.news = await readJson("./data/news_review.json", null);
  state.pondMap = await readJson("./data/pond_map.json", { ponds: [], keyword_groups: [], reports: {} });
  renderAll();
}

bindTabs();
document.getElementById("refreshButton").addEventListener("click", loadAll);
await loadAll();
