# Klay API Documentation Site — Design Spec

**Date:** 2026-06-23
**Repo:** `klay-api-docs` (greenfield)
**Status:** Approved pending user review

## Context

Klay needs a public-facing API documentation page for its contract (Go + Echo
server, consumed by a Next.js owner dashboard, a PWA operator app, and a Skalar
admin panel). The source contract lives at `klay-server/docs/klay-api.yml`
(OpenAPI 3.0.3, "Klay API v0.5.0").

A drift audit (2026-06-23) comparing that YAML against the actual Go code in
`klay-server/apps/api/core/` found **major drift**: the contract documents
endpoints, paths, request bodies, and response schemas that no longer match the
running server. Building docs on the stale YAML would publish a contract that
lies about the live API. So the work is two parts: **(1) reconcile the contract
to match the code, then (2) generate a static documentation site from it.**

Decisions already made with the user:
- **Layout:** B — light theme, two-panel (sidebar + main), maximum breathing room.
- **Source of truth:** the Go code. The YAML is rewritten to match reality.
- **Suspected bugs:** documented as-is, but visibly flagged.
- **Spec location:** corrected `openapi.yaml` lives in `klay-api-docs/`, and the
  canonical `klay-server/docs/klay-api.yml` is synced to match.
- **Generator:** a small Node build script (js-yaml + template) emits static
  HTML/CSS. No runtime logic; output deploys to any static host.

## Part 1 — Contract Reconciliation

Rebuild the spec domain-by-domain by reading the actual
`routes.go` / `handler.go` / `model.go` in each `core/<domain>/` package. The
audit deltas below are the known starting points, but every endpoint's
request/response shape is re-derived from code, not patched blindly.

### Known drift to correct (code = truth)

**Auth**
- `POST /auth/login`: body field `email` → `identifier` (email *or* klay_id);
  response returns only `access_token` (no nested `user`).
- `POST /auth/google`: not implemented — returns **501**. Document + flag.
- Operator login path `/operator/auth/login` → **`/kasir/auth/login`**;
  `/operator/auth/login/qr` → `/kasir/auth/login/qr`. Body `business_id` →
  `identifier`. Flag the `/kasir/` naming as suspected-bug.

**User / Business / Operator**
- `GET /users/me`, `PATCH /users/me`: field `name` → `full_name`.
- `GET/PATCH /business`: real fields are `klay_id`, `business_name`, `phone`,
  `address`, `city`, `country`, `qris_string`, `category`, `xendit_status`
  (not `name`/`location`/`qris_static_payload`).
- `POST /business/operators`: body is `name` only (server generates
  `operator_code` + PIN); they are NOT client-supplied.
- Add undocumented routes that exist in code: operator `rotate`,
  `force-logout`, `GET .../qr`.

**Transaction**
- No `/transactions` create/confirm. Real flow is `/orders` with
  `POST /orders`, `POST /orders/{id}/checkout/begin`,
  `POST /orders/{id}/checkout/confirm`, `POST /orders/{id}/void`. Re-derive the
  exact paths from `core/order/routes.go`.
- Schema: `created_by_operator_id` → `operator_id`; `confirmed_by` is a string
  (not nested object); `voided_by` is absent (flag as gap).
- Status enum: code accepts `DRAFT`/`CONFIRMED`/`VOIDED` only — `PENDING` is
  rejected. Document actual set + flag the PENDING discrepancy.

**Product**
- `Product` has no `recipe` field in code. Owner-facing CRUD is exposed at
  `/products` (not admin-only). List response is wrapped `{ products: [...] }`.

**Admin**
- Confirm `/admin/owners/*` paths and `X-Admin-Key` auth (these are in-sync).
- Reconcile `/admin/owners/{id}/status` (boolean toggle in code vs enum in YAML)
  and document the undocumented `/admin/owners/{id}/credential`.

### In-sync (verify, then keep)
All `/metrics/*` endpoints; the `{ success, data, error }` (+ optional `meta`)
envelope; rate limits (Owner 100 / Operator 60 / Admin 200 per min); BodyLimit
2M, Timeout 30s, XFF IP extractor; root-level paths (no `/api` prefix).

### Bug-flagging convention
Add an OpenAPI vendor extension `x-klay-flag` on affected operations/schemas,
e.g. `x-klay-flag: { kind: "suspected-bug" | "not-implemented" | "undocumented",
note: "..." }`. The generator renders these as a visible warning badge. This
keeps the flag data in the spec (single source of truth) rather than in the
generator.

### Output
- `klay-api-docs/openapi.yaml` — corrected contract, bumped to a clearly-marked
  version (e.g. `0.6.0` with a changelog comment block).
- `klay-server/docs/klay-api.yml` — synced to the same content.

## Part 2 — Static Docs Generator (Layout B)

### Architecture
```
klay-api-docs/
├── openapi.yaml            # corrected contract (source of truth)
├── package.json            # scripts: build, dev
├── scripts/
│   └── build.mjs           # js-yaml parse → render → write dist/
├── src/
│   ├── template.mjs        # HTML structure (sidebar + main)
│   ├── render/
│   │   ├── sidebar.mjs     # tags → endpoints nav
│   │   ├── operation.mjs   # one endpoint block
│   │   ├── schema.mjs      # JSON-schema → field table + example
│   │   └── flag.mjs        # x-klay-flag badge
│   └── styles.css          # layout-B theme (light, two-panel, tokens)
└── dist/                   # generated static output (deploy target)
    ├── index.html
    └── styles.css
```

Files stay small and single-purpose (per house style, <400 lines each). Each
render module takes plain data and returns an HTML string — pure, testable,
no shared mutable state.

### Layout B specifics
- **Theme:** light. CSS custom properties for color, type scale, spacing
  (per web coding-style: `--color-*`, `--text-*`, `--space-*`). Generous
  whitespace, clear scale contrast for hierarchy.
- **Left sidebar (sticky):** title + version, then tag groups (Auth, User,
  Business, Operator, Product, Transaction, Metrics, Admin), each expanding to
  its endpoints (method badge + path). Anchors scroll to the section.
- **Main panel (single page, stacked sections):** per endpoint —
  method badge + path, summary, description, auth requirement, params table,
  request-body schema (field · type · required · description), response schemas
  grouped by status code with the `{success,data,error}` envelope shown, and a
  collapsed example JSON. `x-klay-flag` renders an inline warning badge.
- **Method badges:** color-coded (GET/POST/PUT/PATCH/DELETE), compositor-friendly
  hover states.

### "No logic" boundary
Output is pure static HTML + CSS. The only JavaScript is a tiny inline script
for sidebar active-state / scroll-spy / group collapse — navigation affordance,
not application logic, no network calls, no "try it" console.

### Build & deploy
- `npm run build` → regenerates `dist/`. Deterministic; safe to commit or
  produce in CI.
- Deploy `dist/` to any static host (Vercel / Netlify / GitHub Pages). A
  `vercel.json` / static config can be added at deploy time.

## Testing / Verification
- **Generator unit tests:** `schema.mjs` (field table + example for nested
  objects, arrays, enums, nullable, `allOf`), `flag.mjs` (each flag kind),
  `sidebar.mjs` (grouping). Target ≥80% on render modules.
- **Build smoke test:** `npm run build` exits 0, `dist/index.html` is non-empty,
  contains one section per operation in the spec (count assertion), and valid
  HTML (no unclosed tags via a parser check).
- **Contract accuracy:** spot-check 3–4 reconciled endpoints (auth login,
  operator/kasir login, order checkout, a metrics report) by opening the
  rendered page and confirming path/body/response match the cited Go `file:line`.
- **Responsive/visual:** render at 320 / 768 / 1024 / 1440; verify no overflow
  and sidebar collapses sensibly on narrow widths.
- **Accessibility:** semantic landmarks (`<nav>`, `<main>`, `<section>` with
  `aria-labelledby`), keyboard-navigable sidebar, contrast check on badges.

## Out of Scope (YAGNI)
- Interactive "try it" / live request console.
- Multi-page routing or search (single-page anchors suffice for ~30 endpoints).
- Auth playground, SDK code generation, multi-language samples.
- Changing any server code — drift that looks like a bug is flagged, not fixed.
