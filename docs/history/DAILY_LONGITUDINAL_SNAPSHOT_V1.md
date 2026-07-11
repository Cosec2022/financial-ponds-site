# Daily Longitudinal Snapshot v1

`daily_longitudinal_snapshot_v1` is a published-at-the-time, full-universe observation record. It stores every pool, including non-candidates; it does not recompute scores or include any future outcome.

Snapshots distinguish `null`, missing, and numeric zero. Mapping is `direct`, `sector_proxy`, or `missing`; flow reality is `real`, `estimated`, `proxy`, `manual_seed`, `mock`, `derived_from_non_real`, or `missing`.

`finality_status` is `provisional`, `final`, or `corrected`. A later replay/backtest result is a separate outcome-label record and must never overwrite this snapshot.
