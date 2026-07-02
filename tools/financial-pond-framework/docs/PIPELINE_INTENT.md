# Daily Intelligence Pipeline Intent

The graph engine is not a data crawler and not an AI analyst.

Daily collection, AI interpretation, and human report generation are separate components that feed the graph engine through a stable contract:

```text
collector / AI / holdings importer
  -> node observations
  -> graph engine
  -> scored graph snapshot
  -> human report
```

## Why Separate

The system must support new data sources and AI services without changing core graph code.

Examples:

- FRED data collector
- PBOC data collector
- ETF flow collector
- crypto collector
- news collector
- Codex API news classifier
- user holdings importer
- PDF or HTML report generator

All of these must plug into the pipeline by emitting observations.

## Observation Contract

Every collector emits normalized node observations:

```json
{
  "node_id": "btc_etf_flow",
  "as_of": "2026-07-02",
  "value": 520000000,
  "unit": "USD",
  "score": 1.2,
  "confidence": 0.85,
  "data_type": "hard_data",
  "source": "btc_etf_flow_collector",
  "raw_ref": "raw_data/2026-07-02/btc_etf_flow.json",
  "reason": "BTC spot ETF net inflow was strong versus recent history."
}
```

The graph engine only consumes:

```text
node_id
score
confidence
as_of
```

Other fields support audit, explanation, and reports.

## AI Role

AI is allowed to:

- classify news into structured events
- score event direction, impact, credibility, and duration
- explain unusual data moves
- generate human-readable reports

AI is not allowed to bypass the graph engine and directly set final pool scores.

## Daily Flow

```text
run_daily
├── collect observations
├── validate observations
├── save observations
├── convert observations to node score map
├── run graph engine
├── save graph snapshot
└── generate human report
```

The first implementation uses mock collectors. Real collectors should replace or extend them without touching `src/core`.
