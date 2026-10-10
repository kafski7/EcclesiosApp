# Ecclesios Social Platform UI Specification

**Document:** `social.md`  
**Version:** 0.8  
**Scope:** `apps/web` only  
**Status:** Adopted — slices S1–S5 and layout fixes built (D-042 – D-049)

## 1. Purpose

This document defines the user experience, navigation, layout, pages, and interface rules for the Ecclesios social media platform in `apps/web`.

Ecclesios has two distinct product experiences:

1. **Social Platform (`apps/web`)**: a public-facing Catholic content and community experience.
2. **Church Management Console (`apps/admin`)**: an operational application for church administration, records, workflows, and reporting.

This specification applies only to the Social Platform. Changes made under this specification must not redesign or alter the Church Management Console unless a shared technical contract must be updated deliberately.

## 2. Product Direction

The Social Platform must feel like a modern social and content product, not like an administrative console. It should prioritize:

- Catholic content discovery
- Daily spiritual engagement
- Community participation
- Reading, listening, watching, saving, and sharing
- Clear access to parish and Church content
- A calm, welcoming, contemporary interface
- Responsive use across desktop, tablet, mobile web, and installed PWA

The platform may share brand identity, API contracts, authentication, and selected technical foundations with the Console, but its layout and interaction patterns may evolve independently.

## 3. Application Boundary

### 3.1 Social Platform

The following belong to `apps/web` and may be changed under this specification:

- Social shell and navigation
- Home feed
- Readings
- Saints
- Explore
- Podcasts
- Hymnal
- Teachings
- Books
- Bible
- Platform news
- Search and search results
- Notifications
- Public and member profiles
- Bookmarks, saved content, and personal library
- Authentication and registration screens
- Social interactions
- Responsive and PWA behaviour

### 3.2 Church Management Console

The following remain within `apps/admin` and are outside this redesign:

- Administrative dashboards
- Member records and approval workflows
- Birthdays administration
- Societies and committees administration
- Collections management
- Group management
- Users and roles
- Church settings
- Subscription and billing administration
- Administrative messaging and notifications
- Reports and operational forms

### 3.3 Shared Foundations

Changes to these shared areas must be intentional and must not cause unplanned Console UI changes:

- `packages/shared` Zod schemas and TypeScript types
- Authentication and session contracts
- Brand identity and approved design tokens
- Backend API contracts
- Shared domain rules
- Object-storage and media conventions

Where a visual component needs to diverge, the Social Platform should use an `apps/web` implementation rather than altering a component relied upon by `apps/admin`.

## 4. Primary Navigation

The left sidebar is dedicated to product navigation and content discovery.

### 4.1 Main Sidebar Items

The primary order is:

1. Home
2. Readings
3. Saints
4. Explore
5. Podcasts
6. Hymnal
7. Teachings
8. Books
9. Bible
10. More

Each item must include:

- A recognizable icon
- A text label on expanded desktop navigation
- A clear active state
- Keyboard focus styling
- An accessible name

### 4.2 Sidebar Rules

- The sidebar must not contain the signed-in user's profile block.
- The sidebar must not become an account-management area.
- It should remain visually stable between public and authenticated states.
- Role-specific administrative navigation must not be mixed into the Social Platform sidebar.
- Access to the Church Management Console, when permitted, belongs in the profile menu.
- The sidebar uses the same light surface as the page, not a dark panel (it felt console-like); the active item is gold (D-046).

### 4.3 More Menu

`More` provides access to secondary destinations that should not overcrowd the main sidebar. Candidate entries include:

- Platform news
- Bookmarks
- My Library
- Downloads
- About Ecclesios
- Help and support
- Policies and legal information

The final contents may vary by authentication state and feature availability.

## 5. Top Header

The top header is the home of global actions and the authenticated user's account entry point.

### 5.1 Header Contents

The header should include:

- Ecclesios brand or contextual page title, depending on viewport
- One global search entry point
- Notifications icon
- Profile avatar for authenticated users
- Sign in or Create account actions for visitors
- Mobile navigation control where required

Direct messages may be added beside notifications when the messaging experience is ready for the Social Platform.

### 5.2 Search Rule

Ecclesios must have one global search entry point in the top bar. It opens or routes to a unified search experience across supported social content. Individual Home-page search fields must not duplicate it.

### 5.3 Notifications

For authenticated users:

- The notification icon appears in the top-right area.
- An unread indicator may be shown when unread items exist.
- Selecting the icon opens a notification panel or the Notifications page.
- Notification handling must remain separate from the Church Management Console's administrative workflow screens.

## 6. Profile Placement and Account Menu

### 6.1 Placement Decision

For authenticated users, the profile is displayed in the top-right header beside the notification icon. It must not appear as a profile block in the sidebar.

This keeps the sidebar focused on content navigation and places account controls in the conventional global-action area.

### 6.2 Profile Trigger

The profile trigger should display:

- User avatar or generated fallback
- Accessible account-menu label
- Optional compact display name on sufficiently wide screens

Selecting it opens the account menu.

### 6.3 Account Menu

**Built in S5 (D-049):** Your profile (`/me`), Your churches (`/me#churches`), Saved, My library, Notifications, Account settings, Church Management (authorized only), Sign out. *Switch parish* is *Make home church* on Your churches; *Edit profile* is Account settings until public profiles (Phase 8).

**Built in S1:** name and home church (marked _pending_ while waiting), Your account, Saved, My library, Notifications, Church Management (authorized accounts only), Sign out. Platform accounts see Your account, Church Management (platform door) and Sign out. The remaining items below arrive with the pages they open (Phase 8 member profiles; memberships page).

The menu may contain:

- View Profile
- Edit Profile
- Bookmarks
- My Library
- Downloads
- Notification Settings
- Memberships
- Parish or membership context
- Switch Parish, where permitted by membership rules
- Church Management Console, only for an authorized user
- Account Settings
- Sign Out

Items must be hidden when unavailable or unauthorized. The menu must not imply access that the account does not possess.

### 6.4 Visitor State

Visitors do not see a profile avatar. They see clear actions such as:

- Sign In
- Create Account

These actions must not overwhelm the content experience.

## 7. Desktop Layout

The default desktop experience should use a three-region structure where the page warrants it:

1. **Left navigation:** persistent product navigation
2. **Main content:** primary page content or feed
3. **Right rail:** contextual supporting content

The right rail is optional and page-dependent. It must not be used merely to fill space.

Potential right-rail content includes:

- Platform news written by platform administrators
- Suggested content
- Upcoming liturgical or community items
- Continue reading or listening
- Relevant parish information

Platform news must remain distinct from Explore content.

On Home (D-046):

- **Today's card** (date, celebration or season, Gospel) is the first card in the right rail. Where the rail is hidden (≤1150px) it stays at the top of the feed, above the Today strip.
- The right rail has **no scroll bar of its own**. It scrolls with the page; once its last card is on screen it stays in place while the feed keeps loading, and scrolling up brings its first card back under the top bar.

## 8. Responsive Behaviour

### 8.1 Tablet

- The left navigation may collapse to icons or a drawer.
- The main content remains the dominant region.
- The right rail may move below the main content or disappear when it is supplementary.
- Header search, notifications, and profile remain accessible.

### 8.2 Mobile

- The desktop sidebar becomes a mobile navigation pattern.
- The top header retains access to search, notifications, and profile.
- Touch targets must be comfortably sized.
- Menus and sheets must be dismissible and keyboard accessible.
- Content cards use the available width without desktop-style crowding.
- Reading and media experiences should minimize persistent chrome.

The final mobile navigation pattern must avoid duplicating the full navigation in multiple visible places.

## 9. Page Specifications

### 9.1 Home

**Purpose:** Provide a personalized or generally relevant starting point for daily use.

Possible sections:

- Daily readings highlight
- Saint of the day
- Main social/content feed
- Continue reading or listening
- Recommended teachings, hymns, podcasts, books, or Explore posts
- Platform news in the right rail on desktop

Home must not include a second search field. Global search remains in the top bar.

### 9.2 Readings

**Purpose:** Present the liturgical readings in a focused, readable format.

Core experience:

- Date and liturgical context
- Reading sections in canonical order
- Previous and next day controls
- Calendar/date selection
- Save, share, and related actions where supported
- Clean reading typography

### 9.3 Saints

**Purpose:** Help users discover and read about saints and observances.

Core experience:

- Saint of the day
- Search or browse
- Saint cards
- Biography or article view
- Feast date and relevant metadata
- Save and share actions

### 9.4 Explore

**Purpose:** Provide discovery and community content from authorized publishers.

Publishing is restricted to parish administrators, priests, and designated approved content creators. Ordinary members may interact where permitted but do not publish freely.

Core experience:

- Mixed content feed
- Filters or topics
- Parish and broader Church content
- Media-rich posts
- Visible interaction counts
- Comments on posts

### 9.5 Podcasts

**Purpose:** Support discovery and playback of Catholic audio content, with room for video formats.

Core experience:

- Show and episode discovery
- Episode detail pages
- Audio playback
- YouTube embed support where applicable
- Continue listening
- Save, like, and share actions
- Visible interaction counts

The episode model should support multiple media types so that video can expand later without replacing the underlying content model.

### 9.6 Hymnal

**Purpose:** Provide a searchable, structured digital hymnal.

Core experience:

- Search by title, first line, hymn book, reference, or number
- Structured hymn book plus number references
- Ghanaian hymn books such as NCH and CH
- Lyrics or hymn text where properly licensed or supplied
- Audio, MIDI, and notation assets where available
- Save, like, and share actions
- Visible interaction counts

A hymn number alone must not be treated as the universal identity of a hymn.

### 9.7 Teachings

**Purpose:** Present structured Catholic teaching content in a calm reading experience.

Core experience:

- Featured and recent teachings
- Topics and categories
- Teaching detail page
- Related Scripture, Catechism, or teaching references
- Save, like, and share actions
- Visible interaction counts

Comments are not required for teachings.

### 9.8 Books

**Purpose:** Help users discover and read supported books or documents.

Core experience:

- Library or catalogue
- Book detail page
- Reading view
- Continue reading
- Saved books and personal library
- Downloads or offline access where supported

### 9.9 Bible

**Purpose:** Provide a focused Bible-reading and navigation experience.

Core experience:

- Translation selector
- Book and chapter navigation
- Passage display
- Search
- Share and save passage actions where supported
- World English Bible, Catholic edition (WEBC) as the default translation (D-023)
- Douay-Rheims available as an additional translation

The reading view should prioritize text and reduce visual distractions.

### 9.10 Platform News

**Purpose:** Communicate official Ecclesios announcements, notices, and updates.

Rules:

- Only platform administrators publish platform news.
- Platform news is distinct from Explore content.
- It may appear in the Home right rail on desktop.
- A dedicated listing and detail experience may be provided.
- Pinned and currently relevant items should receive appropriate prominence.

### 9.11 Unified Search

**Purpose:** Search across supported Social Platform content from one entry point.

Potential result categories:

- Explore posts
- Teachings
- Podcast shows and episodes
- Hymns
- Books
- Bible passages or references
- Saints
- Platform news
- Public profiles, when enabled

The results page should support clear category labels and useful empty states. Search must not expose administrative or private Console records.

### 9.12 Notifications

**Purpose:** Give members a focused view of relevant social activity and subscribed updates.

Core experience:

- Unread and read states
- Link to the relevant item
- Mark as read
- Mark all as read
- Notification preferences
- Appropriate grouping to reduce noise

### 9.13 Profile

*S5 (D-049) built the owner's view at `/me`. Public profiles — what others see — are Phase 8.*

**Purpose:** Present a member's public identity and permitted activity.

Possible sections:

- Avatar and display name
- Short biography
- Parish or Church affiliation where appropriate and permitted
- Published content for authorized creators
- Saved or private areas visible only to the owner
- Edit profile action for the owner

Private membership records and Console data must not be exposed through public profiles.

### 9.14 Authentication

Authentication pages include:

- Sign In
- Create Account
- OTP verification
- Password recovery and reset
- Pending membership information

The Social Platform may use a consumer-facing split layout inspired by the approved Ecclesios design direction, with the Ecclesios cross and brand on the visual side. Pending members may sign in and use the social side while restricted member-only or scoped actions remain unavailable according to the established membership rules.

## 10. Social Interactions

### 10.1 Supported Actions

Posts, teachings, podcast episodes, and hymns support:

- Like
- Bookmark or Save
- Share
- Visible counts on content cards where applicable

### 10.2 Comments

Comments are available only for Explore posts unless this rule is deliberately revised in the project documentation.

Teachings, podcast episodes, and hymns do not provide comments in the current scope.

### 10.3 Interaction States

Every action must provide:

- Clear default, hover, focus, active, and disabled states
- Optimistic feedback where technically appropriate
- Error recovery when an action fails
- Authentication prompts for visitor-only restrictions
- Accessible labels

## 11. Visual Design Principles

The Social Platform should be:

- Modern but not visually noisy
- Content-first
- Warm, calm, and respectful
- Consistent without looking like an admin dashboard
- Readable for long-form and devotional content
- Suitable for text, audio, video, imagery, and structured references
- Accessible across common screen sizes and input methods

### 11.1 Cards

_Implemented in `components/cards/` (D-043): one card per content type, reused on the section pages and in the Home feed (Saved and Search keep compact rows). Section pages use `h2` titles, the Home feed `h3`._

Cards should be used where they improve scanning and grouping. They should not wrap every piece of content unnecessarily.

Card families may include:

- Feed post
- Daily reading
- Saint
- Teaching
- Podcast show or episode
- Hymn
- Book
- Platform news

### 11.2 Typography

- Interface text should be clear and compact.
- Reading views should use comfortable line length, spacing, and hierarchy.
- Scripture, teaching, and book pages may use a reading-optimized typographic treatment.
- Font sizes must remain usable without relying on browser zoom.

### 11.3 Colour and Branding

*Brand images (D-047): the tab icon is the burgundy favicon on light devices and the gold one on dark devices; the sidebar shows the burgundy favicon; the sign-in panel shows the full monstrance in gold with a soft radiance.*

Ecclesios brand colours and approved tokens should create family resemblance between the Social Platform and Console. The applications do not need identical layouts or component compositions.

### 11.4 Empty, Loading, and Error States

_Implemented by `components/ui/states.tsx` (D-043). A 404 is shown as an empty state with a way back, not as an error._

Every data-driven page must include:

- Loading state
- Empty state
- Recoverable error state
- Clear action where the user can resolve or retry

Skeletons should resemble the content being loaded and should not create excessive motion.

## 12. Accessibility

The Social Platform should support:

- Keyboard navigation
- Visible focus states
- Semantic landmarks and headings
- Accessible names for icon-only actions
- Sufficient colour contrast
- Screen-reader-friendly status updates
- Reduced-motion preferences
- Logical tab and reading order
- Labels and validation messages for forms

Accessibility applies to menus, drawers, media controls, dialogs, feeds, forms, and reading views.

## 13. Security and Privacy Boundaries

- Social search must never expose private CMS records.
- Public profiles must show only fields approved for public display.
- Administrative permissions must be enforced by the backend, not merely hidden in the UI.
- The Console link must appear only when the current account is authorized to use it.
- Membership context shown on the Social Platform must respect visibility and scope rules.
- Visitor and pending-member states must not reveal restricted information.

## 14. Technical Implementation Rules

- The redesign is implemented primarily in `apps/web`.
- `apps/admin` must remain visually and functionally unaffected unless a separately documented change requires otherwise.
- Shared Zod contracts must be updated before API consumers when a contract change is required.
- Existing domain rules, authentication, RBAC, and hierarchy rules remain authoritative.
- New binaries continue to use object storage.
- Slow or fan-out operations continue to use background workers.
- UI changes must include responsive, accessibility, loading, empty, and error states.
- Relevant automated tests must be updated or added.
- Documentation is the contract. Any decision that conflicts with `blueprint.md`, `functionality.md`, `todo.md`, or `decisions.md` must be reconciled in the docs before implementation.

## 15. Initial Implementation Priorities

The redesign should proceed in a controlled order:

1. Establish Social Platform-only design tokens and component boundaries where necessary.
2. Update the `apps/web` shell.
3. Move the authenticated profile from the sidebar to the top-right header.
4. Keep notifications beside the profile control.
5. Preserve the single global search entry point in the top bar.
6. Implement responsive navigation behaviour.
7. Standardize content cards and interaction controls.
8. Refresh Home and Explore.
9. Refresh reading and media experiences.
10. Complete profile, bookmarks, library, notifications, and search experiences.
11. Verify that `apps/admin` remains unchanged.

### 15.1 Slice progress

| Slice     | Scope                                                                                                                                                                                                                                                                                                                                     | State            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **S1**    | Shell: profile → top-right account menu, sidebar navigation-only, visitor Sign in / Create account, notifications for signed-in people only, Church Management link moved from More to the account menu, one global search → `/search` (interim client fan-out), phone search button                                                      | ✅ built (D-042) |
| **S2**    | Card family (`components/cards/`: post, teaching, news, episode, book, hymn) used everywhere; Skeleton / EmptyState / ErrorState with Try again / LoadMore on every data page; reactions: no double toggles, visible failure + rollback, live-region notes, counts in labels; sign-in returns to the same page (`?next=`, same-site only) | ✅ built (D-043) |
| **S3**    | Home: _Continue_ row (episode in progress, books being read, last Bible chapter), Today strip (news, saint, hymn, event) where the rail is hidden, ARIA feed tabs. Explore: past events, search kept in `?q=`, your churches + Find a church                                                                                              | ✅ built (D-044) |
| **S4**    | One text size for Readings, Bible, Teachings, hymns, saints, news; Bible verse selection → Copy / Share (reopens highlighted); Share on Readings, saints, news; ARIA tabs (readings, tunes, notifications); podcast episode pages; _Latest_ teaching                                                                                      | ✅ built (D-045) |
| **D-046** | Light sidebar with gold active item; Today card first in the right rail (top of feed on phones, above the Today strip); rail scrolls with the page then sticks, no inner scroll bar                                                                                                                                                       | ✅ built         |
| **D-047** | Light/dark tab favicons; favicon in the sidebar; gold monstrance with radiance on sign-in; SVG metadata removed | ✅ built |
| **D-048** | Console: light/dark tab favicons, gold favicon in the dark sidebar, burgundy on sign-in | ✅ built |
| **S5** | Join on church pages; `/me` profile with Your churches (leave, cancel, unfollow, move home church — API + console approval); Saved episodes → episode pages; library order; notifications by day. Public profiles → Phase 8, notification preferences → Phase 7 | ✅ built (D-049) |

## 16. Acceptance Criteria

The Social Platform redesign is successful when:

- `apps/web` has a distinct consumer-facing social and content experience.
- `apps/admin` retains its Console-oriented interface.
- Authenticated users see notifications and profile controls in the top-right header.
- No user-profile block remains in the Social Platform sidebar.
- The sidebar is dedicated to primary content navigation.
- One global top-bar search entry point serves the platform.
- Platform news remains separate from Explore content.
- Social interaction rules are consistent across supported content types.
- Unauthorized users do not see or gain access to restricted Console functions.
- The interface works across desktop, tablet, and mobile layouts.
- Accessibility, loading, empty, and error states are implemented.
- Existing API, RBAC, and membership rules remain intact.

## 17. Decisions Recorded in This Draft

- **S-001:** The Social Platform and Church Management Console may use different layouts and interaction patterns.
- **S-002:** This redesign applies to `apps/web`; `apps/admin` remains outside the scope.
- **S-003:** The Social Platform sidebar is reserved for navigation and content discovery.
- **S-004:** The authenticated user's profile moves to the top-right header beside notifications.
- **S-005:** The profile menu provides authorized access to the Church Management Console.
- **S-006:** Ecclesios uses one global search entry point in the top bar.
- **S-007:** Platform news is administrator-authored and remains separate from Explore.
- **S-008:** Likes, saves, and shares apply to posts, teachings, podcast episodes, and hymns; comments remain limited to posts.
- **S-009:** The sidebar uses the page's light surface; the active item is gold.
- **S-010:** Today's card is the first card of the Home right rail (top of the feed where the rail is hidden).
- **S-011:** The Home right rail scrolls with the page and then sticks; it never has its own scroll bar.

---

This draft should be reviewed alongside `docs/blueprint.md`, `docs/functionality.md`, `docs/todo.md`, and `docs/decisions.md`. When adopted, it should be placed at `docs/social.md`, and any conflicting prior UI decision should be superseded explicitly in `docs/decisions.md` before implementation.
