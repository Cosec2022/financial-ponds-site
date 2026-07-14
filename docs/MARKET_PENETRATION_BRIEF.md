# Market Penetration Report v0.10.72

`market_penetration_report_v2` is the display-only explanation layer for the
Financial Ponds homepage. It turns published FP observations into a concise
market conclusion, sector-state groups, cross-checks, evidence quality, and
next-session validation conditions.

## Boundary

- Media/RSS items remain unverified narratives and never enter graph scoring.
- The explanatory headline is a deterministic summary of published candidate,
  risk-gate, market, mapping, and review outputs.
- `verified_facts` remains empty until a primary-source deterministic
  verification adapter is enabled.
- The report is `observe_only`; it does not produce buy/sell instructions.

## Daily freshness

The daily persistence command rebuilds both:

- `financial-pond/data/market_penetration_brief.json`
- `reports/market-penetration/<AS_OF>.md`

Published-data validation fails closed when the report `as_of` does not match
`history/latest_observation_pointer.json.latest_as_of`. The frontend also shows
an explicit stale warning instead of silently presenting an old interpretation.


## AI web-research layer (v0.10.72)

After the deterministic report is built, `npm run fp:research` can call the OpenAI Responses API with web search when `OPENAI_API_KEY` is configured. It enriches only the human-facing explanation fields and source links. Market facts, scores, rankings, candidate state, risk gates, and outcome review data remain unchanged.

Environment variables:

- `OPENAI_API_KEY`: GitHub Actions secret; without it the deterministic report remains active.
- `FP_MARKET_RESEARCH_MODEL`: defaults to `gpt-5.6-terra`.
- `FP_MARKET_RESEARCH_REASONING`: defaults to `medium`.
- `FP_MARKET_RESEARCH_SEARCH_CONTEXT`: defaults to `medium`.
- `FP_MARKET_RESEARCH_REQUIRED=true`: optional fail-closed mode; the default is fail-open so an API outage does not block the daily data/deploy chain.
