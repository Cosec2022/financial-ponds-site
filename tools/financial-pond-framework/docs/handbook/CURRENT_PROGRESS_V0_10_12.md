# Financial Ponds Site - Current Progress Registry v0.10.12

Date: 2026-07-05

Current package snapshot: `financial-ponds-site-reference-v0.10.12.zip`

## Current Direction

Priority remains:

```text
1. A-share first
2. S&P 500 second
3. Sync reusable coverage/confidence work into the general model
```

## v0.10.12 Change

v0.10.12 fixes GitHub Action ordering for the 31-industry A-share framework.

Changed files:

```text
.github/workflows/daily.yml
tools/financial-pond-framework/src/tools/a_share_daily_ci.mjs
tools/financial-pond-framework/tests/a_share_daily_ci.test.mjs
tests/workflow.test.mjs
```

## Expected Action Order

The daily workflow now runs:

```text
npm test
npm run a-share:daily:ci -- --as-of "$AS_OF"
npm run pool:analysis -- --as-of "$AS_OF"
npm run export:web-data -- "$AS_OF"
copy published JSON files
build / validate / test Worker
persist published data
deploy if Cloudflare secrets exist
```

Inside `a-share:daily:ci`, the important sequence is:

```text
provider exports
provider-to-observation conversions
news intelligence
graph_cycle
sector_flow_review
sector_rotation_intelligence
sector_rotation_history
```

The `graph_cycle` step must run before `sector_flow_review` so 31-industry flow review can use the same-day graph snapshot.

## Current Action Status

Local validation:

```text
framework tests: pass
site build / validate / test: pass
```

External GitHub status:

```text
not checked from this workspace
```

The workflow file is ready for the next manual or scheduled GitHub Actions run.

## Boundary

```text
This version fixes CI order; it does not add the remaining 20 provider mappings.
Provider coverage remains 11 reviewed representative ETF mappings and 20 framework-only sectors.
Cloudflare deploy still depends on CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets.
```

## Next Work Order

1. Trigger or observe the next GitHub Action run.
2. Confirm published JSON contains 31 / 11 / 20 coverage counts.
3. Start reviewing representative ETF or index mappings for the 20 framework-only sectors.
