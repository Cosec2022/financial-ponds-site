import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { convertAkshareExportToFlowObservations } from "../src/tools/akshare_flow_observations.mjs";
import { convertAShareWaterLevelToObservations } from "../src/tools/a_share_water_observations.mjs";
import { runSectorFlowReview } from "../src/tools/sector_flow_review.mjs";
import { readJsonFile } from "../src/core/config_loader.mjs";
import { parseCsv } from "../src/collectors/http_csv_collector.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

test("AKShare fixture export converts to flow-engine observations without enabling sources", async () => {
  const outputRoot = await prepareTempProject();
  const contractPath = path.join(outputRoot, "providers", "akshare_etf_bridge", "provider_contract.json");

  await execFileAsync("python3", [
    path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py"),
    "--fixture",
    "--as-of",
    "2026-07-08",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);

  const result = await convertAkshareExportToFlowObservations({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });
  const observationsFile = await readJsonFile(
    path.join(outputRoot, "observations", "2026-07-08", "provider_flow_observations.json")
  );

  assert.equal(result.payload.readiness, "flow_ready");
  assert.equal(result.payload.counts.source_rows, 11);
  assert.equal(result.payload.counts.observations, 33);
  assert.equal(observationsFile.observations.length, 33);
  assert.ok(observationsFile.observations.some((item) => item.node_id === "semiconductor_etf_flow"));
  assert.ok(observationsFile.observations.some((item) => item.node_id === "semiconductor_relative_strength"));
  assert.ok(observationsFile.observations.some((item) => item.node_id === "semiconductor_leader_confirmation"));
});

test("AKShare baseline-only export creates confirmation inputs but does not fake ETF-flow observations", async () => {
  const outputRoot = await prepareTempProject();
  await mkdir(path.join(outputRoot, "data", "provider_exports"), { recursive: true });
  const contract = await readJsonFile(path.join(outputRoot, "providers", "akshare_etf_bridge", "provider_contract.json"));
  const rows = contract.representative_etfs.map((item, index) => ({
    date: "2026-07-09",
    sector_id: item.sector_id,
    sector_node_id: item.sector_node_id,
    fund_code: item.fund_code,
    fund_name: item.fund_name_hint,
    close: String(1 + index / 100),
    pct_change: String(index - 5),
    amount: String(100000000 + index * 10000000),
    turnover: "",
    latest_share: String(1000000000 + index),
    previous_share: "",
    share_change: "",
    estimated_flow: "",
    source_provider: "akshare",
    source_endpoint: "test",
    provider_run_id: "test",
    collected_at: "2026-07-09T00:00:00.000Z"
  }));
  await writeCsv(
    path.join(outputRoot, "data", "provider_exports", "a_share_etf_daily.csv"),
    contract.row_level_columns,
    rows
  );

  const result = await convertAkshareExportToFlowObservations({
    rootDir: outputRoot,
    asOf: "2026-07-09"
  });
  const directFlowObservations = result.payload.observations.filter((item) => item.node_id.endsWith("_etf_flow"));

  assert.equal(result.payload.readiness, "baseline_only");
  assert.equal(result.payload.counts.observations, 22);
  assert.equal(directFlowObservations.length, 0);
  assert.ok(result.payload.warnings.some((item) => item.includes("No estimated_flow")));
});

test("sector flow review merges provider-flow observations after cycle observations", async () => {
  const outputRoot = await prepareTempProject();
  const contractPath = path.join(outputRoot, "providers", "akshare_etf_bridge", "provider_contract.json");

  await execFileAsync("python3", [
    path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py"),
    "--fixture",
    "--as-of",
    "2026-07-08",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  await convertAkshareExportToFlowObservations({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });
  const review = await runSectorFlowReview({
    rootDir: outputRoot,
    asOf: "2026-07-08",
    fixture: false
  });

  assert.equal(review.payload.counts.sectors, 31);
  assert.equal(review.payload.counts.provider_mapped_representative_sectors, 11);
  assert.equal(review.payload.counts.framework_only_sectors, 20);
  assert.equal(review.payload.data_availability.mode, "etf_flow_ready");
  assert.equal(review.payload.data_availability.counts.representative_direct_flow_inputs, 11);
  assert.equal(review.payload.data_availability.counts.representative_price_volume_confirmations, 11);
  assert.ok(review.payload.sector_reviews.some((item) => item.pool_id === "a_share_semiconductor"));
});

test("sector flow review marks price-volume-only days when ETF share flow is absent", async () => {
  const outputRoot = await prepareTempProject();
  await mkdir(path.join(outputRoot, "data", "provider_exports"), { recursive: true });
  const contract = await readJsonFile(path.join(outputRoot, "providers", "akshare_etf_bridge", "provider_contract.json"));
  const rows = contract.representative_etfs.map((item, index) => ({
    date: "2026-07-10",
    sector_id: item.sector_id,
    sector_node_id: item.sector_node_id,
    fund_code: item.fund_code,
    fund_name: item.fund_name_hint,
    close: String(1 + index / 100),
    pct_change: String(index - 5),
    amount: String(100000000 + index * 10000000),
    turnover: "",
    latest_share: String(1000000000 + index),
    previous_share: "",
    share_change: "",
    estimated_flow: "",
    source_provider: "akshare",
    source_endpoint: "test",
    provider_run_id: "test",
    collected_at: "2026-07-10T00:00:00.000Z"
  }));
  await writeCsv(
    path.join(outputRoot, "data", "provider_exports", "a_share_etf_daily.csv"),
    contract.row_level_columns,
    rows
  );
  await convertAkshareExportToFlowObservations({
    rootDir: outputRoot,
    asOf: "2026-07-10"
  });

  const review = await runSectorFlowReview({
    rootDir: outputRoot,
    asOf: "2026-07-10",
    fixture: false
  });

  assert.equal(review.payload.data_availability.mode, "price_volume_only");
  assert.equal(review.payload.data_availability.counts.representative_direct_flow_inputs, 0);
  assert.equal(review.payload.data_availability.counts.representative_price_volume_confirmations, 11);
  assert.ok(review.payload.data_availability.warnings.some((item) => item.includes("Direct ETF share-flow")));
});

test("A-share water-level fixture feeds market-liquidity observations into flow review", async () => {
  const outputRoot = await prepareTempProject();

  await execFileAsync("python3", [
    path.join(rootDir, "providers", "a_share_water_level", "export_a_share_water_level.py"),
    "--fixture",
    "--as-of",
    "2026-07-08",
    "--root-dir",
    outputRoot
  ]);

  const conversion = await convertAShareWaterLevelToObservations({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });
  const review = await runSectorFlowReview({
    rootDir: outputRoot,
    asOf: "2026-07-08",
    fixture: false
  });
  const firstSector = review.payload.sector_reviews[0];

  assert.equal(conversion.payload.readiness, "water_level_ready");
  assert.ok(conversion.payload.observations.some((item) => item.node_id === "a_share_turnover"));
  assert.ok(conversion.payload.observations.some((item) => item.node_id === "a_share_breadth"));
  assert.equal(firstSector.components.market_liquidity.available, true);
});

async function prepareTempProject() {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-flow-"));
  await cp(path.join(rootDir, "config"), path.join(outputRoot, "config"), { recursive: true });
  await cp(path.join(rootDir, "providers"), path.join(outputRoot, "providers"), { recursive: true });
  return outputRoot;
}

async function writeCsv(filePath, columns, rows) {
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => row[column] ?? "").join(","))
  ].join("\n");
  await writeFile(filePath, `${csv}\n`, "utf8");
  assert.equal(parseCsv(await readFile(filePath, "utf8")).length, rows.length);
}
