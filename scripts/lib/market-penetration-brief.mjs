const DAY = /^\d{4}-\d{2}-\d{2}$/;

const POOL_NAME_MAP = {
  a_share_ai_computer: "AI计算机",
  a_share_communication_electronics: "通信电子",
  a_share_semiconductor: "半导体",
  a_share_healthcare_pharma: "医药医疗",
  a_share_brokerage: "券商",
  a_share_bank_insurance: "银行保险",
  a_share_resources_materials: "资源材料",
  a_share_new_energy_ev: "新能源车",
  a_share_consumer: "消费",
  a_share_real_estate_infra: "地产基建",
  a_share_energy: "能源",
  a_share_media: "传媒",
  a_share_machinery: "机械",
  a_share_transportation: "交通运输",
  a_share_environmental_protection: "环保",
  a_share_utilities: "公用事业"
};

export function buildMarketPenetrationBrief({
  asOf,
  generatedAt,
  marketSignals = {},
  marketReport = {},
  newsReview = {},
  sourceRegistry = {},
  eveningSummary = {},
  candidateLedger = {},
  candidateStateModel = {},
  poolScores = {},
  qualityReport = {},
  coverageReport = {},
  mappingReport = {},
  flowReport = {},
  reviewAnalytics = {},
  outcomeReport = {}
}) {
  const marketRows = (marketSignals.rows ?? []).filter((row) => Number.isFinite(Number(row.price_close ?? row.market_close)));
  const marketFacts = marketRows
    .slice()
    .sort((a, b) => Number(b.momentum_value ?? 0) - Number(a.momentum_value ?? 0) || String(a.pool_id).localeCompare(String(b.pool_id)))
    .slice(0, 12)
    .map((row) => marketFact(row, asOf));
  const narratives = (newsReview.top_events ?? []).map((item, index) => narrative(item, index, asOf, generatedAt));
  const grouped = groupNarratives(narratives);
  const distinctNarratives = grouped.map((group) => group.items[0]);
  const repeated = grouped.filter((group) => group.items.length > 1).map(compactGroup);
  const stale = narratives.filter((item) => item.stale);
  const unsupported = narratives.filter((item) => item.evidence_status !== "primary_evidence_linked");
  const implications = marketFacts
    .filter((fact) => Math.abs(Number(fact.observed_return ?? 0)) >= 2)
    .slice(0, 5)
    .map((fact) => ({
      implication_id: `hypothesis:${fact.fact_id}`,
      kind: "hypothesis",
      statement: `${displayName(fact.pool_id, fact.pool_name)}出现较明显的当日价格变化；需要用未来3–20个交易日的价格、流动性和广度独立验证持续性。`,
      related_fact_ids: [fact.fact_id],
      horizon: "3_20_sessions",
      status: "not_a_fact"
    }));

  const candidates = currentCandidates({ asOf, eveningSummary, candidateLedger, candidateStateModel });
  const groups = sectorGroups(candidates, poolScores.rows ?? []);
  const marketSummary = buildMarketSummary(candidates, groups);
  const evidenceSummary = buildEvidenceSummary({ qualityReport, coverageReport, mappingReport, marketReport, flowReport, reviewAnalytics, outcomeReport });
  const sourceDate = latestSourceDate(marketRows, marketReport.as_of, asOf);
  const headline = buildHeadline(candidates, groups);

  return {
    schema_version: "market_penetration_report_v2",
    as_of: asOf,
    generated_at: generatedAt,
    display_contract: {
      mode: "display_only",
      affects_model_scores: false,
      boundary: "Narratives and interpretation never alter observation ranking."
    },
    coverage_window: { as_of: asOf, market_source_date: sourceDate, narrative_window: newsReview.as_of ?? asOf },
    source_status: [
      {
        source_id: "a_share_market_archive",
        status: marketRows.length ? "available" : "source_unavailable",
        source_date: sourceDate,
        retrieved_at: generatedAt,
        detail: "Published market signal archive; provider-origin quality is retained per fact."
      },
      {
        source_id: "legacy_google_news_rss",
        status: newsReview.collection?.fallback_used ? "fallback" : (newsReview.status ? "available" : "source_unavailable"),
        source_date: newsReview.as_of ?? null,
        retrieved_at: generatedAt,
        detail: "Media narratives only; never verified automatically or scored by the graph."
      },
      ...(sourceRegistry.sources ?? [])
        .filter((source) => source.enabled)
        .map((source) => ({
          source_id: source.source_id,
          status: "registered_not_ingested",
          source_date: null,
          retrieved_at: null,
          detail: "Registry entry has no enabled ingestion adapter."
        }))
    ],
    headline,
    market_summary: marketSummary,
    what_happened: buildWhatHappened({ candidates, groups, marketFacts, evidenceSummary }),
    why_market_moved: buildWhyMarketMoved(distinctNarratives),
    a_share_transmission: buildTransmission({ candidates, groups, marketSummary, narratives: distinctNarratives }),
    fp_cross_checks: candidates.slice(0, 5).map(crossCheck),
    tomorrow_watch: buildTomorrowWatch(candidates, groups),
    sector_state_groups: groups,
    evidence_summary: evidenceSummary,
    market_facts: marketFacts,
    official_fact_candidates: [],
    media_narratives: narratives,
    unsupported_narratives: unsupported.map(compactNarrative),
    repeated_or_stale_items: [...repeated, ...stale.map(compactNarrative)],
    unexplained_moves: [],
    possible_3_20_session_implications: implications,
    verified_facts: [],
    warnings: [
      "Verified facts remain empty until a primary-source ingestion and verification adapter is enabled.",
      "Media narratives are candidates for investigation, not facts, scores, or trading instructions.",
      "The explanatory headline and sector groups are deterministic summaries of published FP outputs.",
      ...(marketRows.length ? [] : ["No exact-date market facts were available from the published market signal archive."])
    ]
  };
}

export function renderMarketPenetrationMarkdown(brief) {
  const lines = [
    "# Market Penetration Brief",
    "",
    `- As of: ${brief.as_of}`,
    `- Generated: ${brief.generated_at}`,
    `- Display contract: ${brief.display_contract?.mode ?? "display_only"}`,
    `- Explanation mode: ${brief.ai_synthesis?.status === "generated" ? `AI web research (${brief.ai_synthesis?.model ?? "unknown model"})` : "deterministic rules"}`,
    "",
    "## 今晚市场结论",
    `- ${brief.headline}`,
    "",
    "## 市场状态",
    `- 市场环境：${brief.market_summary?.market_regime ?? "--"}`,
    `- 主导风格：${brief.market_summary?.dominant_style ?? "--"}`,
    `- 资金状态：${brief.market_summary?.capital_state ?? "--"}`,
    `- 行动边界：${brief.market_summary?.action_boundary ?? "--"}`,
    "",
    "## 今天发生了什么",
    ...statementLines(brief.what_happened),
    "",
    "## 市场为什么这样走",
    ...driverLines(brief.why_market_moved),
    "",
    "## 对 A 股的传导",
    ...transmissionLines(brief.a_share_transmission),
    "",
    "## FP 交叉验证",
    ...crossCheckLines(brief.fp_cross_checks),
    "",
    "## 明天看什么",
    ...statementLines(brief.tomorrow_watch),
    "",
    "## 证据与复盘",
    `- 可靠度：${brief.evidence_summary?.reliability ?? "--"}`,
    `- OHLCV 可用：${brief.evidence_summary?.market_ohlcv_count ?? 0}/${brief.evidence_summary?.total_pool_count ?? 0}`,
    `- Flow 可用：${brief.evidence_summary?.flow_available_count ?? 0}/${brief.evidence_summary?.total_pool_count ?? 0}`,
    `- 高质量完整证据：${brief.evidence_summary?.fully_mapped_count ?? 0}/${brief.evidence_summary?.total_pool_count ?? 0}`,
    `- ${brief.evidence_summary?.note ?? "--"}`,
    "",
    "## 原始市场事实",
    ...factLines(brief.market_facts),
    "",
    "## 媒体叙事（未自动验证）",
    ...narrativeLines(brief.media_narratives),
    "",
    "## 3–20 个交易日假设",
    ...brief.possible_3_20_session_implications.map((item) => `- [Hypothesis] ${item.statement}`),
    "",
    "## 联网研究来源",
    ...(brief.research_sources?.length
      ? brief.research_sources.map((source) => `- [${source.publisher}] ${source.title} — ${source.url}`)
      : ["- 未启用 AI 联网研究；当前为确定性解释。"]),
    "",
    "## 研究不确定性",
    ...(brief.research_uncertainties?.length ? brief.research_uncertainties.map((item) => `- ${item}`) : ["- 无额外 AI 研究不确定性记录。"]),
    ""
  ];
  return lines.join("\n");
}

function currentCandidates({ asOf, eveningSummary, candidateLedger, candidateStateModel }) {
  const ledgerRows = (candidateLedger.rows ?? [])
    .filter((row) => row.as_of === asOf)
    .sort((a, b) => number(b.observation_score) - number(a.observation_score) || String(a.pool_id).localeCompare(String(b.pool_id)));
  if (ledgerRows.length) return uniqueByPool(ledgerRows).slice(0, 5).map(normalizeCandidate);

  const summaryRows = (eveningSummary.top_observation_pools ?? []).map((row) => ({ ...row, as_of: eveningSummary.as_of ?? asOf }));
  if (summaryRows.length) return uniqueByPool(summaryRows).slice(0, 5).map(normalizeCandidate);

  const stateRows = (candidateStateModel.rows ?? [])
    .filter((row) => row.as_of === asOf)
    .sort((a, b) => number(b.major_wave_score) - number(a.major_wave_score));
  return uniqueByPool(stateRows).slice(0, 5).map(normalizeCandidate);
}

function normalizeCandidate(row) {
  return {
    ...row,
    pool_name: displayName(row.pool_id, row.pool_name),
    observation_score: finite(row.observation_score ?? row.final_score),
    overheat_score: finite(row.overheat_score),
    major_wave_score: finite(row.major_wave_score)
  };
}

function sectorGroups(candidates, scoreRows) {
  const groups = { strengthening: [], cooling: [], overheated: [], weak: [] };
  for (const candidate of candidates) {
    const item = sectorItem(candidate);
    if (isOverheated(candidate)) groups.overheated.push(item);
    else if (["Major Candidate", "Early Right"].includes(candidate.candidate_state)) groups.strengthening.push(item);
    else groups.cooling.push(item);
  }

  const used = new Set(candidates.map((row) => canonicalPoolId(row.pool_id)));
  const weakSeen = new Set();
  groups.weak = scoreRows
    .filter((row) => {
      const id = canonicalPoolId(row.pool_id);
      if (!isAShareSector(id) || used.has(id) || weakSeen.has(id)) return false;
      weakSeen.add(id);
      return true;
    })
    .sort((a, b) => number(a.final_score) - number(b.final_score) || String(a.pool_id).localeCompare(String(b.pool_id)))
    .slice(0, 4)
    .map((row) => {
      const poolId = canonicalPoolId(row.pool_id);
      return {
        pool_id: poolId,
        pool_name: displayName(poolId, row.pool_name),
        score: finite(row.final_score),
        direction: "weak",
        reason: "当前综合观察分数偏低或证据不足。"
      };
    });
  return groups;
}

function sectorItem(row) {
  return {
    pool_id: row.pool_id,
    pool_name: displayName(row.pool_id, row.pool_name),
    score: finite(row.observation_score ?? row.final_score),
    candidate_state: row.candidate_state ?? "Noise",
    overheat_score: finite(row.overheat_score),
    major_wave_score: finite(row.major_wave_score),
    risk_gate_status: row.risk_gate_status ?? "insufficient_data"
  };
}

function buildMarketSummary(candidates, groups) {
  const average = candidates.length ? candidates.reduce((sum, row) => sum + number(row.observation_score), 0) / candidates.length : 0;
  const spread = candidates.length >= 3 ? number(candidates[0].observation_score) - number(candidates[2].observation_score) : 99;
  return {
    market_regime: average >= 65 ? "中性偏进攻" : average >= 45 ? "中性" : "偏防守",
    dominant_style: dominantStyle(candidates),
    capital_state: spread <= 4 ? "集中轮动" : "分化轮动",
    action_boundary: groups.overheated.length ? "可跟踪，不追高" : candidates.length ? "等待确认后跟踪" : "仅观察"
  };
}

function buildHeadline(candidates, groups) {
  if (!candidates.length) return "今日候选数据不足，先保持观察，等待市场与资金证据补齐。";
  const leaders = candidates.slice(0, 2).map((row) => row.pool_name).join("、");
  const overheated = groups.overheated.slice(0, 2).map((row) => row.pool_name);
  const strengthening = groups.strengthening.slice(0, 2).map((row) => row.pool_name);
  if (overheated.length && strengthening.length) return `${leaders}仍居前，但${overheated.join("、")}过热风险上升；${strengthening.join("、")}开始具备承接观察价值。`;
  if (overheated.length) return `${leaders}保持前列，但${overheated.join("、")}出现过热或风险门警告；当前更适合观察承接，不宜追高。`;
  if (strengthening.length) return `${leaders}保持前列，${strengthening.join("、")}正在增强；仍需成交、相对强度和后续复盘确认。`;
  return `${leaders}保持观察前列，趋势尚在，但当前候选以降温和验证为主。`;
}

function buildWhatHappened({ candidates, groups, marketFacts, evidenceSummary }) {
  const items = [];
  if (candidates.length) {
    items.push({
      statement: `今日观察前列为${candidates.slice(0, 3).map((row) => row.pool_name).join("、")}，前列分数为${candidates.slice(0, 3).map((row) => formatNumber(row.observation_score)).join(" / ")}。`,
      evidence_type: "fp_hard_data",
      related_pool_ids: candidates.slice(0, 3).map((row) => row.pool_id)
    });
  }
  if (groups.overheated.length) {
    items.push({
      statement: `${groups.overheated.map((row) => row.pool_name).join("、")}触发过热或风险门提醒，强势与新建仓价值不能直接画等号。`,
      evidence_type: "fp_risk_state",
      related_pool_ids: groups.overheated.map((row) => row.pool_id)
    });
  }
  if (groups.strengthening.length) {
    items.push({
      statement: `${groups.strengthening.map((row) => row.pool_name).join("、")}处于主要候选或早期右侧状态，重点看改善能否延续。`,
      evidence_type: "fp_candidate_state",
      related_pool_ids: groups.strengthening.map((row) => row.pool_id)
    });
  }
  if (marketFacts.length) {
    const strongest = marketFacts[0];
    items.push({
      statement: `${displayName(strongest.pool_id, strongest.pool_name)}的代表工具当日变化为${signedPercent(strongest.observed_return)}，这是精确日期市场观察，不代表未来方向。`,
      evidence_type: "exact_date_market_observation",
      related_fact_ids: [strongest.fact_id]
    });
  }
  items.push({
    statement: `OHLCV 可用 ${evidenceSummary.market_ohlcv_count}/${evidenceSummary.total_pool_count}，Flow 可用 ${evidenceSummary.flow_available_count}/${evidenceSummary.total_pool_count}；解释需服从证据边界。`,
    evidence_type: "data_quality"
  });
  return items.slice(0, 5);
}

function buildWhyMarketMoved(narratives) {
  if (!narratives.length) return [{
    statement: "当前没有足够的已验证因果证据；系统不会用媒体标题替代市场事实。",
    confidence: "system_boundary",
    evidence_status: "not_a_causal_claim"
  }];
  return narratives.slice(0, 4).map((item) => ({
    statement: item.title,
    confidence: "unverified",
    evidence_status: "media_narrative",
    narrative_id: item.narrative_id,
    source_url: item.rss_url
  }));
}

function buildTransmission({ candidates, groups, marketSummary, narratives }) {
  const chains = [];
  if (narratives.length) {
    chains.push({
      nodes: ["媒体叙事（待验证）", `${marketSummary.dominant_style}相关方向`, "FP价格与流动性检查", "只形成观察假设"],
      note: "媒体叙事保持 display_only，不进入模型评分。"
    });
  }
  if (candidates.length) {
    const leader = candidates[0];
    chains.push({
      nodes: [
        `${leader.pool_name}保持观察前列`,
        stateDisplay(leader),
        leader.risk_gate_status === "caution" ? "风险门提醒" : "风险门通过",
        candidateWatch(leader)
      ],
      note: "该链条描述模型状态如何转化为观察条件，不是买卖指令。"
    });
  }
  if (groups.overheated.length) {
    chains.push({
      nodes: ["板块保持强势", "短线热度或拥挤升高", "风险门收紧", "等待降温后再确认"],
      note: "过热组优先处理风险，不因排名靠前而自动升级。"
    });
  }
  return chains;
}

function crossCheck(row) {
  return {
    pool_id: row.pool_id,
    pool_name: row.pool_name,
    narrative_direction: "unverified_or_not_required",
    hard_data_direction: row.candidate_state ?? row.observation_tier ?? "观察中",
    agreement: row.risk_gate_status === "pass" ? "数据支持" : "风险提醒",
    interpretation: candidateReason(row),
    next_watch: candidateWatch(row)
  };
}

function buildTomorrowWatch(candidates, groups) {
  const items = [];
  if (groups.overheated.length) items.push({ statement: `${groups.overheated.map((row) => row.pool_name).join("、")}能否降温，同时维持相对强度与成交承接。` });
  if (groups.strengthening.length) items.push({ statement: `${groups.strengthening.map((row) => row.pool_name).join("、")}的改善能否连续，并扩散到相关板块。` });
  const cooling = groups.cooling.slice(0, 2);
  if (cooling.length) items.push({ statement: `${cooling.map((row) => row.pool_name).join("、")}回落后是否出现承接，而不是继续失速。` });
  if (candidates[0]) items.push({ statement: `${candidates[0].pool_name}能否继续保持前列，同时不触发更高的过热或风险门警告。` });
  items.push({ statement: "复盘数据能否从 pending / unavailable 转为 reviewed；在样本不足前不使用胜率结论。" });
  return items.slice(0, 5);
}

function buildEvidenceSummary({ qualityReport, coverageReport, mappingReport, marketReport, flowReport, reviewAnalytics, outcomeReport }) {
  const total = number(qualityReport.total_pool_count ?? mappingReport.total_pool_count ?? coverageReport.observed_pool_count ?? 0);
  const marketCount = number(marketReport.momentum_signal_count ?? marketReport.mapped_pool_count ?? coverageReport.market_channel?.momentum_signal_count ?? 0);
  const flowCount = number((flowReport.source_backed_flow_count ?? 0) + (flowReport.estimated_from_source_count ?? 0));
  const fullCount = number(qualityReport.high_quality_signal_count ?? mappingReport.direct_etf_count ?? 0);
  const directRatio = boundedRatio(qualityReport.direct_evidence_ratio ?? coverageReport.quality?.direct_evidence_ratio);
  const proxyRatio = boundedRatio(qualityReport.proxy_evidence_ratio ?? coverageReport.quality?.proxy_evidence_ratio);
  const reviewed = number(reviewAnalytics.reviewed_rows ?? outcomeReport.reviewed_count ?? 0);
  const reliability = marketCount / Math.max(total, 1) >= 0.9 && directRatio >= 0.6 && reviewed >= 3
    ? "较高"
    : marketCount / Math.max(total, 1) >= 0.8 && directRatio >= 0.3
      ? "中等"
      : "偏低";
  return {
    reliability,
    total_pool_count: total,
    market_ohlcv_count: marketCount,
    flow_available_count: flowCount,
    fully_mapped_count: fullCount,
    direct_evidence_ratio: directRatio,
    proxy_evidence_ratio: proxyRatio,
    reviewed_rows: reviewed,
    pending_rows: number(reviewAnalytics.pending_rows ?? outcomeReport.pending_count ?? 0),
    unavailable_rows: number(reviewAnalytics.unavailable_rows ?? outcomeReport.unavailable_count ?? 0),
    note: reviewed < 3
      ? "历史复盘样本仍不足，暂不用于胜率判断；pending 和 unavailable 不计入输赢。"
      : "复盘样本已开始形成，但仍需按候选状态和市场环境分组解读。"
  };
}

function marketFact(row, asOf) {
  const close = finite(row.price_close ?? row.market_close);
  const change = finite(row.momentum_value);
  const poolId = canonicalPoolId(row.pool_id);
  return {
    fact_id: `market:${asOf}:${poolId}:close`,
    fact_type: "exact_date_market_observation",
    fact_text: `${displayName(poolId, row.pool_name)}代表工具的精确日期收盘数据已记录。`,
    pool_id: poolId || null,
    pool_name: displayName(poolId, row.pool_name),
    observed_value: close,
    previous_value: null,
    unit: "price",
    market: String(row.pool_id ?? "unknown").startsWith("a_share") ? "a_share" : "unknown",
    symbol: row.instrument_code ?? row.fund_code ?? null,
    observation_time: row.price_date ?? row.source_date ?? asOf,
    source: row.source_file ?? "published_market_signal_archive",
    source_date: row.price_date ?? row.source_date ?? asOf,
    verification_status: "candidate",
    data_quality: row.momentum_status ?? "source_unavailable",
    observed_return: change
  };
}

function narrative(item, index, asOf, retrievedAt) {
  const title = item.title ?? "Untitled media narrative";
  const publishedAt = item.published_at ?? null;
  return {
    narrative_id: `media:${asOf}:${index}:${hash(title)}`,
    title,
    description: item.description ?? "",
    rss_url: item.link ?? item.rss_url ?? null,
    publisher: item.publisher ?? null,
    published_at: publishedAt,
    retrieved_at: retrievedAt,
    normalized_topic: normalize(title),
    duplicate_group: normalize(title),
    source_quality: item.source_quality ?? "media_unverified",
    verification_status: "candidate",
    evidence_status: "media_narrative",
    stale: Boolean(publishedAt && DAY.test(publishedAt.slice(0, 10)) && publishedAt.slice(0, 10) < asOf)
  };
}

function candidateReason(row) {
  if (row.evidence_quality === "high" && row.risk_gate_status === "pass") return "价格、流动性与证据质量同时较完整。";
  if (row.evidence_quality === "high") return "强度与证据较好，但风险门已有提醒。";
  if (row.delta_flag === "changed") return "相较上一观察日出现边际变化，但仍需更多直接证据。";
  return "综合观察优先级较高，但证据边界仍然有效。";
}

function candidateWatch(row) {
  if (isOverheated(row)) return "等待降温后再确认";
  if (row.candidate_state === "Cooling") return "观察回落后的承接";
  if (["Major Candidate", "Early Right"].includes(row.candidate_state)) return "观察持续性与扩散";
  return "等待增量证据";
}

function stateDisplay(row) {
  if (isOverheated(row)) return "强势但过热";
  if (row.candidate_state === "Cooling") return "趋势仍强但降温";
  if (row.candidate_state === "Major Candidate") return "主要候选";
  return row.candidate_state ?? "观察中";
}

function dominantStyle(rows) {
  const ids = rows.map((row) => String(row.pool_id ?? ""));
  if (ids.some((id) => /ai|computer|semiconductor|communication|electronics/.test(id))) return "科技成长";
  if (ids.some((id) => /brokerage|bank|insurance/.test(id))) return "大金融";
  if (ids.some((id) => /healthcare|pharma/.test(id))) return "医药防守";
  if (ids.some((id) => /resources|materials|energy|new_energy/.test(id))) return "资源制造";
  return "多线轮动";
}

function isOverheated(row) {
  return row?.candidate_state === "Overheated"
    || number(row?.overheat_score) >= 65
    || (row?.risk_gate_status === "caution" && number(row?.overheat_score) >= 50);
}

function isAShareSector(poolId) {
  const id = canonicalPoolId(poolId);
  return id.startsWith("a_share_") && !["a_share_a_share", "a_share_btc", "a_share_gold", "a_share_sp500", "a_share_us_equity"].includes(id);
}

function uniqueByPool(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (!row.pool_id || seen.has(row.pool_id)) return false;
    seen.add(row.pool_id);
    return true;
  });
}

function canonicalPoolId(poolId) {
  const id = String(poolId ?? "");
  return id.startsWith("a_share_a_share_") ? id.replace(/^a_share_a_share_/, "a_share_") : id;
}

function displayName(poolId, fallback = "") {
  const id = canonicalPoolId(poolId);
  return POOL_NAME_MAP[id] ?? fallback ?? id ?? "未知板块";
}

function groupNarratives(items) {
  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.duplicate_group) ?? { duplicate_group: item.duplicate_group, items: [] };
    group.items.push(item);
    groups.set(item.duplicate_group, group);
  }
  return [...groups.values()];
}

function compactGroup(group) {
  return { duplicate_group: group.duplicate_group, count: group.items.length, titles: group.items.map((item) => item.title), evidence_status: "repeated_media_narrative" };
}

function compactNarrative(item) {
  return { narrative_id: item.narrative_id, title: item.title, rss_url: item.rss_url, duplicate_group: item.duplicate_group, evidence_status: item.evidence_status, stale: item.stale };
}

function factLines(items) {
  return items.length ? items.map((item) => `- ${item.fact_text ?? item.statement ?? item.title} (${item.source_date ?? "no source date"})`) : ["- None."];
}

function narrativeLines(items) {
  return items.length ? items.map((item) => `- ${item.title ?? item.statement} [${item.evidence_status ?? "candidate"}]`) : ["- None."];
}

function statementLines(items) {
  return items?.length ? items.map((item) => `- ${item.statement ?? item.text ?? item}`) : ["- None."];
}

function driverLines(items) {
  return items?.length ? items.map((item) => `- [${item.confidence ?? "unverified"}] ${item.statement ?? item.title}`) : ["- None."];
}

function transmissionLines(items) {
  return items?.length ? items.map((item) => `- ${(item.nodes ?? []).join(" → ")}${item.note ? `（${item.note}）` : ""}`) : ["- None."];
}

function crossCheckLines(items) {
  return items?.length ? items.map((item) => `- ${item.pool_name}: ${item.interpretation}；下一步：${item.next_watch}`) : ["- None."];
}

function latestSourceDate(rows, reportDate, fallback) {
  return rows.map((row) => row.price_date ?? row.source_date).filter(Boolean).sort().at(-1) ?? reportDate ?? fallback;
}

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim().split(" ").slice(0, 10).join(" ");
}

function hash(value) {
  let result = 0;
  for (const character of value) result = ((result * 31) + character.charCodeAt(0)) >>> 0;
  return result.toString(16);
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedRatio(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

function formatNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2).replace(/\.00$/, "") : "--";
}

function signedPercent(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed > 0 ? "+" : ""}${parsed.toFixed(2)}%` : "--";
}
