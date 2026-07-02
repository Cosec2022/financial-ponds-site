# Collectors

Collectors are future adapters that turn external data or news into normalized node observations.

They must emit data in this shape:

```json
{
  "id": "btc_etf_flow",
  "score": 0.9,
  "confidence": 0.85,
  "as_of": "2026-07-02",
  "raw_ref": "raw_data/2026-07-02/btc_etf_flow.json"
}
```

Collectors should not know pool formulas. They only produce node observations.

Examples of future collectors:

- FRED collector for real rates, yields, M2
- PBOC collector for social financing and M1/M2
- ETF flow collector
- news collector that emits structured event scores
- holdings importer that maps uploaded positions to assets and portfolios
