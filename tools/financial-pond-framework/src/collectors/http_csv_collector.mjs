import { CollectorContract } from "../contracts/collector_contract.mjs";
import { normalizeSeries } from "../model/normalizer.mjs";
import { writeRawRecord } from "../storage/raw_store.mjs";

export class HttpCsvCollector extends CollectorContract {
  constructor({ rootDir, sources, normalizationProfiles }) {
    super({
      id: "http_csv_collector",
      description: "Collects enabled HTTP CSV sources and emits normalized node observations."
    });
    this.rootDir = rootDir;
    this.sources = sources;
    this.normalizationProfiles = normalizationProfiles;
  }

  async collect({ asOf, registry }) {
    const observations = [];
    for (const source of this.sources.filter((item) => item.enabled && item.collector === "http_csv")) {
      if (!registry.nodes.has(source.node_id)) {
        throw new Error(`HTTP CSV source ${source.id} references missing node ${source.node_id}`);
      }

      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`HTTP CSV source ${source.id} failed: ${response.status}`);

      const csv = await response.text();
      const rows = parseCsv(csv);
      const profile = this.normalizationProfiles[source.normalization_profile];
      const normalized = normalizeSeries(rows, source.value_column, profile);
      const rawRef = await writeRawRecord({
        rootDir: this.rootDir,
        asOf,
        collectorId: this.id,
        sourceId: source.id,
        payload: { source, rows: rows.slice(-10) }
      });

      observations.push({
        node_id: source.node_id,
        as_of: asOf,
        value: normalized.value,
        unit: source.unit ?? "source_units",
        score: normalized.score,
        confidence: source.confidence ?? 0.75,
        data_type: registry.nodes.get(source.node_id).data_type,
        source: source.id,
        raw_ref: rawRef,
        reason: `${source.description ?? source.id}. ${normalized.reason}`
      });
    }
    return observations;
  }
}

export function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitCsvLine(line) {
  const output = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      output.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  output.push(current);
  return output.map((item) => item.trim());
}
