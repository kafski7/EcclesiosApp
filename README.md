# Ecclesios

A social platform for the Catholic Church with an integrated Church Management application.
Specs: [docs/blueprint.md](docs/blueprint.md) · [docs/functionality.md](docs/functionality.md) · social UI [docs/social.md](docs/social.md) ·
build plan [docs/todo.md](docs/todo.md) · decisions [docs/decisions.md](docs/decisions.md).

## Status

| Phase                                                                                    | State                                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 0 — Foundations                                                                          | ✅ built                                                   |
| 1 — Database layer                                                                       | ✅ built                                                   |
| 2 — API core (auth, RBAC scope guard, health)                                            | ✅ built                                                   |
| 3 — Social platform skeleton                                                             | ✅ built (shell, routing, PWA, sign-in, self-registration) |
| 3.5 — People & memberships refactor (D-014 – D-018)                                      | ✅ built (migration `0001`)                                |
| 4 — CMS shell + subscriptions (D-019 – D-021)                                            | ✅ built                                                   |
| 5.1 — Readings (D-022)                                                                   | ✅ built                                                   |
| 5.2 — Bible (D-023, D-024)                                                               | ✅ built                                                   |
| 5.3 — Saints (D-025)                                                                     | ✅ built                                                   |
| 5.4 — Hymnal + media (D-026)                                                             | ✅ built                                                   |
| 5.5 — Podcasts (D-027 – D-029)                                                           | ✅ built                                                   |
| 5.6 — Teachings (D-030)                                                                  | ✅ built                                                   |
| 5.7 — Explore (D-031)                                                                    | ✅ built                                                   |
| 5.8 — News + Home (D-032 – D-034)                                                        | ✅ built                                                   |
| 5.9 — Likes, saves, shares, comment rules (D-035)                                        | ✅ built                                                   |
| 5.10 — Books (D-036)                                                                     | ✅ built — run `pnpm db:generate` once (migration `0012`)  |
| 6.1 — Register, requests, birthdays (D-037)                                              | ✅ built — no migration                                    |
| 6.2 — Societies & committees (D-038)                                                     | ✅ built — no migration                                    |
| 6.3 — Accounts, notifications, Users & Roles, Settings (D-039)                           | ✅ built — no migration                                    |
| 6.4 — Groups, roll-ups, collections, accounting link (D-040, D-041)                      | ✅ built — no migration                                    |
| S1 — Social shell: account menu, nav-only sidebar, global search (D-042, docs/social.md) | ✅ built — web only, no migration                          |
| S2 — Social cards, loading/empty/error states, reactions, sign-in return (D-043)         | ✅ built — web only, no migration                          |
| S3 — Home (Continue, Today strip, tabs) & Explore (past events, churches) (D-044)        | ✅ built — web only, no migration                          |
| S4 — Reading & media: text size, Bible verse share, episode pages (D-045)                | ✅ built — web only, no migration                          |
| Layout fixes: light sidebar, Today card in rail, rail scrolling (D-046)                  | ✅ built — web only, no migration                          |
| Brand images: favicons, sidebar mark, sign-in monstrance (D-047) | ✅ built — web only |
| Console brand images (D-048) | ✅ built — no migration |
| S5 — You: join, `/me`, move home church (API + console), Saved/Library/Notifications polish (D-049) | ✅ built — API change, no migration |
| 7 — Workers, SMS/email, Messages & broadcasts, digests, notification preferences (D-050 – D-052) | ✅ built — run `pnpm i` and `pnpm db:generate` once (migration `0013`) |
| 8+                                                                                       | not started                                                |

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
                            # workers run inside the API in dev (WORKERS=1); Redis must be up
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

Readings: `curl localhost:4000/api/public/readings/today` · web `/readings`.

Bible: the seed only has sample verses. To load the real text, download the USFM files of the
World English Bible (Catholic edition) and the Douay-Rheims (e.g. from eBible.org), unzip each into a folder, then:

```bash
pnpm bible:import -- --translation WEBC --dir ./downloads/webc
pnpm bible:import -- --translation DRA  --dir ./downloads/dra
```

Re-run after `pnpm db:seed` (seeding wipes the database). Web: `/bible`, or from a reading's citation.
Keep the downloads in `./downloads/` — it is git-ignored and left out of `pnpm bundle`.

Saints: `curl 'localhost:4000/api/public/saints/today?date=2026-10-04'` · web `/saints`.

Hymnal: `curl 'localhost:4000/api/public/hymnal/hymns?q=NCH%2056'` · web `/hymnal`. Upload recordings, MIDI and
notation in the console (`/admin-login` → Platform → Hymnal). Files go straight from the browser to MinIO
(`docker compose up -d minio minio-init`); the MinIO console is at http://localhost:9001.

Podcasts: `curl localhost:4000/api/public/podcasts` · web `/podcasts`. Publish in the console:
`superadmin@…` → Platform → Podcasts, or `creator@…` (Creator studio). Add an episode, upload its
audio (MinIO must be running), then Publish. Followers get a notification on the first publish.

Explore: web `/explore`. Write as `theresa.pastor@…` (in St Theresa's name) or `akosua.boateng@…`
(content creator) → My posts → New post → Submit. Approve in the console as `superadmin@…`
→ Explore moderation. Comment as any member; church pages at `/explore/churches/<id>`.

Books: web `/books`. Sell as `creator@…` in the console → My books → New book → upload an EPUB → Submit;
approve as `superadmin@…` → Platform → Books. Buy as a member: with `PAYMENTS_GATEWAY=test` (default) the
checkout is a test page with _Pay (test)_. For Hubtel set `PAYMENTS_GATEWAY=hubtel` and the `HUBTEL_*` keys.

API e2e tests (need a seeded DB): `pnpm --filter @ecclesios/api test:e2e`. Contract: functionality §2.3.

## CMS (`apps/admin`)

```bash
pnpm --filter @ecclesios/admin dev     # http://localhost:5174
```

- `/login`: church staff (e.g. `theresa.pastor@…`) → Church Management for the churches they manage.
- `/admin-login`: platform accounts (`superadmin@…`) → platform console (overview, subscriptions, activation).
- Subscription states to try: St Theresa (active), Christ the King (trial, `christ.pastor@…`),
  St Anthony (expired, `anthony.pastor@…`; also blocks its outstation, `agnes.catechist@…`), deans (not gated).

## Web app (`apps/web`)

```bash
pnpm --filter @ecclesios/web dev       # http://localhost:5173
pnpm --filter @ecclesios/web build && pnpm --filter @ecclesios/web preview   # test the PWA install + update prompt
```

The More page shows a live API status line (it calls `/api/health`), which proves the shared-schema
client and CORS are wired.

## Dev seed

| Account                                                       | Login                                 | Where                                |
| ------------------------------------------------------------- | ------------------------------------- | ------------------------------------ |
| Super-Admin                                                   | superadmin@dev.ecclesios.local        | /admin-login (users)                 |
| Creator (podcasts + Explore)                                  | creator@dev.ecclesios.local           | /admin-login (users)                 |
| Parish Administrator                                          | theresa.pastor@dev.ecclesios.local    | /login (members) — St Theresa Parish |
| Outstation Administrator                                      | michael.catechist@dev.ecclesios.local | /login — St Michael Outstation       |
| Dean                                                          | joseph.dean@dev.ecclesios.local       | /login — St Joseph Deanery           |
| Archdiocese Administrator                                     | archdiocese.admin@dev.ecclesios.local | /login                               |
| First-login test (must set password)                          | kofi.asante@dev.ecclesios.local       | /login                               |
| Pending home membership (can sign in; church features locked) | esi.mensah@dev.ecclesios.local        | /login                               |
| Member of two churches (parish + outstation)                  | kofi.asante@dev.ecclesios.local       | /login                               |
| Member content creator (may post on Explore)                  | akosua.boateng@dev.ecclesios.local    | /login                               |

Password for all: `Ecclesios#2026` (change with `SEED_DEV_PASSWORD`). Every group has an Administrator
named `<first>.<last>@dev.ecclesios.local` — see `packages/db/src/seed/data.ts`.

Hierarchy: Sample Province → Sample Metropolitan Archdiocese (own Cathedral Deanery + parish) →
Sample Suffragan Diocese (`metropolitan_visibility = aggregates`) → 2 deaneries → 3 parishes → 4 outstations.
Subscriptions cover every gate state (active / trial / expired); pending collections cover every status.

## Workspace

```
apps/api         NestJS API                                   (Phase 2 ✅)
apps/web         Social platform — React + Tailwind + shadcn  (Phase 3)
apps/admin       CMS + platform console — CoreUI v5 in the kit shell (Phase 4)
apps/mobile      Expo placeholder — not a workspace yet       (Phase 11)
packages/shared  Zod contracts + domain rules (resolveAccess, hierarchy, collections)
packages/db      Drizzle schema, migrations, dev seed
packages/config  tsconfig / ESLint / Prettier / Vitest
tools/bundle.mjs pack/unpack the repo as one Markdown file
docs/            specs — the contract
```

## Scripts

| Command                                                 | Does                                                 |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `pnpm dev` / `build` / `lint` / `typecheck` / `test`    | across the workspace (Turborepo)                     |
| `pnpm db:generate`                                      | schema → new SQL migration in `packages/db/drizzle`  |
| `pnpm db:migrate` / `db:seed` / `db:setup` / `db:reset` | apply migrations / seed / both / wipe                |
| `pnpm db:studio`                                        | Drizzle Studio                                       |
| `pnpm infra:up` / `infra:down` / `infra:reset`          | Docker services (reset wipes volumes)                |
| `pnpm bundle`                                           | write `ecclesios-bundle.md` (all source in one file) |

## Working with the chat assistant

Each build turn returns a patch bundle (unpack over the repo) and a zip. Afterwards run `pnpm bundle`
and attach the fresh `ecclesios-bundle.md` at the start of the next turn.

Conventions: [CONTRIBUTING.md](CONTRIBUTING.md) · secrets: [docs/ops/secrets.md](docs/ops/secrets.md).
