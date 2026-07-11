# Outcome Label Ledger v1

`daily_outcome_labels_v1` is append-only and separate from daily snapshots. It reuses only T+1, T+3, T+5, and T+20 review results already available in the repository. Future horizons remain contract-compatible but are not enabled.

Missing benchmark or price data is represented as `null` with an unavailable reason. MFE, MAE, maximum drawdown, and trend duration stay `null` without an observed path; they are never estimated.
