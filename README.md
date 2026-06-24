# Klay API Docs

Static reference documentation for the Klay API (v0.6.0), generated from `openapi.yaml`.

## Development

```bash
npm install
npm run build   # outputs dist/index.html + dist/styles.css
open dist/index.html
```

## Source of truth

`openapi.yaml` in this repo is reconciled to the live Go server and synced back to `klay-server/docs/klay-api.yml`. When the server changes, update `openapi.yaml` here first, then re-sync.

## Deploy

Deploy the `dist/` folder to any static host. A `vercel.json` is included for Vercel one-click deploy (`npm run build` → `dist/`).
