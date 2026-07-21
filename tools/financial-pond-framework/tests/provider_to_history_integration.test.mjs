import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(frameworkRoot, "providers", "akshare_etf_bridge", "provider_contract.json");
const persistScript = path.join(frameworkRoot, "providers", "akshare_etf_bridge", "persist_daily_etf_history.py");
const execFileAsync = promisify(execFile);
const contract = JSON.parse(await readFile(contractPath, "utf8"));
const columns = [...contract.row_level_columns, "open", "high", "low", "volume", "historical_input"];

function rowsFor(date, closeOffset = 0) {
  return contract.representative_etfs.map((item, index) => ({
    date,
    sector_id: item.sector_id,
    sector_node_id: item.sector_node_id,
    fund_code: item.fund_code,
    fund_name: item.fund_name_hint,
    close: 1 + closeOffset + index / 100,
    pct_change: index - 5,
    amount: 100000000 + index,
    turnover: 1 + index / 10,
    latest_share: 1000000000 + index,
    previous_share: "",
    share_change: "",
    estimated_flow: "",
    source_provider: "akshare",
    source_endpoint: "fund_etf_spot_em+fund_etf_scale",
    provider_run_id: `akshare_etf_bridge_${date}_test`,
    collected_at: `${date}T10:00:00Z`
  }));
}

async function setup(initialDates = []) {
  const root = await mkdtemp(path.join(tmpdir(), "fp-provider-history-"));
  const exportDir = path.join(root, "data", "provider_exports");
  await mkdir(path.join(exportDir, "daily"), { recursive: true });
  await writeCsv(path.join(exportDir, "a_share_etf_daily.csv"), initialDates.flatMap((date) => rowsFor(date)));
  return root;
}

async function writeDaily(root, date, rows = rowsFor(date), status = "ok") {
  const payload = {
    schema_version: "akshare_daily_etf_rows_v1",
    provider: "akshare",
    mode: "real",
    status,
    as_of: date,
    provider_run_id: `akshare_etf_bridge_${date}_test`,
    records: rows.length,
    rows
  };
  const file = path.join(root, "data", "provider_exports", "daily", `a_share_etf_daily_${date}.json`);
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return file;
}

async function persist(root, date) {
  return execFileAsync("python3", [persistScript, "--as-of", date, "--root-dir", root, "--contract", contractPath]);
}

async function readRows(root) {
  const text = await readFile(path.join(root, "data", "provider_exports", "a_share_etf_daily.csv"), "utf8");
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const names = header.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [names[index], value])));
}

async function writeCsv(file, rows) {
  await mkdir(path.dirname(file), { recursive: true });
  const text = [columns.join(","), ...rows.map((row) => columns.map((column) => row[column] ?? "").join(","))].join("\n");
  await writeFile(file, `${text}\n`, "utf8");
}

test("A/E: persisted daily provider outputs fill cumulative history without deleting old dates", async () => {
  const root = await setup(["2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"]);
  const additions = ["2026-07-16", "2026-07-17", "2026-07-20", "2026-07-21", "2026-07-22"];
  for (const date of additions) {
    await writeDaily(root, date);
    // Reproduce the production bug: normalized output exists but cumulative CSV lacks the date.
    assert.equal((await readRows(root)).some((row) => row.date === date), false);
    await persist(root, date);
  }
  const rows = await readRows(root);
  const dates = [...new Set(rows.map((row) => row.date))].sort();
  assert.deepEqual(dates, ["2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", ...additions]);
  assert.equal(rows.length, dates.length * 11);
  assert.equal(dates.at(-1), "2026-07-22");
});

test("B: same-day reruns deterministically upsert without duplicate rows", async () => {
  const root = await setup(["2026-07-10"]);
  await writeDaily(root, "2026-07-22", rowsFor("2026-07-22", 0.2));
  await persist(root, "2026-07-22");
  await writeDaily(root, "2026-07-22", rowsFor("2026-07-22", 0.4));
  await persist(root, "2026-07-22");
  await persist(root, "2026-07-22");
  const rows = await readRows(root);
  assert.equal(rows.filter((row) => row.date === "2026-07-22").length, 11);
  assert.equal(Number(rows.find((row) => row.date === "2026-07-22" && row.fund_code === contract.representative_etfs[0].fund_code).close), 1.4);
});

test("C: future-dated provider rows are rejected and excluded", async () => {
  const root = await setup(["2026-07-10"]);
  const file = await writeDaily(root, "2026-07-21", rowsFor("2026-07-22"));
  const payload = JSON.parse(await readFile(file, "utf8"));
  payload.as_of = "2026-07-21";
  payload.provider_run_id = "akshare_etf_bridge_2026-07-22_test";
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await assert.rejects(persist(root, "2026-07-21"));
  assert.equal((await readRows(root)).some((row) => row.date === "2026-07-22"), false);
});

test("D: unavailable provider output creates no fabricated daily rows", async () => {
  const root = await setup(["2026-07-10"]);
  await writeDaily(root, "2026-07-22", [], "unavailable");
  const result = JSON.parse((await persist(root, "2026-07-22")).stdout);
  assert.equal(result.status, "no_valid_provider_rows");
  assert.deepEqual([...new Set((await readRows(root)).map((row) => row.date))], ["2026-07-10"]);
});
