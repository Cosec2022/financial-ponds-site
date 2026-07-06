# Financial Ponds Site - Current Progress Registry v0.10.13

Date: 2026-07-05

Current package snapshot: `financial-ponds-site-reference-v0.10.13.zip`

## v0.10.13 Change

v0.10.13 adds a maintenance rule requested by the user:

```text
Every GPT update must include copyable terminal commands.
```

The active project direction remains A-share first. Current A-share framework coverage remains:

```text
31 industry framework slots
11 provider_mapped_representative sectors
20 framework_only sectors
```

The active CI boundary from v0.10.12 remains:

```text
graph_cycle must run before sector_flow_review
```

Changed files:

```text
tools/financial-pond-framework/docs/MAINTENANCE_RULES.md
tools/financial-pond-framework/docs/UPDATE_PROTOCOL.md
tools/financial-pond-framework/docs/CHANGELOG.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_13.md
```

## Required Final Update Shape

Every meaningful update should now include:

```text
Update summary
Verification result
Copyable terminal commands
Next step
```

The command block should use:

```bash
cd /workspace/financial-ponds-site
npm run build && npm run validate && npm test
```

For framework-only work, use:

```bash
cd /workspace/financial-ponds-site/tools/financial-pond-framework
npm test
```

## Boundary

```text
This is a maintenance protocol change only.
No scoring formula changed.
No provider behavior changed.
No frontend behavior changed.
```

## Next Work Order

1. Continue reviewing ETF or index mappings for the 20 framework-only A-share sectors.
2. Keep terminal commands in every final update note.
