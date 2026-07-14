const ALLOWED_CONFIDENCE = new Set(["confirmed", "likely", "unverified"]);
const ALLOWED_AGREEMENT = new Set(["外部环境与FP同向", "部分同向", "FP强但外部未确认", "外部支持但FP未确认", "风险冲突", "无明确关系"]);

export const MARKET_RESEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    as_of: { type: "string", description: "Business date in YYYY-MM-DD." },
    headline: { type: "string", description: "One concise Chinese conclusion for the page hero." },
    market_summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        market_regime: { type: "string" },
        dominant_style: { type: "string" },
        capital_state: { type: "string" },
        action_boundary: { type: "string" }
      },
      required: ["market_regime", "dominant_style", "capital_state", "action_boundary"]
    },
    what_happened: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          statement: { type: "string" },
          confidence: { type: "string", enum: ["confirmed", "likely", "unverified"] },
          source_ids: { type: "array", maxItems: 4, items: { type: "string" } }
        },
        required: ["statement", "confidence", "source_ids"]
      }
    },
    why_market_moved: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          statement: { type: "string" },
          mechanism: { type: "string" },
          confidence: { type: "string", enum: ["confirmed", "likely", "unverified"] },
          source_ids: { type: "array", maxItems: 4, items: { type: "string" } }
        },
        required: ["statement", "mechanism", "confidence", "source_ids"]
      }
    },
    a_share_transmission: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nodes: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
          note: { type: "string" },
          source_ids: { type: "array", maxItems: 4, items: { type: "string" } }
        },
        required: ["nodes", "note", "source_ids"]
      }
    },
    fp_cross_checks: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pool_id: { type: "string" },
          pool_name: { type: "string" },
          external_context: { type: "string" },
          hard_data_direction: { type: "string" },
          agreement: { type: "string", enum: ["外部环境与FP同向", "部分同向", "FP强但外部未确认", "外部支持但FP未确认", "风险冲突", "无明确关系"] },
          interpretation: { type: "string" },
          next_watch: { type: "string" },
          source_ids: { type: "array", maxItems: 4, items: { type: "string" } }
        },
        required: ["pool_id", "pool_name", "external_context", "hard_data_direction", "agreement", "interpretation", "next_watch", "source_ids"]
      }
    },
    tomorrow_watch: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          statement: { type: "string" },
          confirmation: { type: "string" },
          invalidation: { type: "string" },
          source_ids: { type: "array", maxItems: 4, items: { type: "string" } }
        },
        required: ["statement", "confirmation", "invalidation", "source_ids"]
      }
    },
    sources: {
      type: "array",
      minItems: 3,
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          source_id: { type: "string" },
          title: { type: "string" },
          publisher: { type: "string" },
          url: { type: "string" },
          published_at: { type: ["string", "null"] },
          used_for: { type: "string" }
        },
        required: ["source_id", "title", "publisher", "url", "published_at", "used_for"]
      }
    },
    uncertainties: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } }
  },
  required: ["as_of", "headline", "market_summary", "what_happened", "why_market_moved", "a_share_transmission", "fp_cross_checks", "tomorrow_watch", "sources", "uncertainties"]
};

export function buildMarketResearchPrompt(brief) {
  const candidates = (brief.fp_cross_checks ?? []).slice(0, 5).map((row) => ({
    pool_id: row.pool_id,
    pool_name: row.pool_name,
    hard_data_direction: row.hard_data_direction,
    agreement: row.agreement,
    interpretation: row.interpretation,
    next_watch: row.next_watch
  }));
  const deterministic = {
    as_of: brief.as_of,
    headline: brief.headline,
    market_summary: brief.market_summary,
    candidates,
    sector_state_groups: brief.sector_state_groups,
    evidence_summary: brief.evidence_summary,
    market_facts: (brief.market_facts ?? []).slice(0, 12).map((row) => ({
      pool_id: row.pool_id,
      pool_name: row.pool_name,
      symbol: row.symbol,
      observation_time: row.observation_time,
      observed_return: row.observed_return,
      data_quality: row.data_quality
    }))
  };

  return [
    "你是 Financial Ponds 的每日市场研究编辑。请联网研究指定交易日附近最新的全球市场与中国市场信息，并把外部事实与下面的 FP 硬数据做严格交叉验证。",
    "",
    "硬边界：",
    "1. 你只生成解释层，绝不能修改、重算或暗示修改 FP 的分数、排名、候选状态、风险门与复盘结果。",
    "2. 只把有可靠来源支持的内容写成 confirmed；合理推断写 likely；媒体叙事或证据不足写 unverified。",
    "3. 优先使用事件发生在 as_of 当日或之前 48 小时内的来源。旧资料只能作为背景，必须明确不是当天事件。",
    "4. 区分发布日期和事件日期；不要因为旧文章被重新抓取就当成今日新闻。",
    "5. 优先官方机构、交易所、公司公告、主要央行/统计机构，以及 Reuters、Bloomberg、FT、WSJ、CNBC、SCMP 等信誉较高来源。",
    "6. 研究范围至少覆盖：美股与全球风险偏好、美国利率/美元、原油黄金铜等大宗、AI与半导体、中国政策与宏观、A股当日成交与行业风格。没有重要变化可明确写无显著新信息。",
    "7. 输出简体中文，面向非专业但认真交易的读者。结论要清楚，不写买卖指令，不做短期价格预测。观察周期以未来 3–20 个交易日为主。",
    "8. 每个外部事实和因果判断必须引用 sources 中的 source_id。source_id 必须唯一且确实存在。",
    "9. fp_cross_checks 必须覆盖下面给出的候选 pool_id，不得发明候选或改名。",
    "10. headline 应综合“外部市场环境 + FP硬数据 + 风险边界”，不能只复述 Top 5。",
    "",
    `目标业务日期：${brief.as_of}`,
    "FP确定性输入：",
    JSON.stringify(deterministic, null, 2)
  ].join("\n");
}

export function validateMarketResearchSynthesis(synthesis, brief) {
  if (!synthesis || typeof synthesis !== "object") throw new Error("AI synthesis must be an object");
  if (synthesis.as_of !== brief.as_of) throw new Error(`AI synthesis as_of ${synthesis.as_of} does not match ${brief.as_of}`);
  if (!synthesis.headline || !synthesis.market_summary) throw new Error("AI synthesis missing headline or market_summary");
  const sources = new Map((synthesis.sources ?? []).map((row) => [row.source_id, row]));
  if (sources.size < 3) throw new Error("AI synthesis requires at least three sources");
  for (const source of sources.values()) {
    if (!source.source_id || !source.title || !source.publisher || !/^https?:\/\//.test(source.url ?? "")) throw new Error(`Invalid research source ${source.source_id ?? "unknown"}`);
  }
  const referenceRows = [
    ...(synthesis.what_happened ?? []),
    ...(synthesis.why_market_moved ?? []),
    ...(synthesis.a_share_transmission ?? []),
    ...(synthesis.fp_cross_checks ?? []),
    ...(synthesis.tomorrow_watch ?? [])
  ];
  for (const row of referenceRows) {
    for (const id of row.source_ids ?? []) if (!sources.has(id)) throw new Error(`Unknown source_id ${id}`);
  }
  for (const row of synthesis.what_happened ?? []) if (!ALLOWED_CONFIDENCE.has(row.confidence)) throw new Error(`Invalid confidence ${row.confidence}`);
  for (const row of synthesis.why_market_moved ?? []) if (!ALLOWED_CONFIDENCE.has(row.confidence)) throw new Error(`Invalid confidence ${row.confidence}`);
  for (const row of synthesis.fp_cross_checks ?? []) if (!ALLOWED_AGREEMENT.has(row.agreement)) throw new Error(`Invalid agreement ${row.agreement}`);
  const expected = new Set((brief.fp_cross_checks ?? []).slice(0, 5).map((row) => row.pool_id));
  const actual = new Set((synthesis.fp_cross_checks ?? []).map((row) => row.pool_id));
  for (const poolId of expected) if (!actual.has(poolId)) throw new Error(`AI synthesis missing FP candidate ${poolId}`);
  return true;
}

export function mergeMarketResearchSynthesis(brief, synthesis, metadata = {}) {
  validateMarketResearchSynthesis(synthesis, brief);
  const deterministicFingerprint = stableFingerprint({
    as_of: brief.as_of,
    market_facts: brief.market_facts,
    sector_state_groups: brief.sector_state_groups,
    evidence_summary: brief.evidence_summary,
    original_fp_cross_checks: brief.fp_cross_checks
  });
  return {
    ...brief,
    headline: synthesis.headline,
    market_summary: synthesis.market_summary,
    what_happened: synthesis.what_happened.map((row) => ({ ...row, evidence_type: "ai_web_research" })),
    why_market_moved: synthesis.why_market_moved.map((row) => ({ ...row, evidence_status: "ai_web_research" })),
    a_share_transmission: synthesis.a_share_transmission,
    fp_cross_checks: synthesis.fp_cross_checks,
    tomorrow_watch: synthesis.tomorrow_watch,
    research_sources: synthesis.sources,
    research_uncertainties: synthesis.uncertainties,
    ai_synthesis: {
      status: "generated",
      provider: "openai_responses_api",
      model: metadata.model ?? null,
      generated_at: metadata.generatedAt ?? new Date().toISOString(),
      response_id: metadata.responseId ?? null,
      web_search_used: true,
      affects_model_scores: false,
      deterministic_fingerprint: deterministicFingerprint,
      source_metadata_count: Number(metadata.sourceMetadataCount ?? 0)
    },
    warnings: [
      ...(brief.warnings ?? []),
      "AI web research is a display-only interpretation layer. It cannot alter FP scores, ranking, state, risk gates, or review outcomes.",
      ...synthesis.uncertainties.map((item) => `AI research uncertainty: ${item}`)
    ]
  };
}

export function markMarketResearchUnavailable(brief, metadata = {}) {
  return {
    ...brief,
    ai_synthesis: {
      status: metadata.status ?? "unavailable",
      provider: "openai_responses_api",
      model: metadata.model ?? null,
      generated_at: metadata.generatedAt ?? new Date().toISOString(),
      response_id: null,
      web_search_used: false,
      affects_model_scores: false,
      detail: metadata.detail ?? "AI research was not generated; deterministic explanation remains active."
    }
  };
}

function stableFingerprint(value) {
  const text = JSON.stringify(sortObject(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}
