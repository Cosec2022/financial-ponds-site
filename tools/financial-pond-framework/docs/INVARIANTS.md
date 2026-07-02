# Invariants

These rules must stay true even after a rewrite.

## Core Invariants

1. Core engine code must not contain market-specific assumptions.
2. New pools are added through config, not engine changes.
3. New sector pools are added through `parent_pool` and edges, not hardcoded child lists.
4. A node may affect multiple pools.
5. A pool may affect another pool.
6. An asset may be connected to one or more pools.
7. A portfolio may be connected to assets, pools, or user input nodes.
8. Financial direction is expressed by edge transform and weight, not by `if market === ...` logic.
9. Snapshots must record model version and scoring config version.
10. Historical outputs must be reproducible from config, mock/collected observations, and scoring version.

## Forbidden Core Patterns

Do not add logic like:

```js
if (pool.id === "gold") {
  score -= realRate;
}
```

Do not add logic like:

```js
if (market === "A_SHARE") {
  useSocialFinancing();
}
```

Do not add fixed child lists like:

```js
const aShareChildren = ["semiconductor", "military", "brokerage"];
```

Use registry discovery and graph config instead.

## Allowed Core Patterns

Generic operations are allowed:

- load JSON/YAML/database config
- validate references
- build incoming/outgoing edge maps
- apply transform
- weighted aggregation
- topological dependency resolution
- save snapshot
- generate explanation from contributors

## Extension Examples

Adding Hong Kong equities:

```text
config/pools/hk_equity.json
config/nodes/southbound_flow.json
config/nodes/hk_turnover.json
config/edges/graph.json additions
```

Adding A-share robotics:

```text
config/pools/a_share_robotics.json
config/nodes/robotics_policy_news.json
config/nodes/robotics_etf_flow.json
config/edges/graph.json additions
```

Adding user holdings:

```text
config/assets/*.json
config/portfolios/my_portfolio.json
config/edges/graph.json additions
```

No core code change should be needed.
