# Financial Pond Web

This folder is a standalone static dashboard.

It reads:

```text
web/data/dashboard.json
```

Run locally:

```bash
npm run daily
npm run web
```

Then open:

```text
http://localhost:4173
```

To host under a CosecLab subpage, publish the contents of this `web/` folder.
All paths are relative, so it can live under `/financial-pond/` or another subpath.

The web UI must not contain financial formulas. It renders exported graph data only.
