# Ecclesios

A social platform for the Catholic Church with an integrated Church Management application.
Specs: [docs/blueprint.md](docs/blueprint.md) · [docs/functionality.md](docs/functionality.md) ·
build plan [docs/todo.md](docs/todo.md) · decisions [docs/decisions.md](docs/decisions.md).

## Status

| Phase | State |
|---|---|
| 0 — Foundations | ✅ built |
| 1 — Database layer | ✅ built |
| 2 — API core (auth, RBAC scope guard, health) | ✅ built |
| 3 — Social platform skeleton | 🚧 slice 1 built (shell, routing, PWA, API client); slice 2 = sign-in + register |
| 4+ | not started |

## Prerequisites

- Node **22+** (`nvm use`) · pnpm **9+** (`corepack enable`) · Docker + Docker Compose

## First-time setup

```bash
corepack enable
pnpm i
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
cp packages/db/.env.example packages/db/.env
docker compose up -d        # postgres 16, redis 7, minio (+ private bucket)
pnpm db:setup               # migrate + seed (dev only — wipes data)
pnpm format                 # once, before your first commit
pnpm dev                    # API http://localhost:4000/api · web http://localhost:5173
```

Verify:

```bash
pnpm typecheck && pnpm test
docker compose ps           # postgres/redis/minio healthy; minio-init exited 0
pnpm db:studio              # browse the seeded data
```

## Try the API

```bash
curl localhost:4000/api/health
curl -X POST localhost:4000/api/auth/login -H 'content-type: application/json' \
  -d '{"identifier":"theresa.pastor@dev.ecclesios.local","password":"Ecclesios#2026"}'
# the 6-digit code is printed in the API log (dev only) →
curl -X POST localhost:4000/api/auth/verify-otp -H 'content-type: application/json' \
  -d '{"challengeToken":"<from login>","otp":"<code>"}'
curl localhost:4000/api/groups/00000000-0000-4000-8000-000000000110/access -H 'authorization: Bearer <accessToken>'
```

API e2e tests (need a seeded DB): `pnpm --filter @ecclesios/api test:e2e`. Contract: functionality §2.3.

## Web app (apps/web)

```bash
pnpm --filter @ecclesios/web dev       # http://localhost:5173
pnpm --filter @ecclesios/web build && pnpm --filter @ecclesios/web preview   # test the PWA install + update prompt
```

The More page shows a live API status line (it calls `/api/health`), which proves the shared-schema
client and CORS are wired.

## Dev seed

| Account | Login | Where |
|---|---|---|
| Super-Admin | superadmin@dev.ecclesios.local | /admin-login (users) |
| Creator (podcasts + Explore) | creator@dev.ecclesios.local | /admin-login (users) |
| Parish Administrator | theresa.pastor@dev.ecclesios.local | /login (members) — St Theresa Parish |
| Outstation Administrator | michael.catechist@dev.ecclesios.local | /login — St Michael Outstation |
| Dean | joseph.dean@dev.ecclesios.local | /login — St Joseph Deanery |
| Archdiocese Administrator | archdiocese.admin@dev.ecclesios.local | /login |
| First-login test (must set password) | kofi.asante@dev.ecclesios.local | /login |

Password for all: `Ecclesios#2026` (change with `SEED_DEV_PASSWORD`). Every group has an Administrator
named `<first>.<last>@dev.ecclesios.local` — see `packages/db/src/seed/data.ts`.

Hierarchy: Sample Province → Sample Metropolitan Archdiocese (own Cathedral Deanery + parish) →
Sample Suffragan Diocese (`metropolitan_visibility = aggregates`) → 2 deaneries → 3 parishes → 4 outstations.
Subscriptions cover every gate state (active / trial / expired); pending collections cover every status.

## Workspace

```
apps/api         NestJS API                                   (Phase 2 ✅)
apps/web         Social platform — React + Tailwind + shadcn  (Phase 3)
apps/admin       CMS — React + CoreUI v5                      (Phase 4)
apps/mobile      Expo placeholder — not a workspace yet       (Phase 11)
packages/shared  Zod contracts + domain rules (resolveAccess, hierarchy, collections)
packages/db      Drizzle schema, migrations, dev seed
packages/config  tsconfig / ESLint / Prettier / Vitest
tools/bundle.mjs pack/unpack the repo as one Markdown file
docs/            specs — the contract
```

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` / `build` / `lint` / `typecheck` / `test` | across the workspace (Turborepo) |
| `pnpm db:generate` | schema → new SQL migration in `packages/db/drizzle` |
| `pnpm db:migrate` / `db:seed` / `db:setup` / `db:reset` | apply migrations / seed / both / wipe |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm infra:up` / `infra:down` / `infra:reset` | Docker services (reset wipes volumes) |
| `pnpm bundle` | write `ecclesios-bundle.md` (all source in one file) |

## Working with the chat assistant

Each build turn returns a patch bundle (unpack over the repo) and a zip. Afterwards run `pnpm bundle`
and attach the fresh `ecclesios-bundle.md` at the start of the next turn.

Conventions: [CONTRIBUTING.md](CONTRIBUTING.md) · secrets: [docs/ops/secrets.md](docs/ops/secrets.md).
