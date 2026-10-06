# Klay API Docs

Static reference documentation for the Klay API (v0.6.0), generated from `openapi.yaml`.

Swagger UI is the main view (`/`); the custom static reference lives at
`/reference.html`.

## Development

```bash
npm install
npm run build   # outputs dist/index.html (swagger) + dist/reference.html + specs
open dist/index.html
```

## Source of truth

`openapi.yaml` in this repo is reconciled to the live Go server and synced back to `klay-server/docs/klay-api.yml`. When the server changes, update `openapi.yaml` here first, then re-sync.

## Specs served

- `klay-api.yml` — Go legacy prod (custom reference at `/`, Swagger at `/swagger.html`).
- `klay-api-lite.yml` — copy of `klay-server-lite/klay-api-lite.yml` (source of
  truth lives with the Workers server; copy it over after contract changes,
  then `npm run build`). Both specs are selectable in Swagger UI.

## Deploy

Deploy the `dist/` folder to any static host. A `vercel.json` is included for Vercel one-click deploy (`npm run build` → `dist/`).

## Deploy to Cloudflare Pages (docs.klaypos.com)

```bash
npx wrangler login                                    # sekali saja (OAuth browser)
npm run deploy:pages                                  # build + upload dist/
npx wrangler pages domain add docs.klaypos.com --project-name klay-api-docs
```

Cutover DNS terjadi saat custom domain dipasang (traffic pindah dari Vercel
ke Pages). Rollback: lepas domain di Pages (`pages domain remove ...`) atau
arahkan record kembali ke Vercel. `vercel.json` sengaja dipertahankan sebagai
cadangan sampai cutover stabil.
