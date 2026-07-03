# Financial Ponds Site — Current Progress Registry v0.10.3

Date: 2026-07-03  
Repo: `Cosec2022/financial-ponds-site`  
Public site: `https://financial-ponds.coseclab.dev`  
Deployment: GitHub Actions → Cloudflare Workers  
Current package snapshot: `financial-ponds-site-usable-v0.10.3.zip`

This document exists so future editors can understand the current project shape without re-inventing or misreading the architecture. Treat the numbered modules below as stable names. New work should reference these IDs in commit messages and docs.

Related status documents:

```text
docs/handbook/DATA_STATUS_MATRIX.md
docs/handbook/FRONTEND_MODEL_CONTRACT.md
```

---

## 0. Current project goal

The project is a personal financial model dashboard built around the metaphor of **ponds**.

A pond is a market, asset class, industry, or theme. Water level means liquidity, attention, or relative strength. Inflow and outflow are inferred from hard market data and supported by news pressure, not replaced by news.

Core principle:

```text
Hard data = market confirmation
News = expectation pressure / catalyst / risk
Adaptive feedback = changing weights, keywords, and graph edges over time
Frontend = make the model clickable and explainable
```

---

## 1. Numbered module registry

## 0A. Usable scope in v0.10.3

This package is usable as a daily dashboard and model-inspection prototype.

Working:

```text
- Cloudflare Worker site
- GitHub Actions deploy path
- A-share 11-sector ETF flow review
- A-share market water-level provider with CI fallback
- independent news pressure review
- clickable pond map
- local graph node edit and patch export
```

Not yet live:

```text
- real electricity-sector ETF provider
- adaptive keyword state engine
- adaptive graph backend writeback
- weekly GPT review
- automatic config commit from the frontend
```

Important:

```text
electric_power is a watchlist/demo pond.
It is visible in the frontend but is not a real ETF-backed sector yet.
```

### FP-00 — Site shell and deployment

**Status:** formed / working  
**Scope:** Cloudflare Worker frontend, GitHub repo, GitHub Actions, Cloudflare deployment.

Key files:

```text
.github/workflows/daily.yml
package.json
wrangler.jsonc
scripts/build.sh
scripts/build-assets.mjs
scripts/validate-artifact.mjs
worker/index.js
worker/assets.js
financial-pond/index.html
financial-pond/app.js
financial-pond/styles.css
```

Known state:

```text
- GitHub Actions is green after Node 22 fix.
- Wrangler requires Node >= 22 in CI.
- Public URL: https://financial-ponds.coseclab.dev
- Automatic deployment path is active.
```

Do not confuse this with the old homepage project. This is a standalone Worker site.

---

### FP-01 — A-share hard data provider

**Status:** formed / working with fallback  
**Scope:** A-share ETF daily data and A-share market water-level data.

Submodules:

```text
FP-01A — A-share industry ETF provider
FP-01B — A-share market water-level provider
FP-01C — CI fallback runner
```

Key files:

```text
tools/financial-pond-framework/providers/akshare_etf_bridge/export_a_share_etf_daily.py
tools/financial-pond-framework/providers/akshare_etf_bridge/validate_exports.py
tools/financial-pond-framework/providers/akshare_etf_bridge/inspect_exports.py
tools/financial-pond-framework/src/tools/akshare_flow_observations.mjs
tools/financial-pond-framework/providers/a_share_water_level/export_a_share_water_level.py
tools/financial-pond-framework/src/tools/a_share_water_observations.mjs
tools/financial-pond-framework/src/tools/a_share_daily_ci.mjs
```

Data captured:

```text
- ETF close
- ETF pct_change
- ETF amount
- ETF latest_share
- A-share total turnover
- A-share breadth / up-down count
- optional margin balance
```

Important boundary:

```text
estimated_flow requires at least two trading-day snapshots.
Formula basis: share change × latest close.
```

CI behavior:

```text
- Real provider is attempted first.
- If A-share water provider fails due upstream/network disconnection, CI falls back to fixture.
- Fallback keeps build/deploy alive but must be treated as degraded context.
```

---

### FP-02 — Sector flow engine

**Status:** formed / working prototype  
**Scope:** convert observations into sector flow review and dashboard data.

Key files:

```text
tools/financial-pond-framework/src/tools/sector_flow_review.mjs
tools/financial-pond-framework/src/model/flow_engine.mjs
tools/financial-pond-framework/config/model/flow_engine_v0_9.json
tools/financial-pond-framework/config/sector_catalog/a_share_industry_etfs.json
tools/financial-pond-framework/config/pools/*.json
tools/financial-pond-framework/config/nodes/*.json
```

Outputs:

```text
tools/financial-pond-framework/model_outputs/<date>/sector_flow_review.json
tools/financial-pond-framework/model_outputs/<date>/sector_flow_review.md
financial-pond/data/sector_flow_review.json
financial-pond/data/dashboard.json
```

Current interpretation policy:

```text
ETF share change + price + turnover + breadth are hard confirmation.
News pressure can explain why, but cannot create real flow.
```

---

### FP-03 — News search engine

**Status:** formed / basic, not yet adaptive  
**Scope:** news collection and rule-based interpretation as expectation pressure.

Key files:

```text
tools/financial-pond-framework/config/news/news_daily_v1.json
tools/financial-pond-framework/src/news/news_intelligence.mjs
tools/financial-pond-framework/src/tools/news_daily_review.mjs
tools/financial-pond-framework/tests/news_intelligence.test.mjs
```

Current source method:

```text
Google News RSS search queries.
```

Current search groups:

```text
1. China policy
2. A-share fund flow
3. Global technology risk
4. Macro liquidity
```

Outputs:

```text
tools/financial-pond-framework/observations/<date>/news_observations.json
tools/financial-pond-framework/model_outputs/<date>/news_review.json
tools/financial-pond-framework/model_outputs/<date>/news_review.md
financial-pond/data/news_review.json
```

Current limitation:

```text
- Keyword/search rules are still mostly configured, not self-adjusting.
- No GPT API is currently required.
- GPT weekly review has been designed conceptually but not wired.
- Fixed finance/security/official website scanning is not fully connected yet.
```

---

### FP-04 — Adaptive keyword state

**Status:** designed / not fully implemented  
**Scope:** make keywords dynamic assets with weight, half-life, and feedback.

Desired future state file names:

```text
tools/financial-pond-framework/config/news/keyword_state.json
tools/financial-pond-framework/model_outputs/<date>/keyword_feedback.json
tools/financial-pond-framework/model_outputs/<week>/keyword_review_proposals.json
```

Keyword object shape:

```json
{
  "keyword": "SK Hynix",
  "theme": "global_technology_risk",
  "impacted_sectors": ["a_share_semiconductor", "a_share_ai_computer"],
  "weight": 0.82,
  "half_life_days": 30,
  "splash_coefficient": 0.65,
  "last_hit_at": "2026-07-03",
  "last_confirmed_at": "2026-07-03",
  "confirmed_count": 6,
  "false_signal_count": 2,
  "status": "active"
}
```

Required states:

```text
candidate — discovered but not yet used as model signal
active — used in daily scan and scoring
cooling — low confidence or aging, still watched at low weight
archived — not actively searched unless reactivated
blocked — noisy or misleading keyword
```

Feedback rule:

```text
News hit + hard-data confirmation => weight up
News hit + no market response => weight down
Long time no hit => natural decay
Repeated false hits => cooling or blocked
New repeated theme => candidate keyword
```

---

### FP-05 — Pond graph / upstream-downstream model

**Status:** formed as frontend prototype / adaptive backend pending  
**Scope:** represent market and sector relationships as editable graph edges.

Key files:

```text
financial-pond/data/pond_map.json
financial-pond/app.js
financial-pond/styles.css
```

Current frontend behavior:

```text
- Homepage shows clickable pond map.
- Ponds are arranged by hierarchy.
- Each pond displays heat, valuation zone, model score, and news pressure.
- Clicking a pond shows upstream/downstream nodes and coefficients.
```

Important design rule:

```text
Upstream/downstream nodes are model parameters, not permanent facts.
```

Example: electricity sector.

Old oversimplified view:

```text
Electricity = coal power = coal price / fuel cost
```

Correct adaptive view:

```text
Electricity sector can shift between:
- coal/fuel cost
- power demand
- capacity tariff policy
- green power / green certificate / carbon market
- grid investment / UHV / distribution network
- dividend / defensive utility preference
- data center electricity demand
```

If news and hard data show coal price no longer explains electricity sector behavior, coal-cost edge weight should drop. If green power or grid investment becomes confirmed, those nodes should rise or be added.

---

### FP-06 — Adaptive graph feedback

**Status:** frontend prototype implemented / backend writeback pending  
**Scope:** allow node/edge changes, suggestions, patch export, and later automatic feedback.

Current visible functions:

```text
- View current upstream nodes
- View current downstream nodes
- View edge weight / influence coefficient
- View suggested new nodes
- View suggested node weight adjustments
- Locally edit weight
- Locally add node
- Locally delete node
- Export patch JSON
```

Current storage:

```text
Browser localStorage + exported patch JSON.
```

Not yet implemented:

```text
- Automatic patch writeback to repo/config
- GitHub commit from UI
- Weekly GPT graph audit
- Hard-data statistical confirmation engine for edge relevance
```

Future state file names:

```text
tools/financial-pond-framework/config/graph/edge_state.json
tools/financial-pond-framework/model_outputs/<date>/graph_feedback.json
tools/financial-pond-framework/model_outputs/<week>/graph_update_proposals.json
```

Edge object shape:

```json
{
  "from_node": "coal_price_fuel_cost",
  "to_pond": "a_share_power",
  "edge_weight": 0.42,
  "half_life_days": 45,
  "confirmation_score": 0.31,
  "last_confirmed_at": "2026-07-03",
  "status": "cooling",
  "reason": "Recent electricity sector movement appears more related to grid investment and dividend preference than fuel cost."
}
```

---

### FP-07 — Frontend dashboard UX

**Status:** usable prototype implemented  
**Scope:** make the model readable and clickable.

Key files:

```text
financial-pond/index.html
financial-pond/app.js
financial-pond/styles.css
financial-pond/data/dashboard.json
financial-pond/data/news_review.json
financial-pond/data/pond_map.json
financial-pond/data/sector_flow_review.json
```

Current page logic:

```text
1. Homepage: all ponds by hierarchy, left-right layout.
2. Pond cards: heat, valuation zone, model score, news pressure.
3. Click pond: details page.
4. Detail page: upstream/downstream, coefficients, keyword groups, half-life, splash coefficient.
5. Below: related industries, daily report, weekly report, feedback notes.
6. Node feedback tab: local edit and patch export.
```

Target frontend principle:

```text
The user should be able to click A-share → power sector and see:
- upstream inflow/outflow
- influence coefficients
- keyword groups
- keyword weights
- half-life
- splash coefficient
- related industry data
- daily report
- weekly report
- suggested node/keyword changes
```

---

### FP-08 — Reports

**Status:** basic daily outputs formed / weekly reports pending  
**Scope:** human-readable daily and weekly model explanation.

Existing outputs:

```text
sector_flow_review.md
news_review.md
sector_flow_review.json
news_review.json
```

Desired next outputs:

```text
pond_daily_report.json
pond_daily_report.md
pond_weekly_report.json
pond_weekly_report.md
keyword_weekly_review.md
graph_weekly_review.md
```

Report boundaries:

```text
Daily report = current hard data + news pressure + confirmation status.
Weekly report = trend, keyword decay/reweighting, graph edge proposals, regime changes.
```

---

### FP-09 — GPT / LLM review layer

**Status:** designed only, optional, not active  
**Scope:** use GPT for weekly audit, not daily buy/sell prediction.

Current state:

```text
- No GPT API required in v0.10.3.
- No OpenAI key needed for deployed site.
```

Recommended future use:

```text
Weekly only, to reduce cost and avoid daily noise.
```

Allowed LLM tasks:

```text
- Summarize this week's news themes.
- Identify stale keywords.
- Propose new keywords.
- Propose edge weight changes.
- Explain why a node should be added/deleted/cooling.
- Generate review proposals for user confirmation.
```

Not allowed LLM tasks:

```text
- Directly change portfolio allocation.
- Directly convert news into real capital flow.
- Override hard-data confirmation.
- Make untraceable hidden decisions.
```

---

### FP-10 — Tests and validation

**Status:** formed / working  
**Scope:** prevent broken Worker artifact and major pipeline regressions.

Root tests:

```text
tests/worker.test.mjs
tests/workflow.test.mjs
```

Framework tests:

```text
tools/financial-pond-framework/tests/*.test.mjs
```

Root commands:

```bash
npm run build
npm run validate
npm test
```

Framework commands:

```bash
cd tools/financial-pond-framework
npm test
npm run news:review:fixture
npm run flow:review:fixture
```

---

## 2. Current versions and important fixes

```text
v0.10.3 — usable dashboard state and project semantics cleanup
v0.9.8  — A-share water-level provider
v0.9.9  — CI fallback for A-share water provider
v0.10.0 — independent news intelligence + readable dashboard
v0.10.1 — clickable pond map dashboard
v0.10.2 — adaptive upstream/downstream graph feedback prototype
```

Important deployment fixes:

```text
- GitHub SSH push is working after ssh-agent + id_ed25519_github.
- Cloudflare deploy requires GitHub Actions Node 22.
- Do not rerun old failed commit runs; trigger a new run on main.
```

---

## 3. Current automatic pipeline

GitHub Actions workflow:

```text
checkout
setup Node 22
install dependencies
run A-share daily CI runner
build Worker assets
validate artifact
run tests
deploy to Cloudflare
```

A-share CI runner behavior:

```text
1. Run AKShare ETF provider.
2. Run A-share water-level provider.
3. If water-level provider fails, run fixture fallback and continue.
4. Validate/inspect ETF export.
5. Convert ETF data to flow observations.
6. Convert water-level data to observations.
7. Run news review.
8. Run sector flow review.
9. Export frontend data.
```

---

## 4. Non-negotiable model boundaries

```text
1. News is not capital flow.
2. ETF share change is stronger evidence than title sentiment.
3. Keywords must decay or be reviewed.
4. Upstream/downstream nodes must be editable and time-varying.
5. Any parameter that changes with time must have a feedback mechanism.
6. The frontend must show why a pond has a score.
7. The user must be able to inspect keywords, weights, half-life, splash coefficient, and edge coefficients.
8. GPT can propose, but hard data confirms.
```

---

## 5. Next recommended module order

### Next-1 — FP-04 implementation: keyword state engine

Create:

```text
config/news/keyword_state.json
src/news/keyword_feedback_engine.mjs
tests/keyword_feedback_engine.test.mjs
```

Implement:

```text
- keyword weight
- half-life decay
- hit count
- confirmation count
- false signal count
- status transitions: candidate/active/cooling/archived/blocked
```

### Next-2 — FP-06 backend state: graph edge state engine

Create:

```text
config/graph/edge_state.json
src/graph/edge_feedback_engine.mjs
tests/edge_feedback_engine.test.mjs
```

Implement:

```text
- edge weight
- edge half-life
- confirmation score
- add/delete/cooling proposals
- patch application rules
```

### Next-3 — FP-03 source expansion: fixed finance/security/official sites

Create:

```text
config/news/official_sources.json
config/news/finance_sources.json
config/news/global_sources.json
src/news/fixed_source_scanner.mjs
```

Implement scan modes:

```text
- RSS
- sitemap
- static page title/link scan
```

Avoid:

```text
- login-only content
- aggressive crawling
- copyrighted full article scraping
```

### Next-4 — FP-09 weekly GPT review, optional

Create:

```text
src/news/weekly_llm_review.mjs
src/graph/weekly_graph_review.mjs
config/llm/weekly_review_policy.json
```

Default:

```text
USE_LLM_WEEKLY_REVIEW=false
```

Output only proposals:

```text
keyword_review_proposals.json
graph_update_proposals.json
```

### Next-5 — FP-07 frontend expansion

Add visible pages/cards:

```text
- Keyword state table
- Edge state table
- Weekly review proposals
- Patch import/export
- Source list and hit count
- Confirmation history
```

---

## 6. Editing guidance for future assistants

When updating this project:

```text
1. Do not replace the pond metaphor with generic finance dashboard language.
2. Do not collapse modules FP-03, FP-04, FP-05, FP-06 into one file.
3. Keep news, keyword feedback, graph feedback, and flow engine separate.
4. Any new time-varying parameter must expose weight, half-life, status, and reason.
5. Any automatic change should first generate a proposal unless the rule is low-risk and documented.
6. Frontend changes must remain understandable to a non-quant user.
7. Every new formed module should get an FP module number or sub-number in this file.
8. Always run root build/validate/test before packaging.
```
