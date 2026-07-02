# Pool Guide

A pool is a capital pond. Pools can be nested.

Examples:

- `a_share`: a market pool
- `a_share_semiconductor`: a sector pool with parent `a_share`
- `gold`: an asset-class pool
- `hk_equity`: a future market pool

## Parent/Child Design

Do not hardcode children in code. A child pool declares its parent:

```json
{
  "id": "a_share_semiconductor",
  "kind": "pool",
  "pool_type": "sector",
  "parent_pool": "a_share"
}
```

The registry discovers children by reading all pool configs.

## Adding A New Sector Pool

1. Create a new file under `config/pools/`.
2. Set `parent_pool`.
3. Add sector-specific nodes under `config/nodes/`.
4. Connect parent pool and sector nodes in `config/edges/graph.json`.
5. Optionally connect assets or holdings.

No core code should change.
