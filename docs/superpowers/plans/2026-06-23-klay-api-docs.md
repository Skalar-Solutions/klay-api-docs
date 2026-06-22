# Klay API Documentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the Klay OpenAPI contract to match the live Go server, then generate a static, light-themed two-panel documentation site from it.

**Architecture:** Two phases. Phase 1 rewrites `openapi.yaml` domain-by-domain so every path/body/response matches the actual `klay-server` Go code (code is truth; suspected bugs flagged via an `x-klay-flag` vendor extension). Phase 2 is a small dependency-light Node generator (`js-yaml` + string-templating render modules, tested with the built-in `node:test` runner) that emits a single-page static `dist/index.html` + `styles.css`.

**Tech Stack:** OpenAPI 3.0.3, Node ≥18 (ESM `.mjs`, built-in test runner), `js-yaml`, plain HTML/CSS (no framework, no runtime app logic).

---

## File Structure

```
klay-api-docs/
├── openapi.yaml              # Phase 1 output: corrected contract (source of truth)
├── package.json              # scripts: build, test
├── scripts/
│   └── build.mjs             # parse openapi.yaml → render → write dist/
├── src/
│   ├── template.mjs          # full-page HTML shell (sidebar + main)
│   ├── render/
│   │   ├── flag.mjs          # x-klay-flag → badge HTML
│   │   ├── schema.mjs        # JSON-schema → field rows + example JSON
│   │   ├── sidebar.mjs       # tags → grouped nav HTML
│   │   └── operation.mjs     # one operation → section HTML
│   ├── nav.mjs               # tiny client script (scroll-spy / collapse), inlined
│   └── styles.css            # layout-B theme tokens + components
├── test/
│   ├── flag.test.mjs
│   ├── schema.test.mjs
│   ├── sidebar.test.mjs
│   └── build.test.mjs        # build smoke test
└── dist/                     # generated (gitignored build artifact)
    ├── index.html
    └── styles.css
```

Each render module is a pure function: data in, HTML string out. No shared mutable state.

---

## PHASE 1 — Contract Reconciliation

> Reconciliation rewrites YAML to match Go code. There is no TDD here; the
> verification is reading the cited `file:line` and confirming the YAML matches.
> Each task: (a) read the cited Go files, (b) apply the listed deltas, (c) add
> `x-klay-flag` where noted, (d) commit.

### Task 1: Seed corrected spec + version header

**Files:**
- Create: `klay-api-docs/openapi.yaml` (copy of `klay-server/docs/klay-api.yml`)

- [ ] **Step 1: Copy the current contract as the working baseline**

```bash
cd "klay-api-docs"
cp "../klay-server/docs/klay-api.yml" openapi.yaml
```

- [ ] **Step 2: Replace the `info.version` and top changelog block**

Set `info.version: 0.6.0` and prepend a changelog comment above `info:` (keep the existing v0.5/v0.4/v0.3 history below it):

```yaml
# ============================================================
# KLAY-API CONTRACT v0.6 — RECONCILED TO LIVE SERVER (2026-06-23)
# ============================================================
# This version was reconciled endpoint-by-endpoint against the Go
# implementation in klay-server/apps/api/core/. Where the code and the
# prior contract disagreed, the CODE is authoritative. Behaviour that
# looks like a bug or unfinished work is documented as-is and marked with
# the `x-klay-flag` vendor extension (kind: suspected-bug | not-implemented
# | undocumented) so it renders as a warning badge in the docs.
# ============================================================
```

- [ ] **Step 3: Add the `x-klay-flag` shape to the file (documentation comment)**

Under `components:` add a comment documenting the extension (extensions need no schema, but document the contract for the generator):

```yaml
  # x-klay-flag (vendor extension, may appear on any operation or schema):
  #   x-klay-flag:
  #     kind: suspected-bug | not-implemented | undocumented
  #     note: "<short human explanation>"
```

- [ ] **Step 4: Commit**

```bash
git add openapi.yaml
git commit -m "docs(contract): seed openapi.yaml v0.6.0 baseline for reconciliation"
```

---

### Task 2: Reconcile Auth domain

**Files:**
- Modify: `klay-api-docs/openapi.yaml` (paths under tag `Auth`)
- Read (truth): `klay-server/apps/api/core/auth/routes.go`, `auth/handler.go`, `auth/model.go`, `auth/identifier.go`

- [ ] **Step 1: Read the auth Go files** and confirm the deltas below against current `file:line` (the audit cited `handler.go:54-58`, `:114`, `:120-122`, `:167-172`; `routes.go:24-25,32-33`).

- [ ] **Step 2: Apply these deltas to `openapi.yaml`:**

`POST /auth/login` request body — replace `email` with `identifier`:
```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required: [identifier, password]
        properties:
          identifier:
            type: string
            description: Email atau klay_id owner.
          password: { type: string, format: password }
```
`POST /auth/login` 200 response → `AuthSuccess` must NOT nest `user`. Change the `AuthSuccess` schema (in components, Task 7 covers shared schemas — but fix the reference here): `data` contains only `access_token`.

`POST /auth/google` — add the flag and document the real behaviour:
```yaml
      x-klay-flag:
        kind: not-implemented
        note: "Handler returns 501 Not Implemented (auth/handler.go). Google OAuth login is not wired yet."
      responses:
        '501':
          description: Belum diimplementasi
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
```
(Keep the documented `200`/`403` shapes but mark them as the intended-but-unbuilt contract in the description.)

Operator login — rename paths `/operator/auth/login` → `/kasir/auth/login` and `/operator/auth/login/qr` → `/kasir/auth/login/qr`, flag each:
```yaml
  /kasir/auth/login:
    post:
      x-klay-flag:
        kind: suspected-bug
        note: "Path uses /kasir/ (not /operator/) in routes.go. Likely should be /operator/ for consistency with /operator/me."
```
And change the credential-login body: replace `business_id` with `identifier`:
```yaml
              required: [identifier, operator_code, pin]
              properties:
                identifier:
                  type: string
                  description: Email atau klay_id business (resolves business). 
                operator_code: { type: string, minLength: 3, maxLength: 64 }
                pin: { type: string, format: password, minLength: 4, maxLength: 12 }
```

- [ ] **Step 3: Commit**

```bash
git add openapi.yaml
git commit -m "docs(contract): reconcile Auth domain to server (identifier login, kasir path, google 501)"
```

---

### Task 3: Reconcile User / Business / Operator domains

**Files:**
- Modify: `klay-api-docs/openapi.yaml` (tags `User`, `Business`, `Operator`)
- Read (truth): `klay-server/apps/api/core/user/routes.go`, `user/handler.go`, `user/model.go`

- [ ] **Step 1: Read the user Go files**, confirming deltas (audit cited `handler.go:112-128,135-137,171-182,274,278-302`; `model.go:71-73,184-192`; `routes.go:13,18,22-35`).

- [ ] **Step 2: Apply deltas:**

`GET /users/me` + `PATCH /users/me`: rename response/request field `name` → `full_name`. Update `UserWithBusiness` (Task 7) accordingly and the PATCH body:
```yaml
            schema:
              type: object
              properties:
                full_name: { type: string }
                phone: { type: string }
```

`GET /business` + `PATCH /business`: replace the `Business` display fields with the real ones. PATCH body becomes:
```yaml
            schema:
              type: object
              properties:
                business_name: { type: string }
                phone: { type: string }
                address: { type: string }
                city: { type: string }
                country: { type: string }
                qris_string: { type: string, description: "QRIS static payload merchant." }
                category: { type: string }
```
Update the `Business` schema in components (Task 7): fields `klay_id`, `business_name`, `phone`, `address`, `city`, `country`, `qris_string`, `category`, `xendit_status`, plus lifecycle/status fields that the code actually returns (verify against `user/handler.go:171-182`).

`POST /business/operators`: body is `name` only — code generates `operator_code` + PIN:
```yaml
              required: [name]
              properties:
                name: { type: string, example: Siti Kasir }
```
Add a `description` noting the server returns the generated `operator_code` and credential in the create/regenerate response only.

Add the three undocumented operator routes (verify exact paths in `user/routes.go:32-35`), each with `x-klay-flag: { kind: undocumented, note: "Present in routes.go, absent from prior contract." }`:
- `GET /business/operators/{operator_id}/qr`
- `POST /business/operators/{operator_id}/rotate`
- `POST /business/operators/{operator_id}/force-logout`

- [ ] **Step 3: Commit**

```bash
git add openapi.yaml
git commit -m "docs(contract): reconcile User/Business/Operator domains to server"
```

---

### Task 4: Reconcile Transaction → Order domain

**Files:**
- Modify: `klay-api-docs/openapi.yaml` (tag `Transaction`, rename to reflect `/orders`)
- Read (truth): `klay-server/apps/api/core/order/routes.go`, `order/handler.go`, `order/model.go`, `klay-server/apps/api/core/transaction/handler.go`

- [ ] **Step 1: Read the order + transaction Go files.** Enumerate the ACTUAL registered routes from `order/routes.go` (audit saw `POST /orders`, `POST /orders/{id}/checkout/begin`, `POST /orders/{id}/checkout/confirm`, `POST /orders/{id}/void`, and a transaction list/read in `transaction/handler.go`). Write down each real path + method before editing.

- [ ] **Step 2: Replace the `/transactions` create/confirm paths** with the real `/orders` flow. For each, document request/response from code. Example shell for the confirm step (fill bodies from `order/handler.go`):
```yaml
  /orders/{order_id}/checkout/begin:
    post:
      tags: [Transaction]
      summary: Mulai checkout (stamp checkout_started_at)
      security: [{ BearerAuth: [] }]
      parameters:
        - { name: order_id, in: path, required: true, schema: { type: string } }
      responses:
        '200':
          description: Checkout dimulai
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/TransactionDetail' }
                  error: { type: string, nullable: true }
  /orders/{order_id}/checkout/confirm:
    post:
      tags: [Transaction]
      summary: Konfirmasi pembayaran (-> CONFIRMED)
      security: [{ BearerAuth: [] }]
      parameters:
        - { name: order_id, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [payment_method]
              properties:
                payment_method: { $ref: '#/components/schemas/PaymentMethod' }
      responses:
        '200':
          description: Transaksi CONFIRMED
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
                  data: { $ref: '#/components/schemas/TransactionDetail' }
                  error: { type: string, nullable: true }
```
Keep the read/list endpoints at their real registered paths (verify whether list is `/transactions` or `/orders` in code; document the actual one).

- [ ] **Step 3: Fix the `Transaction` schema** (in components, coordinate with Task 7):
  - `created_by_operator_id` → `operator_id`.
  - `confirmed_by`: change from nested object to `{ type: string, nullable: true }` (matches `order/model.go`). Add `x-klay-flag: { kind: suspected-bug, note: "confirmed_by is a bare string in code; prior contract modelled it as {type,id}. Auditor identity not structured." }`.
  - Remove `voided_by` (absent in model) OR keep with `x-klay-flag: { kind: suspected-bug, note: "voided_by not persisted in order/model.go — void audit actor not captured." }`. Document actual void fields only.

- [ ] **Step 4: Fix `TransactionStatus` enum** to `[DRAFT, CONFIRMED, VOIDED]` and flag it:
```yaml
    TransactionStatus:
      type: string
      enum: [DRAFT, CONFIRMED, VOIDED]
      x-klay-flag:
        kind: suspected-bug
        note: "Code rejects PENDING (transaction/handler.go list-filter validation). Prior contract listed PENDING as a state."
```

- [ ] **Step 5: Commit**

```bash
git add openapi.yaml
git commit -m "docs(contract): reconcile Transaction domain to /orders checkout flow"
```

---

### Task 5: Reconcile Product domain

**Files:**
- Modify: `klay-api-docs/openapi.yaml` (tag `Product`)
- Read (truth): `klay-server/apps/api/core/product/routes.go`, `product/handler.go`, `product/model.go`

- [ ] **Step 1: Read the product Go files** (audit cited `product/model.go:20-31` no `recipe`; `handler.go:82` wrapped list; `routes.go:18-20` owner CRUD).

- [ ] **Step 2: Apply deltas:**
  - `Product` schema: remove `recipe` (not in model). Add `x-klay-flag: { kind: suspected-bug, note: "Product has no recipe field in product/model.go; consumption tracking relies on recipe that the product API does not expose." }`.
  - `GET /products` 200: wrap data as `{ products: [...] }` to match `handler.go:82`.
  - Document the owner-facing write routes that actually exist at `/products` (`POST`, `PATCH`, `DELETE` per `routes.go:18-20`) with `BearerAuth` + owner requirement, flagged `undocumented` since the prior contract said admin-only.

- [ ] **Step 3: Commit**

```bash
git add openapi.yaml
git commit -m "docs(contract): reconcile Product domain (no recipe, owner CRUD, wrapped list)"
```

---

### Task 6: Reconcile Admin domain + verify Metrics & globals

**Files:**
- Modify: `klay-api-docs/openapi.yaml` (tags `Admin`, `Metrics`)
- Read (truth): `klay-server/apps/api/core/admin/routes.go`, `admin/handler.go`, `core/metrics/*`, `pkg/response/response.go`, `pkg/middleware/ratelimit.go`, `cmd/main.go`

- [ ] **Step 1: Admin** — confirm `/admin/owners/*` paths + `X-Admin-Key` (in-sync). Reconcile `/admin/owners/{owner_id}/status` to the real boolean-toggle body (`{ enabled: boolean }`, `admin/handler.go:178-193`) and add it as its own path; flag `x-klay-flag: { kind: suspected-bug, note: "Status is a boolean toggle endpoint, not the ACTIVE/SUSPENDED/CHURNED enum the prior contract implied on PATCH /admin/owners/{id}." }`. Add the undocumented `POST /admin/owners/{owner_id}/credential` (`{ email?, password? }`, `handler.go:195-214`) flagged `undocumented`.

- [ ] **Step 2: Metrics** — verify all 10 routes match (audit: in-sync). For `/metrics/reports/consumption` add `x-klay-flag: { kind: not-implemented, note: "Returns empty entries[]; consumption_log not implemented (handler_report.go). ingredient query param is ignored." }`.

- [ ] **Step 3: Globals** — confirm and (only if wrong) fix: `{success,data,error}` envelope + optional `meta` (response.go); rate limits 100/60/200 (ratelimit.go); BodyLimit 2M / Timeout 30s / XFF (main.go); no `/api` prefix. These were audited in-sync — confirm, no change expected.

- [ ] **Step 4: Commit**

```bash
git add openapi.yaml
git commit -m "docs(contract): reconcile Admin domain + verify Metrics/globals"
```

---

### Task 7: Sync shared component schemas + sync back to klay-server

**Files:**
- Modify: `klay-api-docs/openapi.yaml` (`components.schemas`)
- Modify: `klay-server/docs/klay-api.yml` (overwrite with reconciled content)

- [ ] **Step 1: Reconcile shared schemas** touched by earlier tasks so all `$ref`s resolve consistently: `AuthSuccess` (no nested user), `UserWithBusiness` (`full_name`), `Business` (real fields), `Transaction`/`TransactionDetail`/`TransactionItem`, `Product`, `TransactionStatus`. Read each producing handler to confirm field names/types.

- [ ] **Step 2: Validate the spec parses** (catches YAML errors and broken refs early using the generator's parser, installed in Task 8 — if running before Task 8, use any local YAML linter):

```bash
cd "klay-api-docs"
node -e "import('js-yaml').then(m=>{const fs=require('fs');m.default.load(fs.readFileSync('openapi.yaml','utf8'));console.log('YAML OK')})" 2>/dev/null || npx --yes js-yaml openapi.yaml >/dev/null && echo "YAML OK"
```
Expected: `YAML OK` (no parse errors).

- [ ] **Step 3: Sync back to canonical server contract**

```bash
cp "openapi.yaml" "../klay-server/docs/klay-api.yml"
```

- [ ] **Step 4: Commit (both repos)**

```bash
git add openapi.yaml
git commit -m "docs(contract): reconcile shared schemas; finalize v0.6.0"
cd "../klay-server" && git add docs/klay-api.yml && git commit -m "docs: sync klay-api.yml to reconciled v0.6.0 (matches live server)" && cd -
```

---

## PHASE 2 — Static Docs Generator (Layout B)

### Task 8: Scaffold the Node project

**Files:**
- Create: `klay-api-docs/package.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "klay-api-docs",
  "version": "0.6.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "test": "node --test"
  },
  "dependencies": {
    "js-yaml": "^4.1.0"
  }
}
```

- [ ] **Step 2: Install**

```bash
cd "klay-api-docs"
npm install
```
Expected: `js-yaml` resolved, `node_modules/` created (already gitignored).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: scaffold node generator project"
```

---

### Task 9: `flag.mjs` — render x-klay-flag badge (TDD)

**Files:**
- Create: `klay-api-docs/src/render/flag.mjs`
- Test: `klay-api-docs/test/flag.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// test/flag.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFlag } from '../src/render/flag.mjs';

test('returns empty string when no flag', () => {
  assert.equal(renderFlag(undefined), '');
});

test('renders kind and note with a kind-specific class', () => {
  const html = renderFlag({ kind: 'suspected-bug', note: 'PENDING rejected' });
  assert.match(html, /flag--suspected-bug/);
  assert.match(html, /suspected bug/i);
  assert.match(html, /PENDING rejected/);
});

test('escapes HTML in the note', () => {
  const html = renderFlag({ kind: 'undocumented', note: '<script>x</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "klay-api-docs" && node --test test/flag.test.mjs`
Expected: FAIL — cannot find module `../src/render/flag.mjs`.

- [ ] **Step 3: Implement**

```js
// src/render/flag.mjs
const LABELS = {
  'suspected-bug': 'Suspected bug',
  'not-implemented': 'Not implemented',
  'undocumented': 'Undocumented',
};

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderFlag(flag) {
  if (!flag || !flag.kind) return '';
  const label = LABELS[flag.kind] ?? flag.kind;
  const note = flag.note ? `<span class="flag__note">${escapeHtml(flag.note)}</span>` : '';
  return `<div class="flag flag--${escapeHtml(flag.kind)}"><span class="flag__label">${escapeHtml(label)}</span>${note}</div>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "klay-api-docs" && node --test test/flag.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/flag.mjs test/flag.test.mjs
git commit -m "feat(gen): render x-klay-flag badge"
```

---

### Task 10: `schema.mjs` — field rows + example JSON (TDD)

**Files:**
- Create: `klay-api-docs/src/render/schema.mjs`
- Test: `klay-api-docs/test/schema.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// test/schema.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFields, exampleFor } from '../src/render/schema.mjs';

const objSchema = {
  type: 'object',
  required: ['identifier'],
  properties: {
    identifier: { type: 'string', description: 'Email or klay_id' },
    password: { type: 'string', format: 'password' },
  },
};

test('renderFields lists each property with type and required marker', () => {
  const html = renderFields(objSchema);
  assert.match(html, /identifier/);
  assert.match(html, /string/);
  assert.match(html, /required/i);
  assert.match(html, /Email or klay_id/);
});

test('exampleFor builds a representative object', () => {
  const ex = exampleFor(objSchema);
  assert.equal(typeof ex, 'object');
  assert.ok('identifier' in ex);
});

test('exampleFor renders enum first value and arrays', () => {
  assert.equal(exampleFor({ type: 'string', enum: ['CASH', 'TRANSFER'] }), 'CASH');
  assert.deepEqual(exampleFor({ type: 'array', items: { type: 'integer' } }), [0]);
});

test('exampleFor handles allOf by merging', () => {
  const ex = exampleFor({ allOf: [objSchema, { type: 'object', properties: { extra: { type: 'integer' } } }] });
  assert.ok('identifier' in ex);
  assert.ok('extra' in ex);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "klay-api-docs" && node --test test/schema.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/render/schema.mjs
import { escapeHtml } from './flag.mjs';

function sampleScalar(s) {
  if (s.enum && s.enum.length) return s.enum[0];
  switch (s.type) {
    case 'integer': return 0;
    case 'number': return 0;
    case 'boolean': return true;
    case 'string':
      if (s.format === 'date') return '2026-06-23';
      if (s.format === 'date-time') return '2026-06-23T10:00:00Z';
      if (s.format === 'email') return 'owner@klay.id';
      return 'string';
    default: return null;
  }
}

export function exampleFor(schema) {
  if (!schema) return null;
  if (schema.allOf) return schema.allOf.reduce((acc, s) => Object.assign(acc, exampleFor(s)), {});
  if (schema.type === 'object' || schema.properties) {
    const out = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = exampleFor(v);
    return out;
  }
  if (schema.type === 'array') return [exampleFor(schema.items ?? {})];
  return sampleScalar(schema);
}

function typeLabel(s) {
  if (s.allOf) return 'object';
  if (s.type === 'array') return `array<${s.items?.type ?? 'object'}>`;
  let t = s.type ?? 'object';
  if (s.format) t += ` · ${s.format}`;
  if (s.enum) t += ` · enum`;
  return t;
}

export function renderFields(schema) {
  if (!schema) return '';
  const merged = schema.allOf
    ? schema.allOf.reduce((acc, s) => ({
        properties: { ...acc.properties, ...s.properties },
        required: [...(acc.required ?? []), ...(s.required ?? [])],
      }), { properties: {}, required: [] })
    : schema;
  const required = new Set(merged.required ?? []);
  const props = merged.properties ?? {};
  if (!Object.keys(props).length) return '';
  const rows = Object.entries(props).map(([name, s]) => `
    <tr>
      <td class="field__name">${escapeHtml(name)}${required.has(name) ? '<span class="field__req">required</span>' : ''}</td>
      <td class="field__type">${escapeHtml(typeLabel(s))}</td>
      <td class="field__desc">${escapeHtml(s.description ?? '')}</td>
    </tr>`).join('');
  return `<table class="fields"><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderExample(schema) {
  const ex = exampleFor(schema);
  if (ex === null || ex === undefined) return '';
  return `<pre class="example"><code>${escapeHtml(JSON.stringify(ex, null, 2))}</code></pre>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "klay-api-docs" && node --test test/schema.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/schema.mjs test/schema.test.mjs
git commit -m "feat(gen): render schema field tables and example JSON"
```

---

### Task 11: `sidebar.mjs` — grouped nav (TDD)

**Files:**
- Create: `klay-api-docs/src/render/sidebar.mjs`
- Test: `klay-api-docs/test/sidebar.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// test/sidebar.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByTag, renderSidebar, opId } from '../src/render/sidebar.mjs';

const ops = [
  { tag: 'Auth', method: 'post', path: '/auth/login', summary: 'Login' },
  { tag: 'Auth', method: 'post', path: '/auth/logout', summary: 'Logout' },
  { tag: 'Metrics', method: 'get', path: '/metrics/summary', summary: 'Summary' },
];

test('groupByTag preserves tag order and groups members', () => {
  const groups = groupByTag(ops);
  assert.deepEqual(groups.map(g => g.tag), ['Auth', 'Metrics']);
  assert.equal(groups[0].operations.length, 2);
});

test('opId is a stable slug of method+path', () => {
  assert.equal(opId({ method: 'post', path: '/auth/login' }), 'post-auth-login');
});

test('renderSidebar emits an anchor per operation', () => {
  const html = renderSidebar(ops);
  assert.match(html, /#post-auth-login/);
  assert.match(html, /#get-metrics-summary/);
  assert.match(html, /Auth/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "klay-api-docs" && node --test test/sidebar.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/render/sidebar.mjs
import { escapeHtml } from './flag.mjs';

export function opId(op) {
  return `${op.method}-${op.path}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function groupByTag(operations) {
  const order = [];
  const map = new Map();
  for (const op of operations) {
    if (!map.has(op.tag)) { map.set(op.tag, []); order.push(op.tag); }
    map.get(op.tag).push(op);
  }
  return order.map(tag => ({ tag, operations: map.get(tag) }));
}

export function renderSidebar(operations) {
  const groups = groupByTag(operations);
  const sections = groups.map(g => {
    const links = g.operations.map(op => `
      <a class="nav__link" href="#${opId(op)}">
        <span class="nav__method nav__method--${op.method}">${op.method.toUpperCase()}</span>
        <span class="nav__path">${escapeHtml(op.path)}</span>
      </a>`).join('');
    return `<div class="nav__group"><div class="nav__tag">${escapeHtml(g.tag)}</div>${links}</div>`;
  }).join('');
  return `<nav class="sidebar" aria-label="API navigation">${sections}</nav>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "klay-api-docs" && node --test test/sidebar.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/sidebar.mjs test/sidebar.test.mjs
git commit -m "feat(gen): render grouped sidebar navigation"
```

---

### Task 12: `operation.mjs` — one endpoint section

**Files:**
- Create: `klay-api-docs/src/render/operation.mjs`

- [ ] **Step 1: Implement** (composes flag + schema; rendered output is exercised by the build smoke test in Task 15)

```js
// src/render/operation.mjs
import { escapeHtml } from './flag.mjs';
import { renderFlag } from './flag.mjs';
import { renderFields, renderExample } from './schema.mjs';
import { opId } from './sidebar.mjs';

function bodySchema(op) {
  return op.requestBody?.content?.['application/json']?.schema;
}

function renderParams(parameters = []) {
  if (!parameters.length) return '';
  const rows = parameters.map(p => `
    <tr>
      <td class="field__name">${escapeHtml(p.name)}${p.required ? '<span class="field__req">required</span>' : ''}</td>
      <td class="field__type">${escapeHtml(p.in)} · ${escapeHtml(p.schema?.type ?? 'string')}</td>
      <td class="field__desc">${escapeHtml(p.description ?? '')}</td>
    </tr>`).join('');
  return `<h4 class="op__subhead">Parameters</h4><table class="fields"><thead><tr><th>Name</th><th>In · Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderResponses(responses = {}) {
  const blocks = Object.entries(responses).map(([code, r]) => {
    const schema = r.content?.['application/json']?.schema;
    const cls = code.startsWith('2') ? 'ok' : 'err';
    return `<div class="resp resp--${cls}">
      <div class="resp__code">${escapeHtml(code)}</div>
      <div class="resp__desc">${escapeHtml(r.description ?? '')}</div>
      ${schema ? renderFields(schema) : ''}
    </div>`;
  }).join('');
  return `<h4 class="op__subhead">Responses</h4>${blocks}`;
}

export function renderOperation(op) {
  const id = opId(op);
  const body = bodySchema(op);
  const secured = Array.isArray(op.security) && op.security.length;
  return `<section class="op" id="${id}">
    <div class="op__head">
      <span class="op__method op__method--${op.method}">${op.method.toUpperCase()}</span>
      <code class="op__path">${escapeHtml(op.path)}</code>
      ${secured ? '<span class="op__auth">🔒 Auth required</span>' : '<span class="op__auth op__auth--public">Public</span>'}
    </div>
    <h3 class="op__summary">${escapeHtml(op.summary ?? '')}</h3>
    ${renderFlag(op['x-klay-flag'])}
    ${op.description ? `<p class="op__desc">${escapeHtml(op.description)}</p>` : ''}
    ${renderParams(op.parameters)}
    ${body ? `<h4 class="op__subhead">Request body</h4>${renderFields(body)}${renderExample(body)}` : ''}
    ${renderResponses(op.responses)}
  </section>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/render/operation.mjs
git commit -m "feat(gen): render full operation section"
```

---

### Task 13: `template.mjs` — full page shell + inline nav script

**Files:**
- Create: `klay-api-docs/src/template.mjs`
- Create: `klay-api-docs/src/nav.mjs`

- [ ] **Step 1: Implement the client nav script** (scroll-spy + group collapse — navigation only, no network)

```js
// src/nav.mjs  (string exported for inlining)
export const NAV_SCRIPT = `
const links = [...document.querySelectorAll('.nav__link')];
const map = new Map(links.map(l => [l.getAttribute('href').slice(1), l]));
const obs = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      links.forEach(l => l.classList.remove('is-active'));
      map.get(e.target.id)?.classList.add('is-active');
    }
  }
}, { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('.op').forEach(s => obs.observe(s));
`;
```

- [ ] **Step 2: Implement the page template**

```js
// src/template.mjs
import { escapeHtml } from './render/flag.mjs';
import { renderSidebar } from './render/sidebar.mjs';
import { renderOperation } from './render/operation.mjs';
import { NAV_SCRIPT } from './nav.mjs';

export function renderPage({ info, operations }) {
  const sidebar = renderSidebar(operations);
  const main = operations.map(renderOperation).join('\n');
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(info.title)} · API Reference</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <span class="topbar__title">${escapeHtml(info.title)}</span>
    <span class="topbar__version">v${escapeHtml(info.version)}</span>
  </header>
  <div class="layout">
    ${sidebar}
    <main class="main">
      ${main}
    </main>
  </div>
  <script>${NAV_SCRIPT}</script>
</body>
</html>`;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/template.mjs src/nav.mjs
git commit -m "feat(gen): page template and inline scroll-spy nav"
```

---

### Task 14: `styles.css` — layout-B theme

**Files:**
- Create: `klay-api-docs/src/styles.css`

- [ ] **Step 1: Implement** the light two-panel theme using design tokens (color/type/space custom properties), method-badge colors, flag-badge variants, fields table, and responsive collapse at ≤768px. Animate only `transform`/`opacity` on hover. (Full token set below; extend as needed during visual QA in Task 16.)

```css
:root {
  --color-bg: oklch(99% 0 0);
  --color-surface: oklch(100% 0 0);
  --color-border: oklch(92% 0 0);
  --color-text: oklch(22% 0 0);
  --color-muted: oklch(55% 0 0);
  --color-accent: oklch(58% 0.2 264);
  --m-get: oklch(60% 0.15 230);
  --m-post: oklch(60% 0.16 150);
  --m-put: oklch(65% 0.16 70);
  --m-patch: oklch(65% 0.16 70);
  --m-delete: oklch(60% 0.2 25);
  --text-base: clamp(0.95rem, 0.9rem + 0.2vw, 1.02rem);
  --text-h3: clamp(1.15rem, 1rem + 0.6vw, 1.5rem);
  --space-section: clamp(2.5rem, 2rem + 2vw, 4.5rem);
  --sidebar-w: 300px;
  --radius: 10px;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  color: var(--color-text); background: var(--color-bg); font-size: var(--text-base); line-height: 1.6; }
code, pre, .op__path, .nav__path { font-family: ui-monospace, "SF Mono", Menlo, monospace; }

.topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: baseline; gap: 0.75rem;
  padding: 1rem 1.5rem; background: var(--color-surface); border-bottom: 1px solid var(--color-border); }
.topbar__title { font-weight: 700; }
.topbar__version { color: var(--color-muted); font-size: 0.85em; }

.layout { display: grid; grid-template-columns: var(--sidebar-w) 1fr; align-items: start; }
.sidebar { position: sticky; top: 57px; max-height: calc(100vh - 57px); overflow-y: auto;
  padding: 1.5rem 1rem; border-right: 1px solid var(--color-border); }
.nav__group { margin-bottom: 1.5rem; }
.nav__tag { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--color-muted); margin-bottom: 0.5rem; }
.nav__link { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem;
  border-radius: 6px; text-decoration: none; color: var(--color-text); transition: background var(--ease) 150ms; }
.nav__link:hover { background: oklch(96% 0 0); }
.nav__link.is-active { background: oklch(95% 0.03 264); color: var(--color-accent); }
.nav__method { font-size: 0.6rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 4px; color: #fff; }
.nav__path { font-size: 0.78rem; }

.main { padding: var(--space-section) clamp(1.5rem, 1rem + 3vw, 5rem); max-width: 920px; }
.op { padding-bottom: var(--space-section); margin-bottom: var(--space-section);
  border-bottom: 1px solid var(--color-border); scroll-margin-top: 80px; }
.op__head { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.op__method { font-weight: 700; font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px; color: #fff; }
.op__method--get, .nav__method--get { background: var(--m-get); }
.op__method--post, .nav__method--post { background: var(--m-post); }
.op__method--put, .nav__method--put { background: var(--m-put); }
.op__method--patch, .nav__method--patch { background: var(--m-patch); }
.op__method--delete, .nav__method--delete { background: var(--m-delete); }
.op__path { font-size: 1rem; }
.op__auth { font-size: 0.72rem; color: var(--color-muted); }
.op__summary { font-size: var(--text-h3); margin: 1rem 0 0.5rem; }
.op__desc { color: var(--color-muted); }
.op__subhead { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-muted); margin: 1.75rem 0 0.6rem; }

.fields { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.fields th { text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--color-muted);
  border-bottom: 1px solid var(--color-border); padding: 0.4rem 0.6rem; }
.fields td { border-bottom: 1px solid var(--color-border); padding: 0.5rem 0.6rem; vertical-align: top; }
.field__name { font-family: ui-monospace, monospace; font-weight: 600; }
.field__req { margin-left: 0.4rem; font-size: 0.65rem; color: var(--m-delete); font-weight: 700; }
.field__type { color: var(--color-muted); font-family: ui-monospace, monospace; font-size: 0.82rem; }

.resp { margin: 0.75rem 0; padding: 0.75rem 1rem; border-radius: var(--radius); border: 1px solid var(--color-border); }
.resp__code { font-weight: 700; }
.resp--ok .resp__code { color: var(--m-post); }
.resp--err .resp__code { color: var(--m-delete); }

.example { background: oklch(97% 0 0); border: 1px solid var(--color-border); border-radius: var(--radius);
  padding: 1rem; overflow-x: auto; font-size: 0.82rem; }

.flag { display: flex; gap: 0.5rem; align-items: baseline; margin: 0.75rem 0; padding: 0.6rem 0.9rem;
  border-radius: var(--radius); border-left: 3px solid; font-size: 0.85rem; }
.flag__label { font-weight: 700; }
.flag--suspected-bug { background: oklch(96% 0.04 60); border-color: oklch(70% 0.16 60); }
.flag--not-implemented { background: oklch(96% 0.03 25); border-color: oklch(65% 0.18 25); }
.flag--undocumented { background: oklch(96% 0.02 264); border-color: oklch(65% 0.12 264); }
.flag__note { color: var(--color-muted); }

@media (max-width: 768px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static; max-height: none; border-right: 0; border-bottom: 1px solid var(--color-border); }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat(gen): layout-B light theme stylesheet"
```

---

### Task 15: `build.mjs` — wire it together + smoke test (TDD)

**Files:**
- Create: `klay-api-docs/scripts/build.mjs`
- Test: `klay-api-docs/test/build.test.mjs`

- [ ] **Step 1: Write the failing smoke test**

```js
// test/build.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { flattenOperations } from '../scripts/build.mjs';
import yaml from 'js-yaml';

test('flattenOperations yields one entry per path+method with tag', () => {
  const spec = yaml.load(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'));
  const ops = flattenOperations(spec);
  assert.ok(ops.length > 20, `expected >20 operations, got ${ops.length}`);
  for (const op of ops) {
    assert.ok(op.method && op.path && op.tag, `incomplete op: ${JSON.stringify(op).slice(0,80)}`);
  }
});

test('build produces non-empty dist/index.html with a section per operation', () => {
  execFileSync('node', ['scripts/build.mjs'], { cwd: new URL('..', import.meta.url) });
  const url = new URL('../dist/index.html', import.meta.url);
  assert.ok(existsSync(url), 'dist/index.html missing');
  const html = readFileSync(url, 'utf8');
  const spec = yaml.load(readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8'));
  const ops = flattenOperations(spec);
  const sectionCount = (html.match(/class="op"/g) || []).length;
  assert.equal(sectionCount, ops.length, 'one <section class="op"> per operation');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "klay-api-docs" && node --test test/build.test.mjs`
Expected: FAIL — cannot import `flattenOperations`.

- [ ] **Step 3: Implement the build**

```js
// scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { renderPage } from '../src/template.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export function flattenOperations(spec) {
  const ops = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    const shared = item.parameters ?? [];
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      ops.push({
        method, path,
        tag: (op.tags && op.tags[0]) || 'Other',
        summary: op.summary, description: op.description,
        parameters: [...shared, ...(op.parameters ?? [])],
        requestBody: op.requestBody, responses: op.responses,
        security: op.security, 'x-klay-flag': op['x-klay-flag'],
      });
    }
  }
  return ops;
}

function main() {
  const spec = yaml.load(readFileSync(join(ROOT, 'openapi.yaml'), 'utf8'));
  const operations = flattenOperations(spec);
  const html = renderPage({ info: spec.info, operations });
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist', 'index.html'), html);
  copyFileSync(join(ROOT, 'src', 'styles.css'), join(ROOT, 'dist', 'styles.css'));
  console.log(`Built dist/index.html — ${operations.length} operations`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd "klay-api-docs" && node --test test/build.test.mjs`
Expected: PASS (2 tests); `dist/index.html` + `dist/styles.css` exist.

- [ ] **Step 5: Run the full suite**

Run: `cd "klay-api-docs" && npm test`
Expected: PASS — all flag/schema/sidebar/build tests green.

- [ ] **Step 6: Commit**

```bash
git add scripts/build.mjs test/build.test.mjs
git commit -m "feat(gen): build pipeline + smoke test"
```

---

### Task 16: Visual + accessibility QA, deploy config

**Files:**
- Create: `klay-api-docs/README.md`
- Create: `klay-api-docs/vercel.json` (or chosen host config)

- [ ] **Step 1: Build and open**

```bash
cd "klay-api-docs" && npm run build && open dist/index.html
```

- [ ] **Step 2: Manual checklist** (fix CSS/template inline if any fail):
  - Renders at 320 / 768 / 1024 / 1440 with no horizontal overflow; sidebar collapses ≤768px.
  - Method badges color-correct; flag badges visible on flagged endpoints (auth/google 501, /kasir login, PENDING enum, product recipe).
  - Scroll-spy highlights the active sidebar link.
  - Keyboard: Tab reaches every sidebar link; visible focus ring.
  - Spot-check 3 endpoints (auth login, order checkout/confirm, a metrics report) against the cited Go `file:line` — path/body/response match.

- [ ] **Step 3: Add deploy config + README**

`vercel.json`:
```json
{ "outputDirectory": "dist", "buildCommand": "npm run build" }
```
`README.md`: one-paragraph purpose, `npm install && npm run build`, deploy note, and that `openapi.yaml` is the source of truth synced from `klay-server/docs/klay-api.yml`.

- [ ] **Step 4: Commit**

```bash
git add README.md vercel.json
git commit -m "docs: add README and deploy config"
```

---

## Self-Review Notes

- **Spec coverage:** Phase 1 Tasks 2–7 cover every drift item in the design (Auth, User/Business/Operator, Transaction/Order, Product, Admin, Metrics-verify, shared schemas + sync-back). Phase 2 Tasks 8–16 cover generator, layout-B theme, flag rendering, build, QA, deploy.
- **Flag mechanism:** `x-klay-flag` defined in Task 1, rendered in Task 9, applied across Tasks 2–6 — consistent `kind` values (`suspected-bug` / `not-implemented` / `undocumented`) match `flag.mjs` `LABELS`.
- **Type consistency:** `opId` defined in `sidebar.mjs` (Task 11) and reused in `operation.mjs` (Task 12) and build. `escapeHtml` defined once in `flag.mjs`, imported everywhere. `flattenOperations` shape (method/path/tag/...) matches what `renderOperation` and `renderSidebar` consume.
- **No server code changed** — bug-like behaviour is flagged, never fixed (matches approved scope).
```
