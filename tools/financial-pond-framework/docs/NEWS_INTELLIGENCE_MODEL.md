# News Intelligence Model

News is not final score.

News is converted into structured events, then into node observations. The graph engine decides downstream pool effects through configured edges.

## News Pipeline

```text
collect
  -> deduplicate
  -> classify
  -> channel mapping
  -> score
  -> emit observation
  -> wait for market confirmation
```

## Event Shape

```json
{
  "event_id": "2026-07-02-china-policy-001",
  "title": "Policy headline",
  "source": "official / major_media / market_rumor",
  "published_at": "2026-07-02T08:00:00+08:00",
  "affected_pools": ["a_share", "hk_equity"],
  "affected_sectors": ["brokerage", "real_estate", "consumer"],
  "channel": "policy_liquidity",
  "direction": 1,
  "impact": 0.7,
  "confidence": 0.8,
  "duration": "medium",
  "needs_market_confirmation": true,
  "reason": "Policy wording suggests stronger support for equity market liquidity."
}
```

## News Channels

- liquidity
- interest_rate
- policy_liquidity
- earnings
- regulation
- geopolitics
- risk_appetite
- industry_cycle
- credit
- currency

## Current Version

The current implementation is a rule-based skeleton:

- RSS/XML collection
- keyword matching
- node mapping
- basic score and confidence

It does not yet perform deep semantic analysis.

## Future Codex API Role

Codex API or another AI classifier should:

- identify the event
- deduplicate similar reports
- choose affected pools and sectors
- map channels
- score direction, impact, credibility, duration
- produce a reason string

AI must not directly set final pool scores.

The output of AI remains an observation.
