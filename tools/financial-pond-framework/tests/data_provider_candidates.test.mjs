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

test("open-source data provider candidates are documented as external adapters", async () => {
  const config = await readJsonFile(
    path.join(rootDir, "config", "data_providers", "open_source_candidates.json")
  );

  assert.equal(config.core_boundary.core_must_not_import_providers, true);
  assert.equal(config.core_boundary.default_enabled, false);
  assert.ok(config.candidates.length >= 3);

  const byId = new Map(config.candidates.map((candidate) => [candidate.id, candidate]));
  assert.equal(byId.get("akshare").priority, 1);
  assert.equal(byId.get("akshare").role, "primary_a_share_etf_provider");
  assert.equal(byId.get("efinance").priority, 2);
  assert.equal(byId.get("tushare").token_required, true);

  for (const candidate of config.candidates) {
    assert.ok(candidate.repo_url, `${candidate.id} must include repo_url`);
    assert.ok(candidate.planned_adapter, `${candidate.id} must include planned_adapter`);
    assert.ok(candidate.risk_notes.length > 0, `${candidate.id} must include risk_notes`);
    assert.match(candidate.default_status, /disabled|reference/);
  }
});

test("AKShare ETF bridge fixture exports collector-friendly files", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-bridge-"));
  const bridgeScript = path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py");
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");

  await execFileAsync("python3", [
    bridgeScript,
    "--fixture",
    "--as-of",
    "2026-07-03",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  await execFileAsync("python3", [
    bridgeScript,
    "--fixture",
    "--as-of",
    "2026-07-04",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  await execFileAsync("python3", [
    bridgeScript,
    "--fixture",
    "--as-of",
    "2026-07-04",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);

  const rowCsv = await readFile(path.join(outputRoot, "data", "provider_exports", "a_share_etf_daily.csv"), "utf8");
  const sectorCsv = await readFile(path.join(outputRoot, "data", "provider_exports", "a_share_sector_flow.csv"), "utf8");
  const validatorScript = path.join(rootDir, "providers", "akshare_etf_bridge", "validate_exports.py");
  const validation = await execFileAsync("python3", [
    validatorScript,
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  const status = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_runs", "akshare_etf_bridge_2026-07-03.json")
  );
  const validationReport = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_validation", "akshare_etf_bridge_validation.json")
  );

  assert.match(rowCsv, /fund_code/);
  assert.match(rowCsv, /brokerage/);
  assert.match(sectorCsv, /brokerage_etf_flow/);
  assert.match(sectorCsv, /semiconductor_etf_flow/);
  assert.match(validation.stdout, /"status": "ok"/);
  assert.equal(status.status, "ok");
  assert.equal(status.mode, "fixture");
  assert.equal(status.records, 11);
  assert.equal(validationReport.status, "ok");
  assert.equal(validationReport.counts.representative_codes_observed, 11);
  assert.equal(rowCsv.trim().split("\n").length, 23);
  assert.equal(sectorCsv.trim().split("\n").length, 3);
});

test("AKShare bridge local CSV source templates cover every sector ETF-flow column", async () => {
  const [contract, hardDataSources] = await Promise.all([
    readJsonFile(path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json")),
    readJsonFile(path.join(rootDir, "config", "collectors", "hard_data_sources.json"))
  ]);

  const sourceByNode = new Map(
    hardDataSources.sources
      .filter((source) => source.id.startsWith("akshare_bridge_"))
      .map((source) => [source.node_id, source])
  );

  for (const item of contract.representative_etfs) {
    const source = sourceByNode.get(item.sector_node_id);
    assert.ok(source, `missing source for ${item.sector_node_id}`);
    assert.equal(source.enabled, false);
    assert.equal(source.collector, "local_csv");
    assert.equal(source.path, "data/provider_exports/a_share_sector_flow.csv");
    assert.equal(source.value_column, item.sector_node_id);
  }
});

test("AKShare export inspector writes source-review reports without enabling sources", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-inspect-"));
  const bridgeScript = path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py");
  const inspectorScript = path.join(rootDir, "providers", "akshare_etf_bridge", "inspect_exports.py");
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");

  await execFileAsync("python3", [
    bridgeScript,
    "--fixture",
    "--as-of",
    "2026-07-08",
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);

  const result = await execFileAsync("python3", [
    inspectorScript,
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  const report = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_inspection", "akshare_etf_bridge_inspection.json")
  );
  const markdown = await readFile(
    path.join(outputRoot, "model_outputs", "provider_inspection", "akshare_etf_bridge_inspection.md"),
    "utf8"
  );

  assert.match(result.stdout, /"status": "ok"/);
  assert.equal(report.status, "ok");
  assert.equal(report.as_of, "2026-07-08");
  assert.equal(report.counts.enable_candidates, 11);
  assert.equal(report.overall_recommendation, "review_candidates_before_enabling");
  assert.match(markdown, /Source Recommendations/);
  assert.match(markdown, /brokerage_etf_flow/);
});

test("AKShare ETF bridge real path tolerates fund_etf_scale_sse signature drift", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-real-"));
  const fakeModuleRoot = await mkdtemp(path.join(tmpdir(), "pond-fake-akshare-"));
  const bridgeScript = path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py");
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");
  const contract = await readJsonFile(contractPath);

  await mkdir(fakeModuleRoot, { recursive: true });
  await writeFile(
    path.join(fakeModuleRoot, "akshare.py"),
    buildFakeAkshareModule(contract.representative_etfs),
    "utf8"
  );

  const result = await execFileAsync("python3", [
    bridgeScript,
    "--as-of",
    "2026-07-06",
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

  const status = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_runs", "akshare_etf_bridge_2026-07-06.json")
  );
  const rowCsv = await readFile(path.join(outputRoot, "data", "provider_exports", "a_share_etf_daily.csv"), "utf8");

  assert.match(result.stdout, /"status": "ok"/);
  assert.equal(status.status, "ok");
  assert.equal(status.mode, "real");
  assert.equal(status.records, 11);
  assert.match(rowCsv, /512000/);
  assert.match(rowCsv, /fund_etf_spot_em\+fund_etf_scale/);
});

test("AKShare validation treats first real export as baseline until flow history exists", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-baseline-"));
  const fakeModuleRoot = await mkdtemp(path.join(tmpdir(), "pond-fake-akshare-baseline-"));
  const bridgeScript = path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py");
  const validatorScript = path.join(rootDir, "providers", "akshare_etf_bridge", "validate_exports.py");
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");
  const contract = await readJsonFile(contractPath);

  await mkdir(fakeModuleRoot, { recursive: true });
  await writeFile(
    path.join(fakeModuleRoot, "akshare.py"),
    buildFakeAkshareModule(contract.representative_etfs),
    "utf8"
  );

  await execFileAsync("python3", [
    bridgeScript,
    "--as-of",
    "2026-07-09",
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

  const validation = await execFileAsync("python3", [
    validatorScript,
    "--root-dir",
    outputRoot,
    "--contract",
    contractPath
  ]);
  const report = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_validation", "akshare_etf_bridge_validation.json")
  );

  assert.match(validation.stdout, /"status": "ok"/);
  assert.equal(report.status, "ok");
  assert.equal(report.counts.dates, 1);
  assert.equal(report.flow_readiness.status, "baseline_only");
  assert.ok(report.flow_readiness.empty_flow_columns.length > 0);
});

test("AKShare ETF bridge real path degrades when optional share endpoint fails", async () => {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-partial-"));
  const fakeModuleRoot = await mkdtemp(path.join(tmpdir(), "pond-fake-akshare-partial-"));
  const bridgeScript = path.join(rootDir, "providers", "akshare_etf_bridge", "export_a_share_etf_daily.py");
  const contractPath = path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json");
  const contract = await readJsonFile(contractPath);

  await mkdir(fakeModuleRoot, { recursive: true });
  await writeFile(
    path.join(fakeModuleRoot, "akshare.py"),
    buildFakeAkshareModule(contract.representative_etfs, { failSzse: true }),
    "utf8"
  );

  const result = await execFileAsync("python3", [
    bridgeScript,
    "--as-of",
    "2026-07-07",
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

  const status = await readJsonFile(
    path.join(outputRoot, "model_outputs", "provider_runs", "akshare_etf_bridge_2026-07-07.json")
  );
  const raw = await readJsonFile(
    path.join(outputRoot, "raw_data", "provider", "akshare", "2026-07-07", "a_share_etf_daily_raw.json")
  );

  assert.match(result.stdout, /"status": "ok"/);
  assert.equal(status.status, "ok");
  assert.equal(status.records, 11);
  assert.equal(status.warnings.length, 1);
  assert.match(status.warnings[0], /fund_etf_scale_szse/);
  assert.equal(raw.warnings.length, 1);
});

function buildFakeAkshareModule(representativeEtfs, options = {}) {
  const codes = representativeEtfs.map((item) => item.fund_code);
  const failSzse = Boolean(options.failSzse);
  return `
import json

codes = ${JSON.stringify(codes)}
fail_szse = ${failSzse ? "True" : "False"}

class FakeDataFrame:
    def __init__(self, rows):
        self.rows = rows

    def to_json(self, orient="records", force_ascii=False):
        if orient != "records":
            raise ValueError("FakeDataFrame only supports records orient")
        return json.dumps(self.rows, ensure_ascii=force_ascii)

def fund_etf_spot_em():
    return FakeDataFrame([
        {
            "代码": code,
            "名称": f"ETF {code}",
            "最新价": 1.0 + index / 100,
            "涨跌幅": 0.5,
            "成交额": 100000000 + index,
            "换手率": 1.5,
            "最新份额": 1000000000 + index * 1000000,
        }
        for index, code in enumerate(codes)
    ])

def fund_etf_scale_sse():
    return FakeDataFrame([
        {"基金代码": code, "基金份额": 1000000000 + index * 1000000}
        for index, code in enumerate(codes[:6])
    ])

def fund_etf_scale_szse():
    if fail_szse:
        raise RuntimeError("simulated SSL error from fund.szse.cn")
    return FakeDataFrame([
        {"基金代码": code, "基金份额": 1000000000 + index * 1000000}
        for index, code in enumerate(codes[6:])
    ])
`;
}
