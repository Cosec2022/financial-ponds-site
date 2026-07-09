import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "financial-pond", "data");
const snapshot = JSON.parse(await readFile(resolve(dataDir, "observation_snapshot.json"), "utf8"));
const leaderboard = JSON.parse(await readFile(resolve(dataDir, "etf_flow_leaderboard.json"), "utf8"));
const asOf = process.env.AS_OF ?? new Date().toISOString().slice(0, 10);
const instruments = new Map((leaderboard.rows ?? []).map((row) => [row.sector_id, row]));

const proxyTargets = {
  agriculture: ["consumer", "loose", "Agriculture represented cautiously by the available broad consumer instrument."],
  basic_chemicals: ["resources_materials", "close", "Basic chemicals share the available materials-cycle instrument."],
  beauty_care: ["consumer", "close", "Beauty care is represented by the available consumer instrument."],
  building_materials: ["real_estate_infra", "close", "Building materials share the available real-estate and infrastructure cycle instrument."],
  coal: ["resources_materials", "close", "Coal is represented by the available resources and materials instrument."],
  construction: ["real_estate_infra", "close", "Construction shares the available real-estate and infrastructure cycle instrument."],
  environmental_protection: ["new_energy_ev", "loose", "Environmental protection uses the available new-energy instrument as a low-confidence proxy."],
  food_beverage: ["consumer", "close", "Food and beverage is represented by the available consumer instrument."],
  home_appliances: ["consumer", "close", "Home appliances is represented by the available consumer instrument."],
  light_manufacturing: ["consumer", "loose", "Light manufacturing uses the available consumer instrument as a low-confidence proxy."],
  machinery: ["new_energy_ev", "loose", "Machinery uses the available new-energy industrial instrument as a low-confidence proxy."],
  media: ["ai_computer", "loose", "Media uses the available AI and computer instrument as a low-confidence proxy."],
  nonferrous_metals: ["resources_materials", "close", "Nonferrous metals is represented by the available resources and materials instrument."],
  petroleum_petrochemical: ["resources_materials", "close", "Petroleum and petrochemical is represented by the available resources and materials instrument."],
  retail: ["consumer", "close", "Retail is represented by the available consumer instrument."],
  social_services: ["consumer", "loose", "Social services uses the available consumer instrument as a low-confidence proxy."],
  steel: ["resources_materials", "close", "Steel is represented by the available resources and materials instrument."],
  textile_apparel: ["consumer", "close", "Textile and apparel is represented by the available consumer instrument."],
  transportation: ["real_estate_infra", "loose", "Transportation uses the available infrastructure-linked instrument as a low-confidence proxy."],
  utilities: ["new_energy_ev", "loose", "Utilities uses the available new-energy instrument as a low-confidence proxy."]
};

const rows = (snapshot.rows ?? []).map(buildMapping);
const counts = countStatuses(rows);
const mapped = rows.filter((row) => !["unmapped", "unavailable"].includes(row.mapping_status));
const highConfidence = rows.filter((row) => row.mapping_confidence >= 0.8).length;
const lowConfidence = rows.filter((row) => row.mapping_confidence > 0 && row.mapping_confidence < 0.6).length;
const generatedAt = new Date().toISOString();

const mappingFile = {
  module_id: "pool_instrument_map_v0_10_54",
  as_of: asOf,
  generated_at: generatedAt,
  rows
};
const report = {
  module_id: "pool_mapping_report_v0_10_54",
  as_of: asOf,
  generated_at: generatedAt,
  total_pool_count: rows.length,
  direct_index_count: counts.direct_index ?? 0,
  direct_etf_count: counts.direct_etf ?? 0,
  sector_proxy_count: counts.sector_proxy ?? 0,
  broad_proxy_count: counts.broad_proxy ?? 0,
  unmapped_count: (counts.unmapped ?? 0) + (counts.unavailable ?? 0),
  mapping_coverage_ratio: rows.length ? round(mapped.length / rows.length) : 0,
  high_confidence_count: highConfidence,
  low_confidence_count: lowConfidence,
  unmapped_examples: rows.filter((row) => ["unmapped", "unavailable"].includes(row.mapping_status)).slice(0, 5).map((row) => ({
    pool_id: row.pool_id,
    pool_name: row.pool_name,
    mapping_status: row.mapping_status,
    reason: row.mapping_method
  })),
  boundary_notes: [
    "Mappings are reviewed semantic links to instruments present in the provider export.",
    "Sector proxies are observation estimates and carry lower confidence than direct ETF mappings.",
    "Cross-asset and broad pools remain unavailable when the current provider export has no defensible instrument.",
    "No mapping is treated as an execution instruction; observe_only remains in force."
  ]
};

await writeFile(resolve(dataDir, "pool_instrument_map.json"), `${JSON.stringify(mappingFile, null, 2)}\n`, "utf8");
await writeFile(resolve(dataDir, "pool_mapping_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Pool instrument mapping written: mapped=${mapped.length}, unmapped=${report.unmapped_count}`);

function buildMapping(pool) {
  const semanticId = normalizeSectorId(pool.sector_id);
  const direct = instruments.get(semanticId);
  if (direct) {
    return mappingRow(pool, direct, {
      mapping_status: "direct_etf",
      mapping_confidence: 0.94,
      mapping_method: semanticId === pool.sector_id
        ? "exact sector_id match to provider ETF instrument"
        : "normalized legacy a_share_ sector prefix, then exact sector match",
      proxy_level: "exact"
    });
  }

  const proxy = proxyTargets[semanticId];
  if (proxy) {
    const [target, level, rationale] = proxy;
    const instrument = instruments.get(target);
    if (instrument) {
      return mappingRow(pool, instrument, {
        mapping_status: "sector_proxy",
        mapping_confidence: level === "close" ? 0.67 : 0.48,
        mapping_method: rationale,
        proxy_level: level
      });
    }
  }

  return {
    pool_id: pool.pool_id,
    pool_name: pool.pool_name,
    instrument_type: null,
    instrument_code: null,
    instrument_name: null,
    market: marketFor(semanticId),
    mapping_status: ["btc", "gold", "sp500", "us_equity"].includes(semanticId) ? "unavailable" : "unmapped",
    mapping_confidence: 0,
    mapping_method: "No defensible instrument is present in the current provider export.",
    proxy_level: "none",
    source: "financial-pond/data/etf_flow_leaderboard.json",
    boundary: "source unavailable; observe_only"
  };
}

function mappingRow(pool, instrument, mapping) {
  return {
    pool_id: pool.pool_id,
    pool_name: pool.pool_name,
    instrument_type: "etf",
    instrument_code: String(instrument.fund_code),
    instrument_name: instrument.fund_name,
    market: "a_share",
    ...mapping,
    source: "financial-pond/data/etf_flow_leaderboard.json",
    boundary: `${mapping.mapping_status} observation mapping; observe_only`
  };
}

function normalizeSectorId(value) {
  return String(value ?? "").replace(/^a_share_/, "");
}

function marketFor(id) {
  if (id === "btc") return "crypto";
  if (id === "gold") return "commodity";
  if (["sp500", "us_equity"].includes(id)) return "us";
  return "a_share";
}

function countStatuses(items) {
  return items.reduce((counts, row) => {
    counts[row.mapping_status] = (counts[row.mapping_status] ?? 0) + 1;
    return counts;
  }, {});
}

function round(value) {
  return Number(value.toFixed(4));
}
