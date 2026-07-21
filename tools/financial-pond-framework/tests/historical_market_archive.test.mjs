import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const frameworkRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archiveScript = path.join(frameworkRoot, "providers", "akshare_etf_bridge", "archive_historical_market_inputs.py");

const header = "date,sector_id,sector_node_id,fund_code,fund_name,close,pct_change,amount,turnover,latest_share,previous_share,share_change,estimated_flow,source_provider,source_endpoint,provider_run_id,collected_at,open,high,low,volume,historical_input";

function row(date, close, suffix = "") {
  return `${date},ai_computer,ai_computer_etf_flow,159819,AI ETF,${close},1,100,2,,,,,akshare,spot,run${suffix},2026-07-21T00:00:00Z,,,,,`;
}

test("historical market hydration preserves cumulative rows and excludes future rows", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fp-history-preserve-"));
  const exportDir = path.join(root, "data", "provider_exports");
  await mkdir(exportDir, { recursive: true });
  await writeFile(path.join(exportDir, "a_share_etf_daily.csv"), [
    header,
    row("2026-07-10", "2.10", "-old"),
    row("2026-07-16", "1.98", "-kept"),
    row("2026-07-22", "9.99", "-future")
  ].join("\n") + "\n", "utf8");

  const python = String.raw`
import csv, importlib.util, json
from pathlib import Path
spec=importlib.util.spec_from_file_location("archive_market_inputs", r"${archiveScript}")
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
root=Path(r"${root}")
series=module.load_existing_series(root, "2026-07-21")
new_rows=[{
  "status":"ok", "trade_date":"2026-07-21", "symbol":"159819",
  "sector_id":"ai_computer", "sector_node_id":"ai_computer_etf_flow",
  "fund_name_hint":"AI ETF", "close":2.25, "amount":200, "volume":300,
  "source_provider":"akshare", "source_endpoint":"fund_etf_hist_em",
  "fetched_at":"2026-07-21T10:00:00Z"
}]
module.hydrate(root, new_rows, series)
with (root/"data"/"provider_exports"/"a_share_etf_daily.csv").open(newline="", encoding="utf8") as handle:
  rows=list(csv.DictReader(handle))
print(json.dumps(rows))
`;
  const result = spawnSync("python3", ["-c", python], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const rows = JSON.parse(result.stdout);
  assert.deepEqual(rows.map((item) => item.date), ["2026-07-10", "2026-07-16", "2026-07-21"]);
  assert.equal(rows.find((item) => item.date === "2026-07-16").close, "1.98");
  assert.equal(rows.find((item) => item.date === "2026-07-21").close, "2.25");
  assert.equal(rows.some((item) => item.date === "2026-07-22"), false);
});

test("archive implementation no longer depends on a fixed Git revision", async () => {
  const source = await readFile(archiveScript, "utf8");
  assert.match(source, /load_existing_series\(root, args\.as_of\)/);
  assert.match(source, /row\.get\("date"\) <= as_of/);
  assert.doesNotMatch(source, /git\s*show/);
  assert.doesNotMatch(source, /36e6ae0/);
});
