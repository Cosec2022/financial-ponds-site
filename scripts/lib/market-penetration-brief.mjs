const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function buildMarketPenetrationBrief({ asOf, generatedAt, marketSignals = {}, marketReport = {}, newsReview = {}, sourceRegistry = {} }) {
  const rows = (marketSignals.rows ?? []).filter((row) => Number.isFinite(Number(row.price_close ?? row.market_close)));
  const marketFacts = rows.slice().sort((a, b) => Number(b.momentum_value ?? 0) - Number(a.momentum_value ?? 0) || String(a.pool_id).localeCompare(String(b.pool_id))).slice(0, 12).map((row) => marketFact(row, asOf));
  const narratives = (newsReview.top_events ?? []).map((item, index) => narrative(item, index, asOf, generatedAt));
  const grouped = groupNarratives(narratives);
  const repeated = grouped.filter((group) => group.items.length > 1).map(compactGroup);
  const stale = narratives.filter((item) => item.stale);
  const unsupported = narratives.filter((item) => item.evidence_status !== "primary_evidence_linked");
  const implications = marketFacts.filter((fact) => Math.abs(Number(fact.observed_return ?? 0)) >= 2).slice(0, 5).map((fact) => ({
    implication_id: `hypothesis:${fact.fact_id}`,
    kind: "hypothesis",
    statement: `${fact.symbol ?? fact.market} showed an observed daily change; assess persistence over 3–20 sessions with independent price, flow, and breadth evidence.`,
    related_fact_ids: [fact.fact_id],
    horizon: "3_20_sessions",
    status: "not_a_fact"
  }));
  const sourceDate = latestSourceDate(rows, marketReport.as_of, asOf);
  return {
    schema_version: "market_penetration_brief_v1",
    as_of: asOf,
    generated_at: generatedAt,
    coverage_window: { as_of: asOf, market_source_date: sourceDate, narrative_window: asOf },
    source_status: [
      { source_id: "a_share_market_archive", status: rows.length ? "available" : "source_unavailable", source_date: sourceDate, retrieved_at: generatedAt, detail: "Published market signal archive; provider-origin quality is retained per fact." },
      { source_id: "legacy_google_news_rss", status: newsReview.collection?.fallback_used ? "fallback" : (newsReview.status ? "available" : "source_unavailable"), source_date: newsReview.as_of ?? null, retrieved_at: generatedAt, detail: "Media narratives only; never verified automatically or scored by the graph." },
      ...(sourceRegistry.sources ?? []).filter((source) => source.enabled).map((source) => ({ source_id: source.source_id, status: "registered_not_ingested", source_date: null, retrieved_at: null, detail: "Registry entry has no enabled v0.10.66 ingestion adapter." }))
    ],
    market_facts: marketFacts,
    official_fact_candidates: [],
    media_narratives: narratives,
    unsupported_narratives: unsupported.map(compactNarrative),
    repeated_or_stale_items: [...repeated, ...stale.map(compactNarrative)],
    unexplained_moves: [],
    possible_3_20_session_implications: implications,
    verified_facts: [],
    warnings: [
      "Verified facts are intentionally empty in v0.10.66 until a primary-source ingestion and verification adapter is enabled.",
      "Media narratives are candidates for investigation, not facts, scores, or trading instructions.",
      ...(rows.length ? [] : ["No exact-date market facts were available from the published market signal archive."])
    ]
  };
}

export function renderMarketPenetrationMarkdown(brief) {
  const lines = ["# Market Penetration Brief", "", `- As of: ${brief.as_of}`, `- Generated: ${brief.generated_at}`, "", "## 1. 今天真正发生了什么", ...factLines(brief.market_facts), "", "## 2. 全球市场客观变化", "- Source coverage not yet enabled for global market adapters.", "", "## 3. A 股客观变化", ...factLines(brief.market_facts), "", "## 4. 官方事实与数据", ...factLines(brief.official_fact_candidates), "", "## 5. 金融媒体主要在讲什么", ...narrativeLines(brief.media_narratives), "", "## 6. 哪些叙事有原始证据", "- No media narrative is promoted to primary evidence in this version.", "", "## 7. 哪些叙事证据不足、重复或陈旧", ...narrativeLines(brief.unsupported_narratives), "", "## 8. 哪些变化可能与未来 3–20 个交易日有关", ...brief.possible_3_20_session_implications.map((item) => `- [Hypothesis] ${item.statement}`), "", "## 9. 暂时无法解释的变化", ...(brief.unexplained_moves.length ? brief.unexplained_moves.map((item) => `- ${item.statement}`) : ["- None recorded by the deterministic rule set." ]), "", "## 10. Verified facts / fact candidates", ...(brief.verified_facts.length ? factLines(brief.verified_facts) : ["- No verified facts in v0.10.66."]), ""];
  return lines.join("\n");
}

function marketFact(row, asOf) {
  const close = finite(row.price_close ?? row.market_close);
  const change = finite(row.momentum_value);
  return { fact_id: `market:${asOf}:${row.pool_id}:close`, fact_type: "exact_date_market_observation", fact_text: `${row.pool_name ?? row.pool_id} exact-date representative instrument close was observed.`, observed_value: close, previous_value: null, unit: "price", market: String(row.pool_id ?? "unknown").startsWith("a_share") ? "a_share" : "unknown", symbol: row.instrument_code ?? row.fund_code ?? null, observation_time: row.price_date ?? row.source_date ?? asOf, source: row.source_file ?? "published_market_signal_archive", source_date: row.price_date ?? row.source_date ?? asOf, verification_status: "candidate", data_quality: row.momentum_status ?? "source_unavailable", observed_return: change };
}

function narrative(item, index, asOf, retrievedAt) {
  const title = item.title ?? "Untitled media narrative";
  const publishedAt = item.published_at ?? null;
  return { narrative_id: `media:${asOf}:${index}:${hash(title)}`, title, description: item.description ?? "", rss_url: item.link ?? item.rss_url ?? null, publisher: item.publisher ?? null, published_at: publishedAt, retrieved_at: retrievedAt, normalized_topic: normalize(title), duplicate_group: normalize(title), source_quality: item.source_quality ?? "media_unverified", verification_status: "candidate", evidence_status: "media_narrative", stale: Boolean(publishedAt && DAY.test(publishedAt.slice(0, 10)) && publishedAt.slice(0, 10) < asOf) };
}

function groupNarratives(items) { const groups = new Map(); for (const item of items) { const group = groups.get(item.duplicate_group) ?? { duplicate_group: item.duplicate_group, items: [] }; group.items.push(item); groups.set(item.duplicate_group, group); } return [...groups.values()]; }
function compactGroup(group) { return { duplicate_group: group.duplicate_group, count: group.items.length, titles: group.items.map((item) => item.title), evidence_status: "repeated_media_narrative" }; }
function compactNarrative(item) { return { narrative_id: item.narrative_id, title: item.title, rss_url: item.rss_url, duplicate_group: item.duplicate_group, evidence_status: item.evidence_status, stale: item.stale }; }
function factLines(items) { return items.length ? items.map((item) => `- ${item.fact_text ?? item.statement ?? item.title} (${item.source_date ?? "no source date"})`) : ["- None."]; }
function narrativeLines(items) { return items.length ? items.map((item) => `- ${item.title ?? item.statement} [${item.evidence_status ?? "candidate"}]`) : ["- None."]; }
function latestSourceDate(rows, reportDate, fallback) { return rows.map((row) => row.price_date ?? row.source_date).filter(Boolean).sort().at(-1) ?? reportDate ?? fallback; }
function normalize(value) { return String(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim().split(" ").slice(0, 10).join(" "); }
function hash(value) { let result = 0; for (const character of value) result = ((result * 31) + character.charCodeAt(0)) >>> 0; return result.toString(16); }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
