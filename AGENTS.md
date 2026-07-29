# Financial Ponds repository rules

- Financial Ponds is medium-term A-share sector ETF decision support. Human confirmation is required; automated execution is out of scope.
- Do not create a short-term daily leaderboard, forced candidate, visible ordinal rank, or opaque composite score. A no-qualified-candidate day is valid.
- Preserve one official flow: collect → normalize → observe → assess → penetrate → decide → review → persist → publish. Each official daily stage runs once.
- `sector_assessment_daily.json` is the structural source of truth, `entry_decision_daily.json` is the entry-decision source of truth, and `daily_manifest.json` is the publication source of truth.
- Direction is signed. Keep direction, confirmation, evidence trust, risk, attention, and entry readiness independent. Display order and rank cannot affect the model.
- Missing inputs remain `null`. Enforce exact-date alignment, reject future data and duplicate canonical identities, and never silently reuse stale conclusions.
- Persist the full canonical universe every session with input snapshot, schema, model, and command-contract provenance.
- Keep the deterministic hard model separate from AI narrative. Narrative may explain source-backed facts but cannot mutate hard market fields.
- Builds are pure: no collection, model execution, history writes, data mutation, or network. Collection, modeling, Git writes, deployment, and live-provider access remain separate.
- Do not manually edit generated JSON, generated Worker assets, or build output. Change generators and regenerate from committed inputs.
- Do not call live providers during development unless the user explicitly authorizes it.
- Any rule change requires focused tests plus schema/model/version and migration documentation updates.
