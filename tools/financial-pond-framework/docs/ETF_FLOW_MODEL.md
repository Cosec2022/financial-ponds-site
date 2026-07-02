# ETF Flow Model

This document records the first practical ETF decision model. It exists so a
future assistant or engineer can understand why the nodes exist and how to add
more ETF ponds without changing core code.

## Scope

Initial decision targets:

- A-share industry ETFs
- S&P 500 ETFs such as SPY, VOO, and IVV

The system does not try to predict a single price point. It estimates whether a
pond is receiving or losing support from upstream liquidity, direct fund flow,
fundamentals, news expectations, and market confirmation.

## Theory References

The model design follows established finance and macro ideas:

- Asset-pricing models: market beta, value, size, profitability, investment, and
  momentum factors.
- Liquidity-risk models: assets are affected by market liquidity, funding
  liquidity, and the possibility of liquidity spirals.
- Credit-cycle models: credit, collateral, and asset prices can reinforce each
  other.
- Institutional flow models: fund flows, return chasing, and benchmark demand
  can create momentum and later reversal.
- Behavioral and sentiment models: news changes expectations, but price and
  flow confirmation are required before a news signal gets high trust.

These references guide the node design. They are not fully implemented
structural models yet.

## Common Scoring Layers

Every ETF pond should be decomposed into:

```text
upstream liquidity
+ direct inflow
+ fundamentals
+ news expectation
+ market confirmation
+ downstream diffusion
```

Hard data and news remain separate:

- hard data = market participants have already acted
- news = expectations may have changed
- confirmation = price, flow, breadth, and leaders show whether the market
  accepts the story

## A-share Industry ETF Template

The source of truth for A-share industry ETF pools is:

```text
config/sector_catalog/a_share_industry_etfs.json
```

Run this command after editing the catalog:

```bash
npm run materialize:sectors
```

The materializer writes standard config files under:

```text
config/nodes/
config/pools/
config/assets/
config/edges/graph.json
config/model/node_layers.json
config/model/pool_internal_models.json
config/reporting/default_entities.json
```

This keeps industry expansion out of core code.

An A-share industry ETF should connect to:

### Parent Market

- `a_share`

### China Macro and Liquidity

- `china_social_financing`
- `m1_m2_gap`
- `dr007_shibor`
- `cny_fx_pressure`

### A-share Market Water Level

- `a_share_turnover`
- `a_share_breadth`
- `margin_balance`
- `etf_total_flow_a_share`
- `ipo_refinancing_pressure`
- `china_policy_news`

### Sector-Specific Nodes

Use a sector prefix. Example for semiconductors:

- `semiconductor_etf_flow`
- `semiconductor_policy_news`
- `semiconductor_relative_strength`
- `semiconductor_breadth`
- `semiconductor_leader_confirmation`
- `semiconductor_fundamental_proxy`

For a new sector, copy the pattern and replace the prefix:

```text
<sector>_etf_flow
<sector>_policy_news
<sector>_relative_strength
<sector>_breadth
<sector>_leader_confirmation
<sector>_fundamental_proxy
```

Then add:

- one sector entry in `config/sector_catalog/a_share_industry_etfs.json`
- run `npm run materialize:sectors`

Core code should not change.

## Current A-share Industry Pools

The first catalog includes these pools:

- `a_share_brokerage`
- `a_share_bank_insurance`
- `a_share_semiconductor`
- `a_share_ai_computer`
- `a_share_communication_electronics`
- `a_share_new_energy_ev`
- `a_share_healthcare_pharma`
- `a_share_consumer`
- `a_share_defense_military`
- `a_share_resources_materials`
- `a_share_real_estate_infra`

## S&P 500 ETF Model

The `sp500` pool connects to:

### Parent Market

- `us_equity`

### Macro and Risk

- `usd_liquidity`
- `us_real_rate`
- `treasury_10y_yield`
- `credit_spread`
- `vix`

### Direct ETF Flow

- `sp500_etf_flow`

### Fundamentals and Valuation

- `sp500_eps_revision`
- `sp500_valuation`
- `buyback_activity`
- `mega_cap_earnings`

### Market Confirmation

- `sp500_breadth`
- `equal_weight_vs_cap_weight`

### News Expectations

- `fed_policy_news`
- `ai_capex_news`

The demo asset `sp500_etf_demo` inherits from the `sp500` pool and broad
`us_equity` beta. Real tickers such as SPY, VOO, and IVV should be added as
separate assets later.

## Traceability Rule

Every node must answer:

```text
What does this measure?
Which pond does it affect?
Is it hard data, news, or confirmation?
Which future collector should populate it?
Does it directly set a pond score? The answer must be no.
```

Every edge must explain:

```text
why source affects target
which channel carries the effect
whether direction is positive or negative
which transform is used
```
