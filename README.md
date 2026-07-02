# Financial Ponds Site

Standalone Cloudflare Worker site for the Financial Pond model.

Target domain:

```text
financial-ponds.coseclab.dev
```

## Local Test

```bash
npm install
npm run build
npm run validate
npm test
npm run preview
```

Preview URL:

```text
http://localhost:4174
```

## Daily Automation

GitHub Actions file:

```text
.github/workflows/daily.yml
```

It runs:

```text
tools/financial-pond-framework
→ npm run a-share:daily
→ npm run cycle
→ npm run export:web-data
→ copy dashboard JSON into this site
→ wrangler deploy
```

Required GitHub Secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Cloudflare must have the custom domain `financial-ponds.coseclab.dev` available in the same account and zone.
