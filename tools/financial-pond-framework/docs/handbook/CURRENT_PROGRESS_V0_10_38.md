# Current Progress v0.10.38

## Purpose

This version adds a direct provider-history audit command.

The immediate project bottleneck is no longer whether AKShare can run. It can.
The bottleneck is whether the local provider CSV has enough committed history
to compute ETF share-change flow.

## New Command

```bash
npm run provider:akshare:history -- --as-of YYYY-MM-DD
```

Outputs:

```text
model_outputs/provider_history/akshare_provider_history.json
model_outputs/provider_history/akshare_provider_history.md
```

## What It Answers

```text
Does provider_exports/a_share_etf_daily.csv exist?
Which provider dates are available?
Is there a previous available date before the selected as_of?
How many representative ETF rows exist per date?
How many rows have previous_share, share_change, and estimated_flow?
Has estimated_flow reached the 60% gate threshold?
```

## Boundary

This is an operational audit.

It does not:

- run AKShare;
- alter model scores;
- enable disabled sources;
- output ETF buy, sell, rebalance, or allocation instructions.

## Recommended Next Run

After pulling a package or after a scheduled Action:

```bash
cd tools/financial-pond-framework
npm run provider:akshare:history -- --as-of 2026-07-08
```

Then check:

```text
status
provider_history.available_dates
current.estimated_flow_rows
next_action
```
