import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { LocalCsvCollector } from "../src/collectors/local_csv_collector.mjs";
import { extractJsonPath, normalizeSingleValue } from "../src/collectors/http_json_collector.mjs";
import { buildSourceStatus } from "../src/tools/source_status_report.mjs";

test("HTTP JSON collector helpers extract nested values and normalize percent changes", () => {
  const payload = { ticker: { priceChangePercent: "3.5" } };
  const value = Number(extractJsonPath(payload, "ticker.priceChangePercent"));
  const score = normalizeSingleValue(value, {
    score_scale: "signed_change_percent",
    percent_divisor: 5,
    clamp: [-2, 2]
  });

  assert.equal(value, 3.5);
  assert.equal(score, 0.7);
});

test("local CSV collector emits an observation from a project-local CSV file", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "pond-local-csv-"));
  await mkdir(path.join(rootDir, "data", "manual"), { recursive: true });
  await writeFile(
    path.join(rootDir, "data", "manual", "sample.csv"),
    "date,value\n2026-07-01,1\n2026-07-02,2\n2026-07-03,4\n",
    "utf8"
  );

  const collector = new LocalCsvCollector({
    rootDir,
    sources: [
      {
        id: "sample_local_csv",
        enabled: true,
        collector: "local_csv",
        node_id: "sample_node",
        path: "data/manual/sample.csv",
        value_column: "value",
        normalization_profile: "change_zscore",
        confidence: 0.8
      }
    ],
    normalizationProfiles: {
      change_zscore: {
        method: "change_zscore",
        lookback: 3,
        clamp: [-2, 2]
      }
    }
  });

  const observations = await collector.collect({
    asOf: "2026-07-03",
    registry: {
      nodes: new Map([
        ["sample_node", { data_type: "hard_data" }]
      ])
    }
  });

  assert.equal(observations.length, 1);
  assert.equal(observations[0].node_id, "sample_node");
  assert.equal(observations[0].source, "sample_local_csv");
});

test("source status report summarizes enabled and disabled sources", async () => {
  const rootDir = path.resolve(".");
  const status = await buildSourceStatus({ rootDir });

  assert.ok(status.counts.total > 0);
  assert.ok(status.counts.enabled >= 1);
  assert.ok(status.by_collector.mock >= 1);
});
