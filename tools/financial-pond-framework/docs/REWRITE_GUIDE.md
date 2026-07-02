# Rewrite Guide

This guide is for a future assistant or human engineer who receives only this zip file.

The goal is not to preserve the exact code. The goal is to preserve the design contract.

## Step 1: Read In This Order

1. `README.md`
2. `docs/MODEL_INTENT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/INVARIANTS.md`
5. `docs/FINANCIAL_MODEL_ALIGNMENT.md`
6. `docs/adr/0001-config-driven-graph.md`
7. `config/edges/graph.json`
8. `src/core/*.mjs`
9. `tests/*.test.mjs`

## Step 2: Restate The Model Before Rewriting

Before rewriting, confirm these ideas:

```text
Global financial markets are modelled as a connected graph.
Nodes are reusable observations.
Pools are aggregations of capital pressure.
Edges define financial influence.
Formulas are replaceable scoring profiles.
Collectors emit node observations.
Core code contains no market-specific financial assumptions.
```

## Step 3: Verify Existing Behavior

Run:

```bash
npm test
npm run demo
```

Expected behavior:

- config validates
- A-share semiconductor is discovered from `parent_pool`
- major pools receive scores
- child sector pool inherits through an edge
- portfolio receives score through a connected asset

## Step 4: Rewrite Criteria

A rewrite is acceptable if it still supports:

- add a new major pool without core code changes
- add a new sector pool without core code changes
- connect one node to multiple pools
- connect one pool to another pool
- connect assets and portfolios by config
- save dated snapshots with model version
- explain scores by top edge contributors
- validate missing references before scoring

## Step 5: Better Future Design

A smarter future version may improve:

- JSON schema validation
- YAML or database-backed config
- real API collectors
- news NLP pipeline
- regime-conditional edges
- portfolio risk attribution
- graph visualization
- UI dashboard
- richer tests for cycles and inactive edges

But these improvements should not break the central rule:

```text
Financial assumptions live in config, not core engine code.
```
