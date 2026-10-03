# Application Functionality

This document is the functional specification for **Ecclesios** — a social platform for the Catholic Church with an integrated Church Management application. See `blueprint.md` for the high-level architecture and scope.

## 1. User Roles

| Role                 | Scope        | Summary                                                                                                                                                                                                                                                                                              |
| -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Super-Admin**      | Platform     | Ecclesios administrator. Not an end-user of a specific church. Manages the application itself: podcasts (primary publisher), Explore moderation, creator privileges, church subscriptions, platform reference data (themes, subscription plans, readings calendar, saints, hymns, teachings, Bible). |
| **Administrator**    | Church group | The main administrator for a specific church group at **any hierarchy level** (outstation, parish, deanery, diocese/archdiocese, province). Full CMS access for their own group; oversight/monitoring rights over descendant groups as determined by their level (§5).                               |
| **Manager**          | Church group | A user with specific management permissions within their own group. Sees only the CMS modules their permissions allow; may hold delegated oversight duties (e.g. diocesan finance officer viewing diocesan reports).                                                                                 |
| **Society-Leader**   | Society      | A leader of a specific society or committee within a church. Manages their society's roster; limited CMS access.                                                                                                                                                                                     |
| **Parishioner**      | Church       | A regular member of the church. Social-platform user with a connected identity; personal CMS visibility (own profile, own societies, notifications).                                                                                                                                                 |
| **Priest / Creator** | Platform     | A verified privileged account on the social platform (priests, PYC executives, etc.). Can author Explore content and post Podcasts **when granted the privilege** by a Super-Admin.                                                                                                                  |
| **Public Visitor**   | —            | Anonymous user. Full read access to the social platform; no authoring, no CMS.                                                                                                                                                                                                                       |

> **Two axes define a user's power:** their **role** (this table) and their **position in the ecclesiastical hierarchy** (§5). A Parish-outstation Administrator, a Parish Administrator, a Deanery Administrator and a Diocesan Administrator all hold the _same role_ — what differs is which group they belong to, and the oversight scope their hierarchy level grants over descendant groups. See `blueprint.md` §3.

> **Roles are per membership (D-014):** a person can belong to several churches, each with its own role — e.g. Administrator of an outstation and Parishioner of a parish. Their church access is the combination of their **active** memberships.

**Two role sets:** church roles (Administrator, Manager, Society-Leader, Parishioner) live on `members`; platform roles (Super-Admin, Creator) live on `users`. They never mix.

Creator/Podcast privileges are grants stored against a `users` account — a user's _role_ (e.g. Society-Leader) is independent of their _platform privileges_ (e.g. can post podcasts).

## 2. Login Flow

### 2.1. Super-Admin Login

- **Route:** `/admin-login`
- **Authentication Table:** `users`
- **Functionality:**
  - A dedicated login page for Super-Admins (and platform-level privileged accounts).
  - Accepts email/telephone and password.
  - Validates credentials against the `users` table.
  - Upon successful validation, an OTP is generated and sent (logged to console for now).
  - User is prompted to enter the OTP.
  - If the OTP is correct, the user is logged in.
  - If `first_login` is NULL, the user is redirected to a "Set Password" page.
  - Otherwise, the user is redirected to the Super-Admin dashboard.
  - Provides appropriate error messages for failed login attempts.

### 2.2. End-User Login (Administrator, Manager, Society-Leader, Parishioner)

- **Route:** `/login`
- **Authentication Table:** `members`
- **Functionality:**
  - A single login page for all end-users.
  - Accepts email/telephone and password.
  - Validates credentials against the `members` table.
  - Upon successful validation, an OTP is generated and sent (logged to console for now).
  - User is prompted to enter the OTP.
  - If the OTP is correct, the user is logged in.
  - If `first_login` is NULL, the user is redirected to a "Set Password" page.
  - Otherwise, the user is redirected to their respective dashboard based on their role.
    - Administrator -> Administrator Dashboard
    - Manager -> Manager Dashboard
    - Society-Leader -> Society-Leader Dashboard
    - Parishioner -> Parishioner Dashboard
  - Provides appropriate error messages for failed login attempts.

### 2.3. Auth API contract (implemented — Phase 2)

All routes are under `/api/auth`, rate-limited, and return the standard error envelope `{ error: { code, message, details?, requestId } }`. Request/response schemas live in `packages/shared/src/schemas/auth.ts`.

| Step | Route                                                 | Body → Response                                                                                              |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1    | `POST /admin-login` (users) · `POST /login` (members) | `{ identifier, password }` → `{ challengeToken, expiresInSeconds, delivery }`                                |
| 2    | `POST /verify-otp`                                    | `{ challengeToken, otp }` → `AUTHENTICATED` + tokens, or `PASSWORD_SETUP_REQUIRED` + `tempToken` (15 min)    |
| 2b   | `POST /set-password`                                  | `{ tempToken, newPassword }` → tokens; sets `first_login`                                                    |
| —    | `POST /refresh`                                       | `{ refreshToken }` → new token pair (rotating)                                                               |
| —    | `POST /logout`                                        | `{ refreshToken }` → 204                                                                                     |
| —    | `POST /register`                                      | see §2.4 → 201 `{ status: "REGISTERED", membership: { status: "PENDING", church } }`                         |
| —    | `GET /api/public/plans`                               | → `{ items: [plan] }` (§4.11)                                                                                |
| —    | `GET /api/public/churches?q=`                         | → `{ items: [{ id, name, level, parish, deanery, diocese }] }` (max 20, active parishes **and outstations**) |

- **Identifier** is an email or an E.164 telephone. **Password policy:** 10–128 characters, at least one letter and one digit.
- **Errors never reveal whether an account exists:** unknown account and wrong password both return `INVALID_CREDENTIALS`. `ACCOUNT_DISABLED` is shown only after a correct password.
- **Lockout:** 5 wrong passwords lock the account for 15 minutes (`ACCOUNT_LOCKED`, 423).
- **OTP:** 6 digits, 10 minutes, single use, 5 wrong attempts end the challenge (`OTP_ATTEMPTS_EXCEEDED`).
- **Rate limits (per 15 min):** 30 requests per IP across all auth routes; 5 login attempts per identifier. Over the limit → 429 `RATE_LIMITED` with `Retry-After`.
- **Tokens:** access token 15 min (Bearer; names the person only — churches and roles come from memberships, checked per request, D-015); refresh token 30 days, rotated on every use (one session per account until the sessions table — D-007).
- **Audit:** failed logins, lockouts, OTP sends/failures, successful logins, password setup, logout and refresh-token reuse are written to `audit_logs`.

### 2.4. Self-Registration

- **Route:** `/register` (link from Sign in and the More menu).
- **Flow:** search for and choose your **parish or outstation** → names, email and/or phone (at least one), optional gender and date of birth → choose a password → **Create account**.
- The person can **sign in immediately** and use the whole social platform (D-015). A **PENDING home membership** request goes to the chosen church; its Administrators — and for an outstation, the parish's Administrators too — are notified.
- Until approved, a banner says "Waiting for _St Michael Outstation_ to confirm your membership"; only that church's members-only features are locked.
- An email or phone already in use is refused (`ACCOUNT_EXISTS`). Sign-up is limited to 10 requests per IP per hour.

### 2.5. Memberships, Following and the Home Church (D-014 – D-016)

|                                                      | Anyone signed in (any status)         | Active member of church X          |
| ---------------------------------------------------- | ------------------------------------- | ---------------------------------- |
| Readings, Bible, Hymnal, Saints, Podcasts, Teachings | ✅                                    | ✅                                 |
| Follow churches; see their public posts and events   | ✅                                    | ✅                                 |
| Comment on Explore                                   | ✅                                    | ✅                                 |
| Post on Explore                                      | only approved content creators (§3.4) | church Administrators: in X's name |
| X's members-only notices, societies, dues            | ❌                                    | ✅                                 |
| CMS for X                                            | ❌                                    | ✅ if their role there allows      |

- **Follow** (`PUT/DELETE /api/groups/:id/follow`): one tap, no approval, public content in the feed.
- **Join** (`POST /api/groups/:id/join`): a membership request to a parish or outstation; also follows it. A person may belong to **several churches**. **Leave / cancel:** `DELETE /api/groups/:id/membership`. Rejected or left memberships can be requested again.
- **Approval:** `GET /api/groups/:id/membership-requests` and `POST /api/membership-requests/:id/decision` (`approve`, or `reject` with a reason) — by an Administrator of that church, or of its parish for an outstation. The person is notified.
- **Me:** `GET /api/me` returns the person, their memberships (pending and active) and follows.
- **Home church:** exactly one membership is the person's home — the first church they join. The home church's staff (and its parish) edit the person's sacramental records; other churches where they are active can read them. A person can **request a transfer** of their home to another church where they are already an active member; the receiving church (or its parish) approves and the previous home is notified (UI: Phase 6).

## 3. The Social Platform (Main Application)

The main application is what every user sees. It has a fixed primary navigation with the sections below. All content sections are publicly readable; authoring is privilege-gated.

### 3.1. Home

- A blended feed that "shows a bit of all the posts": upcoming events, saint of the day, hymn highlights, new teachings, latest podcast episodes, and featured Explore content.
- Sections are ordered by relevance/recency; signed-in users additionally see content from their church and societies.
- Entry cards deep-link into each dedicated section.
- **Implemented (Phase 5.8, D-032, D-033):**
  - **Today card:** the liturgical day and the day's Gospel, linking to Readings.
  - **Watch row (D-034):** a horizontal, swipeable row of the newest videos — podcast episodes, Explore posts and hymns with YouTube links. Tapping one plays it in a pop-up player with a link to its page.
  - **Feed tabs:** *For you* — new Explore posts, new teachings, new podcast episodes and Ecclesios news, newest first; *Following* — posts from churches and episodes from podcasts the member follows.
  - **Right rail (sticky, like Twitter's):** **Ecclesios news** (pinned first), **saint of the day**, **hymn of the day** (chosen for the season, or pinned by the Ecclesios team for a feast), **trending on Explore** (posts with the most recent comments, weighed against age), **upcoming events**.
  - The "Write" box appears only for people who may post on Explore (D-017).
  - API: `GET /api/public/home?date=` · `GET /api/public/home/feed?tab=for-you|following&page=`.
- **Ecclesios news (D-032):** official announcements from the Ecclesios team — published at once or scheduled, optionally pinned, optionally leaving Home after a date. `/news`, `/news/:slug`; `GET /api/public/news`, `GET /api/public/news/:slug`; Super-Admin `/api/platform/news`.

### 3.2. Readings

- Daily Mass readings in the style of usccb.org, for **every day of the liturgical calendar**: First Reading, Responsorial Psalm, Second Reading (Sundays/solemnities), Gospel.
- Date navigation (today, pick a date, prev/next day) and liturgical-season context (Advent, Christmas, Lent, Easter, Ordinary Time; feast/saint commemorations shown on their days).
- Backed by a readings calendar table seeded/administered by the platform; the Bible reader (§3.8) can open any cited passage.
- **Implemented (Phase 5.1, D-022):** `GET /api/public/readings/:date` (`YYYY-MM-DD` or `today`) returns `{ date, season, color, sundayCycle, weekdayCycle, celebration, available, readings: [{ kind, citation, response, text[] }], source }`. Season, colour and cycles are computed from the date; celebrations and texts are data. Super-Admins replace a day with `PUT /api/platform/readings/:date` (at least one Gospel). Web: `/readings` and `/readings/:date` with previous / today / next, a date picker, one tab per reading, and citation links into the Bible.
- **Licensing:** lectionary translations are copyrighted; only licensed text is loaded, credited per day (`source`). Development data uses placeholder text.

### 3.3. Saints

- **Saint of the Day** — automatically surfaces the saint(s) whose feast falls on today's date.
- **Saint Directory** — searchable list of saints; each saint page shows biography, feast day, patronage, and related readings/hymns where available.
- **Implemented (Phase 5.3, D-025):** `GET /api/public/saints/today?date=` (highest-ranked saint of the reader's local date, plus others), `GET /api/public/saints?q=&month=` (calendar order; searches names, summaries and patronage), `GET /api/public/saints/:slug`; Super-Admins maintain entries with `PUT /api/platform/saints/:slug`. Web: Saint of the Day card on Home and Saints, directory with search and month filter (`/saints?month=10&q=missions`), saint pages at `/saints/:slug`. Links to related readings and hymns come with those modules.

### 3.4. Explore

- The authoring space for privileged user types: **churches, priests, and approved creators** (e.g. PYC executives).
- **Who may post (D-017):** to keep order and reverence, posting is a privilege. **Approved content creators** (members or platform accounts holding the `AUTHOR_EXPLORE` grant, given by a Super-Admin after the person applies) post under their own name. **Church Administrators** (priests / parish offices, at any level) post **in their church's name**, for that church only. Ordinary members — pending or approved — read, follow and **comment**, but do not post.
- Content types: **church profiles, priest profiles, events, and educational content** (articles, catechetical resources, media posts).
- Authored content enters a **moderation queue**; Super-Admins approve before it appears publicly.
- Public users browse approved content: upcoming events across churches, educational posts, church and priest profiles.
- **Implemented (Phase 5.7, D-031):** posts are **articles** or **events**; drafts are submitted for review; any edit takes a post back to draft until it is reviewed again. Members comment (post-moderated: visible at once, hidden after 3 reports or by the post's church/author; Super-Admins review reports). Church pages show the church's about text, Mass times and contact details (edited by its Administrators) with its posts and a Follow button; "Churches I follow" lists their posts. API: `GET /api/public/explore/posts?kind=&church=&following=1&past=1&q=` · `GET /api/public/explore/posts/:id` (+ `/comments`) · `GET /api/public/explore/churches/:id` · authoring under `/api/explore/my-posts` · comments under `/api/explore/…` · moderation under `/api/platform/explore` (Super-Admin). Web: `/explore`, `/explore/posts/:id`, `/explore/churches/:id`, `/explore/mine`, `/explore/write/:id`. Console: Platform → Explore moderation; creators: Explore posts.

### 3.4a. Likes, saves, shares and comments (D-035)

- **Like (♥), Save and Share** on Explore posts, teachings, podcast episodes and hymns. Like counts show on every card; what you save is private and listed under **Saved** (More menu).
- **Share** opens the phone's share menu (WhatsApp, SMS…) or copies the link on a computer.
- **Comments** are on Explore posts only. They **cannot contain links**. Type **@** to mention someone from the conversation or from your own church; they are notified. (Personal @usernames come with member profiles.)

### 3.5. Podcasts

- A podcast library of **series** and their **episodes**. Each episode leads with **uploaded audio** or a **YouTube / YouTube Music video** (embedded player), and may carry both; show notes, an optional **transcript** and **PDF handouts** (D-029).
- **Video later:** self-hosted video is reserved for a managed video service (smaller versions for mobile data); until then video comes from YouTube links. The section may be renamed (e.g. "Listen & Watch") once hosted video exists.
- **Access:** each episode is free or subscribers-only; everything stays open until listener subscriptions launch (D-026, D-029).
- **Mini-player:** audio keeps playing in a bar at the bottom while you browse, resumes where you left off, and works with lock-screen controls.
- **Platform admins** are the primary publishers. Churches, priests, PYC executives, etc. **who have been granted the privilege** can also post episodes/series.
- Users browse, search, stream episodes, and follow series; new-episode notifications for followers.
- **Implemented (Phase 5.5, D-027):** `GET /api/public/podcasts?q=&category=&page=` · `GET /api/public/podcasts/:slug` (published episodes, newest first) · `GET /api/public/podcasts/episodes/:id/url` (short-lived stream link). Members: `GET /api/podcasts/following`, `PUT|DELETE /api/podcasts/:slug/follow`. Publishing studio for Super-Admins and `POST_PODCASTS` holders: `/api/studio/podcasts` (series, cover upload, episodes, presigned audio upload, publish / unpublish, delete). A series belongs to one owner; episodes are drafts until their audio is uploaded and they are published; followers are notified on the first publish. Web: `/podcasts`, `/podcasts/:slug`. Console: Platform → Podcasts (Super-Admins) and the Creator studio (creator accounts).
- **Added in D-029:** `GET /api/public/podcasts/episodes/:id/transcript` · `GET /api/public/podcasts/attachments/:id/url`; studio `PUT …/episodes/:id/youtube`, `POST …/episodes/:id/attachment-upload`, `POST …/episodes/:id/attachments`, `DELETE …/attachments/:attachmentId`; episodes carry `mediaKind`, `access`, `transcript`.

### 3.6. Hymnal

- A dedicated page for browsing the hymn collection, searchable by **hymn number**, **first line**, title, words of the hymn, hymn book, or season/occasion.
- **Numbers belong to hymn books, not hymns (D-026).** The same hymn can be NCH 56 in the New Catholic Hymnal and another number in the older Catholic Hymnal (CH) or in another country's book. Typing `56`, `NCH 56` or `ch 12` finds it; the reader's own country's books are listed first.
- Each hymn page shows:
  - The hymn's numbers in each book, and its season/occasion tags.
  - Full lyrics (verses and refrain).
  - **Tunes** — one or more per hymn, one marked default. For each tune:
    - **Recordings** (uploaded audio — e.g. Piano, Choir, Voice), one marked default.
    - **MIDI** file.
    - **Staff notation** and **sol-fa notation** (PDF).
    - **YouTube / YouTube Music** links, played in an embedded player.
- **Access (D-026):** every item is Free or Subscribers-only. Defaults: lyrics, MIDI and the default recording are free; notation, extra recordings and YouTube links are for subscribers. Subscriber items stay open until personal subscriptions (and playlists / play queues) are introduced; locked items show a "Subscribers" badge.
- Hymns link to related content (e.g. feasts, saints) where applicable.
- **Licensing:** each hymn and item records its source or permission. Public-domain texts can be published freely; hymnal arrangements, scores and copyrighted texts need the publisher's permission.
- **Implemented (Phase 5.4):** `GET /api/public/hymnal/books` · `GET /api/public/hymnal/hymns?q=&book=&tag=&country=&page=` · `GET /api/public/hymnal/hymns/:slug` · `GET /api/public/hymnal/media/:id/url` (short-lived link; `403 MEDIA_LOCKED` behind the paywall). Super-Admin: `/api/platform/hymnal/hymns` (create, edit, numbers, tags), tunes, presigned uploads and media (`…/tunes/:id/uploads`, `…/tunes/:id/media`, `PATCH|DELETE …/media/:id`). Web: `/hymnal`, `/hymnal/:slug`. Console: Platform → Hymnal.

### 3.7. Teachings

- A dedicated catechesis library: teachings about the Catholic Church and the faith.
- Organised by **topic** (sacraments, morality, prayer, liturgy, Church history, social teaching, apologetics, etc.).
- Users search for topics and read structured, long-form lessons; related teachings are cross-linked.
- **Official content (D-030):** written and published by Ecclesios administrators, with an optional "Reviewed by" line (e.g. a priest). Lessons cite the Bible (links open the reader) and the Catechism by paragraph number (e.g. CCC 1324).
- **Implemented (Phase 5.6):** `GET /api/public/teachings/topics` · `GET /api/public/teachings?q=&topic=&page=` · `GET /api/public/teachings/:slug` (lesson source, topics, reading time, related). Super-Admin: `/api/platform/teachings` (create, edit, publish / unpublish — refused while the lesson has problems — delete) and `/api/platform/teachings/topics`. Web: `/teachings`, `/teachings/:slug`. Console: Platform → Teachings, with a live preview.

### 3.8. Bible

- A full Bible reader in the spirit of YouVersion: book → chapter → verse navigation, search, and clean reading experience.
- Launches with a **translation picker** (D-023): **World English Bible, Catholic edition** (default) and **Douay-Rheims**, both public domain with the deuterocanonical books. **GNB (Good News Bible)** is added as another translation once licensed. The reader remembers the chosen translation on each device.
- **Implemented (Phase 5.2):** `GET /api/public/bible/translations` · `/:translation/books` (73 books, Catholic order, chapters loaded) · `/:translation/:book/:chapter` (verses, words of Jesus, previous/next) · `/:translation/search?q=`. Web: `/bible/:book/:chapter`, and `/bible?ref=Luke 10:13-16` from Readings opens the chapter with those verses highlighted. Chapters already read are kept offline for translations whose licence allows it.
- **Future versions:** additional translations, each optionally **downloadable** for offline use.
- Deep-linked from Readings, Saints, and Teachings wherever scripture is cited.

### 3.9. More (Off-Canvas Menu)

An off-canvas menu that connects the social platform to the Church Management application and the user's account:

- **Subscribe** — a church (Administrator) subscribes to the Church Management application (chooses a plan: Basic/Premium/Ultimate; activates trial where applicable).
- **Notifications** — the user's notification center (new content, events, society messages).
- **Church Management Login** — shown for subscribed churches; logs staff into the CMS (same OTP flow, §2.2).
- Account actions (sign in / register, profile) and platform links (about, privacy, terms).

## 4. The Church Management Application (CMS)

The CMS is reached from the social platform via **More → Subscribe / Login**. It serves subscribed churches only and mirrors the legacy PHP application's administrative scope, **excluding accounting**.

### 4.1. Dashboard

- At-a-glance statistics for the church: total members, societies, committees, today's birthdays, recent notifications, subscription status.

### 4.2. Members

- Full membership records for the church: personal details (name, contact, address, photo), sacramental records (baptised, communicant, confirmed), deceased flag, and society/community affiliations.
- Create/edit/deactivate members; member profile page consolidates all records; photo upload; print/export tools.

### 4.3. Birthdays

- Lists members' birthdays — today's celebrants plus upcoming — as an engagement tool (drives greeting messages and Home-feed highlights).

### 4.4. Societies

- Manage societies/clubs in the church (name, description, leadership, committee flag) and their membership rosters.

### 4.5. Committees

- Committees are societies flagged as committees. Manage committee membership separately from general societies.

### 4.6. Notifications

- In-app notification center: list, single view, read/unseen tracking; generated by system events (new content, messages, subscription events).

### 4.7. Messages

- SMS & email blasts to members, societies, or committees (compose, recipient selection, delivery log). SMS consumes the church's paid SMS balance.

### 4.8. Users & Roles

- Church admin accounts: create/edit/deactivate CMS users, assign roles (Administrator, Manager, Society-Leader, Parishioner) and permissions.

### 4.9. Profile Settings

- The logged-in user's own profile: photo, password change, personal details.

### 4.10. Themes & Settings

- Church-level branding (theme selection) and settings: language, currency display, operational toggles (e.g. manual transaction dates — for the external accounting feed).

### 4.11. Billing

- The church's **platform subscription**: current plan (Basic/Premium/Ultimate), expiry, renew/upgrade, and SMS balance top-up. This is Ecclesios platform billing — church accounting lives in the external system (§4.12).
- Shown to the parish **Administrator** only (the parish holds the subscription; outstations are covered by it).
- **Until online payment exists (D-021):** the Administrator can start a **one-time free trial** on any plan (no SMS credit during the trial); activation, renewal and upgrade are done by the Ecclesios team in the platform console against a payment reference. Unused days and SMS credit carry over on renewal.
- API: `GET /api/public/plans` · `POST /api/groups/:id/subscription/trial` · `GET /api/platform/subscriptions` · `POST /api/platform/subscriptions` (Super-Admin).

### 4.12. Accounting (External)

- **Not implemented in Ecclesios.** The CMS integrates with an **external accounting API** for ledger, transactions, budgets, and AR/AP.
- Where relevant, the CMS displays read-only financial summaries fetched from the external service; Ecclesios stores only external reference IDs.
- **Hierarchy on money:** outstations may record day-to-day collections/dues locally, but every transaction is subject to **parish oversight/approval** (§5.2); deaneries and above see aggregated financial reports only.
- **Pending collections:** outstation entries are stored in `pending_collections` with status `PENDING`. The parish approves (→ queued for sync to the accounting API → `SYNCED`) or rejects with a note. Only `PENDING` entries can be edited, and only by the recorder. See blueprint §8.1.

### 4.13. Branch / Groups

- Context switcher between the church groups a user administers (the `groups` tree: Outstation → Parish → Deanery → Diocese/Archdiocese → Metropolitan Province).
- When switching context, the entire CMS re-scopes: navigation, dashboards, and data views reflect the selected group **and the oversight scope of its hierarchy level** (§5).
- Contexts are the person's ACTIVE memberships with a CMS role — Administrator, Manager or Society-Leader (`GET /api/cms/contexts`, D-020). The sidebar follows the role in the selected church: Managers have no Users & Roles, Settings or Billing; Society-Leaders see Dashboard, Members, Birthdays, Societies, Committees and Notifications.

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

_(Apostolic Nunciature and Pope/Vatican exist in the data model but are out of scope for this deployment.)_

### 5.1. Rules

1.  **Own scope (write):** every user has full write access to the data of their **own group** only — an outstation manages its own members, societies, and records; a parish manages its own.
2.  **Parish → Outstation oversight:** the parish has **full oversight** of its outstations — it can view outstation records, **approve/override outstation transactions**, and intervene administratively. The outstation runs its own facility, but the parish is the financial and administrative supervisor.
3.  **Deanery → Parish monitoring:** the deanery has **monitoring rights only** over parishes — read access to selected aspects of parish activity (membership statistics, sacramental registers, activity summaries, financial summaries). No write, no approval.
4.  **Diocese/Archdiocese → Deanery monitoring:** the diocese monitors consolidated data from the deaneries under it — aggregated reports and dashboards across its deaneries and (through them) parishes.
5.  **Province → national oversight:** the Metropolitan Province has a **general overview** of data from the whole nation — aggregated statistics across all archdioceses/dioceses. Reporting and analytics only; no operational intervention.
6.  **No lateral or upward access:** users can never see data of sibling groups or of any group above their own, beyond what their level's oversight grants.
7.  **Aggregation is computed, not copied:** monitoring levels see roll-ups calculated live from descendant groups; lower groups continue to own and edit their own data.

### 5.2. Scope Matrix

| Data / capability         | Outstation (own)   | Parish (own + outstations)                                    | Deanery (parishes)          | Diocese/Archdiocese (deaneries) | Province (nation)   |
| ------------------------- | ------------------ | ------------------------------------------------------------- | --------------------------- | ------------------------------- | ------------------- |
| Member records            | full CRUD (own)    | full CRUD (own); **view/approve** outstation members          | read statistics of parishes | aggregated view                 | aggregated view     |
| Sacramental registers     | record (own)       | full CRUD; inspect outstation registers                       | read/inspect                | aggregated view                 | aggregated view     |
| Societies & committees    | full CRUD (own)    | full CRUD; view outstation societies                          | read summary                | aggregated view                 | aggregated view     |
| Transactions / finances   | **record locally** | full CRUD (own); **approve/override outstation transactions** | read financial summaries    | read reports                    | read reports        |
| Messaging                 | own community      | own + outstations                                             | deanery-wide                | diocesan-wide                   | national broadcasts |
| Users & roles (own group) | manage             | manage                                                        | manage                      | manage                          | manage              |
| Child-group users         | —                  | manage outstation users                                       | —                           | —                               | —                   |
| Dashboards/reports        | own data           | own + outstation roll-up                                      | deanery roll-up             | diocesan roll-up                | national roll-up    |
| Subscription/billing      | —                  | manages for parish + outstations                              | —                           | —                               | —                   |

### 5.3. Suffragan Dioceses (metropolitan visibility)

A suffragan diocese sits under its metropolitan archdiocese in the tree, but controls what the archdiocese sees through **Settings → Metropolitan visibility** (Administrator of the diocese only):

- **Hidden** — the archdiocese sees nothing of this diocese.
- **Aggregates only** _(default)_ — totals and trends.
- **Detailed** — read-only summary reports with drill-down to parish level.

The archdiocese never gets write access to a suffragan. The Province's national aggregates are unaffected. Changes are audit-logged. See blueprint §3.4–3.5.

### 5.4. Practical examples

- An **outstation catechist** (Administrator of the outstation group) adds members, records societies, and logs collections — but a collection is final only after the **parish** reviews/approves it in the oversight queue.
- The **parish priest** (Parish Administrator) sees all outstations on his dashboard, can correct any outstation record, and approves or rejects their transactions; he cannot see the neighbouring parish's data.
- The **dean** (Deanery Administrator) opens the deanery dashboard: membership totals, register health, and activity summaries for each parish — read-only, with drill-down to the summaries (not raw editing).
- The **diocesan curia** (Diocese Administrator/Managers) monitor all deaneries: consolidated reports, trends, and compliance flags for the bishop.
- The **province office** sees the national picture — every diocese's aggregates — for planning and reporting to the bishops' conference.

## 6. Cross-Cutting Behaviour

- **Subscription gate:** a church whose subscription expires is locked out of the CMS ("not subscribed" state) until renewed; the social platform remains accessible. Subscriptions are held at **parish level** (covering its outstations) unless a diocese procures centrally — deanery/province accounts are monitoring accounts and ride on existing subscriptions. The API answers gated routes with **402 SUBSCRIPTION_REQUIRED**; deaneries, dioceses and the province are not gated (D-020). Central diocesan procurement is a later addition.
- **Moderation:** all Explore content requires Super-Admin approval; podcasts are restricted to the platform and explicitly privileged accounts.
- **Audit trail:** significant CMS actions and logins are written to the audit log; **oversight actions** (approvals, overrides of outstation data by the parish) are logged with the acting user and group.
- **OTP security:** both login flows are password → OTP; OTPs expire in 10 minutes and are single-use. OTP/auth endpoints are **rate-limited** (per IP and per identifier) to prevent brute-force enumeration; OTP delivery is logged server-side (pino) until an SMS/email gateway is wired in.
- **Role-based routing:** after login, users land on the dashboard matching their role; navigation and API access are permission-filtered **by both role and hierarchy scope** (§5).
- **Data isolation:** every API query is scoped to the caller's group plus its permitted descendant scope (enforced in the NestJS scope guard via `resolveAccess` and the materialised `groups.path` prefix — blueprint §3.5); cross-group access attempts are rejected and audited.
- **Media handling:** all binaries (hymn audio/MIDI, notation PDFs, podcast episodes, member photos) live in S3-compatible object storage; the API issues short-lived presigned URLs and stores only object keys.
- **Background jobs:** SMS/email blasts, notification fan-out, and birthday digests run on BullMQ workers (Redis) — never inline in request handlers; delivery results land in the audit/notifications tables.
- **Offline support (social platform):** the Bible, daily readings, and browsed hymns are cached in IndexedDB for offline reading (a PWA installable on phones); downloaded Bible translations are stored per §3.8. The **mobile app (phase 2)** mirrors this natively — resumable downloads kept on-device (Expo FileSystem/SQLite).
- **Push notifications (phase 2 — mobile app):** device registration via Expo push with opt-in channels: Saint of the Day, daily Readings, new podcast episodes from followed series, society/committee messages, and birthday reminders. Push is mobile-first; at launch the web PWA relies on in-app notifications.
- **Bible content licensing:** structured verse data comes from a licensed provider (e.g. API.Bible); development runs on a public-domain translation with GNB enabled once licensing is in place.
