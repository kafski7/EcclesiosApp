# Application Functionality

This document is the functional specification for **Ecclesios** — a social platform for the Catholic Church with an integrated Church Management application. See `blueprint.md` for the high-level architecture and scope.

## 1. User Roles

| Role | Scope | Summary |
|---|---|---|
| **Super-Admin** | Platform | Ecclesios administrator. Not an end-user of a specific church. Manages the application itself: podcasts (primary publisher), Explore moderation, creator privileges, church subscriptions, platform reference data (themes, subscription plans, readings calendar, saints, hymns, teachings, Bible). |
| **Administrator** | Church group | The main administrator for a specific church group at **any hierarchy level** (outstation, parish, deanery, diocese/archdiocese, province). Full CMS access for their own group; oversight/monitoring rights over descendant groups as determined by their level (§5). |
| **Manager** | Church group | A user with specific management permissions within their own group. Sees only the CMS modules their permissions allow; may hold delegated oversight duties (e.g. diocesan finance officer viewing diocesan reports). |
| **Society-Leader** | Society | A leader of a specific society or committee within a church. Manages their society's roster; limited CMS access. |
| **Parishioner** | Church | A regular member of the church. Social-platform user with a connected identity; personal CMS visibility (own profile, own societies, notifications). |
| **Priest / Creator** | Platform | A verified privileged account on the social platform (priests, PYC executives, etc.). Can author Explore content and post Podcasts **when granted the privilege** by a Super-Admin. |
| **Public Visitor** | — | Anonymous user. Full read access to the social platform; no authoring, no CMS. |

> **Two axes define a user's power:** their **role** (this table) and their **position in the ecclesiastical hierarchy** (§5). A Parish-outstation Administrator, a Parish Administrator, a Deanery Administrator and a Diocesan Administrator all hold the *same role* — what differs is which group they belong to, and the oversight scope their hierarchy level grants over descendant groups. See `blueprint.md` §3.

> **Two role sets:** church roles (Administrator, Manager, Society-Leader, Parishioner) live on `members`; platform roles (Super-Admin, Creator) live on `users`. They never mix.

Creator/Podcast privileges are grants stored against a `users` account — a user's *role* (e.g. Society-Leader) is independent of their *platform privileges* (e.g. can post podcasts).

## 2. Login Flow

### 2.1. Super-Admin Login

*   **Route:** `/admin-login`
*   **Authentication Table:** `users`
*   **Functionality:**
    *   A dedicated login page for Super-Admins (and platform-level privileged accounts).
    *   Accepts email/telephone and password.
    *   Validates credentials against the `users` table.
    *   Upon successful validation, an OTP is generated and sent (logged to console for now).
    *   User is prompted to enter the OTP.
    *   If the OTP is correct, the user is logged in.
    *   If `first_login` is NULL, the user is redirected to a "Set Password" page.
    *   Otherwise, the user is redirected to the Super-Admin dashboard.
    *   Provides appropriate error messages for failed login attempts.

### 2.2. End-User Login (Administrator, Manager, Society-Leader, Parishioner)

*   **Route:** `/login`
*   **Authentication Table:** `members`
*   **Functionality:**
    *   A single login page for all end-users.
    *   Accepts email/telephone and password.
    *   Validates credentials against the `members` table.
    *   Upon successful validation, an OTP is generated and sent (logged to console for now).
    *   User is prompted to enter the OTP.
    *   If the OTP is correct, the user is logged in.
    *   If `first_login` is NULL, the user is redirected to a "Set Password" page.
    *   Otherwise, the user is redirected to their respective dashboard based on their role.
        *   Administrator -> Administrator Dashboard
        *   Manager -> Manager Dashboard
        *   Society-Leader -> Society-Leader Dashboard
        *   Parishioner -> Parishioner Dashboard
    *   Provides appropriate error messages for failed login attempts.

### 2.3. Auth API contract (implemented — Phase 2)

All routes are under `/api/auth`, rate-limited, and return the standard error envelope `{ error: { code, message, details?, requestId } }`. Request/response schemas live in `packages/shared/src/schemas/auth.ts`.

| Step | Route | Body → Response |
|---|---|---|
| 1 | `POST /admin-login` (users) · `POST /login` (members) | `{ identifier, password }` → `{ challengeToken, expiresInSeconds, delivery }` |
| 2 | `POST /verify-otp` | `{ challengeToken, otp }` → `AUTHENTICATED` + tokens, or `PASSWORD_SETUP_REQUIRED` + `tempToken` (15 min) |
| 2b | `POST /set-password` | `{ tempToken, newPassword }` → tokens; sets `first_login` |
| — | `POST /refresh` | `{ refreshToken }` → new token pair (rotating) |
| — | `POST /logout` | `{ refreshToken }` → 204 |

*   **Identifier** is an email or an E.164 telephone. **Password policy:** 10–128 characters, at least one letter and one digit.
*   **Errors never reveal whether an account exists:** unknown account and wrong password both return `INVALID_CREDENTIALS`. `ACCOUNT_DISABLED` is shown only after a correct password.
*   **Lockout:** 5 wrong passwords lock the account for 15 minutes (`ACCOUNT_LOCKED`, 423).
*   **OTP:** 6 digits, 10 minutes, single use, 5 wrong attempts end the challenge (`OTP_ATTEMPTS_EXCEEDED`).
*   **Rate limits (per 15 min):** 30 requests per IP across all auth routes; 5 login attempts per identifier. Over the limit → 429 `RATE_LIMITED` with `Retry-After`.
*   **Tokens:** access token 15 min (Bearer, carries `{ id, role, group_id, hierarchy_level }`); refresh token 30 days, rotated on every use (one session per account until the sessions table — D-007).
*   **Audit:** failed logins, lockouts, OTP sends/failures, successful logins, password setup, logout and refresh-token reuse are written to `audit_logs`.

## 3. The Social Platform (Main Application)

The main application is what every user sees. It has a fixed primary navigation with the sections below. All content sections are publicly readable; authoring is privilege-gated.

### 3.1. Home

*   A blended feed that "shows a bit of all the posts": upcoming events, saint of the day, hymn highlights, new teachings, latest podcast episodes, and featured Explore content.
*   Sections are ordered by relevance/recency; signed-in users additionally see content from their church and societies.
*   Entry cards deep-link into each dedicated section.

### 3.2. Readings

*   Daily Mass readings in the style of usccb.org, for **every day of the liturgical calendar**: First Reading, Responsorial Psalm, Second Reading (Sundays/solemnities), Gospel.
*   Date navigation (today, pick a date, prev/next day) and liturgical-season context (Advent, Christmas, Lent, Easter, Ordinary Time; feast/saint commemorations shown on their days).
*   Backed by a readings calendar table seeded/administered by the platform; the Bible reader (§3.8) can open any cited passage.

### 3.3. Saints

*   **Saint of the Day** — automatically surfaces the saint(s) whose feast falls on today's date.
*   **Saint Directory** — searchable list of saints; each saint page shows biography, feast day, patronage, and related readings/hymns where available.

### 3.4. Explore

*   The authoring space for privileged user types: **churches, priests, and approved creators** (e.g. PYC executives).
*   Content types: **church profiles, priest profiles, events, and educational content** (articles, catechetical resources, media posts).
*   Authored content enters a **moderation queue**; Super-Admins approve before it appears publicly.
*   Public users browse approved content: upcoming events across churches, educational posts, church and priest profiles.

### 3.5. Podcasts

*   A podcast library of **series** and their **episodes** (audio, with show notes).
*   **Platform admins** are the primary publishers. Churches, priests, PYC executives, etc. **who have been granted the privilege** can also post episodes/series.
*   Users browse, search, stream episodes, and follow series; new-episode notifications for followers.

### 3.6. Hymnal

*   A dedicated page for browsing the hymn collection, searchable by title, liturgical season/occasion, or hymn number.
*   Each hymn page shows:
    *   Full lyrics (verses/refrain).
    *   **Recorded versions** (audio renditions) where available.
    *   **MIDI files** where available.
    *   **Downloadable Staff / Solfa notations** (PDF/score files) where available.
*   Hymns link to related content (e.g. feasts, saints) where applicable.

### 3.7. Teachings

*   A dedicated catechesis library: teachings about the Catholic Church and the faith.
*   Organised by **topic** (sacraments, morality, prayer, liturgy, Church history, social teaching, apologetics, etc.).
*   Users search for topics and read structured, long-form lessons; related teachings are cross-linked.

### 3.8. Bible

*   A full Bible reader in the spirit of YouVersion: book → chapter → verse navigation, search, and clean reading experience.
*   Launches with the **GNB (Good News Bible)** translation; the data model supports multiple translations.
*   **Future versions:** additional translations, each optionally **downloadable** for offline use.
*   Deep-linked from Readings, Saints, and Teachings wherever scripture is cited.

### 3.9. More (Off-Canvas Menu)

An off-canvas menu that connects the social platform to the Church Management application and the user's account:

*   **Subscribe** — a church (Administrator) subscribes to the Church Management application (chooses a plan: Basic/Premium/Ultimate; activates trial where applicable).
*   **Notifications** — the user's notification center (new content, events, society messages).
*   **Church Management Login** — shown for subscribed churches; logs staff into the CMS (same OTP flow, §2.2).
*   Account actions (sign in / register, profile) and platform links (about, privacy, terms).

## 4. The Church Management Application (CMS)

The CMS is reached from the social platform via **More → Subscribe / Login**. It serves subscribed churches only and mirrors the legacy PHP application's administrative scope, **excluding accounting**.

### 4.1. Dashboard

*   At-a-glance statistics for the church: total members, societies, committees, today's birthdays, recent notifications, subscription status.

### 4.2. Members

*   Full membership records for the church: personal details (name, contact, address, photo), sacramental records (baptised, communicant, confirmed), deceased flag, and society/community affiliations.
*   Create/edit/deactivate members; member profile page consolidates all records; photo upload; print/export tools.

### 4.3. Birthdays

*   Lists members' birthdays — today's celebrants plus upcoming — as an engagement tool (drives greeting messages and Home-feed highlights).

### 4.4. Societies

*   Manage societies/clubs in the church (name, description, leadership, committee flag) and their membership rosters.

### 4.5. Committees

*   Committees are societies flagged as committees. Manage committee membership separately from general societies.

### 4.6. Notifications

*   In-app notification center: list, single view, read/unseen tracking; generated by system events (new content, messages, subscription events).

### 4.7. Messages

*   SMS & email blasts to members, societies, or committees (compose, recipient selection, delivery log). SMS consumes the church's paid SMS balance.

### 4.8. Users & Roles

*   Church admin accounts: create/edit/deactivate CMS users, assign roles (Administrator, Manager, Society-Leader, Parishioner) and permissions.

### 4.9. Profile Settings

*   The logged-in user's own profile: photo, password change, personal details.

### 4.10. Themes & Settings

*   Church-level branding (theme selection) and settings: language, currency display, operational toggles (e.g. manual transaction dates — for the external accounting feed).

### 4.11. Billing

*   The church's **platform subscription**: current plan (Basic/Premium/Ultimate), expiry, renew/upgrade, and SMS balance top-up. This is Ecclesios platform billing — church accounting lives in the external system (§4.12).

### 4.12. Accounting (External)

*   **Not implemented in Ecclesios.** The CMS integrates with an **external accounting API** for ledger, transactions, budgets, and AR/AP.
*   Where relevant, the CMS displays read-only financial summaries fetched from the external service; Ecclesios stores only external reference IDs.
*   **Hierarchy on money:** outstations may record day-to-day collections/dues locally, but every transaction is subject to **parish oversight/approval** (§5.2); deaneries and above see aggregated financial reports only.
*   **Pending collections:** outstation entries are stored in `pending_collections` with status `PENDING`. The parish approves (→ queued for sync to the accounting API → `SYNCED`) or rejects with a note. Only `PENDING` entries can be edited, and only by the recorder. See blueprint §8.1.

### 4.13. Branch / Groups

*   Context switcher between the church groups a user administers (the `groups` tree: Outstation → Parish → Deanery → Diocese/Archdiocese → Metropolitan Province).
*   When switching context, the entire CMS re-scopes: navigation, dashboards, and data views reflect the selected group **and the oversight scope of its hierarchy level** (§5).

## 5. Hierarchy-Scoped RBAC

The CMS enforces permissions along two axes: the user's **role** (§1) and the **hierarchy level of the group they belong to** (see `blueprint.md` §3). The operating chain for this national deployment is:

```
Metropolitan Province
└── Archdiocese / Diocese
    └── Deanery
        └── Parish
            └── Outstation / Mission
                └── Societies & Committees
```

*(Apostolic Nunciature and Pope/Vatican exist in the data model but are out of scope for this deployment.)*

### 5.1. Rules

1.  **Own scope (write):** every user has full write access to the data of their **own group** only — an outstation manages its own members, societies, and records; a parish manages its own.
2.  **Parish → Outstation oversight:** the parish has **full oversight** of its outstations — it can view outstation records, **approve/override outstation transactions**, and intervene administratively. The outstation runs its own facility, but the parish is the financial and administrative supervisor.
3.  **Deanery → Parish monitoring:** the deanery has **monitoring rights only** over parishes — read access to selected aspects of parish activity (membership statistics, sacramental registers, activity summaries, financial summaries). No write, no approval.
4.  **Diocese/Archdiocese → Deanery monitoring:** the diocese monitors consolidated data from the deaneries under it — aggregated reports and dashboards across its deaneries and (through them) parishes.
5.  **Province → national oversight:** the Metropolitan Province has a **general overview** of data from the whole nation — aggregated statistics across all archdioceses/dioceses. Reporting and analytics only; no operational intervention.
6.  **No lateral or upward access:** users can never see data of sibling groups or of any group above their own, beyond what their level's oversight grants.
7.  **Aggregation is computed, not copied:** monitoring levels see roll-ups calculated live from descendant groups; lower groups continue to own and edit their own data.

### 5.2. Scope Matrix

| Data / capability | Outstation (own) | Parish (own + outstations) | Deanery (parishes) | Diocese/Archdiocese (deaneries) | Province (nation) |
|---|---|---|---|---|---|
| Member records | full CRUD (own) | full CRUD (own); **view/approve** outstation members | read statistics of parishes | aggregated view | aggregated view |
| Sacramental registers | record (own) | full CRUD; inspect outstation registers | read/inspect | aggregated view | aggregated view |
| Societies & committees | full CRUD (own) | full CRUD; view outstation societies | read summary | aggregated view | aggregated view |
| Transactions / finances | **record locally** | full CRUD (own); **approve/override outstation transactions** | read financial summaries | read reports | read reports |
| Messaging | own community | own + outstations | deanery-wide | diocesan-wide | national broadcasts |
| Users & roles (own group) | manage | manage | manage | manage | manage |
| Child-group users | — | manage outstation users | — | — | — |
| Dashboards/reports | own data | own + outstation roll-up | deanery roll-up | diocesan roll-up | national roll-up |
| Subscription/billing | — | manages for parish + outstations | — | — | — |

### 5.3. Suffragan Dioceses (metropolitan visibility)

A suffragan diocese sits under its metropolitan archdiocese in the tree, but controls what the archdiocese sees through **Settings → Metropolitan visibility** (Administrator of the diocese only):

*   **Hidden** — the archdiocese sees nothing of this diocese.
*   **Aggregates only** *(default)* — totals and trends.
*   **Detailed** — read-only summary reports with drill-down to parish level.

The archdiocese never gets write access to a suffragan. The Province's national aggregates are unaffected. Changes are audit-logged. See blueprint §3.4–3.5.

### 5.4. Practical examples

*   An **outstation catechist** (Administrator of the outstation group) adds members, records societies, and logs collections — but a collection is final only after the **parish** reviews/approves it in the oversight queue.
*   The **parish priest** (Parish Administrator) sees all outstations on his dashboard, can correct any outstation record, and approves or rejects their transactions; he cannot see the neighbouring parish's data.
*   The **dean** (Deanery Administrator) opens the deanery dashboard: membership totals, register health, and activity summaries for each parish — read-only, with drill-down to the summaries (not raw editing).
*   The **diocesan curia** (Diocese Administrator/Managers) monitor all deaneries: consolidated reports, trends, and compliance flags for the bishop.
*   The **province office** sees the national picture — every diocese's aggregates — for planning and reporting to the bishops' conference.

## 6. Cross-Cutting Behaviour

*   **Subscription gate:** a church whose subscription expires is locked out of the CMS ("not subscribed" state) until renewed; the social platform remains accessible. Subscriptions are held at **parish level** (covering its outstations) unless a diocese procures centrally — deanery/province accounts are monitoring accounts and ride on existing subscriptions.
*   **Moderation:** all Explore content requires Super-Admin approval; podcasts are restricted to the platform and explicitly privileged accounts.
*   **Audit trail:** significant CMS actions and logins are written to the audit log; **oversight actions** (approvals, overrides of outstation data by the parish) are logged with the acting user and group.
*   **OTP security:** both login flows are password → OTP; OTPs expire in 10 minutes and are single-use. OTP/auth endpoints are **rate-limited** (per IP and per identifier) to prevent brute-force enumeration; OTP delivery is logged server-side (pino) until an SMS/email gateway is wired in.
*   **Role-based routing:** after login, users land on the dashboard matching their role; navigation and API access are permission-filtered **by both role and hierarchy scope** (§5).
*   **Data isolation:** every API query is scoped to the caller's group plus its permitted descendant scope (enforced in the NestJS scope guard via `resolveAccess` and the materialised `groups.path` prefix — blueprint §3.5); cross-group access attempts are rejected and audited.
*   **Media handling:** all binaries (hymn audio/MIDI, notation PDFs, podcast episodes, member photos) live in S3-compatible object storage; the API issues short-lived presigned URLs and stores only object keys.
*   **Background jobs:** SMS/email blasts, notification fan-out, and birthday digests run on BullMQ workers (Redis) — never inline in request handlers; delivery results land in the audit/notifications tables.
*   **Offline support (social platform):** the Bible, daily readings, and browsed hymns are cached in IndexedDB for offline reading (a PWA installable on phones); downloaded Bible translations are stored per §3.8. The **mobile app (phase 2)** mirrors this natively — resumable downloads kept on-device (Expo FileSystem/SQLite).
*   **Push notifications (phase 2 — mobile app):** device registration via Expo push with opt-in channels: Saint of the Day, daily Readings, new podcast episodes from followed series, society/committee messages, and birthday reminders. Push is mobile-first; at launch the web PWA relies on in-app notifications.
*   **Bible content licensing:** structured verse data comes from a licensed provider (e.g. API.Bible); development runs on a public-domain translation with GNB enabled once licensing is in place.
