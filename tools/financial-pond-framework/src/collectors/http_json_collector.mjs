import { CollectorContract } from "../contracts/collector_contract.mjs";
import { writeRawRecord } from "../storage/raw_store.mjs";

export class HttpJsonCollector extends CollectorContract {
  constructor({ rootDir, sources, normalizationProfiles }) {
    super({
      id: "http_json_collector",
      description: "Collects enabled HTTP JSON sources and emits normalized node observations."
    });
    this.rootDir = rootDir;
    this.sources = sources;
    this.normalizationProfiles = normalizationProfiles;
  }

  async collect({ asOf, registry }) {
    const observations = [];
    for (const source of this.sources.filter((item) => item.enabled && item.collector === "http_json")) {
      if (!registry.nodes.has(source.node_id)) {
        throw new Error(`HTTP JSON source ${source.id} references missing node ${source.node_id}`);
      }

      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`HTTP JSON source ${source.id} failed: ${response.status}`);

      const payload = await response.json();
      const rawValue = extractJsonPath(payload, source.value_path);
      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        throw new Error(`HTTP JSON source ${source.id} produced non-numeric value at ${source.value_path}`);
      }

      const score = normalizeSingleValue(value, source, this.normalizationProfiles[source.normalization_profile]);
      const rawRef = await writeRawRecord({
        rootDir: this.rootDir,
        asOf,
        collectorId: this.id,
        sourceId: source.id,
        payload: { source, value, raw_sample: payload }
      });

      observations.push({
        node_id: source.node_id,
        as_of: asOf,
        value,
        unit: source.unit ?? "source_units",
        score,
        confidence: source.confidence ?? 0.75,
        data_type: registry.nodes.get(source.node_id).data_type,
        source: source.id,
        raw_ref: rawRef,
        reason: source.description ?? source.id
      });
    }
    return observations;
  }
}

export function extractJsonPath(payload, jsonPath) {
  if (!jsonPath) return payload;
  const parts = jsonPath.split(".").filter(Boolean);
  let current = payload;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export function normalizeSingleValue(value, source, profile) {
  if (source.score_scale === "already_normalized") {
    return clamp(value, source.clamp ?? profile?.clamp ?? [-2, 2]);
  }
  if (source.score_scale === "signed_change_percent") {
    const divisor = source.percent_divisor ?? 5;
    return clamp(value / divisor, source.clamp ?? profile?.clamp ?? [-2, 2]);
  }
  if (source.score_scale === "positive_threshold") {
    const threshold = source.threshold ?? 1;
    return clamp(value / threshold, source.clamp ?? profile?.clamp ?? [-2, 2]);
  }
  return clamp(value, source.clamp ?? profile?.clamp ?? [-2, 2]);
}

function clamp(value, [min, max]) {
  return Math.max(min, Math.min(max, value));
}

