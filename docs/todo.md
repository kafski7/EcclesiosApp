# Ecclesios v2 — Master Build TODO

> This is the end-to-end build plan for the greenfield rebuild described in `blueprint.md` and `functionality.md`. Work through the phases **in order** — each phase unblocks the next. Check items off as you go; never skip a checklist box inside a phase, because later phases assume earlier ones are done.
>
> Reference docs: `blueprint.md` (architecture, stack, schema, RBAC) · `functionality.md` (per-section functional spec) · `decisions.md` (decision log). The hierarchy is defined in blueprint §3 and functionality §5.

---

## Phase 0 — Foundations & Repository Setup

- [x] Create fresh repo (`ecclesios`) and copy in `docs/` (blueprint.md, functionality.md, todo.md, decisions.md)
- [x] Initialise **pnpm workspaces + Turborepo** monorepo: `turbo.json`, `pnpm-workspace.yaml`, root `package.json`
- [x] Scaffold `packages/config` — shared ESLint, Prettier, `tsconfig` (strict mode), shared Vitest config
- [x] Create empty workspace apps: `apps/api`, `apps/web`, `apps/admin`; placeholder `apps/mobile/` (Phase-2 slot, do not build)
- [x] Create `packages/shared` — Zod schemas + TS types; wire it as a dependency of all three apps
- [x] `docker-compose.yml` for dev: **postgres 16+, redis, minio** (per blueprint §6)
- [x] Environment conventions: `.env.example` for every app; **no secrets in code**; secret management plan for prod
- [x] CI skeleton (GitHub Actions): lint + typecheck + unit tests on every PR; Turborepo remote cache optional
- [x] Define Git conventions: branch naming, conventional commits, PR template
- [x] `tools/bundle.mjs` — pack/unpack the repo source as a single Markdown file (for chat hand-off)
- [x] Write `README.md`: setup steps (`pnpm i`, `docker compose up -d`, `pnpm dev`), workspace layout, links to docs

## Phase 1 — Database Layer (`packages/db`)

- [x] Set up **Drizzle ORM + drizzle-kit** in `packages/db`; configure `generate → review → migrate` workflow
- [x] Schema: **hierarchy** — `hierarchy_level_enum`, `groups` (self-referencing `parent_group_id` tree + materialised `path`), `group_settings` incl. `metropolitan_visibility` *(blueprint §3.4–3.5, §7)*
- [x] Schema: **RBAC** — `roles`, `permissions`, `role_permissions`
- [x] Shared: `resolveAccess` + hierarchy rules in `packages/shared`, with table-driven tests *(blueprint §3.5)*
- [x] Schema: **identity** — `users` (+ `platform_role`, `user_privileges`), `members` (OTP, temp-token, password-reset, refresh-token columns; argon2id hashing is app-side)
- [x] Schema: **CMS operational** — `societies`, `society_members` (with `is_committee` flag handling), `subscription_types`, `subscriptions`, `notification_types`, `notifications`, `audit_logs`, `themes`, `currencies`, `languages`, `icons`
- [x] Schema: **thin accounting linkage** — `external_accounting_refs` *(blueprint §7 "Out of scope")*
- [x] Schema: **`pending_collections`** staging table + status state machine *(blueprint §8.1)*
- [x] Schema: **subscriptions/plans** — Basic / Premium / Ultimate seed data *(functionality §4.11)*
- [x] Indexes & constraints review: FKs on all hierarchy edges, unique constraints (emails/phones per table), composite indexes for group-scoped queries
- [x] Seed scripts (dev-only, wipe-and-reload): 4 church roles + permissions (platform roles are a `users` enum), themes, GHS currency, English language, icons, sample groups (1 province → 1 metropolitan archdiocese → 1 suffragan diocese → 2 deaneries → 3 parishes → outstations, plus 1 archdiocesan deanery), sample users/members/societies
- [x] Verify: first migration applies cleanly on a fresh Postgres container; seed script runs
- [x] **Do NOT create**: v1 accounting tables (chart_of_accounts, journal_entries, invoices/bills/payments, assets, etc.) — out of scope

## Phase 2 — API Core (`apps/api`, NestJS)

- [x] Scaffold NestJS app; module layout per blueprint §5: `auth`, `rbac`, `cms`, `social` (content), `subscriptions`, `media`
- [x] Wire Drizzle into NestJS (DI provider); health-check endpoint hitting the DB
- [x] **Auth module** *(functionality §2)*:
    - [x] `POST /api/auth/admin-login` — validates against `users` (email or telephone)
    - [x] `POST /api/auth/login` — validates against `members`
    - [x] Both: argon2id verify → generate 6-digit OTP (10-min expiry, single-use) → store → send (console log until gateway)
    - [x] `POST /api/auth/verify-otp` — clears OTP; if `first_login` is NULL → return 15-min `tempToken`; else issue JWT access + refresh tokens
    - [x] `POST /api/auth/set-password` — verifies tempToken, hashes new password, sets `first_login = NOW()`
    - [x] Refresh-token endpoint; logout (revoke)
    - [x] **Rate limiting** on all four endpoints (per IP + per identifier) *(functionality §6)*
- [x] **RBAC scope guard** *(blueprint §3.2, functionality §5)*:
    - [x] JWT payload carries `{ id, role, group_id, hierarchy_level }`
    - [x] Scope resolution via the materialised `groups.path` (prefix match → caller's permitted descendant scope) + `resolveAccess` from `@ecclesios/shared` (§3.5)
    - [x] Guard decorator: `@Scope({ need })` — capability-based (D-008) — enforcing own-scope write / descendant-scope read per the §3.3 matrix
    - [x] Reject + audit cross-group access attempts *(functionality §6 "Data isolation")*
- [x] Cross-cutting: **pino** structured logging, **helmet**, global Zod validation pipe, standard error filter (consistent error envelope)
- [x] `packages/shared`: define request/response Zod schemas for every auth endpoint; consume them in the controllers
- [x] E2E tests (Supertest): full login flow for both auth tables; first-login/set-password path; rate-limit triggers; RBAC scope matrix
- [x] Verify on a real machine: `pnpm --filter @ecclesios/api test:e2e` passes against a seeded database (also runs in CI)

## Phase 3 — Social Platform Skeleton (`apps/web`)

- [x] Scaffold React + Vite + TypeScript; **Tailwind CSS**; install & configure **shadcn/ui**
- [x] **TanStack Query** provider + API client (typed by `packages/shared`); **Zustand** store for session/theme client state
- [ ] Routing: `/` Home · `/readings` · `/saints` · `/explore` · `/podcasts` · `/hymnal` · `/teachings` · `/bible` · `/more`
- [ ] App shell: primary nav (the 9 sections), footer; consumer-grade look — **not** a dashboard layout *(blueprint §2.1)*
- [ ] **More off-canvas** *(functionality §3.9)*: Subscribe entry, Notifications link, CMS Login link, account actions, about/privacy/terms
- [ ] Register flow (member self-registration → lands in `members`)
- [ ] PWA setup: Vite PWA plugin, installable manifest, basic service worker *(blueprint §5 Mobile Strategy)*
- [ ] Placeholder pages for each section (fleshed out in Phase 5)

## Phase 4 — CMS Shell (`apps/admin`) + Subscriptions

- [ ] Scaffold React + Vite + **CoreUI v5**; TanStack Query + Zustand; same shared API client
- [ ] Routing: `/admin-login` → `/admin/*` (AdminLayout); public pages 404/500
- [ ] Login page hitting `/api/auth/admin-login` (OTP flow UI incl. SetPassword page) *(functionality §2.1)*
- [ ] **Subscription gate** *(functionality §6)*: middleware/redirect to "not subscribed" state when subscription expired
- [ ] **Subscriptions module (API + admin UI)** *(functionality §4.11)*:
    - [ ] Choose plan (Basic/Premium/Ultimate), trial activation, expiry tracking
    - [ ] Renew/upgrade flow; SMS balance tracking
    - [ ] Subscription held at **parish level (covers outstations)** per functionality §6
- [ ] CMS sidebar per role + hierarchy level (permission-filtered) *(blueprint §3.3)*
- [ ] **Super-Admin dashboard** (`users`-based): platform overview, subscription list, moderation queue link
- [ ] Role-based landing: Super-Admin → platform dashboard; others → group dashboard *(functionality §6)*

## Phase 5 — Social Content Modules (API + web, in this order)

### 5.1 Readings *(functionality §3.2)*
- [ ] Schema: `reading_days` + `readings` (first reading, psalm, second reading, gospel; season & feast metadata) — Drizzle migration
- [ ] API: by-date lookup (today / pick date), liturgical-season context; admin CRUD for the calendar
- [ ] Seed: at least 2 weeks of readings for dev
- [ ] Web: Readings page — date navigation (prev/today/next + date picker), season badge, scripture display, deep-links into the Bible

### 5.2 Bible *(functionality §3.8)*
- [ ] Schema: `bible_translations`, `bible_books`, `bible_verses`
- [ ] **Licensing**: start with a public-domain translation for dev; plan API.Bible integration for GNB *(blueprint §7)*
- [ ] API: book → chapter → verse endpoints; search; translation list
- [ ] Web: Bible reader (book/chapter nav, verse-per-line, search); cross-link targets for Readings/Saints/Teachings
- [ ] Offline: cache chapters in **IndexedDB (Dexie)**; "download translation" storage model *(functionality §6)*

### 5.3 Saints *(functionality §3.3)*
- [ ] Schema: `saints` (feast day, patronage, biography) + saint-of-the-day schedule
- [ ] API: today's saint(s); searchable directory; full-text search (`tsvector`)
- [ ] Web: Saint of the Day card (Home + Saints page); directory with search; saint detail page

### 5.4 Hymnal *(functionality §3.6)*
- [ ] Schema: `hymns` (lyrics, number, season/occasion metadata), `hymn_media` (audio/MIDI), `hymn_notations` (staff/solfa files) — **object-storage keys only**
- [ ] Media module: presigned upload/download URLs (MinIO in dev) *(blueprint §5)*
- [ ] API: browse/search by title, season, hymn number
- [ ] Web: Hymnal browser; hymn detail (lyrics, audio player, MIDI link, downloadable notation PDFs)
- [ ] Super-Admin: hymn + media management screens

### 5.5 Podcasts *(functionality §3.5)*
- [ ] Schema: `podcasts` (series), `podcast_episodes` (audio object key, show notes, publisher ref)
- [ ] **Privilege grant**: "can post podcasts" flag/grant on `users` accounts, assignable by Super-Admin *(functionality §1 note)*
- [ ] API: list/stream episodes; publish endpoints gated to platform admin + granted accounts; follow-series + new-episode notification fan-out (BullMQ)
- [ ] Web: podcast browser, series pages, episode player, follow buttons

### 5.6 Teachings *(functionality §3.7)*
- [ ] Schema: `teaching_topics`, `teachings` (long-form, cross-linked)
- [ ] API: topic taxonomy, search, related-teaching links; admin CRUD
- [ ] Web: topic browsing, search, reading view

### 5.7 Explore *(functionality §3.4)*
- [ ] Schema: `posts`, `events` (types: church profile, priest profile, event, educational content; moderation state)
- [ ] API: authoring endpoints **gated to privileged accounts**; moderation queue endpoints for Super-Admin
- [ ] Web: authoring UI (for churches/priests/PYC executives); public browsing of approved content
- [ ] Super-Admin: moderation queue (approve/reject with audit logging) *(functionality §6)*

### 5.8 Home feed *(functionality §3.1)*
- [ ] API: blended feed endpoint (events, saint of the day, hymn highlights, new teachings, latest episodes, approved Explore posts); personalised for signed-in members (church/society content)
- [ ] Web: Home landing assembling section cards with deep links

## Phase 6 — CMS Operational Modules (API + admin)

- [ ] **Groups/Branch management** *(functionality §4.13)*: create/edit groups in the hierarchy; **context switcher** that re-scopes the whole CMS (nav, dashboards, data) per selected group + hierarchy level
- [ ] **Members** *(functionality §4.2)*: CRUD, personal + sacramental records, photo (object storage), deceased flag, society affiliations, profile page, print/export
- [ ] **Birthdays** *(functionality §4.3)*: today's celebrants + upcoming
- [ ] **Societies** *(functionality §4.4)*: CRUD + membership rosters
- [ ] **Committees** *(functionality §4.5)*: committee-flagged societies, separate roster management
- [ ] **Metropolitan visibility setting** UI for suffragan dioceses *(functionality §5.3)*
- [ ] **Pending collections**: outstation entry → parish approval queue → BullMQ sync to accounting API *(blueprint §8.1)*
- [ ] **Hierarchy-scoped data rules** *(functionality §5)* — implement and test per module:
    - [ ] Own-group full CRUD everywhere
    - [ ] Parish → outstation: view/approve/override records; **transaction approval queue**
    - [ ] Deanery → parishes: read-only monitoring (stats, registers, activity, financial summaries)
    - [ ] Diocese → deaneries: aggregated monitoring
    - [ ] Province → national: aggregated reporting
    - [ ] No lateral/upward access (automated tests for each denial)
- [ ] **Notifications** *(functionality §4.6)*: notification center API + admin UI, read/unseen tracking, system-event generation
- [ ] **Users & Roles** *(functionality §4.8)*: church-level user CRUD, role + permission assignment, activation/deactivation
- [ ] **Profile Settings** *(functionality §4.9)*: own photo, password change, details
- [ ] **Themes & Settings** *(functionality §4.10)*: theme selection, language, currency display, operational toggles
- [ ] **Dashboard** *(functionality §4.1)*: per-level dashboard (own stats + roll-ups per hierarchy scope)
- [ ] **Accounting linkage** *(functionality §4.12)*: read-only financial summaries fetched from the external accounting API (can stub the external service for now); outstation collections recorded locally → parish approval queue
- [ ] E2E tests: role × level access matrix from blueprint §3.3

## Phase 7 — Communication

- [ ] **BullMQ + Redis** infrastructure: queues, workers, retries; nothing inline in request handlers *(functionality §6)*
- [ ] **SMS/Email gateway integration** (also replaces console-log OTP delivery) *(blueprint §6)*
- [ ] **Messages module** *(functionality §4.7)*: compose SMS/email, recipient selection (members/societies/committees), delivery log, SMS balance consumption
- [ ] **Cross-level broadcasts** *(blueprint §3.3)*: parish → own outstations; deanery → parishes; diocesan; national — enforce in the scope guard
- [ ] Birthday digest worker (daily job) + notification fan-out worker
- [ ] Follow/new-episode podcast notifications wired to the same worker infra

## Phase 8 — Platform Administration (Super-Admin)

- [ ] Platform reference-data management: themes, subscription plans, icons, currencies, languages *(blueprint §4 User Types)*
- [ ] Creator/podcast privilege management UI (grant/revoke per account)
- [ ] Explore moderation queue (full flow with audit trail)
- [ ] Church subscription management: list churches, plans, expiries; manual interventions
- [ ] Platform audit-log browser *(functionality §6)*

## Phase 9 — Hardening, Offline & PWA Polish

- [ ] Security review: rate limits tuned, auth token lifetimes, object-storage presign expiry, CORS allowlist *(blueprint §6)*
- [ ] **Redis-backed rate-limit store** (replaces the in-memory store) before running more than one API instance *(apps/api/src/auth/core/rate-limit.ts)*
- [ ] **`sessions` table** for multi-device refresh tokens (D-007)
- [ ] **PWA polish**: offline app shell, offline readings/Bible/hymns via IndexedDB, update prompts *(functionality §6)*
- [ ] Full-text search audit (`tsvector`/`pg_trgm`) across saints, hymns, teachings, Bible *(blueprint §6)*
- [ ] Audit-trail coverage check: logins, oversight actions, moderation, messaging all recorded
- [ ] Performance pass: feed pagination, N+1 audit on group-scoped queries, DB indexes verified under realistic seed volume
- [ ] Accessibility pass on the social platform (keyboard nav, contrast, screen-reader labels)
- [ ] Cross-browser/device testing incl. low-end Android for the PWA

## Phase 10 — Deployment & Launch

- [ ] Production infrastructure: managed Postgres, Redis, S3/R2 bucket, API container hosting, static hosting for `web` + `admin`
- [ ] Environment & secrets management for prod (no `.env` files in deploy artifacts)
- [ ] Database migration strategy for prod (drizzle-kit `migrate` in release pipeline; backups + restore rehearsal)
- [ ] Monitoring: pino log aggregation, error tracking (e.g. Sentry), uptime checks, BullMQ queue depth alerts
- [ ] Domain + TLS; CORS/origins per app (`web`, `admin`); PWA install banners verified on prod
- [ ] Seed production reference data: roles, themes, currencies, **first real province → diocese → deanery → parish hierarchy**
- [ ] **Bible licensing in place (GNB) before public launch** or launch with the public-domain translation clearly labelled *(blueprint §7)*
- [ ] Pilot: onboard one parish + its outstations end-to-end (subscribe → create users → members → societies → messaging → approval queue)
- [ ] Post-pilot fixes; then general availability

## Phase 11 — Mobile (Phase 2 — after web launch)

- [ ] Scaffold `apps/mobile` with **Expo (React Native)**; NativeWind with the shared Tailwind tokens *(blueprint §5, §6)*
- [ ] Reuse `packages/shared` types + API client for the mobile app
- [ ] Social platform surfaces: Home, Readings, Saints, Hymnal (audio), Podcasts, Bible, Teachings, Explore (browse)
- [ ] **Push notifications**: Expo push, opt-in channels (Saint of the Day, daily Readings, new episodes, society messages, birthdays) *(functionality §6)*
- [ ] Offline: resumable downloads (Expo FileSystem/SQLite); downloaded Bible translations on-device
- [ ] App Store / Play Store accounts, builds, review compliance
- [ ] **No CMS in the app** — scope discipline per blueprint §5

---

## Standing Rules (apply at every phase)

1. **Docs are the contract** — if an implementation choice contradicts `blueprint.md`/`functionality.md`, update the doc first, then the code.
2. **Never add the v1 accounting stack.** Financial summaries come from the external API; store only external reference IDs.
3. **Every API change goes through `packages/shared`** (Zod + types) before touching consumers.
4. **Schema changes only via drizzle-kit migrations** — never edit live tables or rely on reset scripts outside dev.
5. **All binaries → object storage; all slow work → BullMQ workers.** No exceptions added later either.
6. **Every module ships with its RBAC tests** (own-scope CRUD + each hierarchy-level denial) before moving to the next phase.
7. **OTP/auth endpoints are rate-limited from day one**, not added later.
