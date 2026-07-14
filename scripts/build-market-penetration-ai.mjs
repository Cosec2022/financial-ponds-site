import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderMarketPenetrationMarkdown } from "./lib/market-penetration-brief.mjs";
import {
  MARKET_RESEARCH_SCHEMA,
  buildMarketResearchPrompt,
  markMarketResearchUnavailable,
  mergeMarketResearchSynthesis
} from "./lib/market-penetration-ai.mjs";

const root = resolve(import.meta.dirname, "..");
const dataPath = resolve(root, "financial-pond", "data", "market_penetration_brief.json");
const brief = JSON.parse(await readFile(dataPath, "utf8"));
const model = process.env.FP_MARKET_RESEARCH_MODEL || "gpt-5.6-terra";
const generatedAt = process.env.GENERATED_AT || new Date().toISOString();
const apiKey = process.env.OPENAI_API_KEY || "";
const required = /^(1|true|yes)$/i.test(process.env.FP_MARKET_RESEARCH_REQUIRED || "false");

if (!apiKey) {
  console.log("AI market research skipped: OPENAI_API_KEY is not configured; deterministic report remains active.");
  if (required) throw new Error("OPENAI_API_KEY is required for AI market research");
  process.exit(0);
}

try {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: process.env.FP_MARKET_RESEARCH_REASONING || "medium" },
      tools: [{
        type: "web_search",
        search_context_size: process.env.FP_MARKET_RESEARCH_SEARCH_CONTEXT || "medium",
        user_location: { type: "approximate", country: "HK", city: "Hong Kong", region: "Hong Kong" }
      }],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      text: {
        format: {
          type: "json_schema",
          name: "financial_ponds_market_research",
          strict: true,
          schema: MARKET_RESEARCH_SCHEMA
        }
      },
      input: [
        {
          role: "system",
          content: "You are a rigorous financial news researcher and editor. Follow the supplied evidence boundaries and return only the requested JSON."
        },
        { role: "user", content: buildMarketResearchPrompt(brief) }
      ]
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${JSON.stringify(payload)}`);
  const outputText = extractOutputText(payload);
  if (!outputText) throw new Error("OpenAI response did not contain output text");
  const synthesis = JSON.parse(outputText);
  const toolSources = extractWebSearchSources(payload);
  verifySynthesisSources(synthesis, toolSources);
  const merged = mergeMarketResearchSynthesis(brief, synthesis, {
    model,
    generatedAt,
    responseId: payload.id ?? null,
    sourceMetadataCount: toolSources.length
  });
  await writeOutputs(merged);
  console.log(`AI market research written: as_of=${merged.as_of}, model=${model}, sources=${merged.research_sources.length}`);
} catch (error) {
  console.error(`AI market research failed: ${error.stack || error.message}`);
  if (required) throw error;
  const marked = markMarketResearchUnavailable(brief, {
    model,
    generatedAt,
    status: "failed",
    detail: String(error.message || error).slice(0, 500)
  });
  await writeOutputs(marked);
  console.log("Deterministic market penetration report retained after AI failure.");
}

async function writeOutputs(value) {
  await writeFile(dataPath, `${JSON.stringify(value, null, 2)}\n`);
  await writeFile(resolve(root, "reports", "market-penetration", `${value.as_of}.md`), `${renderMarketPenetrationMarkdown(value)}\n`);
}


function extractWebSearchSources(payload) {
  const sources = [];
  for (const item of payload.output ?? []) {
    if (item.type !== "web_search_call") continue;
    for (const source of item.action?.sources ?? []) {
      const url = source.url ?? source.source_url ?? null;
      if (url) sources.push({ ...source, url });
    }
  }
  return sources;
}

function verifySynthesisSources(synthesis, toolSources) {
  if (!toolSources.length) return;
  const consulted = toolSources.map((source) => canonicalUrl(source.url)).filter(Boolean);
  for (const source of synthesis.sources ?? []) {
    const candidate = canonicalUrl(source.url);
    const matched = consulted.some((url) => url === candidate || url.startsWith(candidate) || candidate.startsWith(url));
    if (!matched) throw new Error(`Research source was not present in web-search source metadata: ${source.url}`);
  }
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|oc$|gclid$|fbclid$)/i.test(key)) url.searchParams.delete(key);
    }
    return `${url.origin}${url.pathname.replace(/\/$/, "")}${url.search}`;
  } catch {
    return "";
  }
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if ((content.type === "output_text" || content.type === "text") && typeof content.text === "string") return content.text;
    }
  }
  return "";
}
