# Financial Ponds Site - Current Progress Registry v0.10.17

Date: 2026-07-06

Current package snapshot: `financial-ponds-site-reference-v0.10.17.zip`

## v0.10.17 Change

v0.10.17 hardens the full daily Action path after the live recovery run.

Live recovery showed:

```text
A-share collection succeeded.
Old GitHub code could publish 2026-07-06 data after workflow compatibility fixes.
Worker-stage npm install/npm ci is the unstable point.
```

The full package workflow now avoids dependency installation during Worker build/test:

```bash
npm run build
npm run validate
npm test
```

Deploy is pinned:

```bash
npx wrangler@4.102.0 deploy
```

The active A-share boundaries remain:

```text
31 industry framework slots
11 provider_mapped_representative sectors
20 framework_only sectors
graph_cycle must run before sector_flow_review
general_pool_analysis publishes S&P 500, A-share market, and A-share industries
```

Changed files:

```text
.github/workflows/daily.yml
package.json
tests/workflow.test.mjs
tools/financial-pond-framework/package.json
tools/financial-pond-framework/docs/CHANGELOG.md
tools/financial-pond-framework/docs/GITHUB_SYNC_PROTOCOL.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_17.md
tools/financial-pond-framework/tests/maintenance_docs.test.mjs
README.md
tools/financial-pond-framework/README.md
```

## Boundary

```text
This is a CI stability and maintenance protocol update.
No scoring formula changed.
No provider behavior changed.
No frontend behavior changed.
```

## Next Work Order

1. Sync the full package into GitHub using one stable authentication method.
2. Run `Financial Ponds Daily` manually once.
3. Confirm website data date advances and full v0.10.17 outputs include general pool analysis and rotation history.
