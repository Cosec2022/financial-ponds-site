# Model Intent

The user's investment model treats global financial markets as one connected water system.

Capital does not only move inside one isolated asset class. US equity conditions can affect gold.
USD liquidity can affect US equities, Bitcoin, gold, Hong Kong equities, and emerging markets.
China policy can affect A-shares, Hong Kong equities, commodities, and sector ETFs.

This project therefore models financial markets as a configurable directed graph:

- Node: a reusable signal
- Pool: a capital pond that aggregates signals and connected pools
- Edge: the direction, channel, weight, and condition of influence
- Asset: an investable item, such as an ETF
- Portfolio: user holdings or watchlists that can be connected to pools and assets
- Regime: market state such as risk-on, risk-off, dollar squeeze, or China credit impulse

## Why Config-Driven

Financial logic will change over time. The first version must preserve extensibility:

- adding Hong Kong equities must not change core code
- adding an A-share semiconductor sector pool must not change core code
- adding a user holdings analysis component must not change core code
- changing how gold reacts to real rates must not change core code

Market-specific assumptions live in config. Core code only loads, validates, scores, propagates,
stores, and explains the graph.

## What The First Version Does

The first version builds the basic connection layer:

1. Load nodes, pools, assets, portfolios, edges, and scoring config.
2. Validate identifiers and references.
3. Accept mock scores or future collector outputs.
4. Propagate weighted influence through configured edges.
5. Calculate pool, asset, and portfolio scores generically.
6. Generate explanations from config descriptions and top contributors.
7. Save daily snapshots with model version.

## What The First Version Does Not Do

It does not:

- forecast tomorrow's price
- make buy/sell recommendations
- parse live news automatically
- assume a fixed formula for a specific market
- optimize portfolio weights

Those are future modules layered on top of the graph.
