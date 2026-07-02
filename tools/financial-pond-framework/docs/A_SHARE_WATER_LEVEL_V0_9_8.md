# A-share Water Level v0.9.8

Purpose: add broad A-share market-water context before direct ETF flow has
enough local history.

## Commands

Daily stable path:

```bash
npm run a-share:daily
```

Manual water-level path:

```bash
npm run provider:a-share-water
npm run provider:a-share-water:to-observations
npm run flow:review
```

Fixture path:

```bash
npm run provider:a-share-water:fixture
npm run provider:a-share-water:to-observations
npm run flow:review
```

Scheduler:

```bash
npm run scheduler:a-share
```

The scheduler reads:

```text
config/schedules/a_share_daily.json
```

Default time:

```text
16:30 Asia/Hong_Kong
```

This is after the A-share close and gives providers time to update.

## Data

Current provider:

```text
providers/a_share_water_level/export_a_share_water_level.py
```

Main real endpoint:

```text
AKShare stock_zh_a_spot_em
```

Outputs:

```text
data/provider_exports/a_share_water_level.csv
observations/<date>/a_share_water_observations.json
model_outputs/<date>/a_share_water_level_observations.json
model_outputs/<date>/a_share_water_level_observations.md
```

## Observations

The converter emits:

```text
a_share_turnover
a_share_breadth
margin_balance, only if available
```

These enter Flow Review through:

```text
market_liquidity
```

## Boundary

Market water level is not ETF net flow.

```text
High turnover + strong breadth
= broad participation is improving

High turnover + weak breadth
= high disagreement or risk release

Low turnover
= insufficient market water even if a sector rises
```

Direct ETF flow still requires:

```text
latest_share(T) - latest_share(T-1)
```

## Current Limits

- Turnover is estimated by summing all-stock quote amount rows.
- Breadth is based on current pct_change rows.
- Margin balance is optional and low-confidence until local history exists.
- This module writes observations only. It does not enable collector sources or
  mutate graph scores.
