# Flow Engine v0.9

This document explains the first executable A-share sector ETF flow review
layer.

## Purpose

The engine ranks relative sector-flow pressure. It does not predict tomorrow's
price and does not create portfolio actions.

The intended question is:

```text
Which A-share sector ETF pools show stronger or weaker capital-flow evidence
after combining flow proxies, market confirmation, liquidity, policy sentiment,
fundamental proxies, and wide external factors?
```

## Design Boundary

The engine is intentionally separate from core graph scoring.

It writes:

```text
model_outputs/<date>/sector_flow_review.json
model_outputs/<date>/sector_flow_review.md
```

It does not write:

```text
snapshots/<date>/graph_scores.json
config/edges/graph.json
portfolio actions
collector enable flags
```

## Why Wide Factors

Single-market events can matter, but the model should not create brittle links
such as:

```text
one overseas stock move -> one A-share sector ETF
```

Instead, event interpretation must pass through wider factors:

```text
global_tech_risk
global_liquidity_risk
a_share_risk_appetite
sector_rotation_pressure
china_policy_support
```

Example:

```text
An overseas semiconductor selloff
-> global_tech_risk negative
-> pressure on semiconductor, AI/computer, communication/electronics pools
-> A-share price, turnover, breadth, and ETF share data must confirm it
```

This keeps the model elastic. Future events can reuse the same factor layer
without adding a new node for every company, country, or headline.

## Inputs

The engine reads:

```text
config/sector_catalog/a_share_industry_etfs.json
config/model/flow_engine_v0_9.json
config/model/flexible_risk_factors.json
observations/<date>/node_observations.json
```

Fixture mode reads:

```text
config/mock_scores/2026-07-02.json
config/examples/flow_scenario_global_tech_selloff.json
```

## Components

Each sector review combines:

```text
direct_flow
market_confirmation
market_liquidity
policy_sentiment
fundamental_proxy
external_factor_effect
```

The component weights live in:

```text
config/model/flow_engine_v0_9.json
```

They are model parameters, not permanent truths. Future backtests should adjust
them.

## Commands

Offline fixture review:

```bash
npm run flow:review:fixture
```

Review with an existing observation date:

```bash
npm run cycle 2026-07-03
npm run flow:review -- --as-of 2026-07-03
```

Review with a custom scenario:

```bash
npm run flow:review -- --as-of 2026-07-03 --scenario config/examples/flow_scenario_global_tech_selloff.json
```

## Output Meaning

Each sector receives:

```text
score: [-1, 1]
label: strong_inflow_bias / constructive_inflow_bias / neutral / outflow_watch / risk_off_pressure
confidence: [0, 1]
data_completeness: [0, 1]
top_drivers
```

Interpretation:

```text
positive score = stronger relative inflow or support evidence
negative score = stronger relative outflow or pressure evidence
higher confidence = more available inputs support the score
```

The output is a review queue, not a trade signal.

## Extension Rule

To add a sector:

1. Edit `config/sector_catalog/a_share_industry_etfs.json`.
2. Run `npm run materialize:sectors`.
3. The Flow Engine discovers the new sector through the catalog.

No engine code should change just because a new sector pool is added.
