# CLOTHIFY

A modern, multi-tenant **clothing-store management platform** — point of sale,
inventory, sales, customers, purchasing, employees, reporting and subscriptions —
with a fully bilingual **Arabic / English** interface (RTL-aware).

Built with **Next.js (App Router) · TypeScript · Prisma 7 · PostgreSQL · Better Auth · next-intl · Tailwind CSS 4**.

## Features

- **Multi-tenant & multi-branch** — tenant-scoped data with per-branch stock and
  branch-limited users.
- **Role-based access control** — 6 roles (platform admin, owner, manager,
  inventory manager, cashier, sales employee) mapped to a granular permission
  catalogue (`src/core/rbac/catalog.ts`).
- **Point of Sale** — fast checkout, multiple payment methods, per-line and
  sale-level discounts, loyalty points, printable receipt.
- **Products & variants** — sizes/colors, cost & price, categories, brands.
- **Inventory** — atomic stock adjustments, movement ledger, inter-branch
  transfers, and stocktakes. Concurrency-safe (never oversells).
- **Sales** — history, detail, partial/full refunds (with restock or damaged
  handling), cancellation.
- **Customers** — profiles, purchase history, loyalty balances.
- **Suppliers & Purchasing** — supplier directory, purchase orders, goods
  receiving (updates stock + cost).
- **Expenses** — categorised operating expenses with filtering and totals.
- **Employees** — invite staff, assign roles, reset passwords.
- **Branches** — create/manage locations with sales & stock-value stats.
- **Reports** — 15 built-in reports with date/branch filters and **CSV export**.
- **Settings** — store profile, tax, inventory and receipt configuration.
- **Subscriptions** — plan management (runs in **development mode**; no real
  payment provider is wired).
- **Bilingual UI** — Arabic (default) and English, RTL layout, light/dark themes,
  accent theming.

## Tech stack

| Area       | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Server Actions, Turbopack) |
| Language   | TypeScript 5.9                                     |
| Database   | PostgreSQL 16 + Prisma 7 (`prisma-client` generator) |
| Auth       | Better Auth (email/password + username plugin)     |
| i18n       | next-intl (locales `ar`, `en`; default `ar`)       |
| UI         | Tailwind CSS 4, Radix UI, lucide-react, motion     |
| Charts     | Recharts                                           |
| Tests      | Vitest (unit + integration), Playwright (E2E)      |

## Getting started

### 1. Prerequisites

- Node.js **22+**
- PostgreSQL **16**
- A `.env` file (copy from `.env.example`)

```bash
cp .env.example .env
```

Key variables:

```dotenv
DATABASE_URL="postgresql://postgres@127.0.0.1:5432/clothify?schema=public"
BETTER_AUTH_SECRET="change-me"
BETTER_AUTH_URL="http://localhost:3000"
CLOTHIFY_PLATFORM_ADMIN_EMAIL="admin@clothify.local"
CLOTHIFY_PLATFORM_ADMIN_PASSWORD="ChangeMe!123"
```

> Leave `STRIPE_*` empty — subscriptions intentionally run in development mode
> and never confirm a payment without a provider.

### 2. Install

```bash
npm install
```

### 3. Database

Start PostgreSQL, create the database (with `pgcrypto`), push the schema and
seed demo data:

```bash
createdb clothify            # or: psql -c "CREATE DATABASE clothify"
psql -d clothify -c "CREATE EXTENSION IF NOT EXISTS pgcrypto"

npm run db:push
npm run db:generate          # Prisma 7: db push does not generate
npm run db:seed
```

### 4. Run

```bash
npm run dev     # http://localhost:3000
```

Sign in with a seeded account (see table below).

### Demo accounts

| Role           | Email                    | Password       |
| -------------- | ------------------------ | -------------- |
| Platform admin | `admin@clothify.local`   | `ChangeMe!123` |
| Store owner    | `owner@zahra.local`      | `owner123`     |
| Manager        | `manager@zahra.local`    | `manager123`   |
| Cashier        | `cashier@zahra.local`    | `cashier123`   |
| Stock keeper   | `stock@zahra.local`      | `stock123`     |

## Scripts

| Script                | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Start dev server on :3000                |
| `npm run build`       | Production build                         |
| `npm run start`       | Serve the production build               |
| `npm run lint`        | ESLint                                   |
| `npm run typecheck`   | `tsc --noEmit`                           |
| `npm test`            | Vitest (unit + integration)              |
| `npm run test:unit`   | Vitest unit tests only (no database)     |
| `npm run test:integration` | Vitest integration tests (needs Postgres) |
| `npm run test:e2e`    | Playwright end-to-end tests              |
| `npm run db:push`     | Push schema to the database              |
| `npm run db:generate` | Generate the Prisma client               |
| `npm run db:seed`     | Seed demo data (idempotent)              |
| `npm run db:studio`   | Prisma Studio                            |

## Project structure

```
src/
  app/
    [locale]/(app)/         authenticated app (dashboard, pos, sales, …)
    [locale]/(auth)/        login, register, reset password
    api/                    route handlers (auth, reports CSV export)
  components/               UI: ui/ primitives, feature folders, layout/
  core/                     server domain services (auth, rbac, tenant, audit, subscriptions)
  lib/                      helpers (pricing, inventory, sequence, store-config, format, reports)
  i18n/ , messages/         next-intl config + en/ar translations
prisma/
  schema.prisma             data model
  seed.ts                   idempotent demo seed
tests/                      integration test setup
e2e/                        Playwright specs
```

## Testing

```bash
npm test                  # all Vitest tests (unit + integration)
npm run test:unit         # unit only — pure logic, no database
npm run test:integration  # integration only — needs a local Postgres
npm run test:e2e          # browser E2E (Playwright)
```

The integration suite requires a local Postgres and creates/uses the
`clothify_test` database automatically (see `tests/global-setup.ts` / `tests/prepare-db.ts`).
It retries up to 3 times to tolerate transient module-resolution failures in
memory-constrained sandboxes (`test:integration:once` is a single attempt).

The E2E suite boots its own Next dev server (port 3100) against the same
`clothify_test` database and drives a real Chromium browser (login → POS →
checkout → receipt). Install the browser first with `npx playwright install chromium`.
It requires a host where Chromium's networking works; in restricted sandboxes
where Chromium aborts requests to `localhost` (`net::ERR_ABORTED`) the E2E suite
cannot run.

## Security notes

- All authorization is enforced **server-side** via `requirePermission`.
- Passwords are hashed by Better Auth; no secrets are logged.
- Tenant isolation is enforced on every query by `tenantId` (and `branchIds`
  where applicable).
