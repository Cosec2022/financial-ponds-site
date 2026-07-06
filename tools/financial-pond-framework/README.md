# Financial Pond Framework

Current package version: `0.10.17`

Start recovery here if chat history is missing:

- `docs/MAINTENANCE_RULES.md`
- `docs/UPDATE_PROTOCOL.md`
- `docs/GITHUB_SYNC_PROTOCOL.md`
- `docs/PROJECT_PLAN.md`
- `docs/MODULE_PLAN.md`
- `docs/handbook/CURRENT_PROGRESS_V0_10_17.md`
- `PROJECT_STATE.md`
- `docs/PROJECT_MEMORY.md`
- `docs/MODULE_STATUS.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

This is a config-driven graph framework for modelling connected financial ponds.

The final target is an extensible financial analysis network. Any market, sector,
asset, theme, or user-defined watchlist can be added as a pond. Each pond is
evaluated through capital-flow signals, graph influence factors, price-volume
analysis, and news-pressure analysis.

The framework intentionally does not output trading instructions. It builds and
explains the structure:

- nodes: reusable signals such as real rates, ETF flows, policy news, or portfolio holdings
- pools: aggregations such as `us_equity`, `a_share`, `btc`, `gold`, or sector pools
- edges: relationships between nodes, pools, assets, and portfolios
- scoring versions: replaceable rules for combining inputs
- snapshots: reproducible daily outputs

## Non-Negotiable Rule

Core engine code must not contain market-specific assumptions.

Do not hardcode rules such as:

- if pool is gold, invert real rates
- if pool is A-share, read social financing
- if market is BTC, use ETF flow
- if pool is Hong Kong, connect to US equities

All financial relationships must be expressed through configuration files:
nodes, pools, assets, portfolios, edges, transforms, and scoring versions.

## Quick Start

```bash
npm run demo
npm run daily
npm run cycle
npm run scheduler
npm run materialize:sectors
npm run sources:status
npm run provider:akshare:fixture
npm run provider:akshare:validate
npm run provider:akshare:inspect
npm run provider:akshare:to-flow
npm run provider:efinance:probe
npm run provider:qstock:probe
npm run providers:compare:a-share-etf
npm run flow:review:fixture
npm run flow:review -- --as-of 2026-07-03
npm run pool:analysis -- --as-of 2026-07-02
npm run rotation:review -- --as-of 2026-07-02
npm test
```

`npm run cycle` also writes:

```text
model_outputs/<date>/regime_summary.json
```

Search-based news discovery is configured in:

```text
config/news/search_queries.json
```

Search queries are disabled by default until deployment sources are verified.

The demo reads mock node scores from `config/mock_scores/2026-07-02.json`,
builds the graph, calculates pool scores, and prints explanations.

The daily pipeline reads mock observations, validates them, runs the graph,
and writes a Markdown report under `reports/YYYY-MM-DD/`.

The cycle command reads configured collectors. By default it uses mock data so
the project runs without network access. Real hard-data and news sources are
enabled through config files.

The scheduler command runs the cycle twice daily using
`config/schedules/twice_daily.json`.

## Add Without Touching Core Code

- Add a major pool: create `config/pools/hk_equity.json` and connect it in `config/edges/graph.json`.
- Add a sector pool: create `config/pools/a_share_robotics.json`, set `parent_pool`, then add sector nodes and edges.
- Add a holdings analysis component: create a portfolio config under `config/portfolios/` and connect it to pools/assets.
- Add a new data API later: implement a collector adapter that emits node observations. The graph engine should not change.

Read `docs/MAINTENANCE_RULES.md`, `docs/UPDATE_PROTOCOL.md`, `docs/PROJECT_PLAN.md`,
and `docs/MODULE_PLAN.md` first when resuming from a zip package.

Read `PROJECT_STATE.md` when older version history is needed.

Read `docs/PROJECT_MEMORY.md`, `docs/ROADMAP.md`, and `docs/CHANGELOG.md` when
conversation history is unavailable.

Read `docs/MODEL_INTENT.md` before changing structure.

Read `docs/ETF_FLOW_MODEL.md` before adding A-share industry ETFs or S&P 500
ETF assets.

Edit `config/sector_catalog/a_share_industry_etfs.json` and run
`npm run materialize:sectors` to add or update A-share industry ETF pools.

Read `docs/DATA_INGESTION_V0_7.md` before enabling real data sources.

Read `docs/OPEN_SOURCE_DATA_PROVIDER_COMPARISON.md` before adding A-share ETF
or S&P 500 ETF provider bridges.

Read `docs/AKSHARE_ETF_BRIDGE.md` before running or modifying the first A-share
ETF provider bridge.

Read `docs/FLOW_ENGINE_V0_9.md` before changing the A-share sector ETF flow
review model.

Read `docs/FLOW_ENGINE_V0_9_1_AKSHARE_INPUTS.md` before changing AKShare to
Flow Engine observation mapping.

Read `docs/PIPELINE_INTENT.md` before adding collectors, Codex API analysis,
or report generators.

Read `docs/VERSION_RECOVERY_GUIDE.md` first when resuming from a zip package.
