// FP-AUDIT-01 Data Reality Audit
// Input: published model JSON files
// Output: data_reality_audit.json and data_reality_audit.md
// Boundary: labels data origin only; it does not change model scores.

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteFile, jsonContent } from "../storage/atomic_write.mjs";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function runDataRealityAudit({
  rootDir = defaultRootDir,
  asOf
}) {
  const resolvedAsOf = asOf ?? new Date().toISOString().slice(0, 10);
  const inputs = {
    sectorFlow: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_flow_review.json" }),
    news: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "news_review.json" }),
    general: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "general_pool_analysis.json" }),
    rotation: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_rotation_intelligence.json" }),
    rotationHistory: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_rotation_history.json" }),
    moduleReview: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "sector_module_review.json" }),
    etfReadiness: await readModelJson({ rootDir, asOf: resolvedAsOf, fileName: "etf_decision_readiness.json" }),
    akshareDoctor: await readJsonIfExists(
      path.join(rootDir, "model_outputs", "provider_runs", "akshare_etf_bridge_doctor.json")
    ),
    akshareProviderRun: await readJsonIfExists(
      path.join(rootDir, "model_outputs", "provider_runs", `akshare_etf_bridge_${resolvedAsOf}.json`)
    )
  };
  const payload = buildDataRealityAudit({ asOf: resolvedAsOf, inputs });

  const outDir = path.join(rootDir, "model_outputs", payload.as_of);
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "data_reality_audit.json");
  const mdPath = path.join(outDir, "data_reality_audit.md");
  await atomicWriteFile(jsonPath, jsonContent(payload));
  await atomicWriteFile(mdPath, buildMarkdown(payload));

  return { payload, jsonPath, mdPath };
}

export function buildDataRealityAudit({ asOf, inputs }) {
  const flowLayer = auditFlowLayer(inputs.sectorFlow);
  const doctorLayer = auditProviderDoctorLayer(inputs.akshareDoctor);
  const providerLayer = auditProviderRunLayer(inputs.akshareProviderRun);
  const newsLayer = auditNewsLayer(inputs.news);
  const moduleLayer = auditModuleLayer(inputs.moduleReview, flowLayer);
  const etfReadinessLayer = auditEtfReadinessLayer(inputs.etfReadiness);
  const rotationLayer = auditDerivedLayer({
    id: "sector_rotation",
    name: "行业轮动",
    inputLayers: [flowLayer, newsLayer],
    payload: inputs.rotation,
    sourceFile: "sector_rotation_intelligence.json"
  });
  const generalLayer = auditGeneralLayer(inputs.general);
  const rotationHistoryLayer = auditDerivedLayer({
    id: "rotation_history",
    name: "轮动历史",
    inputLayers: [rotationLayer],
    payload: inputs.rotationHistory,
    sourceFile: "sector_rotation_history.json"
  });

  const layers = [doctorLayer, providerLayer, flowLayer, newsLayer, moduleLayer, etfReadinessLayer, rotationLayer, generalLayer, rotationHistoryLayer];
  const overallReality = overallRealityFromLayers(layers);

  return {
    as_of: firstValue(layers.map((layer) => layer.as_of)) ?? asOf,
    generated_at: new Date().toISOString(),
    module_id: "data_reality_audit_v0_1",
    status: "audit_available",
    overall_reality: overallReality,
    headline: headlineFor(overallReality, layers),
    layers,
    warnings: buildWarnings(layers),
    interpretation_boundary: [
      "This audit labels data origin and freshness. It does not change model scores.",
      "mock, fixture, manual_seed, and derived_from_non_real layers are not live market evidence.",
      "A layer can have a valid model contract while still using non-real inputs.",
      "Use this audit before reading any ranking or decision label as market evidence."
    ]
  };
}

async function readModelJson({ rootDir, asOf, fileName }) {
  const candidates = [
    path.join(rootDir, "model_outputs", asOf, fileName),
    path.join(rootDir, "..", "..", "financial-pond", "data", fileName)
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(await readFile(candidate, "utf8"));
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function auditProviderRunLayer(payload) {
  if (!payload) {
    return {
      id: "akshare_provider_run",
      name: "AKShare真实数据探测",
      source_file: "model_outputs/provider_runs/akshare_etf_bridge_<date>.json",
      as_of: null,
      generated_at: null,
      reality: "provider_not_run",
      confidence_for_market_use: "low",
      reading: "当前日期没有 AKShare real provider run status。先跑 provider，再谈真实资金量价。"
    };
  }

  const ok = payload.mode === "real" && payload.status === "ok";
  const error = payload.status === "error";
  return {
    id: "akshare_provider_run",
    name: "AKShare真实数据探测",
    source_file: payload.outputs?.run_status_json ?? "model_outputs/provider_runs/akshare_etf_bridge_<date>.json",
    as_of: payload.as_of ?? null,
    generated_at: payload.finished_at ?? payload.started_at ?? null,
    reality: ok ? "provider_run_ok" : error ? "provider_run_failed" : "provider_run_unverified",
    confidence_for_market_use: ok ? "medium" : "low",
    counts: {
      records: payload.records ?? 0,
      warnings: payload.warnings?.length ?? 0,
      errors: payload.errors?.length ?? 0
    },
    errors: payload.errors ?? [],
    warnings: payload.warnings ?? [],
    reading: ok
      ? `AKShare real provider completed with ${payload.records ?? 0} rows. Flow review still needs observed-source coverage checks.`
      : error
        ? `AKShare real provider failed: ${(payload.errors ?? []).join(" / ")}`
        : "AKShare provider run status is present but not verified as a real successful run."
  };
}

function auditProviderDoctorLayer(payload) {
  if (!payload) {
    return {
      id: "akshare_provider_doctor",
      name: "AKShare环境预检",
      source_file: "model_outputs/provider_runs/akshare_etf_bridge_doctor.json",
      as_of: null,
      generated_at: null,
      reality: "provider_doctor_not_run",
      confidence_for_market_use: "low",
      reading: "当前没有 AKShare doctor 预检结果。先跑 npm run provider:akshare:doctor。"
    };
  }

  const ok = payload.status === "ok";
  const blockedChecks = (payload.checks ?? []).filter((item) => item.status !== "ok");
  return {
    id: "akshare_provider_doctor",
    name: "AKShare环境预检",
    source_file: "model_outputs/provider_runs/akshare_etf_bridge_doctor.json",
    as_of: null,
    generated_at: payload.finished_at ?? payload.started_at ?? null,
    reality: ok ? "provider_doctor_ok" : "provider_doctor_blocked",
    confidence_for_market_use: ok ? "medium" : "low",
    counts: {
      checks: payload.checks?.length ?? 0,
      blocked_checks: blockedChecks.length
    },
    reading: ok
      ? "AKShare provider environment preflight passed."
      : `AKShare provider environment is blocked: ${blockedChecks.map((item) => `${item.id}: ${item.detail}`).join(" / ")}`,
    install_hint: payload.install_hint,
    run_hint: payload.run_hint
  };
}

function auditFlowLayer(payload) {
  const sourceCounts = countFlowSources(payload);
  const hasMock = Object.keys(sourceCounts).some((source) => /mock|fixture|config\/mock_scores/i.test(source));
  const hasProvider = Object.keys(sourceCounts).some((source) => /akshare|provider|efinance|qstock|exchange|real/i.test(source));
  const directFlowCount = payload?.data_availability?.counts?.representative_direct_flow_inputs ?? 0;
  const confirmationCount = payload?.data_availability?.counts?.representative_price_volume_confirmations ?? 0;
  const reality = hasMock ? "mock" : hasProvider ? "provider_observed" : "unknown";
  return {
    id: "flow_price",
    name: "资金量价",
    source_file: "sector_flow_review.json",
    as_of: payload?.as_of ?? null,
    generated_at: payload?.generated_at ?? null,
    reality,
    confidence_for_market_use: reality === "provider_observed" ? "medium" : "low",
    source_counts: sourceCounts,
    counts: {
      sectors: payload?.counts?.sectors ?? 0,
      representative_direct_flow_inputs: directFlowCount,
      representative_price_volume_confirmations: confirmationCount
    },
    reading: reality === "mock"
      ? "模型组件可运行，但当前资金量价节点来自 mock/fixture 来源，不能当作真实市场信号。"
      : reality === "provider_observed"
        ? "资金量价来自 provider/observed source，仍需检查覆盖和异常。"
        : "资金量价来源不明，不能直接用于市场判断。"
  };
}

function auditNewsLayer(payload) {
  const collection = payload?.collection ?? {};
  const reality = collection.mode === "fixture" || collection.fallback_used ? "fixture" : collection.mode === "live" ? "live_news" : "unknown";
  return {
    id: "news",
    name: "新闻层",
    source_file: "news_review.json",
    as_of: payload?.as_of ?? null,
    generated_at: payload?.generated_at ?? null,
    reality,
    confidence_for_market_use: reality === "live_news" ? "medium" : "low",
    counts: payload?.counts ?? {},
    reading: reality === "fixture"
      ? "新闻层使用 fixture/fallback，只能检查流程，不能当作当天真实新闻。"
      : reality === "live_news"
        ? "新闻层来自实时采集，但仍需要硬数据确认。"
        : "新闻层来源不明。"
  };
}

function auditModuleLayer(payload, flowLayer) {
  const statusCounts = {};
  for (const row of payload?.sectors ?? []) {
    for (const [name, module] of Object.entries(row.modules ?? {})) {
      const key = `${name}:${module.status ?? "unknown"}`;
      statusCounts[key] = (statusCounts[key] ?? 0) + 1;
    }
  }
  const hasManual = Object.keys(statusCounts).some((key) => key.includes("manual_seed"));
  const reality = hasManual ? "manual_seed" : flowLayer.reality === "provider_observed" ? "derived_mixed" : "derived_from_non_real";
  return {
    id: "sector_modules",
    name: "估值/基本面/资金量价三模块",
    source_file: "sector_module_review.json",
    as_of: payload?.as_of ?? null,
    generated_at: payload?.generated_at ?? null,
    reality,
    confidence_for_market_use: "low",
    source_counts: statusCounts,
    counts: payload?.counts ?? {},
    reading: hasManual
      ? "估值和基本面是 manual_seed，可解释结构，但不是实时估值或财报数据。"
      : "模块层由上游数据派生，需先检查上游真实性。"
  };
}

function auditEtfReadinessLayer(payload) {
  if (!payload) {
    return {
      id: "etf_decision_readiness",
      name: "ETF行动准备度",
      source_file: "etf_decision_readiness.json",
      as_of: null,
      generated_at: null,
      reality: "decision_gate_not_run",
      confidence_for_market_use: "low",
      reading: "ETF readiness gate has not run yet. Run npm run etf:readiness before reading ETF guidance."
    };
  }

  const ready = payload.guidance_state === "decision_support_ready";
  return {
    id: "etf_decision_readiness",
    name: "ETF行动准备度",
    source_file: "etf_decision_readiness.json",
    as_of: payload.as_of ?? null,
    generated_at: payload.generated_at ?? null,
    reality: ready ? "decision_gate_ready" : "decision_gate_blocked",
    confidence_for_market_use: ready ? "medium" : "low",
    counts: payload.counts ?? {},
    blockers: payload.blockers ?? [],
    reading: ready
      ? "ETF readiness gate passed its base checks, but the output is still a human-review checklist."
      : payload.headline ?? "ETF readiness gate blocks market guidance."
  };
}

function auditDerivedLayer({ id, name, inputLayers, payload, sourceFile }) {
  const hasNonReal = inputLayers.some((layer) => ["mock", "fixture", "manual_seed", "unknown", "derived_from_non_real"].includes(layer.reality));
  return {
    id,
    name,
    source_file: sourceFile,
    as_of: payload?.as_of ?? null,
    generated_at: payload?.generated_at ?? null,
    reality: hasNonReal ? "derived_from_non_real" : "derived_from_observed",
    confidence_for_market_use: hasNonReal ? "low" : "medium",
    input_layers: inputLayers.map((layer) => ({ id: layer.id, reality: layer.reality })),
    reading: hasNonReal
      ? "该层是解释层，上游仍含非真实输入，因此只能看结构，不能当真实市场结论。"
      : "该层由已观察输入派生，仍不是交易指令。"
  };
}

function auditGeneralLayer(payload) {
  return {
    id: "general_pool_analysis",
    name: "通用池模型",
    source_file: "general_pool_analysis.json",
    as_of: payload?.as_of ?? null,
    generated_at: payload?.generated_at ?? null,
    reality: "contract_output_source_unverified",
    confidence_for_market_use: "low",
    counts: payload?.counts ?? {},
    reading: "通用池模型契约可用，但当前发布 JSON 没有携带可验证 provider source，不能视为实时真实行情判断。"
  };
}

function countFlowSources(payload) {
  const counts = {};
  for (const row of payload?.sector_reviews ?? []) {
    for (const component of Object.values(row.components ?? {})) {
      for (const node of component.nodes ?? []) {
        const source = typeof node === "string" ? "string_node" : node.source ?? "no_source";
        counts[source] = (counts[source] ?? 0) + 1;
      }
    }
  }
  return counts;
}

function overallRealityFromLayers(layers) {
  const realities = new Set(layers.map((layer) => layer.reality));
  if (
    realities.has("mock") ||
    realities.has("fixture") ||
    realities.has("manual_seed") ||
    realities.has("derived_from_non_real") ||
    realities.has("provider_run_failed") ||
    realities.has("provider_not_run") ||
    realities.has("provider_doctor_blocked") ||
    realities.has("provider_doctor_not_run") ||
    realities.has("decision_gate_blocked") ||
    realities.has("decision_gate_not_run")
  ) {
    return "mixed_non_real";
  }
  if (realities.has("unknown") || realities.has("contract_output_source_unverified") || realities.has("provider_run_unverified")) return "source_unverified";
  return "observed_pipeline";
}

function headlineFor(overallReality, layers) {
  const nonReal = layers.filter((layer) => ["mock", "fixture", "manual_seed", "derived_from_non_real", "contract_output_source_unverified", "provider_run_failed", "provider_not_run", "provider_doctor_blocked", "provider_doctor_not_run", "decision_gate_blocked", "decision_gate_not_run"].includes(layer.reality));
  if (overallReality === "mixed_non_real") {
    return `当前页面含 ${nonReal.length} 个非真实或来源未验证层。模型结构可看，市场结论不可直接用。`;
  }
  if (overallReality === "source_unverified") {
    return "当前页面存在来源未验证层，先检查数据源再读结论。";
  }
  return "当前页面主要来自已观察数据，但仍不是交易指令。";
}

function buildWarnings(layers) {
  return layers
    .filter((layer) => layer.confidence_for_market_use === "low")
    .map((layer) => `${layer.name}: ${layer.reading}`);
}

function firstValue(values) {
  return values.find((value) => value !== null && value !== undefined) ?? null;
}

function buildMarkdown(payload) {
  const rows = payload.layers.map((layer) => (
    `| ${layer.name} | ${layer.reality} | ${layer.confidence_for_market_use} | ${layer.reading} |`
  )).join("\n");
  return `# Data Reality Audit ${payload.as_of}

${payload.headline}

| Layer | Reality | Market-use confidence | Reading |
| --- | --- | --- | --- |
${rows}

## Boundary

${payload.interpretation_boundary.map((item) => `- ${item}`).join("\n")}
`;
}

function parseArgs(argv) {
  const args = {
    asOf: new Date().toISOString().slice(0, 10)
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--as-of") args.asOf = argv[index + 1];
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const result = await runDataRealityAudit({ rootDir: defaultRootDir, asOf: args.asOf });
  console.log(`Wrote ${result.jsonPath}`);
}
