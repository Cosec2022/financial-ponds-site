# Financial Ponds Frontend Model Contract v0.10.9

Date: 2026-07-05

This contract defines what the dashboard may display and what it must not claim.

## Required frontend data files

```text
financial-pond/data/dashboard.json
financial-pond/data/general_pool_analysis.json
financial-pond/data/sector_flow_review.json
financial-pond/data/sector_rotation_intelligence.json
financial-pond/data/sector_rotation_history.json
financial-pond/data/news_review.json
financial-pond/data/pond_map.json
```

## Dashboard responsibilities

The frontend may display:

```text
- pond hierarchy
- general pool analysis for S&P 500 and A-share industries
- capital-flow / network-influence / price-volume / news-pressure component state
- heat
- valuation zone
- model score
- news pressure
- sector rotation state
- leaders and laggards
- style clusters
- possible weak-to-strong switching paths
- watch points
- rotation history sample count
- trend confirmation boundary
- upstream/downstream nodes
- influence coefficients
- keyword groups
- keyword weights
- half-life
- splash coefficient
- related sectors
- daily/weekly report status
- graph feedback proposals
- local node/weight edits
- exported patch JSON
```

The frontend must make these states clear:

```text
real data
fixture fallback
demo/watchlist
prototype
planned
```

## Scoring boundary

The frontend must not imply that:

```text
- news is real capital flow
- a watchlist pond is a real ETF-backed sector
- localStorage edits have changed backend model configuration
- GPT review is active when it is only planned
- any score is a buy/sell instruction
- sector rotation is multi-day trend confirmation when only single-day data exists
- rotation history is reliable without persisted generated data across runs
- S&P 500 analysis is live-provider confirmed before real S&P 500 data ingestion is enabled
```

## General Pool Analysis Rule

The frontend may compare S&P 500, the A-share market, and A-share industry pools through:

```text
capital_flow
network_influence
price_volume
news_pressure
fundamental_value
```

The frontend must keep the boundary visible:

```text
one component contract
different market-specific graph inputs
no trading instruction
live-provider status only when provider ingestion exists
```

The frontend may display input profile and coverage metadata from:

```text
input_contract_id
input_profile
expected_inputs
```

The frontend must not imply that all pools share the same concrete inputs.

## Electricity-sector rule

The electricity pond currently demonstrates graph adaptability.

Correct wording:

```text
电力行业当前是观察池，用来展示上下游节点和权重如何随新闻与硬数据反馈而变化。
```

Do not use wording that claims real ETF-flow coverage for electricity.

```text
电力行业不能写成已接入真实ETF资金流，直到 framework provider 和 sector flow engine 都有对应配置。
```

## News display rule

News should be shown as:

```text
pressure
catalyst
risk
expectation
```

News should not be shown as:

```text
confirmed flow
trade signal
position instruction
```

## Rotation display rule

Sector rotation should be shown as:

```text
relative strength / weakness
snapshot
rotation pressure
watch point
evidence level
```

Sector rotation should not be shown as:

```text
confirmed trend unless multi-day history exists
buy/sell signal
portfolio allocation instruction
```

## Rotation history display rule

The frontend may show:

```text
sample days
latest vs previous change
insufficient history warning
history-ready state after enough samples
```

The frontend must not show:

```text
trend confirmed before minimum sample count
history available without persisted generated data
```

## Graph edit rule

Frontend edits are temporary until written back to source configuration.

Current write path:

```text
browser localStorage
export patch JSON
manual review
future config update
```

Not implemented:

```text
automatic GitHub commit
automatic config writeback
automatic score mutation from UI edits
```

## Future data contract additions

Planned files:

```text
config/news/keyword_state.json
config/graph/edge_state.json
model_outputs/<date>/keyword_feedback.json
model_outputs/<date>/graph_feedback.json
model_outputs/<week>/keyword_review_proposals.json
model_outputs/<week>/graph_update_proposals.json
```

When these are added, update this contract before changing the frontend.
