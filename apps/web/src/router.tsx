import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/pages/home";
import { MorePage } from "@/pages/more";
import { NotFoundPage } from "@/pages/not-found";
import { LoginPage } from "@/pages/auth/login";
import { RegisterPage } from "@/pages/auth/register";
import { BiblePage } from "@/pages/bible";
import { HymnPage } from "@/pages/hymn";
import { HymnalPage } from "@/pages/hymnal";
import { ReadingsPage } from "@/pages/readings";
import { SaintPage } from "@/pages/saint";
import { SaintsPage } from "@/pages/saints";
import * as S from "@/pages/sections";

/** Routes: the 9 primary sections (todo Phase 3) + More-menu destinations. */
export const router = createBrowserRouter([
  // Full-page auth screens (D-013) — outside the app shell, like x.com.
  { path: "/login", element: <LoginPage />, errorElement: <NotFoundPage /> },
  { path: "/register", element: <RegisterPage />, errorElement: <NotFoundPage /> },
  {
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "readings", element: <ReadingsPage /> },
      { path: "readings/:date", element: <ReadingsPage /> },
      { path: "saints", element: <SaintsPage /> },
      { path: "saints/:slug", element: <SaintPage /> },
      { path: "explore", element: <S.ExplorePage /> },
      { path: "podcasts", element: <S.PodcastsPage /> },
      { path: "hymnal", element: <HymnalPage /> },
      { path: "hymnal/:slug", element: <HymnPage /> },
      { path: "teachings", element: <S.TeachingsPage /> },
      { path: "bible", element: <BiblePage /> },
      { path: "bible/:book/:chapter", element: <BiblePage /> },
      { path: "more", element: <MorePage /> },
      { path: "subscribe", element: <S.SubscribePage /> },
      { path: "cms-login", element: <S.CmsLoginPage /> },
      { path: "notifications", element: <S.NotificationsPage /> },
      { path: "about", element: <S.AboutPage /> },
      { path: "privacy", element: <S.PrivacyPage /> },
      { path: "terms", element: <S.TermsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
