# AGENTS.md

Guidance for AI agents and developers working in the **CLOTHIFY** codebase.

## What this is

CLOTHIFY is a multi-tenant, bilingual (Arabic/English, RTL) clothing-store
management SaaS built with Next.js (App Router), TypeScript, Prisma 7 and
PostgreSQL. It covers POS, products/variants, inventory (movements, transfers,
stocktakes), sales & refunds, customers, suppliers & purchasing, expenses,
employees, branches, reporting/CSV export, settings and subscriptions.

## Golden rules

- **Never fake success.** Subscriptions run in DEVELOPMENT mode; a payment must
  never be reported as succeeded without a real payment provider confirming it.
  See `src/core/subscriptions.ts` (`subscriptionsInDevelopmentMode`).
- **All money math goes through `computeTotals`** (`src/lib/pricing.ts`). Do not
  re-implement subtotal/tax/discount/loyalty math anywhere else.
- **Stock changes go through `adjustStock`** (`src/lib/inventory.ts`). It uses an
  atomic conditional `UPDATE ... WHERE quantity >= n` so concurrent sales can
  never oversell a SKU. Never write inventory balances directly.
- **Authorization is server-side.** Use `requirePermission(code)` in every server
  action/route. Client checks (`canSync`) are for UI affordances only.
- **Do not add comments** unless they explain a non-obvious *why*.
- Types-first: this repo runs `tsc --noEmit` in CI; `verbatimModuleSyntax` and
  `noUncheckedIndexedAccess` are on (use `import type`, guard index accesses
  with `!`).

## Environment / host notes

- Target directory: `/root/clothify`.
- Node **v22**. Long installs/compiles need extra heap:
  `NODE_OPTIONS="--max-old-space-size=2048"` (use `3072` for `next build`).
- Wrap long-running commands (`tsc`, `eslint`, `build`) in `timeout 300`.
- **TypeScript is pinned to `^5.9.3`** (not TS 7's native preview, which panics
  on this host's bind mount). Keep it.

## Local PostgreSQL 16

Data dir: `/opt/clothify-pg` (trust auth, port 5432, unix socket in `/tmp`).

```bash
# start
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /opt/clothify-pg \
  -l /opt/clothify-pg/server.log -o '-p 5432 -k /tmp' start"

# stop
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /opt/clothify-pg stop"

# psql
su postgres -c "/usr/lib/postgresql/16/bin/psql -h /tmp -p 5432 -d clothify"
```

`DATABASE_URL` (see `.env`): `postgresql://postgres@127.0.0.1:5432/clothify?schema=public`.
The `pgcrypto` extension is required (created during schema push).

## Common commands

```bash
npm run dev            # next dev on :3000
npm run build          # production build
npm run start          # serve production build
npm run lint           # eslint .
npm run typecheck      # tsc --noEmit
npm test               # vitest run (unit + integration)
npm run test:unit      # vitest run --config vitest.unit.config.ts (no DB)
npm run test:integration   # vitest run tests (needs Postgres)
npm run test:watch     # vitest watch
npm run test:e2e       # playwright test

npm run db:push        # prisma db push (does NOT generate in Prisma 7)
npm run db:generate    # prisma generate
npm run db:seed        # tsx prisma/seed.ts (idempotent)
npm run db:studio      # prisma studio
```

Prisma 7 gotcha: `prisma db push` has **no** `--skip-generate`. Run `db push`
**then** `generate` separately.

After any `schema.prisma` change: `npm run db:push && npm run db:generate`.

## Testing

- **Unit** (`src/**/*.test.ts`): pure logic, no DB. e.g. `src/lib/pricing.test.ts`,
  `src/core/rbac/catalog.test.ts`. Run with `npm run test:unit`
  (`vitest.unit.config.ts`).
- **Integration** (`tests/**/*.test.ts`): run against a real Postgres test DB
  (`clothify_test`). Session/auth/RBAC are mocked so server actions can be
  exercised directly. `tests/global-setup.ts` loads `.env.test`, pushes the
  schema and seeds the DB on first run (`tests/prepare-db.ts`). Run with
  `npm run test:integration`.
- **E2E** (`e2e/*.spec.ts`, Playwright): full browser flows against a running
  server. See `playwright.config.ts`. Playwright boots a dev server on port
  `3100` against the `clothify_test` DB (seeded by `e2e/global-setup.ts`).
  **Requires a host where the Chromium network stack works** — it cannot run in
  locked-down sandboxes where Chromium aborts requests to `localhost`
  (`net::ERR_ABORTED`).

Sandbox note: under tight memory, Vitest occasionally fails to resolve existing
TS modules during collection. `npm run test:integration` retries up to 3 times
(`test:integration:once` is the single attempt). Set
`NODE_OPTIONS=--max-old-space-size=2048` for tooling; the environment may
default to a very small heap (192 MB) that OOMs `eslint`/`tsc`.

Before finishing any task, run and make green:
`npm run lint && npm run typecheck && npm test && npm run build`.

## Architecture map

```
src/
  app/[locale]/(app)/…      route segments + server actions (actions.ts)
  app/api/…                 route handlers (e.g. reports CSV export)
  components/…              UI (ui/ primitives, feature folders, layout/)
  core/                     server-only domain services
    auth/                   Better Auth config + session/permission guards
    rbac/                   permission catalog + role→permission map
    tenant.ts               requireTenantContext / branch scoping
    audit.ts                recordAudit
    subscriptions.ts        plan limits + DEV-mode billing
  lib/                      frameworks-agnostic helpers
    pricing.ts              computeTotals, discountAllowed
    inventory.ts            adjustStock (atomic), valuation
    sequence.ts             nextNumber / peekNumber (per-tenant sequences)
    store-config.ts         Tenant.config JSON (StoreConfig) + merge
    format.ts               fmtMoney / toNumber / fmtInt / dates
    reports.ts              REPORT_KEYS + runReport
  i18n/, messages/          next-intl config + en.json / ar.json
```

## Domain conventions

- **Multi-tenancy:** every query scopes by `tenantId` (from
  `requireTenantContext()`); branch-scoped users are further limited by
  `ctx.branchIds`. Use `branchFilter` helper where relevant.
- **Roles:** `platform_admin, owner, manager, inventory_manager, cashier,
  sales_employee` (`src/core/rbac/catalog.ts`). There is **no** `branches:write`
  / `settings:write` / `subscription:write` code — those screens are gated by
  `roleCode === "owner" || user.isPlatformAdmin`.
- **Sequences:** sales/receipts/refunds/POs/… use per-tenant `NumberSequence`
  via `nextNumber(tenantId, key)`.
- **Models:** `Supplier` uses `name`/`nameAr` (not `nameEn`); `Category`/`Brand`/
  `Product` use `nameEn`/`nameAr`. `InventoryBalance` has only `quantity` (cost
  basis = `quantity × variant.cost`).
- **Money:** Prisma `Decimal` → convert with `toNumber()` from `src/lib/format.ts`.
- **i18n:** default locale `ar` with `localePrefix: "as-needed"`; add all UI
  strings to **both** `src/messages/en.json` and `src/messages/ar.json`.

## Seed / demo data

`npm run db:seed` is idempotent (resets demo rows then rebuilds). Credentials:

| role           | email                    | password      |
| -------------- | ------------------------ | ------------- |
| platform admin | `admin@clothify.local`   | `ChangeMe!123`|
| owner          | `owner@zahra.local`      | `owner123`    |
| manager        | `manager@zahra.local`    | `manager123`  |
| cashier        | `cashier@zahra.local`    | `cashier123`  |
| stock          | `stock@zahra.local`      | `stock123`    |

Demo tenant slug: `zahra-fashion`; branches `MAIN`, `MALL`.
