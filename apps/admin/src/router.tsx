import { createBrowserRouter } from "react-router-dom";
import { CmsLayout } from "@/components/cms-layout";
import { PlatformLayout } from "@/components/platform-layout";
import { HomeRedirect, RequireAuth } from "@/components/require-auth";
import { LoginPage } from "@/pages/auth/login";
import { BillingPage } from "@/pages/cms/billing";
import { BirthdaysPage } from "@/pages/cms/birthdays";
import { MemberPage } from "@/pages/cms/member";
import { MembersPage, RequestsPage } from "@/pages/cms/members";
import { SocietiesPage } from "@/pages/cms/societies";
import { CmsNotificationsPage } from "@/pages/cms/notifications";
import { CollectionsPage } from "@/pages/cms/collections";
import { GroupDetailPage, GroupsPage } from "@/pages/cms/groups";
import { MessagePage, MessagesPage } from "@/pages/cms/messages";
import { SettingsPage } from "@/pages/cms/settings";
import { UsersPage } from "@/pages/cms/users";
import { NotificationsPage } from "@/pages/notifications";
import { ProfilePage } from "@/pages/profile";
import { SocietyPage } from "@/pages/cms/society";
import { DashboardPage } from "@/pages/cms/dashboard";
import { ErrorPage, NotFoundPage } from "@/pages/errors";
import { Placeholder } from "@/pages/placeholder";
import { PlatformOverviewPage } from "@/pages/platform/overview";
import { PlatformSubscriptionsPage } from "@/pages/platform/subscriptions";
import { PlatformHymnalPage } from "@/pages/platform/hymnal";
import { HymnEditPage } from "@/pages/platform/hymn-edit";
import { PlatformTeachingsPage } from "@/pages/platform/teachings";
import { TeachingEditPage } from "@/pages/platform/teaching-edit";
import { PlatformNewsPage } from "@/pages/platform/news";
import { NewsEditPage } from "@/pages/platform/news-edit";
import { BookEditPage } from "@/pages/platform/book-edit";
import { PlatformBooksPage } from "@/pages/platform/books";
import { MyBooksPage } from "@/pages/platform/books-mine";
import { PlatformPodcastsPage } from "@/pages/platform/podcasts";
import { PodcastEditPage } from "@/pages/platform/podcast-edit";
import { ExploreModerationPage } from "@/pages/platform/explore";
import { ExploreMinePage, ExploreWritePage } from "@/pages/platform/explore-write";
import { PlatformHome } from "@/components/platform-layout";

const soon = (path: string, title: string, when: string, about: string) => ({
  path,
  element: <Placeholder title={title} when={when} about={about} />,
});

/**
 * /login        church staff (members)   → /admin/*     Church Management
 * /admin-login  platform accounts (users) → /platform/*  Super-Admin console
 */
export const router = createBrowserRouter([
  { path: "/", element: <HomeRedirect />, errorElement: <ErrorPage /> },
  { path: "/login", element: <LoginPage kind="member" />, errorElement: <ErrorPage /> },
  { path: "/admin-login", element: <LoginPage kind="user" />, errorElement: <ErrorPage /> },
  {
    path: "/admin",
    element: (
      <RequireAuth kind="member">
        <CmsLayout />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "billing", element: <BillingPage /> },
      { path: "members", element: <MembersPage /> },
      { path: "members/requests", element: <RequestsPage /> },
      { path: "members/:personId", element: <MemberPage /> },
      { path: "birthdays", element: <BirthdaysPage /> },
      { path: "societies", element: <SocietiesPage kind="SOCIETY" /> },
      { path: "societies/:id", element: <SocietyPage kind="SOCIETY" /> },
      { path: "committees", element: <SocietiesPage kind="COMMITTEE" /> },
      { path: "committees/:id", element: <SocietyPage kind="COMMITTEE" /> },
      { path: "groups", element: <GroupsPage /> },
      { path: "groups/:id", element: <GroupDetailPage /> },
      { path: "collections", element: <CollectionsPage /> },
      { path: "notifications", element: <CmsNotificationsPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "messages", element: <MessagesPage /> },
      { path: "messages/:id", element: <MessagePage /> },
      { path: "users", element: <UsersPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "/platform",
    element: (
      <RequireAuth kind="user">
        <PlatformLayout />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <PlatformHome overview={<PlatformOverviewPage />} /> },
      { path: "subscriptions", element: <PlatformSubscriptionsPage /> },
      { path: "hymnal", element: <PlatformHymnalPage /> },
      { path: "hymnal/:slug", element: <HymnEditPage /> },
      { path: "teachings", element: <PlatformTeachingsPage /> },
      { path: "teachings/:slug", element: <TeachingEditPage /> },
      { path: "news", element: <PlatformNewsPage /> },
      { path: "news/:slug", element: <NewsEditPage /> },
      { path: "books", element: <PlatformBooksPage /> },
      { path: "books/mine", element: <MyBooksPage /> },
      { path: "books/mine/:slug", element: <BookEditPage /> },
      { path: "podcasts", element: <PlatformPodcastsPage /> },
      { path: "podcasts/:slug", element: <PodcastEditPage /> },
      { path: "explore", element: <ExploreModerationPage /> },
      { path: "explore/mine", element: <ExploreMinePage /> },
      { path: "explore/write/:id", element: <ExploreWritePage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "profile", element: <ProfilePage /> },
      soon(
        "creators",
        "Creators",
        "Phase 8",
        "Content-creator and podcast applications and grants.",
      ),
      soon(
        "reference",
        "Reference data",
        "Phase 8",
        "Themes, plans, currencies, languages and icons.",
      ),
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
