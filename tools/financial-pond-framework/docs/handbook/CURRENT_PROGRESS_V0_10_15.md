# Financial Ponds Site - Current Progress Registry v0.10.15

Date: 2026-07-06

Current package snapshot: `financial-ponds-site-reference-v0.10.15.zip`

## v0.10.15 Change

v0.10.15 corrects the update protocol after the downloaded-zip command rule.

The assistant must run validation before delivering the package. The final user-facing terminal command block should target the user's downloaded zip and should default to preview, deploy, or the next manual action. It should not default to asking the user to repeat assistant validation.

The active A-share and CI boundaries remain:

```text
31 industry framework slots
11 provider_mapped_representative sectors
20 framework_only sectors
graph_cycle must run before sector_flow_review
```

Default preview command shape:

```bash
ZIP=~/Downloads/financial-ponds-site-reference-vX.Y.Z.zip
WORKDIR=$(mktemp -d)
unzip -q "$ZIP" -d "$WORKDIR"
cd "$WORKDIR/financial-ponds-site"

npm install
npm run preview
```

Deploy command shape:

```bash
ZIP=~/Downloads/financial-ponds-site-reference-vX.Y.Z.zip
WORKDIR=$(mktemp -d)
unzip -q "$ZIP" -d "$WORKDIR"
cd "$WORKDIR/financial-ponds-site"

npm install
npm run deploy
```

Changed files:

```text
tools/financial-pond-framework/docs/MAINTENANCE_RULES.md
tools/financial-pond-framework/docs/UPDATE_PROTOCOL.md
tools/financial-pond-framework/docs/CHANGELOG.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_15.md
tools/financial-pond-framework/tests/maintenance_docs.test.mjs
README.md
tools/financial-pond-framework/README.md
```

## Boundary

```text
This is a maintenance protocol update only.
No scoring formula changed.
No provider behavior changed.
No frontend behavior changed.
```

## Next Work Order

1. Continue reviewing ETF or index mappings for the 20 framework-only A-share sectors.
2. Keep assistant validation in the final note.
3. Keep user terminal commands based on the downloaded zip path and aimed at preview, deploy, or next manual action.
