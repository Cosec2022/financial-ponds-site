# Web Dashboard Contract

The web dashboard is intentionally independent from the graph engine.

It reads one stable JSON file:

```text
web/data/dashboard.json
```

The dashboard must not import core engine modules. It only renders exported data.

## Export Flow

```text
config + observations + graph snapshot
  -> src/web/export_dashboard_data.mjs
  -> web/data/dashboard.json
  -> web/index.html
```

## Why This Contract Exists

The dashboard may later be hosted under a CosecLab subpage, such as:

```text
coseclab.dev/financial-pond/
```

The UI should remain portable:

- no build step
- no framework dependency
- no backend assumption
- no financial formula in UI code
- all financial relationships come from exported graph data

## Dashboard Data Shape

```json
{
  "as_of": "2026-07-02",
  "model_version": "0.1.0",
  "entities": {
    "us_equity": {
      "id": "us_equity",
      "kind": "pool",
      "name": "US Equity Pool",
      "score": 0.26,
      "description": "..."
    }
  },
  "edges": [
    {
      "id": "usd_liquidity_to_us_equity",
      "from": "usd_liquidity",
      "to": "us_equity",
      "channel": "upstream_liquidity",
      "weight": 0.3
    }
  ],
  "groups": {
    "pools": ["us_equity", "a_share", "btc", "gold"],
    "nodes": ["usd_liquidity"],
    "assets": [],
    "portfolios": []
  },
  "observations": []
}
```

Future UI versions can add charts, filters, and visual layers without changing the graph engine.
