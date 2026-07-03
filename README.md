# Financial Ponds Site

Independent Cloudflare Worker site for `financial-ponds.coseclab.dev`.

## Current status

- Site root shows a usable clickable A-share sector dashboard.
- A-share hard-data collection runs in `tools/financial-pond-framework`.
- News intelligence is an independent module and writes separate review files.
- Electricity is currently a watchlist/demo pond. It is visible in the graph UI but is not yet connected to a real A-share industry ETF provider.
- GitHub Actions runs the CI daily runner, then deploys the Worker with Wrangler.

## Daily automation

Workflow: `.github/workflows/daily.yml`

Main model command used by CI:

```bash
cd tools/financial-pond-framework
npm run a-share:daily:ci -- --as-of "$AS_OF"
```

The CI runner collects:

1. A-share sector ETF snapshot.
2. A-share water-level data, with explicit fixture fallback if upstream is unstable.
3. Independent news review, with explicit fixture fallback if news search is unavailable.
4. Sector Flow Review.

Published web JSON:

```text
financial-pond/data/dashboard.json
financial-pond/data/sector_flow_review.json
financial-pond/data/news_review.json
```

## Local test

```bash
npm install
npm run build
npm run validate
npm test
```

Model test:

```bash
cd tools/financial-pond-framework
npm test
npm run news:review:fixture -- --as-of 2026-07-02
```

## Deploy

```bash
npm run deploy
```

Required GitHub Secrets for automatic deploy:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

## Boundary

News is expectation pressure. It does not prove flow. Market confirmation still comes from price, turnover, breadth, ETF share change, and other hard data.

## v0.10.3 usable scope

This package is usable as a dashboard prototype and daily publishing pipeline:

```text
Working:
- Cloudflare Worker site
- GitHub Actions deploy
- A-share 11-sector ETF flow review
- A-share broad water-level provider with CI fallback
- independent news pressure review
- clickable pond map
- local graph node edits and patch export

Not yet live:
- real electricity-sector ETF provider
- adaptive keyword state engine
- adaptive graph backend writeback
- weekly GPT review
- automatic config commit from the frontend
```

Generated runtime outputs under `observations/`, `snapshots/`, `model_outputs/`, and `reports/` are sample state from this package. Treat them as examples, not as permanent source configuration.


## v0.10.2 Adaptive graph feedback

The dashboard now treats upstream/downstream pond nodes as adjustable model parameters. A pond can show proposed node additions, weight reductions, and local manual overrides. Browser-side edits are saved in localStorage and can be exported as a patch JSON before being committed back into model configuration.

The goal is to avoid permanent assumptions such as treating the power sector only as coal power. If news and market confirmation show that grid capex, green power, carbon market, or other nodes have higher explanatory power, the graph can propose node additions or coefficient changes.

## Current progress registry

The project architecture and current module status are recorded in:

```text
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_3.md
```

Use this file before editing the project. The modules are numbered FP-00 to FP-10 to avoid confusing formed modules with future proposals.

Additional maintenance references:

```text
tools/financial-pond-framework/docs/handbook/DATA_STATUS_MATRIX.md
tools/financial-pond-framework/docs/handbook/FRONTEND_MODEL_CONTRACT.md
```
