# Architecture

This project is a config-driven financial graph framework.

The core idea is:

```text
Financial meaning lives in config.
Graph mechanics live in core code.
Data collection lives in collectors.
Daily results live in snapshots.
```

## Main Objects

### Node

A node is a reusable observation or signal.

Examples:

- `us_real_rate`
- `btc_etf_flow`
- `china_social_financing`
- `semiconductor_policy_news`
- `user_holdings_input`

Nodes do not decide which pool they affect. Edges decide that.

### Pool

A pool is a capital pond or sub-pond.

Examples:

- `us_equity`
- `a_share`
- `btc`
- `gold`
- `a_share_semiconductor`

Pools can be nested through `parent_pool`, but inheritance is still expressed through edges.
This avoids hidden logic in code.

### Edge

An edge is an influence relationship.

Examples:

- `us_real_rate -> gold`
- `a_share -> a_share_semiconductor`
- `a_share_semiconductor -> a_share_semiconductor_etf_demo`

Edges store channel, direction, weight, transform, and explanation.

### Asset

An asset is an investable item such as an ETF, index, stock, or crypto instrument.
Assets receive influence from pools or nodes through edges.

### Portfolio

A portfolio is a user-specific component. It can receive influence from assets, pools, and user input nodes.

Future user holdings uploads should create or update portfolio and asset configs, then add edges.
They must not require a core code change.

## Data Flow

```text
config files
  -> config_loader
  -> registry
  -> schema validation
  -> graph_engine
  -> scoring_engine
  -> snapshot_store
```

## Why JSON Config

The first version uses JSON because it is zero-dependency and directly runnable with Node.js.
If future versions switch to YAML or a database, only the config loading layer should change.
The graph and scoring engines should stay generic.

## Intentional Simplicity

The first version uses mock scores. This is deliberate.

Before adding live APIs or news parsing, the project must prove that:

- nodes can connect to multiple pools
- pools can connect to other pools
- sector pools can be added without code changes
- assets can inherit from pools
- portfolios can inherit from assets
- results can be reproduced from a dated snapshot

## Rewrite Boundary

A future rewrite may replace implementation details, but should preserve the public concepts:

- Node
- Pool
- Edge
- Asset
- Portfolio
- Regime
- Score
- Snapshot

These concepts are the project contract.
