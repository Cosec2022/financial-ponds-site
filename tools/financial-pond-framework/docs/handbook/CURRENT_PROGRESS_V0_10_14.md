# Financial Ponds Site - Current Progress Registry v0.10.14

Date: 2026-07-05

Current package snapshot: `financial-ponds-site-reference-v0.10.14.zip`

## v0.10.14 Change

v0.10.14 corrects the terminal-command rule.

The final update command block must target the user's downloaded zip, not the assistant workspace.

The active A-share and CI boundaries remain:

```text
31 industry framework slots
11 provider_mapped_representative sectors
20 framework_only sectors
graph_cycle must run before sector_flow_review
```

Required command shape:

```bash
ZIP=~/Downloads/financial-ponds-site-reference-vX.Y.Z.zip
WORKDIR=$(mktemp -d)
unzip -q "$ZIP" -d "$WORKDIR"
cd "$WORKDIR/financial-ponds-site"
npm run build && npm run validate && npm test
```

Changed files:

```text
tools/financial-pond-framework/docs/MAINTENANCE_RULES.md
tools/financial-pond-framework/docs/UPDATE_PROTOCOL.md
tools/financial-pond-framework/docs/CHANGELOG.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_14.md
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
2. Keep final command blocks based on the downloaded zip path.
