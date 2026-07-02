# Flow Engine v0.9.1 AKShare Inputs

This document records how AKShare provider exports enter the Flow Engine review
layer.

## Purpose

v0.9.1 connects:

```text
data/provider_exports/a_share_etf_daily.csv
-> observations/<date>/provider_flow_observations.json
-> npm run flow:review -- --as-of <date>
```

This is a bridge from provider output to review observations. It does not
enable collector sources and does not change the main graph snapshot.

## Command

After an AKShare run:

```bash
npm run provider:akshare
npm run provider:akshare:validate
npm run provider:akshare:inspect
npm run provider:akshare:to-flow
npm run flow:review -- --as-of 2026-07-02
```

For fixture testing:

```bash
npm run provider:akshare:fixture -- --as-of 2026-07-08
npm run provider:akshare:to-flow -- --as-of 2026-07-08
npm run flow:review -- --as-of 2026-07-08
```

## Mapping Rules

The bridge emits three possible signal types:

```text
pct_change
-> <sector>_relative_strength

amount rank
-> <sector>_leader_confirmation

estimated_flow
-> <sector>_etf_flow
```

`estimated_flow` is strict:

```text
if estimated_flow exists:
  emit <sector>_etf_flow

if estimated_flow is missing:
  do not emit <sector>_etf_flow
```

This prevents baseline-only runs from creating fake net-flow evidence.

## Readiness States

```text
flow_ready
  all representative ETFs have estimated_flow

partial_flow
  some representative ETFs have estimated_flow

baseline_only
  no representative ETF has estimated_flow
```

`baseline_only` is still useful. It gives market-confirmation inputs from price
change and amount rank. It is not enough for direct ETF-flow evidence.

## Output Files

```text
observations/<date>/provider_flow_observations.json
model_outputs/<date>/akshare_provider_flow_observations.json
model_outputs/<date>/akshare_provider_flow_observations.md
```

Flow review automatically merges:

```text
observations/<date>/node_observations.json
observations/<date>/provider_flow_observations.json
```

Provider-flow observations are used only during Flow Engine review. They do not
rewrite `node_observations.json`.

## Boundary

- No provider source is enabled.
- No graph score is rewritten.
- No portfolio action is generated.
- Single-ETF sector proxies are marked as proxies in their observation reasons.
- Missing `estimated_flow` remains missing.
