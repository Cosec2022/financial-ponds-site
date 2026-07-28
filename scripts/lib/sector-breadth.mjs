const SOURCE_KINDS = new Set(["official_sector_constituents", "etf_constituent_basket"]);

export function buildSectorBreadth({ asOf, input }) {
  if (!input) return unavailable(asOf);
  const metadata = [
    input.constituent_source,
    input.constituent_as_of,
    input.composition_as_of,
    input.price_source
  ];
  if (!SOURCE_KINDS.has(input.source_kind) || metadata.some((value) => !value) || untrusted(metadata.join(" "))) {
    return unavailable(asOf, "成分股来源或日期元数据不可信");
  }
  const rows = [];
  for (const sector of input.sectors ?? []) {
    const constituents = (sector.constituents ?? []).filter((item) => (
      item.trade_date === asOf
      && positive(item.close)
      && positive(item.previous_close)
      && positive(item.ma20)
      && !untrusted(String(item.source_provider ?? input.price_source))
    ));
    const totalCount = Number(sector.total_count ?? sector.constituents?.length ?? 0);
    const effectiveCount = constituents.length;
    if (!totalCount || !effectiveCount) continue;
    rows.push({
      date: asOf,
      sector_id: sector.sector_id,
      source_kind: input.source_kind,
      label: input.source_kind === "etf_constituent_basket" ? "ETF篮子扩散" : "行业内部扩散",
      constituent_source: input.constituent_source,
      constituent_as_of: input.constituent_as_of,
      composition_as_of: input.composition_as_of,
      price_source: input.price_source,
      effective_count: effectiveCount,
      total_count: totalCount,
      advancers_ratio: round(constituents.filter((item) => Number(item.close) > Number(item.previous_close)).length / effectiveCount),
      above_ma20_ratio: round(constituents.filter((item) => Number(item.close) > Number(item.ma20)).length / effectiveCount),
      known_limitation: input.known_limitation ?? "composition_as_of applies; no silent historical reconstruction"
    });
  }
  return rows.length ? {
    module_id: "sector_breadth_daily_v0_10_77",
    as_of: asOf,
    status: "available",
    source_kind: input.source_kind,
    display_label: input.source_kind === "etf_constituent_basket" ? "ETF篮子扩散" : "行业内部扩散",
    reason: null,
    rows
  } : unavailable(asOf, "可信来源已配置，但当日有效成分股价格为空");
}

export function unavailable(asOf, reason = "尚未接入可信成分股数据源") {
  return {
    module_id: "sector_breadth_daily_v0_10_77",
    as_of: asOf,
    status: "unavailable",
    source_kind: null,
    display_label: "内部扩散",
    reason,
    rows: [],
    required_metadata: [
      "constituent_source",
      "constituent_as_of",
      "composition_as_of",
      "price_source",
      "effective_count",
      "total_count"
    ],
    boundary: "mock/model breadth rejected; forward collection contract ready"
  };
}

function untrusted(value) {
  return /mock|fixture|model|manual/i.test(value);
}

function positive(value) {
  const number = Number(value);
  return value !== null && value !== "" && Number.isFinite(number) && number > 0;
}

function round(value) {
  return Number(value.toFixed(6));
}
