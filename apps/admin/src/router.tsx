import { createBrowserRouter } from "react-router-dom";
import { CmsLayout } from "@/components/cms-layout";
import { PlatformLayout } from "@/components/platform-layout";
import { HomeRedirect, RequireAuth } from "@/components/require-auth";
import { LoginPage } from "@/pages/auth/login";
import { BillingPage } from "@/pages/cms/billing";
import { DashboardPage } from "@/pages/cms/dashboard";
import { ErrorPage, NotFoundPage } from "@/pages/errors";
import { Placeholder } from "@/pages/placeholder";
import { PlatformOverviewPage } from "@/pages/platform/overview";
import { PlatformSubscriptionsPage } from "@/pages/platform/subscriptions";
import { PlatformHymnalPage } from "@/pages/platform/hymnal";
import { HymnEditPage } from "@/pages/platform/hymn-edit";

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
      soon(
        "members",
        "Members",
        "Phase 6",
        "Member records, sacramental registers and membership requests.",
      ),
      soon("birthdays", "Birthdays", "Phase 6", "Today's celebrants and upcoming birthdays."),
      soon("societies", "Societies", "Phase 6", "Societies, clubs and their rosters."),
      soon("committees", "Committees", "Phase 6", "Committees and their members."),
      soon("notifications", "Notifications", "Phase 6", "Your notification centre."),
      soon(
        "messages",
        "Messages",
        "Phase 7",
        "SMS and email to members, societies and committees.",
      ),
      soon("users", "Users & Roles", "Phase 6", "Who manages this church, and with which role."),
      soon("settings", "Settings", "Phase 6", "Theme, language, currency and visibility settings."),
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
      { index: true, element: <PlatformOverviewPage /> },
      { path: "subscriptions", element: <PlatformSubscriptionsPage /> },
      { path: "hymnal", element: <PlatformHymnalPage /> },
      { path: "hymnal/:slug", element: <HymnEditPage /> },
      soon("moderation", "Moderation", "Phase 5.7", "Explore posts waiting for approval."),
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
