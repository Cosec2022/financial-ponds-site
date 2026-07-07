import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, mkdir, cp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "../src/core/config_loader.mjs";
import { runAkshareProviderHistoryAudit } from "../src/tools/akshare_provider_history.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("AKShare provider history audit reports a single-date baseline", async () => {
  const outputRoot = await prepareTempProject();
  const contract = await readJsonFile(path.join(outputRoot, "providers", "akshare_etf_bridge", "provider_contract.json"));
  await writeProviderCsv({
    rootDir: outputRoot,
    contract,
    dates: ["2026-07-07"],
    withEstimatedFlow: false
  });

  const result = await runAkshareProviderHistoryAudit({
    rootDir: outputRoot,
    asOf: "2026-07-07"
  });

  assert.equal(result.payload.status, "baseline_only");
  assert.deepEqual(result.payload.provider_history.available_dates, ["2026-07-07"]);
  assert.equal(result.payload.provider_history.previous_available_date, null);
  assert.equal(result.payload.current.row_count, 11);
  assert.equal(result.payload.current.estimated_flow_rows, 0);
  assert.match(result.payload.next_action, /2026-07-07/);
});

test("AKShare provider history audit reports flow gate readiness after two dates with estimated flow", async () => {
  const outputRoot = await prepareTempProject();
  const contract = await readJsonFile(path.join(outputRoot, "providers", "akshare_etf_bridge", "provider_contract.json"));
  await writeProviderCsv({
    rootDir: outputRoot,
    contract,
    dates: ["2026-07-07", "2026-07-08"],
    withEstimatedFlow: true
  });

  const result = await runAkshareProviderHistoryAudit({
    rootDir: outputRoot,
    asOf: "2026-07-08"
  });
  const output = JSON.parse(await readFile(
    path.join(outputRoot, "model_outputs", "provider_history", "akshare_provider_history.json"),
    "utf8"
  ));

  assert.equal(result.payload.status, "flow_gate_ready");
  assert.equal(result.payload.provider_history.previous_available_date, "2026-07-07");
  assert.equal(result.payload.current.estimated_flow_rows, 11);
  assert.equal(output.status, "flow_gate_ready");
  assert.match(result.payload.next_action, /下游/);
});

async function prepareTempProject() {
  const outputRoot = await mkdtemp(path.join(tmpdir(), "pond-akshare-history-"));
  await cp(path.join(rootDir, "providers"), path.join(outputRoot, "providers"), { recursive: true });
  return outputRoot;
}

async function writeProviderCsv({ rootDir, contract, dates, withEstimatedFlow }) {
  const columns = contract.row_level_columns;
  const rows = [];
  for (const date of dates) {
    contract.representative_etfs.forEach((item, index) => {
      const latestShare = 1000000000 + index + (date.endsWith("08") ? 100 : 0);
      const previousShare = date.endsWith("08") ? latestShare - 100 : "";
      const shareChange = previousShare === "" ? "" : latestShare - previousShare;
      const close = 1 + index / 100;
      rows.push({
        date,
        sector_id: item.sector_id,
        sector_node_id: item.sector_node_id,
        fund_code: item.fund_code,
        fund_name: item.fund_name_hint,
        close,
        pct_change: index - 5,
        amount: 100000000 + index * 10000000,
        turnover: "",
        latest_share: latestShare,
        previous_share: withEstimatedFlow ? previousShare : "",
        share_change: withEstimatedFlow ? shareChange : "",
        estimated_flow: withEstimatedFlow && shareChange !== "" ? shareChange * close : "",
        source_provider: "akshare",
        source_endpoint: "test",
        provider_run_id: "test",
        collected_at: `${date}T00:00:00.000Z`
      });
    });
  }
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => row[column] ?? "").join(","))
  ].join("\n");
  const outDir = path.join(rootDir, "data", "provider_exports");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "a_share_etf_daily.csv"), `${csv}\n`, "utf8");
}
