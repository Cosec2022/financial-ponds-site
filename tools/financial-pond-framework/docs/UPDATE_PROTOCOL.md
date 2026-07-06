# Update Protocol

Version: v0.10.16
Status: active

Every meaningful update must follow this protocol.

## Required Update Steps

| Step | Requirement |
|---|---|
| 1. Declare target | Name the update version and affected module IDs. |
| 2. Mark code | Add concise module markers to new formed-module source files. |
| 3. Mark docs | Update human-readable progress notes and boundaries. |
| 4. Mark data state | Label data as real, fallback, demo, watchlist, prototype, or planned. |
| 5. Update progress | Update overall progress and affected module progress. |
| 6. Test | The assistant runs relevant tests. Run all tests for shared logic or pipeline changes. |
| 7. Terminal commands | Include copyable terminal commands for local preview, deploy, or next manual action from the downloaded zip. |
| 8. Package | Package with current rules, plans, changelog, and progress registry. |

## Required Update Note

Every update should be summarized in this shape:

```text
Update version:
Changed modules:
Overall progress:
Module progress:
Code markers:
Human-readable markers:
Data boundary:
Tests:
Terminal commands:
Next step:
```

## Terminal Command Discipline

Every final GPT update must include a copyable terminal command block for the delivered zip file.

Assistant validation comes first. The final note should say what the assistant already ran.

Use this default local preview format:

```bash
ZIP=~/Downloads/financial-ponds-site-reference-vX.Y.Z.zip
WORKDIR=$(mktemp -d)
unzip -q "$ZIP" -d "$WORKDIR"
cd "$WORKDIR/financial-ponds-site"

npm ci --no-audit --no-fund
npm run preview
```

Use this deploy format when the user is ready to publish:

```bash
ZIP=~/Downloads/financial-ponds-site-reference-vX.Y.Z.zip
WORKDIR=$(mktemp -d)
unzip -q "$ZIP" -d "$WORKDIR"
cd "$WORKDIR/financial-ponds-site"

npm ci --no-audit --no-fund
npm run deploy
```

The command block should match the actual update and should not rely on the assistant workspace path. User-facing commands should not default to re-running validation because validation is the assistant's responsibility. Include verification commands only when the user asks for them, when the package is meant to be independently audited, or when a local environment issue needs confirmation.

## Code Marker Format

Use this format in new source files when a module becomes formed:

```js
// FP-AREA-Number Human Module Name
// Input: source data or config
// Output: generated file, state, or UI surface
// Boundary: what this module must not claim or mutate.
```

Example:

```js
// FP-ROT-01 Sector Rotation Intelligence
// Input: sector_flow_review.json
// Output: sector_rotation_intelligence.json
// Boundary: explains relative rotation only; not a trading instruction.
```

## Documentation Marker Format

Use this format in plan, changelog, and progress documents:

```text
Module: FP-ROT-01
Progress: working prototype
Change: added single-day rotation intelligence
Boundary: not trend confirmation until multi-day history exists
Next: add continuation / reversal / strengthening labels
```

## Version Discipline

Update these files when the project state changes:

```text
docs/MAINTENANCE_RULES.md       if rules change
docs/UPDATE_PROTOCOL.md         if update workflow changes
docs/PROJECT_PLAN.md            if total plan or total progress changes
docs/MODULE_PLAN.md             if module state changes
docs/CHANGELOG.md               for every meaningful version
docs/handbook/CURRENT_PROGRESS_*.md for recovery state
README.md                       for top-level user-facing state
```

## Data Boundary Discipline

Do not publish data without a visible state label.

Required labels:

```text
real       actual provider or model output can run in the pipeline
fallback   deterministic substitute for continuity; not live market data
demo       displayed to explain shape; not evidence
watchlist  visible for observation; not fully connected
prototype  implemented enough to test, not complete backend state
planned    designed but not implemented
```

## Test Discipline

Minimum test expectation:

```text
docs-only update: run doc guard or explain why skipped
frontend data contract update: root build + validate + root tests
framework module update: framework tests
shared pipeline update: framework tests + root build + validate + root tests
```
