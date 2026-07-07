import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../collectors/http_csv_collector.mjs";
import { readJsonFile } from "../core/config_loader.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runAkshareProviderHistoryAudit({
  rootDir,
  asOf = null
}) {
  const contract = await readJsonFile(path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json"));
  const csvPath = path.join(rootDir, "data", "provider_exports", "a_share_etf_daily.csv");
  const rows = await readCsvIfExists(csvPath);
  const payload = buildAkshareProviderHistoryAudit({
    contract,
    rows,
    asOf,
    csvPath: path.relative(rootDir, csvPath)
  });

  const outputDir = path.join(rootDir, "model_outputs", "provider_history");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "akshare_provider_history.json");
  const mdPath = path.join(outputDir, "akshare_provider_history.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return { payload, jsonPath, mdPath };
}

export function buildAkshareProviderHistoryAudit({
  contract,
  rows,
  asOf = null,
  csvPath = "data/provider_exports/a_share_etf_daily.csv"
}) {
  const expectedCodes = (contract.representative_etfs ?? []).map((item) => item.fund_code);
  const availableDates = [...new Set(rows.map((row) => row.date).filter(Boolean))].sort();
  const currentDate = asOf ?? availableDates.at(-1) ?? null;
  const previousDate = currentDate ? availableDates.filter((date) => date < currentDate).at(-1) ?? null : null;
  const dateFindings = availableDates.map((date) => buildDateFinding({
    date,
    rows: rows.filter((row) => row.date === date),
    expectedCodes
  }));
  const currentFinding = dateFindings.find((item) => item.date === currentDate) ?? null;
  const minFlowRows = Math.max(1, Math.ceil(expectedCodes.length * 0.6));
  const status = historyStatus({
    rows,
    currentDate,
    previousDate,
    currentFinding,
    minFlowRows
  });

  return {
    audit_id: "akshare_provider_history_audit_v0_10_38",
    generated_at: new Date().toISOString(),
    status,
    as_of: currentDate,
    row_csv: csvPath,
    expected_representative_rows: expectedCodes.length,
    min_flow_rows_for_gate: minFlowRows,
    provider_history: {
      available_dates: availableDates,
      date_count: availableDates.length,
      current_date: currentDate,
      previous_available_date: previousDate,
      has_previous_available_date: Boolean(previousDate),
      rows_by_date: Object.fromEntries(dateFindings.map((item) => [item.date, item.row_count]))
    },
    current: currentFinding,
    previous: dateFindings.find((item) => item.date === previousDate) ?? null,
    date_findings: dateFindings,
    next_action: nextAction({ status, currentDate, previousDate, currentFinding, minFlowRows })
  };
}

async function readCsvIfExists(csvPath) {
  try {
    return parseCsv(await readFile(csvPath, "utf8"));
  } catch {
    return [];
  }
}

function buildDateFinding({ date, rows, expectedCodes }) {
  const observedCodes = new Set(rows.map((row) => row.fund_code).filter(Boolean));
  const missingCodes = expectedCodes.filter((code) => !observedCodes.has(code));
  const latestShareRows = rows.filter((row) => numberValue(row.latest_share) !== null).length;
  const previousShareRows = rows.filter((row) => numberValue(row.previous_share) !== null).length;
  const shareChangeRows = rows.filter((row) => numberValue(row.share_change) !== null).length;
  const estimatedFlowRows = rows.filter((row) => numberValue(row.estimated_flow) !== null).length;
  return {
    date,
    row_count: rows.length,
    expected_rows: expectedCodes.length,
    missing_codes: missingCodes,
    latest_share_rows: latestShareRows,
    previous_share_rows: previousShareRows,
    share_change_rows: shareChangeRows,
    estimated_flow_rows: estimatedFlowRows,
    status: estimatedFlowRows >= Math.max(1, Math.ceil(expectedCodes.length * 0.6))
      ? "flow_gate_ready"
      : estimatedFlowRows > 0
        ? "partial_flow"
        : previousShareRows > 0
          ? "history_present_missing_flow"
          : "baseline_only"
  };
}

function historyStatus({ rows, currentDate, previousDate, currentFinding, minFlowRows }) {
  if (!rows.length) return "no_provider_csv";
  if (!currentDate || !currentFinding) return "current_date_missing";
  if (!previousDate) return "baseline_only";
  if ((currentFinding.estimated_flow_rows ?? 0) >= minFlowRows) return "flow_gate_ready";
  if ((currentFinding.estimated_flow_rows ?? 0) > 0) return "partial_flow";
  return "history_present_missing_flow";
}

function nextAction({ status, currentDate, previousDate, currentFinding, minFlowRows }) {
  if (status === "no_provider_csv") {
    return "先运行 npm run provider:akshare，生成 provider_exports CSV。";
  }
  if (status === "current_date_missing") {
    return "指定日期不在 provider CSV 中；先确认 --as-of 或重新运行 provider。";
  }
  if (status === "baseline_only") {
    return `当前只有 ${currentDate} 的 provider 基线；下一次真实交易日再运行 provider，或补入更早真实 CSV 基线。`;
  }
  if (status === "history_present_missing_flow") {
    return `CSV 已有上一日期 ${previousDate}，但 ${currentDate} 仍没有 estimated_flow；检查 previous_share 回填和 AKShare 份额字段。`;
  }
  if (status === "partial_flow") {
    return `已有 ${currentFinding.estimated_flow_rows}/${currentFinding.expected_rows} 行 estimated_flow；达到 ${minFlowRows} 行才可通过 60% 覆盖门槛。`;
  }
  return "provider 历史和 estimated_flow 覆盖已达到基础门槛；继续运行 flow/review/readiness 下游。";
}

function numberValue(value) {
  if (value === null || value === undefined || value === "" || value === "None") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildMarkdown(payload) {
  const lines = [
    "# AKShare Provider History Audit",
    "",
    `- status: ${payload.status}`,
    `- as_of: ${payload.as_of ?? "none"}`,
    `- available_dates: ${payload.provider_history.available_dates.join(", ") || "none"}`,
    `- previous_available_date: ${payload.provider_history.previous_available_date ?? "none"}`,
    `- min_flow_rows_for_gate: ${payload.min_flow_rows_for_gate}`,
    `- next_action: ${payload.next_action}`,
    "",
    "## Date Findings",
    "",
    "| Date | Rows | latest_share | previous_share | share_change | estimated_flow | Status |",
    "|---|---:|---:|---:|---:|---:|---|"
  ];
  for (const row of payload.date_findings) {
    lines.push(
      `| ${row.date} | ${row.row_count}/${row.expected_rows} | ${row.latest_share_rows} | ${row.previous_share_rows} | ${row.share_change_rows} | ${row.estimated_flow_rows} | ${row.status} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = { asOf: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runAkshareProviderHistoryAudit({ rootDir, asOf: args.asOf });
  console.log(`AKShare provider history audit written: ${result.jsonPath}`);
  console.log(`Review Markdown written: ${result.mdPath}`);
  console.log(`Status: ${result.payload.status}`);
  console.log(`Next action: ${result.payload.next_action}`);
}
