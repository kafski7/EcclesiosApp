import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/pages/home";
import { MorePage } from "@/pages/more";
import { NotFoundPage } from "@/pages/not-found";
import * as S from "@/pages/sections";

/** Routes: the 9 primary sections (todo Phase 3) + More-menu destinations. */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "readings", element: <S.ReadingsPage /> },
      { path: "saints", element: <S.SaintsPage /> },
      { path: "explore", element: <S.ExplorePage /> },
      { path: "podcasts", element: <S.PodcastsPage /> },
      { path: "hymnal", element: <S.HymnalPage /> },
      { path: "teachings", element: <S.TeachingsPage /> },
      { path: "bible", element: <S.BiblePage /> },
      { path: "more", element: <MorePage /> },
      { path: "subscribe", element: <S.SubscribePage /> },
      { path: "cms-login", element: <S.CmsLoginPage /> },
      { path: "notifications", element: <S.NotificationsPage /> },
      { path: "login", element: <S.LoginPage /> },
      { path: "register", element: <S.RegisterPage /> },
      { path: "about", element: <S.AboutPage /> },
      { path: "privacy", element: <S.PrivacyPage /> },
      { path: "terms", element: <S.TermsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
