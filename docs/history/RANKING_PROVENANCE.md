# Ranking provenance

| Ledger field | Published source field | File | Fallback allowed |
| --- | --- | --- | --- |
| `rank` | explicit `rank` only | `observation_snapshot.rows` or `pool_observation_scores.rows` | No; otherwise `null` |
| `candidate_rank` | explicit `candidate_rank`, then published candidate ledger order | `observation_candidate_ledger.rows` | Published order only; never score sorting |
| `published_top5_position` | published Top 5 list order | `evening_observation_summary.top_observation_pools` | Membership/order only; never full-pool rank |

No ledger code uses array position, Top 5 position, current score, or a tie-breaker to invent `rank`. A missing published field is retained as `null` with its missing reason.
