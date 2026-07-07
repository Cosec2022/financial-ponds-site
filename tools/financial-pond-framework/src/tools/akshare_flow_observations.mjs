import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../collectors/http_csv_collector.mjs";
import { readJsonFile } from "../core/config_loader.mjs";
import { clamp } from "../core/transforms.mjs";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function convertAkshareExportToFlowObservations({
  rootDir,
  asOf = null
}) {
  const [contract, sectorCatalog] = await Promise.all([
    readJsonFile(path.join(rootDir, "providers", "akshare_etf_bridge", "provider_contract.json")),
    readJsonFile(path.join(rootDir, "config", "sector_catalog", "a_share_industry_etfs.json"))
  ]);
  const csvPath = path.join(rootDir, "data", "provider_exports", "a_share_etf_daily.csv");
  const rows = parseCsv(await readFile(csvPath, "utf8"));
  const availableDates = [...new Set(rows.map((row) => row.date).filter(Boolean))].sort();
  const resolvedAsOf = asOf ?? availableDates.at(-1);
  if (!resolvedAsOf) {
    throw new Error("No AKShare export dates found. Run npm run provider:akshare or provider:akshare:fixture first.");
  }

  const latestRows = rows.filter((row) => row.date === resolvedAsOf);
  if (!latestRows.length) {
    throw new Error(`No AKShare ETF rows found for ${resolvedAsOf}. Available dates: ${availableDates.join(", ")}`);
  }

  const sectorById = new Map((sectorCatalog.sectors ?? []).map((sector) => [sector.id, sector]));
  const expectedSectorIds = new Set((contract.representative_etfs ?? []).map((item) => item.sector_id));
  const missingSectorIds = [...expectedSectorIds].filter(
    (sectorId) => !latestRows.some((row) => row.sector_id === sectorId)
  );
  const amountValues = latestRows.map((row) => numberValue(row.amount)).filter((value) => value !== null);
  const flowValues = latestRows.map((row) => numberValue(row.estimated_flow)).filter((value) => value !== null);
  const maxAbsFlow = Math.max(...flowValues.map((value) => Math.abs(value)), 0);
  const amountRank = buildAmountRanks(latestRows);

  const observations = [];
  const rowFindings = [];
  for (const row of latestRows) {
    const sector = sectorById.get(row.sector_id);
    const pctChange = numberValue(row.pct_change);
    const amount = numberValue(row.amount);
    const estimatedFlow = numberValue(row.estimated_flow);
    const latestShare = numberValue(row.latest_share);
    const previousShare = numberValue(row.previous_share);
    const shareChange = numberValue(row.share_change);
    const rankInfo = amountRank.get(row.sector_id);

    rowFindings.push({
      sector_id: row.sector_id,
      fund_code: row.fund_code,
      fund_name: row.fund_name,
      pct_change: pctChange,
      amount,
      latest_share: latestShare,
      previous_share: previousShare,
      share_change: shareChange,
      estimated_flow: estimatedFlow,
      flow_available: estimatedFlow !== null
    });

    if (!sector) continue;

    if (pctChange !== null) {
      observations.push({
        node_id: `${row.sector_id}_relative_strength`,
        as_of: resolvedAsOf,
        value: pctChange,
        unit: "percent_change",
        score: clamp(pctChange / 5, -1, 1),
        confidence: 0.65,
        data_type: "hard_data",
        source: "akshare_provider_flow_observations",
        raw_ref: "data/provider_exports/a_share_etf_daily.csv",
        reason: `AKShare representative ETF pct_change mapped to ${sector.name} relative-strength proxy. This is a single-ETF sector proxy, not a full sector breadth measure.`
      });
    }

    if (rankInfo && amount !== null) {
      observations.push({
        node_id: `${row.sector_id}_leader_confirmation`,
        as_of: resolvedAsOf,
        value: amount,
        unit: "amount",
        score: rankInfo.score,
        confidence: 0.55,
        data_type: "hard_data",
        source: "akshare_provider_flow_observations",
        raw_ref: "data/provider_exports/a_share_etf_daily.csv",
        reason: `AKShare representative ETF amount rank ${rankInfo.rank}/${rankInfo.total} mapped to ${sector.name} attention proxy. This is confirmation heat, not net flow.`
      });
    }

    if (estimatedFlow !== null && maxAbsFlow > 0) {
      observations.push({
        node_id: row.sector_node_id,
        as_of: resolvedAsOf,
        value: estimatedFlow,
        unit: "estimated_flow",
        score: clamp(estimatedFlow / maxAbsFlow, -1, 1),
        confidence: 0.75,
        data_type: "hard_data",
        source: "akshare_provider_flow_observations",
        raw_ref: "data/provider_exports/a_share_etf_daily.csv",
        reason: `AKShare estimated_flow mapped to ${row.sector_node_id}. This is available only when share_change exists.`
      });
    }
  }

  const flowReadyRows = rowFindings.filter((row) => row.flow_available).length;
  const providerHistory = buildProviderHistory({ rows, availableDates, resolvedAsOf });
  const shareChangeDiagnostics = buildShareChangeDiagnostics(rowFindings, providerHistory);
  const readiness = flowReadyRows === latestRows.length
    ? "flow_ready"
    : flowReadyRows > 0
      ? "partial_flow"
      : "baseline_only";
  const payload = {
    converter_id: "akshare_provider_to_flow_observations_v0_9_1",
    as_of: resolvedAsOf,
    generated_at: new Date().toISOString(),
    readiness,
    counts: {
      source_rows: latestRows.length,
      observations: observations.length,
      flow_ready_rows: flowReadyRows,
      amount_rows: amountValues.length,
      missing_sector_ids: missingSectorIds.length
    },
    provider_history: providerHistory,
    share_change_diagnostics: shareChangeDiagnostics,
    warnings: buildWarnings({ readiness, missingSectorIds, providerHistory }),
    observations,
    row_findings: rowFindings
  };

  const observationDir = path.join(rootDir, "observations", resolvedAsOf);
  const outputDir = path.join(rootDir, "model_outputs", resolvedAsOf);
  await Promise.all([
    mkdir(observationDir, { recursive: true }),
    mkdir(outputDir, { recursive: true })
  ]);
  const observationPath = path.join(observationDir, "provider_flow_observations.json");
  const modelJsonPath = path.join(outputDir, "akshare_provider_flow_observations.json");
  const modelMdPath = path.join(outputDir, "akshare_provider_flow_observations.md");
  await atomicWriteFile(observationPath, jsonContent({
    as_of: resolvedAsOf,
    observations
  }));
  await atomicWriteFile(modelJsonPath, jsonContent(payload));
  await atomicWriteFile(modelMdPath, buildMarkdown(payload));

  return {
    payload,
    observationPath,
    modelJsonPath,
    modelMdPath
  };
}

function buildAmountRanks(rows) {
  const ranked = rows
    .map((row) => ({
      sector_id: row.sector_id,
      amount: numberValue(row.amount)
    }))
    .filter((row) => row.amount !== null)
    .sort((a, b) => b.amount - a.amount);
  const total = ranked.length;
  const map = new Map();
  ranked.forEach((row, index) => {
    const percentile = total <= 1 ? 1 : 1 - index / (total - 1);
    map.set(row.sector_id, {
      rank: index + 1,
      total,
      score: clamp((percentile - 0.5) * 2, -1, 1)
    });
  });
  return map;
}

function buildWarnings({ readiness, missingSectorIds, providerHistory }) {
  const warnings = [];
  if (missingSectorIds.length) {
    warnings.push(`Missing sector rows: ${missingSectorIds.join(", ")}`);
  }
  if (readiness === "baseline_only") {
    warnings.push("No estimated_flow values are available. The converter emitted market-confirmation inputs only.");
    if (!providerHistory?.previous_available_date) {
      warnings.push(`Provider CSV has no earlier trade date before ${providerHistory?.current_date ?? "the selected date"}. Share-change flow needs a later provider run or a historical baseline.`);
    }
  }
  if (readiness === "partial_flow") {
    warnings.push("Only some estimated_flow values are available. Review flow rows before using them as strong evidence.");
  }
  return warnings;
}

function buildProviderHistory({ rows, availableDates, resolvedAsOf }) {
  const rowsByDate = Object.fromEntries(
    availableDates.map((date) => [date, rows.filter((row) => row.date === date).length])
  );
  const previousAvailableDate = [...availableDates].filter((date) => date < resolvedAsOf).at(-1) ?? null;
  return {
    available_dates: availableDates,
    date_count: availableDates.length,
    current_date: resolvedAsOf,
    previous_available_date: previousAvailableDate,
    has_previous_available_date: Boolean(previousAvailableDate),
    rows_by_date: rowsByDate,
    current_rows: rowsByDate[resolvedAsOf] ?? 0,
    previous_rows: previousAvailableDate ? rowsByDate[previousAvailableDate] ?? 0 : 0
  };
}

function buildShareChangeDiagnostics(rows, providerHistory) {
  const total = rows.length;
  const latestShareRows = rows.filter((row) => row.latest_share !== null).length;
  const previousShareRows = rows.filter((row) => row.previous_share !== null).length;
  const shareChangeRows = rows.filter((row) => row.share_change !== null).length;
  const estimatedFlowRows = rows.filter((row) => row.estimated_flow !== null).length;
  const missing = rows
    .filter((row) => row.estimated_flow === null)
    .map((row) => ({
      sector_id: row.sector_id,
      fund_code: row.fund_code,
      fund_name: row.fund_name,
      missing_fields: [
        row.latest_share === null ? "latest_share" : null,
        row.previous_share === null ? "previous_share" : null,
        row.share_change === null ? "share_change" : null,
        row.estimated_flow === null ? "estimated_flow" : null
      ].filter(Boolean)
    }));

  return {
    status: estimatedFlowRows === total && total > 0 ? "flow_ready" : estimatedFlowRows > 0 ? "partial_flow" : "baseline_only",
    total_rows: total,
    latest_share_rows: latestShareRows,
    previous_share_rows: previousShareRows,
    share_change_rows: shareChangeRows,
    estimated_flow_rows: estimatedFlowRows,
    coverage: {
      latest_share: ratio(latestShareRows, total),
      previous_share: ratio(previousShareRows, total),
      share_change: ratio(shareChangeRows, total),
      estimated_flow: ratio(estimatedFlowRows, total)
    },
    missing,
    provider_history: providerHistory,
    next_unlock: shareChangeNextUnlock({
      missingCount: missing.length,
      total,
      providerHistory
    })
  };
}

function shareChangeNextUnlock({ missingCount, total, providerHistory }) {
  if (!missingCount) return "代表 ETF 份额变化流已可计算。";
  if (!providerHistory?.previous_available_date) {
    return `当前真实 provider CSV 只有 ${providerHistory?.current_date ?? "当前日期"} 的基线；需要下一次真实交易日运行，或补入更早真实 CSV 基线。`;
  }
  return `已有上一可用日期 ${providerHistory.previous_available_date}，但仍有 ${missingCount}/${total} 只代表 ETF 缺份额变化流；检查 previous_share/estimated_flow 字段。`;
}

function numberValue(value) {
  if (value === null || value === undefined || value === "" || value === "None") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ratio(count, total) {
  return total ? Number((count / total).toFixed(4)) : 0;
}

function buildMarkdown(payload) {
  const lines = [
    "# AKShare Provider Flow Observations",
    "",
    `- as_of: ${payload.as_of}`,
    `- readiness: ${payload.readiness}`,
    `- source_rows: ${payload.counts.source_rows}`,
    `- observations: ${payload.counts.observations}`,
    `- flow_ready_rows: ${payload.counts.flow_ready_rows}`,
    `- share_change_status: ${payload.share_change_diagnostics.status}`,
    `- share_change_rows: ${payload.share_change_diagnostics.share_change_rows}/${payload.share_change_diagnostics.total_rows}`,
    `- provider_dates: ${payload.provider_history.available_dates.join(", ") || "none"}`,
    `- previous_available_date: ${payload.provider_history.previous_available_date ?? "none"}`,
    "",
    "## Boundary",
    "",
    "- `estimated_flow` creates direct ETF-flow observations only when share-change data exists.",
    "- Missing `estimated_flow` does not get filled with a fake flow value.",
    "- ETF amount is mapped only as attention/confirmation heat.",
    "- ETF pct_change is mapped only as a representative relative-strength proxy.",
    ""
  ];
  if (payload.warnings.length) {
    lines.push("## Warnings", "");
    for (const warning of payload.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  lines.push("## Rows", "");
  lines.push("| Sector | Fund | pct_change | amount | share_change | estimated_flow |");
  lines.push("|---|---|---:|---:|---:|---:|");
  for (const row of payload.row_findings) {
    lines.push(
      `| ${row.sector_id} | ${row.fund_code} | ${formatNumber(row.pct_change)} | ${formatNumber(row.amount)} | ${formatNumber(row.share_change)} | ${formatNumber(row.estimated_flow)} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

function formatNumber(value) {
  return typeof value === "number" ? value.toFixed(4).replace(/\.?0+$/, "") : "";
}

function parseArgs(argv) {
  const args = {
    asOf: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await convertAkshareExportToFlowObservations({
    rootDir,
    asOf: args.asOf
  });
  console.log(`AKShare provider-flow observations written: ${result.observationPath}`);
  console.log(`Review JSON written: ${result.modelJsonPath}`);
  console.log(`Review Markdown written: ${result.modelMdPath}`);
  console.log(`Readiness: ${result.payload.readiness}`);
  console.log(`Observations: ${result.payload.counts.observations}`);
}
