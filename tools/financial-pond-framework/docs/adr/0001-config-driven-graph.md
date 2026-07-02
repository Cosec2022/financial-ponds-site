# ADR 0001: Config-Driven Financial Graph

## Status

Accepted.

## Decision

Pools, nodes, assets, portfolios, and edges are defined in configuration files instead of being hardcoded in JavaScript.

## Reason

The project must support new financial structures without rewriting the core engine. Examples:

- adding a Hong Kong equity pool
- adding an A-share robotics sector pool
- adding a portfolio holdings component
- changing gold's relationship with US real rates
- connecting US equity weakness to gold only during risk-off regimes

Hardcoded financial assumptions would make later changes fragile and could overwrite earlier logic.

## Consequence

Core engine code may contain only generic graph and scoring operations:

- load config
- validate config
- find incoming and outgoing edges
- apply transforms
- weighted aggregation
- active condition checks
- score propagation
- explanation assembly

Core code must not contain market names such as gold, BTC, A-share, US equity, or Hong Kong equity in logic branches.

Market-specific behavior belongs in:

- `config/nodes/*.json`
- `config/pools/*.json`
- `config/assets/*.json`
- `config/portfolios/*.json`
- `config/edges/*.json`
- `config/scoring/*.json`
