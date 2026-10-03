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
- [x] Schema: **hierarchy** — `hierarchy_level_enum`, `groups` (self-referencing `parent_group_id` tree + materialised `path`), `group_settings` incl. `metropolitan_visibility` _(blueprint §3.4–3.5, §7)_
- [x] Schema: **RBAC** — `roles`, `permissions`, `role_permissions`
- [x] Shared: `resolveAccess` + hierarchy rules in `packages/shared`, with table-driven tests _(blueprint §3.5)_
- [x] Schema: **identity** — `users` (+ `platform_role`, `user_privileges`), `members` (OTP, temp-token, password-reset, refresh-token columns; argon2id hashing is app-side)
- [x] Schema: **CMS operational** — `societies`, `society_members` (with `is_committee` flag handling), `subscription_types`, `subscriptions`, `notification_types`, `notifications`, `audit_logs`, `themes`, `currencies`, `languages`, `icons`
- [x] Schema: **thin accounting linkage** — `external_accounting_refs` _(blueprint §7 "Out of scope")_
- [x] Schema: **`pending_collections`** staging table + status state machine _(blueprint §8.1)_
- [x] Schema: **subscriptions/plans** — Basic / Premium / Ultimate seed data _(functionality §4.11)_
- [x] Indexes & constraints review: FKs on all hierarchy edges, unique constraints (emails/phones per table), composite indexes for group-scoped queries
- [x] Seed scripts (dev-only, wipe-and-reload): 4 church roles + permissions (platform roles are a `users` enum), themes, GHS currency, English language, icons, sample groups (1 province → 1 metropolitan archdiocese → 1 suffragan diocese → 2 deaneries → 3 parishes → outstations, plus 1 archdiocesan deanery), sample users/members/societies
- [x] Verify: first migration applies cleanly on a fresh Postgres container; seed script runs
- [x] **Do NOT create**: v1 accounting tables (chart_of_accounts, journal_entries, invoices/bills/payments, assets, etc.) — out of scope

## Phase 2 — API Core (`apps/api`, NestJS)

- [x] Scaffold NestJS app; module layout per blueprint §5: `auth`, `rbac`, `cms`, `social` (content), `subscriptions`, `media`
- [x] Wire Drizzle into NestJS (DI provider); health-check endpoint hitting the DB
- [x] **Auth module** _(functionality §2)_:
  - [x] `POST /api/auth/admin-login` — validates against `users` (email or telephone)
  - [x] `POST /api/auth/login` — validates against `members`
  - [x] Both: argon2id verify → generate 6-digit OTP (10-min expiry, single-use) → store → send (console log until gateway)
  - [x] `POST /api/auth/verify-otp` — clears OTP; if `first_login` is NULL → return 15-min `tempToken`; else issue JWT access + refresh tokens
  - [x] `POST /api/auth/set-password` — verifies tempToken, hashes new password, sets `first_login = NOW()`
  - [x] Refresh-token endpoint; logout (revoke)
  - [x] **Rate limiting** on all four endpoints (per IP + per identifier) _(functionality §6)_
- [x] **RBAC scope guard** _(blueprint §3.2, functionality §5)_:
  - [x] JWT payload carries `{ id, role, group_id, hierarchy_level }`
  - [x] Scope resolution via the materialised `groups.path` (prefix match → caller's permitted descendant scope) + `resolveAccess` from `@ecclesios/shared` (§3.5)
  - [x] Guard decorator: `@Scope({ need })` — capability-based (D-008) — enforcing own-scope write / descendant-scope read per the §3.3 matrix
  - [x] Reject + audit cross-group access attempts _(functionality §6 "Data isolation")_
- [x] Cross-cutting: **pino** structured logging, **helmet**, global Zod validation pipe, standard error filter (consistent error envelope)
- [x] `packages/shared`: define request/response Zod schemas for every auth endpoint; consume them in the controllers
- [x] E2E tests (Supertest): full login flow for both auth tables; first-login/set-password path; rate-limit triggers; RBAC scope matrix
- [x] Verify on a real machine: `pnpm --filter @ecclesios/api test:e2e` passes against a seeded database (also runs in CI)

## Phase 3 — Social Platform Skeleton (`apps/web`)

- [x] Scaffold React + Vite + TypeScript; **Tailwind CSS**; install & configure **shadcn/ui**
- [x] **TanStack Query** provider + API client (typed by `packages/shared`); **Zustand** store for session/theme client state
- [x] Routing: `/` Home · `/readings` · `/saints` · `/explore` · `/podcasts` · `/hymnal` · `/teachings` · `/bible` · `/more`
- [x] App shell: primary nav (the 9 sections), footer; consumer-grade look — **not** a dashboard layout _(blueprint §2.1)_
- [x] **More off-canvas** _(functionality §3.9)_: Subscribe entry, Notifications link, CMS Login link, account actions, about/privacy/terms
- [x] Register flow (member self-registration → lands in `members` as PENDING in the chosen parish — D-011)
- [x] Sign-in screen: password → 6-digit code → first-time set password; session restore (D-012); x.com-style layout (D-013)
- [x] PWA setup: Vite PWA plugin, installable manifest, basic service worker _(blueprint §5 Mobile Strategy)_
- [x] Placeholder pages for each section (fleshed out in Phase 5)

## Phase 3.5 — People & Memberships refactor (D-014 – D-018)

- [x] Docs: decisions D-014 – D-018; functionality §1, §2.4, §2.5, §3.4; blueprint §3.2, §3.5, §4, §7
- [x] Shared: `memberships.ts` (status machine, `resolveMemberAccess`, `canDecideMembership`, home-church rules) and `explore.ts` (posting rules) with tests
- [x] Schema: `members` = person; new `memberships`, `follows`, `home_transfers`, `member_privileges`
- [x] Ship the refactor as migration `0001` (D-018, revised) and run `pnpm db:setup` on a real machine
- [x] Seed: home memberships for everyone, an extra church for Kofi, a pending outstation request (Yaw), follows, a member content creator (Akosua)
- [x] Auth: tokens name the person only; pending memberships never block sign-in
- [x] Scope guard: access from ACTIVE memberships; new `memberContent` capability; `GET /api/groups/:id/member-access`
- [x] API: `GET /api/public/churches` (parishes + outstations), register with a church, `GET /api/me`, join / leave / follow / unfollow, membership requests + approve/reject (church Administrator or parish backup)
- [x] Web: church picker (parishes + outstations), immediate sign-in after registration, pending-membership banner, sidebar shows the person and home church
- [x] Verify on a real machine: typecheck, unit tests, API e2e

## Phase 4 — CMS Shell (apps/admin) + Subscriptions

- [x] Scaffold React + Vite + **CoreUI v5** inside the UI-kit admin shell (D-019); TanStack Query + Zustand; same shared API client
- [x] Routing: `/login` (church staff) → `/admin/*`; `/admin-login` (platform) → `/platform/*`; 404 and error (500) pages
- [x] Login pages for both doors: password → code → set password _(functionality §2.1–2.2)_; separate CMS session (D-012)
- [x] **CMS contexts** + church switcher: `GET /api/cms/contexts` (D-020)
- [x] **Subscription gate** _(functionality §6, D-020)_: `@RequiresSubscription` → 402; not-subscribed page in the CMS (Billing stays open)
- [x] **Subscriptions module (API + admin UI)** _(functionality §4.11, D-021)_:
  - [x] Plans (`GET /api/public/plans`); one-time free trial started by the parish Administrator
  - [x] Expiry tracking (date-based state, expiring-soon banner); SMS balance shown
  - [x] Renew / upgrade: Super-Admin activation with a payment reference; days and SMS carry over
  - [x] Subscription held at **parish level (covers outstations)**
  - [ ] Online payment (mobile money / card) — replaces manual activation _(when a provider is chosen)_
  - [ ] Daily job: expiry reminders to Administrators _(Phase 7, BullMQ)_
- [x] CMS sidebar per role + hierarchy level _(blueprint §3.3)_ — `apps/admin/src/nav.ts`, with tests
- [x] Church dashboard counters: `GET /api/cms/groups/:id/dashboard`
- [x] **Super-Admin console**: platform overview, subscription list, activation / renewal; moderation, creators and reference data are placeholders (Phase 5.7 / 8)
- [x] Role-based landing: platform accounts → `/platform`; church staff → `/admin`; Parishioners → "no church to manage" _(functionality §6)_
- [x] API e2e: contexts, gate (active / trial / expired / outstation / monitoring / scope before gate), trial, activation, renewal carry-over
- [x] Verify on a real machine: `pnpm i`, typecheck, unit tests, API e2e, click through `apps/admin`
- [x] E2E hygiene: test app listens on a real port; CMS spec fetches tokens before building requests

## Phase 5 — Social Content Modules (API + web, in this order)

### 5.1 Readings _(functionality §3.2, D-022)_

- [x] Shared: liturgical calendar rules (`liturgy.ts`: computus, seasons, colours, Sunday A/B/C and weekday I/II cycles) with tests; `ReadingDay` contract
- [x] Schema: `reading_days` + `readings` (first reading, psalm, second reading, alleluia, gospel; celebration, colour override, source credit) — migration `0002` generated on your machine
- [x] API: `GET /api/public/readings/:date|today` (computed context even when not loaded); `PUT /api/platform/readings/:date` for Super-Admins
- [x] Seed: 2 weeks around the seed date — sample citations, labelled placeholder text (licensing)
- [x] Web: Readings page — prev / today / next + date picker, season and cycle chips, one tab per reading, citation links into the Bible
- [ ] Admin UI for the readings calendar (Super-Admin) *(Phase 8, reference data)*
- [ ] Licensed lectionary text source chosen and loaded *(Phase 10, before launch — D-022)*

### 5.2 Bible _(functionality §3.8, D-023)_

- [x] Shared: 73-book Catholic canon, book names/abbreviations, citation parser (`bible.ts`) and USFM reader (`usfm.ts`), with tests
- [x] Schema: `bible_translations` (licence, default, offline flag) + `bible_verses` (words of Jesus, full-text index) — migration `0003` generated on your machine
- [x] **Translations**: World English Bible Catholic (WEBC, default) + Douay-Rheims (DRA), public domain; GNB later as another row once licensed
- [x] Importer: `pnpm bible:import -- --translation WEBC --dir <usfm folder>`; seed has labelled sample verses
- [x] API: translations, books, chapter (prev/next), search
- [x] Web: reader with translation picker, book/chapter selectors, text size, search, `?ref=` deep links from Readings with highlights, words of Jesus in burgundy
- [x] Offline: chapters already opened are stored in IndexedDB (Dexie) for translations that allow it
- [x] Psalm numbering per translation (Douay-Rheims uses Vulgate numbers) — D-024
- [x] Importer verified against the real WEBC and DRA files (73 books each)
- [ ] Download a whole translation for offline reading *(Phase 9, PWA polish)*
- [ ] Load the full WEBC and DRA text on each environment (run the importer) — and before launch *(Phase 10)*

### 5.3 Saints _(functionality §3.3, D-025)_

- [x] Shared: feast dates, ranks, saint-of-the-day ordering (`saints.ts`) with tests; saint contracts
- [x] Schema: `saints` (fixed feast, rank, title, summary, patronage, born/died, biography, image key, published) — migration `0004` generated on your machine
- [x] Seed: 36 saints with short original biographies (African saints included; full coverage around October)
- [x] API: saint of the day for a local date; directory with search and month filter; saint page; Super-Admin upsert/unpublish
- [x] Web: Saint of the Day card (Home + Saints), directory with search and month pills, saint detail page
- [x] Portraits via object storage (media module, 5.4) — upload UI in Phase 8
- [ ] Links from a saint to readings and hymns *(after Hymnal, 5.4)*
- [ ] Admin UI for saints *(Phase 8, reference data)*; grow the directory to the full General Roman Calendar before launch

### 5.4 Hymnal _(functionality §3.6, D-026)_

- [x] Shared: hymnal rules (`hymnal.ts`: number/book query parsing, number ordering, country-first books, media access defaults and paywall check, YouTube link parsing) with tests; hymnal contracts
- [x] Schema: `hymn_books`, `hymns` (full-text index), `hymn_numbers` (unique per book), `hymn_tags`, `hymn_tunes` (one default), `hymn_media` (object key or YouTube id, access level, one default recording per tune) — migration `0005` generated on your machine
- [x] Media module: presigned PUT/GET (MinIO in dev), type and size checks, HEAD before registering an upload _(blueprint §5)_
- [x] Seed: NCH and CH books; five public-domain hymns with NCH numbers, one with two tunes
- [x] API: books; search by number / book + number / first line / lyrics / tag; browse a book in order; hymn page; short-lived media URLs with access check
- [x] Web: Hymnal browser (search, book and season filters, load more) and hymn page (numbers, lyrics, tune tabs, play / open / download, embedded YouTube, locked items)
- [x] Super-Admin console: hymn list, hymn editor (words, numbers, tags, source, publish), tunes, uploads, YouTube links, access and default switches
- [x] Saint portraits through the same media module (API; console UI in Phase 8)
- [ ] Bucket CORS and lifecycle rules for production storage _(Phase 10)_
- [ ] Permission from the NCH/CH publisher before uploading hymnal arrangements and scores _(before launch)_
- [ ] Personal (listener) subscriptions, paywall on, **playlists and play queues** _(later phase — D-026)_
- [ ] Links from saints and feasts to hymns

### 5.5 Podcasts _(functionality §3.5)_

- [ ] Schema: `podcasts` (series), `podcast_episodes` (audio object key, show notes, publisher ref)
- [ ] **Privilege grant**: "can post podcasts" flag/grant on `users` accounts, assignable by Super-Admin _(functionality §1 note)_
- [ ] API: list/stream episodes; publish endpoints gated to platform admin + granted accounts; follow-series + new-episode notification fan-out (BullMQ)
- [ ] Web: podcast browser, series pages, episode player, follow buttons

### 5.6 Teachings _(functionality §3.7)_

- [ ] Schema: `teaching_topics`, `teachings` (long-form, cross-linked)
- [ ] API: topic taxonomy, search, related-teaching links; admin CRUD
- [ ] Web: topic browsing, search, reading view

### 5.7 Explore _(functionality §3.4)_

- [ ] Schema: `posts`, `events` (types: church profile, priest profile, event, educational content; moderation state); author = person or church (D-017); `comments`
- [ ] API: authoring endpoints gated by `canPostAsSelf` / `canPostAsChurch` (D-017); comments for any signed-in person; moderation queue endpoints for Super-Admin
- [ ] Web: authoring UI (for churches/priests/PYC executives); public browsing of approved content
- [ ] Super-Admin: moderation queue (approve/reject with audit logging) _(functionality §6)_

### 5.8 Home feed _(functionality §3.1)_

- [ ] API: blended feed endpoint (events, saint of the day, hymn highlights, new teachings, latest episodes, approved Explore posts); personalised for signed-in members (church/society content)
- [ ] Web: Home landing assembling section cards with deep links

## Phase 6 — CMS Operational Modules (API + admin)

- [ ] **Groups/Branch management** _(functionality §4.13)_: create/edit groups in the hierarchy; **context switcher** that re-scopes the whole CMS (nav, dashboards, data) per selected group + hierarchy level
- [ ] **Members** _(functionality §4.2)_: CRUD, personal + sacramental records, photo (object storage), deceased flag, society affiliations, profile page, print/export
- [ ] **Membership requests UI** _(functionality §2.5, D-016)_: Members → Requests for the church (and its outstations for a parish); approve or reject with a reason (API done in Phase 3.5)
- [ ] **Home-church transfers** _(D-016)_: request from the member's profile; receiving church (or parish) approves; previous home notified; sacramental-record edit rights move
- [ ] **Roles per membership** in Users & Roles: change a person's role in this church only
- [ ] **Birthdays** _(functionality §4.3)_: today's celebrants + upcoming
- [ ] **Societies** _(functionality §4.4)_: CRUD + membership rosters
- [ ] **Committees** _(functionality §4.5)_: committee-flagged societies, separate roster management
- [ ] **Metropolitan visibility setting** UI for suffragan dioceses _(functionality §5.3)_
- [ ] **Pending collections**: outstation entry → parish approval queue → BullMQ sync to accounting API _(blueprint §8.1)_
- [ ] **Hierarchy-scoped data rules** _(functionality §5)_ — implement and test per module:
  - [ ] Own-group full CRUD everywhere
  - [ ] Parish → outstation: view/approve/override records; **transaction approval queue**
  - [ ] Deanery → parishes: read-only monitoring (stats, registers, activity, financial summaries)
  - [ ] Diocese → deaneries: aggregated monitoring
  - [ ] Province → national: aggregated reporting
  - [ ] No lateral/upward access (automated tests for each denial)
- [ ] **Notifications** _(functionality §4.6)_: notification center API + admin UI, read/unseen tracking, system-event generation
- [ ] **Users & Roles** _(functionality §4.8)_: church-level user CRUD, role + permission assignment, activation/deactivation
- [ ] **Profile Settings** _(functionality §4.9)_: own photo, password change, details
- [ ] **Themes & Settings** _(functionality §4.10)_: theme selection, language, currency display, operational toggles
- [ ] **Dashboard** _(functionality §4.1)_: per-level dashboard (own stats + roll-ups per hierarchy scope)
- [ ] **Accounting linkage** _(functionality §4.12)_: read-only financial summaries fetched from the external accounting API (can stub the external service for now); outstation collections recorded locally → parish approval queue
- [ ] E2E tests: role × level access matrix from blueprint §3.3

## Phase 7 — Communication

- [ ] **BullMQ + Redis** infrastructure: queues, workers, retries; nothing inline in request handlers _(functionality §6)_
- [ ] **SMS/Email gateway integration** (also replaces console-log OTP delivery) _(blueprint §6)_
- [ ] **Messages module** _(functionality §4.7)_: compose SMS/email, recipient selection (members/societies/committees), delivery log, SMS balance consumption
- [ ] **Cross-level broadcasts** _(blueprint §3.3)_: parish → own outstations; deanery → parishes; diocesan; national — enforce in the scope guard
- [ ] Birthday digest worker (daily job) + notification fan-out worker
- [ ] Follow/new-episode podcast notifications wired to the same worker infra

## Phase 8 — Platform Administration (Super-Admin)

- [ ] Platform reference-data management: themes, subscription plans, icons, currencies, languages _(blueprint §4 User Types)_
- [ ] Creator/podcast privilege management UI (grant/revoke per account) — **members apply to become content creators**; Super-Admin approves into `member_privileges` (D-017)
- [ ] Explore moderation queue (full flow with audit trail)
- [ ] Church subscription management: list churches, plans, expiries; manual interventions
- [ ] Platform audit-log browser _(functionality §6)_

## Phase 9 — Hardening, Offline & PWA Polish

- [ ] Security review: rate limits tuned, auth token lifetimes, object-storage presign expiry, CORS allowlist _(blueprint §6)_
- [ ] **Redis-backed rate-limit store** (replaces the in-memory store) before running more than one API instance _(apps/api/src/auth/core/rate-limit.ts)_
- [ ] **`sessions` table** for multi-device refresh tokens (D-007)
- [ ] Move the web refresh token from localStorage to an httpOnly, SameSite cookie (D-012)
- [ ] **PWA polish**: offline app shell, offline readings/Bible/hymns via IndexedDB, update prompts _(functionality §6)_
- [ ] Full-text search audit (`tsvector`/`pg_trgm`) across saints, hymns, teachings, Bible _(blueprint §6)_
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
- [ ] **Bible licensing in place (GNB) before public launch** or launch with the public-domain translation clearly labelled _(blueprint §7)_
- [ ] Pilot: onboard one parish + its outstations end-to-end (subscribe → create users → members → societies → messaging → approval queue)
- [ ] Post-pilot fixes; then general availability

## Phase 11 — Mobile (Phase 2 — after web launch)

- [ ] Scaffold `apps/mobile` with **Expo (React Native)**; NativeWind with the shared Tailwind tokens _(blueprint §5, §6)_
- [ ] Reuse `packages/shared` types + API client for the mobile app
- [ ] Social platform surfaces: Home, Readings, Saints, Hymnal (audio), Podcasts, Bible, Teachings, Explore (browse)
- [ ] **Push notifications**: Expo push, opt-in channels (Saint of the Day, daily Readings, new episodes, society messages, birthdays) _(functionality §6)_
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
