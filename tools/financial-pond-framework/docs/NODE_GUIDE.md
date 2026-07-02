# Node Guide

A node is a reusable signal. It can affect one pool, multiple pools, assets, or portfolios through edges.

Nodes should not contain final investment decisions. They describe observations.

Example:

```json
{
  "id": "us_real_rate",
  "kind": "node",
  "name": "US Real Rate",
  "data_type": "hard_data",
  "category": "discount_rate",
  "frequency": "daily",
  "description": "US real rates affect the discount rate of long-duration assets.",
  "source": {
    "provider": "FRED",
    "series": "DFII10",
    "status": "planned"
  }
}
```

Relationships are not written inside the engine. Add them in `config/edges/graph.json`.

## Node Types

- `hard_data`: real market, macro, positioning, or flow data
- `news`: structured news, policy, or narrative signals
- `confirmation`: price/volume/breadth confirmation
- `portfolio_input`: user holdings, costs, exposure, or custom watchlists

## Scoring

The first version accepts mock scores. Future collectors should produce normalized observations:

```json
{
  "id": "us_real_rate",
  "score": -0.4,
  "confidence": 0.9,
  "as_of": "2026-07-02"
}
```

Scores use the project convention:

- `+2`: strong positive pressure
- `+1`: weak positive pressure
- `0`: neutral
- `-1`: weak negative pressure
- `-2`: strong negative pressure
