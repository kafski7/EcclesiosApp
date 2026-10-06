# Ecclesios — Application Blueprint

> **v2 rebuild note:** This document describes the **greenfield rebuild** of Ecclesios in a fresh repository (pnpm + Turborepo monorepo, TypeScript, NestJS, Drizzle, Tailwind/shadcn + CoreUI). Functionality and scope are unchanged from the v1 design; the technology and infrastructure decisions in §5–§7 supersede the original Express/Redux/raw-`pg` stack. Docs in this `docs/` folder are the source of truth to carry over.

## 1. Overview

Ecclesios is a **social platform for the Catholic Church with an integrated Church Management component**.

It is two products in one application:

1.  **The Social Platform (main application)** — the public-facing experience. Every member of the faithful can engage with daily Catholic content: readings, saints, hymns, podcasts, teachings, and the Bible — and interact with the Church as a community.
2.  **The Church Management Application (CMS)** — the administrative suite, used by church staff (Administrators, Managers, Society-Leaders) to run the operations of a parish/society: membership records, societies and committees, communication, notifications, and settings. **Accounting is out of scope** — it is delegated to an external accounting API.

A member of the public can use the social platform freely. A church **subscribes** to unlock the Church Management application for its staff, and its members get a deeper, connected experience.

## 2. Product Areas

### 2.1. The Social Platform (Main Application)

The main application is a content-and-community experience with a fixed primary navigation:

| Section       | Purpose                                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home**      | A feed that surfaces a bit of everything: upcoming events, saint of the day, hymn highlights, new teachings, podcasts, and posts from groups the user follows. The landing page for all users.                                                                     |
| **Readings**  | Daily Mass readings modelled on usccb.org: First Reading, Psalm, Second Reading, Gospel for **every day of the liturgical calendar** (Sundays, weekdays, solemnities, feasts, memorias). Includes liturgical-season context (Advent, Lent, Easter, Ordinary Time). |
| **Saints**    | Saint of the day, plus a searchable directory of saints with full biographies (feast day, patronage, life story).                                                                                                                                                  |
| **Explore**   | Authoring space for privileged user types. Churches, priests, and approved creators (e.g. PYC executives) can create and publish content: **church profiles, priest profiles, events, and educational content**. Content is moderated by platform staff.           |
| **Podcasts**  | Podcast library. **Platform admins** post podcasts; churches, priests, and other privileged accounts (e.g. PYC executives) who have been granted the privilege can also post episodes. Users browse, stream, and follow series.                                    |
| **Hymnal**    | A dedicated hymn browser: lyrics, **recorded versions (audio)**, and/or **MIDI files**, and downloadable **Staff / Solfa notations** where available. Searchable by title, first line, lyrics, liturgical season, or hymn number in any hymn book (numbers belong to books, D-026).                                                      |
| **Teachings** | A catechesis library — teachings about the Catholic faith and Church. Users can search by topic (sacraments, morality, prayer, Church history, etc.) and read structured lessons.                                                                                  |
| **Books**     | Catholic e-books: free classics and books sold by approved Catholic writers (Hubtel checkout, configurable commission, refunds). Read in the app; My library. (D-036) |
| **Bible**     | A full Bible reader in the spirit of YouVersion, beginning with the **GNB (Good News Bible)** translation. Future versions will add additional, downloadable translations.                                                                                         |
| **More**      | An off-canvas menu that exposes: subscription to the Church Management application, notifications, and login to the Church Management application (for subscribed churches). Also hosts settings, about, and legal links.                                          |

### 2.2. The Church Management Application (CMS)

The administrative suite behind the More menu (after subscription + login). It is the modernized equivalent of the legacy PHP application, **without the accounting module**.

| Module                | Purpose                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**         | At-a-glance statistics: members, societies, committees, birthdays today, recent notifications.                                                           |
| **Members**           | Full membership records: personal details, sacramental records (baptism, communion, confirmation), photo, deceased flag, society/community affiliations. |
| **Birthdays**         | Members' birthdays — today's celebrants and upcoming, as an engagement tool.                                                                             |
| **Societies**         | Societies and clubs in the church, with their membership rosters.                                                                                        |
| **Committees**        | Committees (a flag on societies) and their membership.                                                                                                   |
| **Notifications**     | In-app notification center with read/unseen tracking.                                                                                                    |
| **Messages**          | SMS & email blasts to members/societies (uses a paid SMS balance).                                                                                       |
| **Users & Roles**     | Admin user accounts for the church, with role-based permissions (Administrator, Manager, Society-Leader, Parishioner).                                   |
| **Profile Settings**  | Own profile: photo, password, personal details.                                                                                                          |
| **Themes & Settings** | Church-level branding/themes, language, currency display, operational toggles.                                                                           |
| **Billing**           | The church's subscription to the Ecclesios platform (plan, expiry, renew/upgrade). This is **platform billing**, not church accounting.                  |
| **Branch/Groups**     | Switch context between parishes/outstations/branches the user administers (the `groups` hierarchy).                                                      |

**Explicitly excluded:** accounts/wallets, transactions, budgets, financial categories, transaction templates, financial reports, and the double-entry ledger. These are delegated to an **external accounting API** (see §8).

## 3. The Ecclesiastical Hierarchy & RBAC Model

The Church Management application is built around the Church's own hierarchical structure — the same structure the platform's RBAC mirrors. Starting from a **national** deployment, the operating levels are:

```
Metropolitan Province (national overview)
└── Metropolitan Archdiocese (monitor own deaneries; vigilance over suffragans)
    ├── Suffragan Diocese (monitor deaneries) — visibility to the metropolitan is a diocese setting (§3.4)
    │   └── Deanery …
    └── Deanery (monitor parishes)
        └── Parish (oversight of outstations)
            └── Outstation / Mission (runs its own day-to-day facility)
                └── Societies & Committees (groups within a church)
```

_(Apostolic Nunciature and Pope/Vatican levels exist in the data model but are out of scope for this deployment.)_

### 3.1. Governance Levels

| Level                      | Led by                                   | Role in the system                                                                                                                                                                                 |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Metropolitan Province**  | Metropolitan Archbishop                  | General oversight of data from the whole nation. Aggregated reporting only; no day-to-day operations.                                                                                              |
| **Archdiocese / Diocese**  | Archbishop / Bishop                      | Monitor data from the deaneries under them. Diocesan curia roles (vicar general, finance officer etc.) exercise this on the bishop's behalf.                                                       |
| **Deanery**                | Dean (Vicar Forane)                      | Monitoring rights over parishes — sees selected aspects of their activities (per can. 555: pastoral coordination, registers, liturgy, goods administration). No operational control.               |
| **Parish**                 | Pastor (Parish Priest)                   | The operating unit with **oversight of its outstations**. Full management of its own members, societies, and activities; supervisory (not hands-on) control over outstation data and transactions. |
| **Outstation / Mission**   | Outstation chaplain / catechist-led team | Runs its **own facility**: full member management, society management, and day-to-day record-keeping for its own community — but its transactions remain under parish oversight.                   |
| **Societies & Committees** | Society-Leader                           | Lay associations within any church level; manage their own rosters.                                                                                                                                |

This mirrors canon law: the pastor is the proper pastor of his community under the authority of the diocesan bishop (can. 519–532); the dean coordinates and inspects but does not govern parishes (can. 553–555); the metropolitan exercises watchfulness over his province (can. 436).

### 3.2. Access Model (Hierarchy-Scoped RBAC)

Every person holds one or more **memberships** (D-014); each membership is a **group** (a node in the hierarchy) plus a **role** (Administrator, Manager, Society-Leader, Parishioner). Permissions are evaluated as **role × hierarchy level**:

- **Own-scope (write):** a user at any level has full write access to the data of their own group — e.g. an outstation team manages its own members and societies.
- **Descendant-scope (oversight):** a user's permissions over _child_ groups depend on their level —
  - **Parish → Outstations:** full **oversight** — can view, approve, and intervene in outstation records and **transactions** (approver role for outstation finances).
  - **Deanery → Parishes:** **monitoring only** — read access to selected activity aspects (membership statistics, registers, activity reports); no write access.
  - **Diocese/Archdiocese → Deaneries:** **monitoring** — consolidated data from all deaneries under them.
  - **Province → Nation:** **general oversight** — aggregated national data across all archdioceses/dioceses.
- **No upward access:** a lower level can never see the data of a sibling or parent group.
- **Aggregation, not duplication:** monitors see roll-up dashboards and reports computed from descendant groups; they do not re-enter or edit that data.

### 3.3. Permission Matrix (summary)

| Capability                               | Outstation       | Parish                      | Deanery             | Diocese/Archdiocese | Province          | Super-Admin   |
| ---------------------------------------- | ---------------- | --------------------------- | ------------------- | ------------------- | ----------------- | ------------- |
| Members (own group)                      | CRUD             | CRUD                        | CRUD                | CRUD                | view              | —             |
| Societies/Committees (own)               | CRUD             | CRUD                        | CRUD                | CRUD                | view              | —             |
| Members/Societies of **child** groups    | —                | approve/override            | view (selected)     | view (aggregated)   | view (aggregated) | —             |
| Transactions (own group)                 | record (limited) | CRUD                        | —                   | —                   | —                 | —             |
| Transactions of **child** groups         | —                | **full oversight/approval** | view summaries      | view reports        | view reports      | —             |
| Messaging (own group)                    | ✓                | ✓                           | ✓                   | ✓                   | ✓                 | —             |
| Cross-level messaging/broadcasts         | —                | to own outstations          | to deanery parishes | diocesan            | national          | platform-wide |
| Platform data (readings, saints, hymns…) | read             | read                        | read                | read                | read              | manage        |

_(“CRUD” = full create/read/update/delete within own group; monitoring roles get read/aggregated views only. Detailed per-module rules live in `functionality.md` §5.)_

### 3.4. Suffragan Dioceses & Metropolitan Visibility

In the `groups` tree a **suffragan diocese is a child of its metropolitan archdiocese** (which is itself a child of the Province). Canonically, however, the metropolitan exercises **vigilance, not governance**, over suffragans (can. 436). The tree therefore expresses _belonging_; what the archdiocese may _see_ across that edge is controlled by a per-diocese setting:

| `metropolitan_visibility`  | Archdiocese sees of the suffragan (and everything below it) |
| -------------------------- | ----------------------------------------------------------- |
| `hidden`                   | nothing                                                     |
| `aggregates` **(default)** | roll-up totals and trends only                              |
| `detailed`                 | read-only summary reports with drill-down to parish level   |

- The setting lives in `group_settings` of the **suffragan diocese** and is changed only by that diocese's own Administrator (the bishop's authority over his own diocese).
- Whatever the setting, the archdiocese **never** gets write access to a suffragan.
- The **Province** always sees national aggregates, independent of this setting.
- The archdiocese's _own_ deaneries/parishes are governed by the normal diocese rules (§3.2).

### 3.5. Access Resolution (implementation contract)

Every group stores a **materialised path** (`groups.path`, e.g. `/<provinceId>/<archId>/<dioceseId>/…/`). "Is B under A?" is a prefix check (`b.path LIKE a.path || '%'`) on an indexed column, instead of a recursive walk per request. Access of a viewer group V to a target group T resolves to exactly one of:

| Access              | When                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `OWN`               | T = V — full write within role permissions                                                            |
| `OVERSIGHT`         | V is a Parish and T is one of its Outstations — view, approve, override                               |
| `MONITOR_DETAILED`  | V is a Deanery and T is below it; or V is an Archdiocese and T is under a suffragan set to `detailed` |
| `MONITOR_AGGREGATE` | V is a Diocese/Archdiocese and T is below it (subject to §3.4); or V is the Province                  |
| `NONE`              | T is a sibling, ancestor, unrelated, or behind a `hidden` suffragan                                   |

This function lives once in `packages/shared` (`resolveAccess`) and is used by the API scope guard; it is covered by a table-driven test suite.

**People with several memberships (D-015):** `resolveMemberAccess` combines a person's **ACTIVE** memberships. Staff memberships (Administrator, Manager) contribute the group-to-group access above; other memberships contribute `MEMBER` access to exactly their own church (members-only content). Routes require a capability (`write`, `approve`, `readRecords`, `readSummaries`, `readAggregates`, `memberContent`); the request is allowed if any of the person's accesses grants it. Pending memberships grant nothing.

## 4. User Types

- **Public Visitor:** Anonymous. Can browse Home, Readings, Saints, Hymnal, Teachings, Bible, Podcasts (streaming), and Explore content. Cannot author content or log in to the CMS.
- **Parishioner (member):** Registered member of a church (any level). Everything a visitor can do, plus a connected identity, notifications, and society/committee membership visibility.
- **Society-Leader:** Leads a society or committee within a church at any level. Manages their society's roster in the CMS.
- **Manager:** Church staff with specific management permissions within their own group (members, societies, communication — per assigned permissions).
- **Administrator:** The main administrator of a church group (outstation, parish, deanery, diocese, or province office). Full CMS access for their group, with oversight scope determined by their hierarchy level (§3.2).
- **Priest / Creator (privileged social accounts):** Verified accounts (priests, PYC executives, etc.) that can author on **Explore** and post **Podcasts** when granted the privilege by platform admins. Church Administrators also post on Explore **in their church's name** (D-017).
- **Two separate role sets.** Church roles (**Administrator, Manager, Society-Leader, Parishioner**) belong to people in the `members` table and are scoped to a group. Platform roles (**Super-Admin, Creator**) belong to accounts in the `users` table and are platform-wide. Creator abilities (post podcasts, author on Explore) are stored as explicit **privileges** granted by a Super-Admin, not as a church role.
- **Super-Admin (Ecclesios platform admin):** Not an end-user of a church. Owns the platform: podcasts (primary publisher), Explore moderation, creator privileges, subscriptions/billing of churches, and platform-wide reference data.

> **Hierarchy officers** (Metropolitan Archbishop, Bishop, Dean, Pastor, outstation leader) are all modelled as **members/users holding the Administrator or Manager role at their group's level** — their oversight powers come from _where they sit in the hierarchy_, not from a special role name. This keeps the RBAC table small and the `groups.parent_group_id` tree authoritative.

## 5. Architecture

A self-contained application with its own dedicated database, fronted by two single-page applications (social platform + CMS) talking to a single typed API. Services communicate over authenticated REST APIs — a separation that keeps the social platform, the CMS, and the external accounting service loosely coupled, while a monorepo keeps them type-safe and independently deployable.

```
┌──────────────────────────────────────────────────────────────────────┐
│            pnpm workspaces + Turborepo monorepo (TypeScript)         │
│                                                                      │
│   apps/web (Social Platform)        apps/admin (CMS)                 │
│   React 19 + Vite + Tailwind        React + Vite + CoreUI v5         │
│   + shadcn/ui                       TanStack Query + Zustand         │
│   TanStack Query + Zustand                                           │
│          │                             │                             │
└──────────┼─────────────────────────────┼─────────────────────────────┘
           │  REST / JSON — contracts typed by packages/shared (Zod)    │
┌──────────▼─────────────────────────────▼─────────────────────────────┐
│                      apps/api — NestJS + TypeScript                  │
│  modules: auth │ social content │ cms │ rbac │ subscriptions │ media │
│  JWT guards enforce role × hierarchy-level scope (blueprint §3)      │
└────────┬──────────────┬───────────────┬───────────────┬──────────────┘
         │              │               │               │
   ┌─────▼──────┐ ┌─────▼──────┐ ┌──────▼────────┐ ┌────▼──────────────┐
   │ PostgreSQL │ │ Redis      │ │ Object store  │ │ External services │
   │ (Docker)   │ │ BullMQ     │ │ MinIO (dev) → │ │ Accounting API,   │
   │ Drizzle    │ │ jobs &     │ │ R2/S3 (prod)  │ │ SMS/E-mail gw,    │
   │ migrations │ │ schedules  │ │ audio/MIDI/   │ │ Bible provider    │
   │            │ │            │ │ PDFs/photos   │ │ (e.g. API.Bible)  │
   └────────────┘ └────────────┘ └───────────────┘ └───────────────────┘
```

Binary media never passes through the API process — clients upload/download directly to object storage via short-lived presigned URLs. Job workers (SMS/email blasts, notifications, birthday digests) consume BullMQ queues so no request handler does slow work inline.

### Mobile Strategy (Phase 2)

- **Baseline (day one):** the social platform ships as a **PWA** — installable on phones, with offline readings/Bible/hymns (see §6). Cheapest path to mobile reach, and the right fit for low-data environments.
- **Phase 2 — `apps/mobile`:** a native app for the **social platform only**, built with **Expo (React Native)** — the only route that keeps the "TypeScript everywhere" decision (Flutter introduces Dart; Capacitor stays a WebView wrapper). It consumes the same NestJS API and `packages/shared` types, with **NativeWind** reusing the Tailwind design tokens.
- **Scope discipline:** the **CMS stays browser-based** (staff tooling; the PWA covers "admin checks birthdays on their phone"). The native app exists only for what the web cannot do well: **push notifications** (Saint of the Day, daily Readings, new podcast episodes, society messages) and fully **downloadable Bible translations**.
- The monorepo reserves the slot from day one (`apps/mobile/`, scaffolded as a placeholder) so adding it later touches no API contract and no existing app.

## 6. Technology Stack

**Language & tooling**

- **TypeScript everywhere** (strict mode) — backend, both frontends, and shared packages. The hierarchy-scoped RBAC (role × group level × descendant scope) is exactly the kind of logic types must cover.
- **pnpm workspaces + Turborepo** monorepo; shared ESLint/Prettier/tsconfig (packages/config); Vitest for unit tests, Supertest for API e2e.

**Backend — `apps/api`**

- **NestJS + TypeScript.** Chosen over Express/Fastify because Nest's module boundaries map 1:1 to the product areas (auth, social content, CMS, subscriptions, media), and its guards/interceptors/decorators express the RBAC rules cleanly (e.g. a scope guard resolving the caller's group ancestry per request).
- **Drizzle ORM + drizzle-kit** — SQL-like, TS-first schema in `packages/db`; generated, versioned SQL migrations; materialised `groups.path` prefix matching for hierarchy ancestor-scoping (§3.5), with `resolveAccess` deciding what a caller may see.
- **Zod** schemas in `packages/shared` double as runtime validation (API DTOs) and the single source of TypeScript types consumed by both frontends.
- **argon2id** password hashing; JWT access + refresh tokens; OTP flow per `functionality.md` §2.
- **pino** structured logging, **helmet** security headers, **rate limiting on all OTP/auth endpoints**.

**Frontends**

- **`apps/web` (Social Platform):** React + Vite + **Tailwind CSS + shadcn/ui** for a consumer-grade look (feed, readings, Bible reader, hymnal — not a dashboard); **TanStack Query** for server state (caching/refetching of readings, saints, feed) + **Zustand** for small client state; react-router; **Vite PWA plugin + IndexedDB (Dexie)** for offline readings/Bible/hymns.
- **`apps/admin` (CMS):** React + Vite + **CoreUI v5** components inside the UI kit's admin shell (`docs/ecclesios-ui/admin.html`, D-019); TanStack Query + Zustand; same shared types. Also hosts the Super-Admin platform console (`/platform`).
- **`apps/mobile` (Phase 2):** **Expo / React Native** — native home for the social platform (push notifications, downloadable translations). Shares `packages/shared` types and the API client; **NativeWind** applies the Tailwind design tokens. Not built at launch — see §5, Mobile Strategy.

**Data & infrastructure**

- **PostgreSQL 16+** (Docker) — hierarchy tree, enums, RBAC joins, full-text search (`tsvector`/`pg_trgm`) for saints/hymns/teachings/Bible.
- **Redis** — BullMQ queues (SMS/email blasts, notifications, digests) + caching.
- **S3-compatible object storage** — MinIO locally, Cloudflare R2/S3 in production; presigned URLs for hymn audio, MIDI, notation PDFs, podcast episodes and handouts, member photos. Hosted video, when added, goes through a managed video service rather than plain object storage (D-029).
- **Docker Compose** for dev (postgres + redis + minio); the API deploys as a container, the frontends as static builds.

**External services**

- Accounting API (external — see §8)
- SMS/E-mail gateway for OTP and message blasts (consumed via BullMQ workers)
- Bible verse provider — API.Bible or similar for licensed translations (GNB); public-domain text for development (see §7)

### Repository Layout (monorepo)

```
ecclesios/                      # pnpm + Turborepo monorepo (TypeScript)
├── apps/
│   ├── api/                    # NestJS — auth, RBAC, social content, CMS, subscriptions, media
│   ├── web/                    # Social platform (React + Vite + Tailwind + shadcn/ui)
│   ├── admin/                  # CMS (React + Vite + CoreUI)
│   └── mobile/                 # (Phase 2 placeholder) Social platform — Expo / React Native
├── packages/
│   ├── shared/                 # Zod schemas + TS types (API contracts), RBAC scope logic
│   ├── db/                     # Drizzle schema, drizzle-kit migrations, seeds
│   └── config/                 # Shared ESLint / tsconfig / prettier configs
├── docs/                       # blueprint.md, functionality.md, decisions.md…
├── docker-compose.yml          # postgres + redis + minio (dev)
└── turbo.json / pnpm-workspace.yaml
```

**Why a monorepo:** API contracts live once (`packages/shared`, consumed by `api`, `web`, `admin`, and the phase-2 `mobile` app with type checking across boundaries), cross-app changes are atomic, there is one CI pipeline, and each app still deploys independently (static builds for web/admin, app stores for mobile, a container for api).

## 7. Database Schema

The database is designed to be normalized and efficient, with each feature area owning a related set of tables. The schema lives in `packages/db` as **Drizzle ORM schema definitions**, with versioned SQL migrations generated by **drizzle-kit** (`generate` → review → `migrate`). Wipe-and-reload seed scripts are for local development only — production schema changes always go through migrations. Table groups (carried over from the v1 schema and extended):

**Organisation & hierarchy:**

- `groups` — self-referencing hierarchy tree (Outstation → Parish → Deanery → Diocese → Archdiocese → Metropolitan Province → Apostolic Nunciature → Vatican) with per-group theme, currency, and language, plus a materialised `path` (§3.5); `group_settings` (incl. `metropolitan_visibility`, §3.4).
- `roles`, `permissions`, `role_permissions` — RBAC for church (member) roles.
- `users.platform_role` (`SUPER_ADMIN` / `CREATOR`) and `user_privileges` (e.g. `POST_PODCASTS`, `AUTHOR_EXPLORE`) — platform roles and creator grants.

**Identity & auth:**

- `users` — platform-level accounts (Super-Admins, privileged creators).
- `members` — **people** (identity, sign-in, sacramental records); both `users` and `members` carry OTP, temp-token, password-reset, and refresh-token columns; passwords hashed with argon2id.
- `memberships` — person × church × role × status (PENDING / ACTIVE / REJECTED / LEFT), one `is_home` per person (D-014, D-016); `follows`; `home_transfers`; `member_privileges` (creator grants for members, D-017).

**CMS operational:**

- `societies`, `society_members`, `subscriptions`, `subscription_types`, `notifications`, `notification_types`, `audit_logs`, `themes`, `currencies`, `languages`, `icons`.

**Social content (to be added):**

- `readings` / `reading_days` — daily Mass readings mapped to the liturgical calendar (first reading, psalm, second reading, gospel; season & feast metadata).
- `saints` — saint directory (feast day, patronage, biography) with a "saint of the day" schedule.
- `hymn_books`, `hymns`, `hymn_numbers` (book × number), `hymn_tags`, `hymn_tunes`, `hymn_media` (recordings, MIDI, staff/sol-fa PDFs as object keys; YouTube ids), each media item Free or Subscriber (D-026).
- `podcasts` — podcast series with one owner (platform account or member holding `POST_PODCASTS`) and a cover key; `podcast_episodes` — DRAFT/PUBLISHED episodes with a primary media kind (AUDIO / YOUTUBE; VIDEO reserved), audio object key, YouTube id, access level, transcript, duration and show notes; `podcast_attachments` (PDF handouts); `podcast_follows` (D-027, D-029).
- `teaching_topics`, `teachings` (lesson source in the D-030 text format + plain text for search, reading time, reviewed-by, DRAFT/PUBLISHED), `teaching_topic_links`, `teaching_relations` (D-030).
- `news` — Ecclesios announcements (draft / scheduled / live, pinned, expiry) (D-032); `hymn_picks` — Super-Admin choice of hymn of the day per date (D-033).
- `reactions` — likes and saves by members on posts, teachings, episodes and hymns (D-035).
- `books`, `book_orders` (commission and split frozen per order), `library_items` (what a member can read + reading position), `book_refunds`, `book_sellers` (commission override, payout details), `book_payouts`, `platform_settings` (D-036).
- `bible_translations`, `bible_verses` — Bible reader data (the canon and book names live in `packages/shared`, D-023). GNB text is copyrighted, so structured verses come from a licensed provider (e.g. API.Bible); development starts with a public-domain translation behind the same schema, and GNB is enabled once licensed.
- `posts` — Explore articles and events (DRAFT/PENDING/APPROVED/REJECTED/REMOVED), author = person or church; `post_comments` + `comment_reports`; `church_profiles` (D-031).
- Media columns (hymn recordings, MIDI, notation PDFs, podcast audio, member photos) store **object-storage keys**, with binaries in S3-compatible storage — never in the database or on the API server's disk.

**Out of scope (accounting):**

- The v1 accounting block (`chart_of_accounts`, `accounts`, `categories`/`sub_categories` as financial categories, `transactions`, `transaction_templates`, `transfers`, `budgets`, `journal_entries`, `journal_entry_lines`, `customers`, `vendors`, `invoices`, `bills`, `payments`, `tax_rates`, `assets` and related) is **not carried into the new build**. Only a thin linkage table (`external_accounting_refs`) is kept so the CMS can display financial summaries from the external service — plus the `pending_collections` staging table (§8).

_(This section will be expanded as content features are built.)_

## 8. External Accounting Integration

Church accounting (ledger, transactions, budgets, AR/AP) is **not built into Ecclesios**. Instead:

- The CMS integrates with an **external accounting API** via authenticated REST calls.
- Church financial categories map to the external system; Ecclesios stores only external references (IDs), never the ledger itself.
- Where the CMS shows financial summaries (e.g. society dues, collections), it reads them from the external API and presents them read-only.
- This keeps the platform lighter, avoids duplicating financial-grade security/compliance, and lets churches keep their existing accounting provider.

### 8.1. Outstation Collections (staging before approval)

Outstation collections must be recorded locally _and_ approved by the parish before they become accounting entries. They are held in **`pending_collections`** — a staging table, not a ledger:

```
PENDING ──approve──▶ APPROVED ──sync ok──▶ SYNCED   (external_txn_id stored)
   │                    └──sync fail──▶ SYNC_FAILED ──retry──▶ SYNCED
   └──reject──▶ REJECTED (review note required)
```

- Recorded by the outstation (amount, currency, category ref, date, note); reviewed by the parent **parish** only.
- On approval a BullMQ job posts it to the external accounting API; the returned ID is stored and the row becomes read-only.
- Only `PENDING` rows are editable (by the recorder); every transition is audit-logged.
- Once `SYNCED`, the external system is the source of truth — Ecclesios never computes balances from this table.

## 9. Communication with other Ecclesios Apps

Communication between Ecclesios and other applications in the Ecclesios suite (including the accounting provider) is done via secure, authenticated API calls. This allows for a clean separation of concerns and ensures that each application remains independent.

---
