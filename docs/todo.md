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

### 5.5 Podcasts _(functionality §3.5, D-027)_

- [x] Shared: podcast rules (`podcasts.ts`: who may publish, who manages a series, publish needs audio, durations) with tests; podcast contracts
- [x] Schema: `podcasts` (one owner: user or member, cover key), `podcast_episodes` (DRAFT/PUBLISHED, audio key, duration, notes, number unique per series), `podcast_follows` — migration `0006` generated on your machine
- [x] **Privilege grant**: `POST_PODCASTS` on users or members (`user_privileges` / `member_privileges`, D-017); revoking freezes the owner's series
- [x] API: public list/search, series page, short-lived stream URLs; member follow/unfollow; studio CRUD with presigned cover + audio uploads, publish/unpublish; first publish notifies followers (one INSERT … SELECT)
- [x] Web: podcast browser with search, series page with follow button, episode player
- [x] Console: Platform → Podcasts for Super-Admins; Creator studio for creator accounts
- [x] Seed: two series (Ecclesios, sample creator) with draft episodes; `PODCAST_EPISODE` notification type
- [x] API e2e: who may publish, drafts vs published, audio required, upload type check, one notification per first publish, follows
- [x] Social ↔ CMS links use `VITE_ADMIN_URL`; `/cms-login` placeholder removed (D-028)
- [x] **Episode media (D-029):** primary media AUDIO or YOUTUBE (both allowed), VIDEO reserved; transcript; PDF handouts; per-episode FREE/SUBSCRIBER access under one `LISTENER_PAYWALL` switch — migration `0007` generated on your machine
- [x] Web **mini-player**: persists across pages and reloads, refreshes expired URLs, lock-screen controls; Watch (embedded YouTube), Transcript and handout links on episodes
- [x] Console: episode editor for primary media, access, transcript, YouTube link and handouts
- [ ] Hosted video through a managed video service (Cloudflare Stream / Mux) — enable `VIDEO` _(later)_
- [ ] Move follower fan-out to a BullMQ worker _(Phase 7)_
- [ ] Studio for member creators (profile → My podcasts) and grant/revoke UI _(Phase 8)_
- [ ] Verify on a real machine: `pnpm db:generate` (0006), `db:setup`, typecheck, unit tests, API e2e; upload and play an episode

### 5.6 Teachings _(functionality §3.7, D-030)_

- [x] Shared: lesson format (`teachings.ts`: `parseLesson`, inline references to Bible / CCC / teachings, `lessonReferences`, `readingMinutes`, `lintLesson`) with tests; teaching contracts
- [x] Schema: `teaching_topics`, `teachings` (weighted full-text index), `teaching_topic_links`, `teaching_relations` — migration `0008` generated on your machine
- [x] Seed: 7 topics, 5 short original lessons (sacraments, Baptism, Eucharist, prayer, human dignity)
- [x] API: topics, search / topic filter, lesson with related teachings; Super-Admin CRUD, publish blocked while the lesson has problems, topic management
- [x] Web: topic tiles, search, lesson reader (Bible links into the reader, CCC chips, related teachings)
- [x] Console: Platform → Teachings — list, topics, editor with toolbar, live preview and problems list
- [ ] Have a priest review the seeded lessons; fill in "Reviewed by" _(before launch)_
- [ ] Offline reading of saved teachings _(Phase 9, PWA)_

### 5.7 Explore _(functionality §3.4, D-031)_

- [x] Shared: post workflow (`nextPostStatus`, `canManagePost`, `postProblems`, `submitSkipsQueue`), comment rules; contracts
- [x] Schema: `posts` (article/event, author person or church, review fields, full-text index), `post_comments`, `comment_reports`, `church_profiles` — migration `0009` generated on your machine
- [x] API: public feed (all / events upcoming-past / articles / church / following / search), post page, comments, church page; authoring gated by `canPostAsSelf` / `canPostAsChurch` (D-017) with drafts, submit, edit-returns-to-draft, cover upload; Super-Admin queue, approve / reject / remove, reported comments — all audited
- [x] Notifications: author on review; church followers once on first approval (one INSERT … SELECT)
- [x] Web: Explore feed with tabs, post page with comments (report / hide / delete), church pages with follow and inline editing, "My posts" and the editor with live preview
- [x] Console: Platform → Explore moderation (queue with preview, reported comments); Explore posts for platform accounts (creators, Super-Admins)
- [x] Seed: church posts (events + article), a pending creator post, a draft, a church profile, a comment
- [x] API e2e: who may post, drafts and submit, incomplete events, review, edit-takes-down, followers notified once, creators, Super-Admin direct publish, comments (hide / report once / delete own), church page editing
- [ ] Trust levels (experienced authors skip the queue) and image moderation _(Phase 9)_
- [ ] Move follower fan-out to a worker _(Phase 7)_
- [ ] Creator applications (members apply for `AUTHOR_EXPLORE`) _(Phase 8)_
- [ ] Verify on a real machine: `pnpm db:generate` (0009), `db:setup`, typecheck, unit tests, API e2e; write → review → publish → comment

### 5.8 News + Home _(functionality §3.1, D-032, D-033)_

- [x] **Fix**: correlated subqueries now qualify outer columns (`qcol`) — topic counts, hymn tune/media counts, podcast order; e2e checks added
- [x] Shared: `news.ts` (live / current / pinned order) and `home.ts` (`hymnOfDay`, `rankTrending`, `mergeFeed`) with tests; news and home contracts
- [x] Schema: `news` (draft / scheduled / live, pinned, expiry, link), `hymn_picks` — migration `0010` generated on your machine
- [x] Seed: two live news items (one pinned) and a draft; three non-seasonal public-domain hymns so Ordinary Time has a hymn of the day
- [x] API: public news list / item; Super-Admin news CRUD, publish now / schedule / back to draft; home summary (today, saint, hymn of the day, news, trending, events); blended feed (For you / Following); pin the hymn of the day
- [x] Web: Home with today card, feed tabs, blended feed cards (posts, teachings, episodes with Listen, news), Twitter-style sticky rail; `/news` and `/news/:slug`; More → Ecclesios news; Explore accepts `?q=`
- [x] Console: Platform → News (list, editor with preview, publish / schedule) and the hymn-of-the-day picker
- [x] **Watch row** on Home (D-034): newest YouTube videos from episodes, Explore posts and hymns; swipeable strip, pop-up player; e2e check
- [ ] Hashtags on Explore posts → real "trending topics" _(later — D-033)_
- [ ] Personalise For you with the member's own church and societies _(Phase 6, after CMS notices)_
- [ ] Cache the home summary per date (Redis) once traffic needs it _(Phase 9)_

### 5.9 Likes, saves, shares, comment rules _(functionality §3.4a, D-035)_

- [x] Shared: `engagement.ts` (keys, paths, compact counts, `containsLink`, mention tokens / encode / segments / caret query) with tests; trending counts likes
- [x] Schema: `reactions` (member × kind × item × LIKE/SAVE) — migration `0011` generated on your machine; `COMMENT_MENTION` notification type
- [x] API: public like counts + own state (batched), like / unlike / save / unsave, Saved list; comments refuse links; mention suggestions (conversation + own churches), mention check and notification; reactions deleted with their item
- [x] Web: like · comment · save · share bar on post, teaching, episode and hymn cards and pages; Saved page (More menu); comment box with @ suggestions and a link warning; mentions shown as names
- [x] e2e: likes / saves / Saved, guests and platform accounts refused, links refused, mentions allowed / refused / notified
- [ ] `@username` handles _(Phase 8, member profiles)_

### 5.10 Books _(functionality §3.10, D-036)_

- [x] Shared: `books.ts` (listing workflow, submit checks, who may sell, `splitSale`, price parse/format, order states and expiry, refund rules, seller balance) with tests; book contracts; `SELL_BOOKS` privilege; engage kind `BOOK`
- [x] Schema: `books`, `book_orders`, `library_items`, `book_refunds`, `book_sellers`, `book_payouts`, `platform_settings` — migration `0012` generated on your machine
- [x] Payments: `PaymentGateway` interface; **Hubtel** Online Checkout (initiate + status check) and a **test gateway** for development/e2e; production refuses the test gateway; orders paid only after the API verifies with the gateway (amount checked), idempotent callbacks, 60-minute expiry
- [x] API: catalogue + search, book page (owned, refund state), sample, library, reading links (watermark for paid books), progress, add/remove free books, checkout, order status, refund requests; seller studio (CRUD, uploads, price, submit, unlist, delete-if-unsold, statement); Super-Admin review, unlist, commission setting, sellers' terms, payouts (≤ owed), refunds (approve / decline / refund any order) — all audited; seller and buyer notifications
- [x] Web: **Books** in the sidebar, catalogue with category and price filters, book page (buy / add / read / sample / refund), reader (epub.js: pages, text size, night mode, resume; PDF viewer), My library, payment return page, development test checkout; Saved includes books
- [x] Console: Platform → Books (review, all books, refunds, sellers & payouts, commission); **My books** studio for creators and Super-Admins (editor, uploads, price, submit / unlist, statement)
- [x] Seed: 20 % commission, `SELL_BOOKS` for the sample creator, two draft catalogue entries (no files)
- [x] e2e: who may list, review flow, checkout → test payment → read, callbacks don't pay, refund rules and approval, commission frozen per order, payouts ≤ owed, free books
- [ ] **Hubtel go-live**: merchant account, API keys, whitelist the API server's IP for the status endpoint, set `PUBLIC_API_URL` callback, test in Hubtel's sandbox and confirm the request/response fields used in `hubtel.gateway.ts` _(before launch)_
- [ ] Load public-domain classics (EPUB) as free books _(content)_
- [ ] PDF page tracking and in-app PDF rendering with pdf.js (progress and refund rule for PDFs) _(Phase 9)_
- [ ] Offline reading of owned books on phones _(Phase 9, PWA)_
- [ ] Automatic payouts through Hubtel's transfer API _(later)_; highlights and notes in the reader _(later)_; print books and audiobooks _(later)_

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
- [ ] **Book sellers**: members apply for `SELL_BOOKS`; Super-Admin grants/revokes; a **seller studio in the web app** for member sellers (the API already supports them; platform creators use the console) _(D-036)_
- [ ] Explore moderation queue (full flow with audit trail)
- [ ] Church subscription management: list churches, plans, expiries; manual interventions
- [ ] **Online payment for church subscriptions** through the same Hubtel gateway (replaces manual activation, D-021) _(D-036)_
- [ ] Platform audit-log browser _(functionality §6)_

## Phase 9 — Hardening, Offline & PWA Polish

- [ ] Security review: rate limits tuned, auth token lifetimes, object-storage presign expiry, CORS allowlist _(blueprint §6)_
- [ ] **Redis-backed rate-limit store** (replaces the in-memory store) before running more than one API instance _(apps/api/src/auth/core/rate-limit.ts)_
- [ ] **`sessions` table** for multi-device refresh tokens (D-007)
- [ ] Move the web refresh token from localStorage to an httpOnly, SameSite cookie (D-012)
- [ ] **PWA polish**: offline app shell, offline readings/Bible/hymns via IndexedDB, update prompts _(functionality §6)_
- [ ] **Global search**: one search box in the top bar opening a results page across every section — readings, saints, hymns, Bible, teachings, podcasts, Explore, news; full-text audit (`tsvector`/`pg_trgm`) _(blueprint §6)_
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
- [ ] **Link previews for shared links** (Open Graph / Twitter meta tags rendered on the server for posts, teachings, episodes, hymns, saints, news, readings) _(D-035)_
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
