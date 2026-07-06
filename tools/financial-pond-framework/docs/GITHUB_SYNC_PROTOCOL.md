# GitHub Sync Protocol

Version: v0.10.18
Status: active

## Purpose

Financial Ponds has two runtime surfaces:

```text
GitHub = source code, scheduled automation, generated data commits
Cloudflare = published website and Worker runtime
```

For daily A-share automation, GitHub must be the source of truth. Cloudflare should publish the result produced by GitHub Actions.

## Rule

Do not treat a manual Cloudflare deploy as the only project update when automation changes.

If an update changes any of these items, update GitHub first:

```text
.github/workflows/daily.yml
tools/financial-pond-framework/**
financial-pond/data/*.json generation contract
scripts/build-assets.mjs
worker/assets.js
package.json
package-lock.json
```

Then run `Financial Ponds Daily` from GitHub Actions and confirm the website date.

## Current Stable Path

The daily Action should:

```text
1. collect A-share provider data
2. run a-share:daily:ci
3. run pool:analysis
4. export web data
5. copy JSON into financial-pond/data
6. build, validate, and test Worker without npm install/npm ci
7. commit published JSON back to GitHub
8. deploy with npx wrangler@4.102.0 deploy
```

## Why No Worker Install Step

The Worker build and tests use local project files and Node built-ins. The only package required for publish is Wrangler. The daily Action therefore avoids `npm install` and `npm ci` during Worker build/test because npm install was the failure point in GitHub Actions.

Deploy uses:

```bash
npx wrangler@4.102.0 deploy
```

## Recovery Check

After a manual fix, confirm:

```text
Actions -> Financial Ponds Daily -> latest run is green
Website data date equals current trading date
sector_flow_review.json has the same as_of date
```

## User Command Shape

For a downloaded zip release, update GitHub from a local repo, then run the workflow:

```bash
ZIP=~/Downloads/financial-ponds-site-reference-vX.Y.Z.zip
REPO=~/Documents/GitHub/financial-ponds-site

unzip -q "$ZIP" -d /tmp/financial-ponds-release
rsync -a --exclude='.git' /tmp/financial-ponds-release/financial-ponds-site/ "$REPO/"

cd "$REPO"
git status
git add .
git commit -m "update financial ponds to vX.Y.Z"
git push origin main
```

Authentication should be handled by one stable method:

```text
GitHub Desktop
GitHub CLI
SSH key
Personal Access Token with repo + workflow permissions
```

Do not mix several methods during one release.

## Current Confirmed SSH Path

The MacBook Air terminal path was confirmed working after loading the named SSH key:

```bash
eval "$(ssh-agent -s)"
ssh-add --apple-use-keychain ~/.ssh/id_ed25519_github
ssh -T git@github.com
```

The local repo should use the SSH remote:

```bash
cd ~/Documents/GitHub/financial-ponds-site
git remote set-url origin git@github.com:Cosec2022/financial-ponds-site.git
```

Known-good release confirmation:

```text
v0.10.17 commit 6cbe3d9 pushed to main.
Financial Ponds Daily #10 succeeded from commit 6cbe3d9.
```
