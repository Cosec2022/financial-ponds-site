import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../src/core/config_loader.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

test("provider lab probes compare AKShare, efinance, and qstock without enabling sources", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-provider-lab-"));
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");

  await execFileAsync("python3", [
    path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py"),
    "--fixture",
    "--as-of",
    "2026-07-10",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  await execFileAsync("python3", [
    path.join(rootDir, "providers", "efinance_quote_bridge", "probe_a_share_etf_quotes.py"),
    "--fixture",
    "--as-of",
    "2026-07-10",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  await execFileAsync("python3", [
    path.join(rootDir, "providers", "qstock_bridge", "probe_a_share_structure.py"),
    "--fixture",
    "--as-of",
    "2026-07-10",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);

  const comparisonResult = await execFileAsync("python3", [
    path.join(rootDir, "providers", "provider_comparison", "compare_a_share_etf_providers.py"),
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  const comparison = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_comparison", "a_share_etf_provider_comparison.json")
  );
  const markdown = await readFile(
    path.join(outputRoot, "model_outputs", "provider_comparison", "a_share_etf_provider_comparison.md"),
    "utf8"
  );
  const efinanceProbe = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_probes", "efinance_a_share_etf_quote_probe.json")
  );
  const qstockProbe = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_probes", "qstock_a_share_structure_probe.json")
  );

  assert.match(comparisonResult.stdout, /"comparison_id": "a_share_etf_provider_comparison"/);
  assert.equal(comparison.status, "ok");
  assert.equal(comparison.counts.representative_etfs, 11);
  assert.equal(comparison.counts.providers_available, 3);
  assert.equal(comparison.counts.multi_provider_rows, 11);
  assert.equal(comparison.provider_status.akshare.available, true);
  assert.equal(comparison.provider_status.efinance.available, true);
  assert.equal(comparison.provider_status.qstock.available, true);
  assert.equal(efinanceProbe.status, "ok");
  assert.equal(efinanceProbe.records, 11);
  assert.equal(qstockProbe.status, "ok");
  assert.equal(qstockProbe.records.representative_etfs, 11);
  assert.match(markdown, /A-share ETF Provider Comparison/);
  assert.match(markdown, /AKShare/);
});

test("provider lab real probes degrade when optional Python dependencies are missing", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-provider-lab-missing-"));
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");

  await execFileAsync("python3", [
    path.join(rootDir, "providers", "efinance_quote_bridge", "probe_a_share_etf_quotes.py"),
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ], {
    env: {
      ...process.env,
      PYTHONPATH: "",
      FINANCIAL_POND_FORCE_MISSING_EFINANCE: "1"
    }
  });

  const efinanceProbe = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_probes", "efinance_a_share_etf_quote_probe.json")
  );

  assert.equal(efinanceProbe.status, "missing_dependency");
  assert.ok(Array.isArray(efinanceProbe.errors));
});

test("provider comparison does not count empty efinance rows as cross-checked quotes", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-provider-quality-"));
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");

  await execFileAsync("python3", [
    path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py"),
    "--fixture",
    "--as-of",
    "2026-07-10",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);

  const contract = await readJsonFile(contractPath);
  const emptyRows = contract.representative_etfs.map((item) => ({
    date: "2026-07-10",
    provider: "efinance",
    sector_id: item.sector_id,
    sector_node_id: item.sector_node_id,
    fund_code: item.fund_code,
    fund_name: item.fund_name_hint,
    close: null,
    pct_change: null,
    amount: null,
    volume: null,
    turnover: null
  }));
  const probeDir = path.join(outputRoot, "model_outputs", "provider_probes");
  await mkdir(probeDir, { recursive: true });
  await writeFile(
    path.join(probeDir, "efinance_a_share_etf_quote_probe.json"),
    JSON.stringify({
      probe_id: "efinance_a_share_etf_quote_probe",
      provider: "efinance",
      status: "no_usable_fields",
      records: emptyRows.length,
      usable_quote_records: 0,
      rows: emptyRows
    }, null, 2)
  );

  await execFileAsync("python3", [
    path.join(rootDir, "providers", "provider_comparison", "compare_a_share_etf_providers.py"),
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);

  const comparison = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_comparison", "a_share_etf_provider_comparison.json")
  );

  assert.equal(comparison.status, "partial");
  assert.equal(comparison.provider_status.akshare.usable_quote_records, 11);
  assert.equal(comparison.provider_status.efinance.usable_quote_records, 0);
  assert.equal(comparison.counts.quote_providers_available, 1);
  assert.equal(comparison.counts.cross_checked_quote_rows, 0);
  assert.ok(comparison.comparisons.every((row) => row.recommended_use === "single_provider_only"));
});

test("AKShare month backfill writes historical rows and calculated fixture flows", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-backfill-"));
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");

  const result = await execFileAsync("python3", [
    path.join(rootDir, "providers", "akshare_etf_bridge", "backfill_a_share_etf_history.py"),
    "--fixture",
    "--start-date",
    "2026-06-01",
    "--end-date",
    "2026-06-30",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);

  const status = JSON.parse(result.stdout);
  const rowCsv = await readFile(path.join(outputRoot, "data", "provider_exports", "a_share_etf_daily.csv"), "utf8");
  const sectorCsv = await readFile(path.join(outputRoot, "data", "provider_exports", "a_share_sector_flow.csv"), "utf8");
  const rows = rowCsv.trim().split("\n");
  const sectorRows = sectorCsv.trim().split("\n");

  assert.equal(status.status, "ok");
  assert.equal(status.counts.representative_etfs, 11);
  assert.equal(status.counts.rows_with_estimated_flow > 0, true);
  assert.equal(rows.length > 11, true);
  assert.match(rowCsv, /semiconductor_etf_flow/);
  assert.match(sectorCsv, /brokerage_etf_flow/);
  assert.equal(sectorRows.length > 2, true);
});

test("AKShare validation reports partial history without failing the command", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-partial-history-"));
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");
  const contract = await readJsonFile(contractPath);
  const observed = contract.representative_etfs.slice(0, 5);
  const rowDir = path.join(outputRoot, "data", "provider_exports");
  await mkdir(rowDir, { recursive: true });
  await writeFile(
    path.join(rowDir, "a_share_etf_daily.csv"),
    [
      contract.row_level_columns.join(","),
      ...observed.map((item, index) => contract.row_level_columns.map((column) => ({
        date: "2026-07-02",
        sector_id: item.sector_id,
        sector_node_id: item.sector_node_id,
        fund_code: item.fund_code,
        fund_name: item.fund_name_hint,
        close: "1.0",
        pct_change: "0.5",
        amount: String(100000000 + index),
        turnover: "1.0",
        latest_share: "1000000000",
        previous_share: "",
        share_change: "",
        estimated_flow: "",
        source_provider: "akshare",
        source_endpoint: "test",
        provider_run_id: "test",
        collected_at: "2026-07-02T00:00:00Z"
      })[column] ?? "").join(","))
    ].join("\n") + "\n"
  );
  await writeFile(
    path.join(rowDir, "a_share_sector_flow.csv"),
    [
      contract.sector_flow_columns.join(","),
      contract.sector_flow_columns.map((column) => column === "date" ? "2026-07-02" : "").join(",")
    ].join("\n") + "\n"
  );

  await execFileAsync("python3", [
    path.join(rootDir, "providers", "akshare_etf_bridge", "validate_exports.py"),
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath,
    "--no-require-latest-run-ok"
  ]);

  const validation = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_validation", "akshare_etf_bridge_validation.json")
  );

  assert.equal(validation.status, "partial");
  assert.ok(validation.partial_reasons.some((reason) => reason.includes("Missing representative ETF codes")));
});

test("AKShare month backfill reports no_history_available when history endpoint returns no rows", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-no-history-"));
  const fakeModuleRoot = await mkdtemp(path.join(tmpdir(), "pond-fake-akshare-no-history-"));
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");
  const scriptPath = path.join(rootDir, "providers", "akshare_etf_bridge", "backfill_a_share_etf_history.py");

  await mkdir(fakeModuleRoot, { recursive: true });
  await writeFile(
    path.join(fakeModuleRoot, "akshare.py"),
    `
import json

class FakeDataFrame:
    def __init__(self, rows):
        self.rows = rows

    def to_json(self, orient="records", force_ascii=False):
        return json.dumps(self.rows, ensure_ascii=force_ascii)

def fund_etf_hist_em(**kwargs):
    return FakeDataFrame([])

def fund_etf_scale_sse(**kwargs):
    return FakeDataFrame([])

def fund_etf_scale_szse(**kwargs):
    return FakeDataFrame([])
`,
    "utf8"
  );

  const result = await execFileAsync("python3", [
    scriptPath,
    "--start-date",
    "2026-06-01",
    "--end-date",
    "2026-07-02",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ], {
    env: {
      ...process.env,
      AKSHARE_BRIDGE_MODULE_PATH: path.join(fakeModuleRoot, "akshare.py")
    }
  });

  const status = JSON.parse(result.stdout);

  assert.equal(status.status, "no_history_available");
  assert.equal(status.records, 0);
  assert.equal(status.counts.representative_codes_observed, 0);
  assert.ok(status.warnings.some((warning) => warning.includes("no representative ETF rows")));
});
