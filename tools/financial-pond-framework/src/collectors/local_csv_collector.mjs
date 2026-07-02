import { readFile } from "node:fs/promises";
import path from "node:path";
import { CollectorContract } from "../contracts/collector_contract.mjs";
import { normalizeSeries } from "../model/normalizer.mjs";
import { writeRawRecord } from "../storage/raw_store.mjs";
import { parseCsv } from "./http_csv_collector.mjs";

export class LocalCsvCollector extends CollectorContract {
  constructor({ rootDir, sources, normalizationProfiles }) {
    super({
      id: "local_csv_collector",
      description: "Loads local CSV files and emits normalized node observations."
    });
    this.rootDir = rootDir;
    this.sources = sources;
    this.normalizationProfiles = normalizationProfiles;
  }

  async collect({ asOf, registry }) {
    const observations = [];
    for (const source of this.sources.filter((item) => item.enabled && item.collector === "local_csv")) {
      if (!registry.nodes.has(source.node_id)) {
        throw new Error(`Local CSV source ${source.id} references missing node ${source.node_id}`);
      }

      const filePath = resolveSafePath(this.rootDir, source.path);
      const csv = await readFile(filePath, "utf8");
      const rows = parseCsv(csv);
      const profile = this.normalizationProfiles[source.normalization_profile];
      const normalized = normalizeSeries(rows, source.value_column, profile);
      const rawRef = await writeRawRecord({
        rootDir: this.rootDir,
        asOf,
        collectorId: this.id,
        sourceId: source.id,
        payload: {
          source: { ...source, path: path.relative(this.rootDir, filePath) },
          rows: rows.slice(-10)
        }
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

function resolveSafePath(rootDir, relativePath) {
  const filePath = path.resolve(rootDir, relativePath);
  if (!filePath.startsWith(rootDir)) {
    throw new Error(`Local CSV source path escapes project root: ${relativePath}`);
  }
  return filePath;
}

