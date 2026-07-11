# Append-only and no-lookahead rules

The daily archive is immutable: identical canonical input is idempotent; changed content becomes a revision that references the superseded record. Current pointers and indexes are derived views and can be rebuilt.

Historical imports may use only committed archives, preserve their original fields and provenance, and mark unavailable fields `null` with a missing reason. Current algorithms must not recalculate or overwrite past published snapshots. Provider failures must never replace last-known-good data with a claimed current observation.
