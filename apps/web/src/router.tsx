import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { HomePage } from "@/pages/home";
import { BookPage } from "@/pages/book";
import { BookOrderPage, TestCheckoutPage } from "@/pages/book-order";
import { BookReaderPage } from "@/pages/book-reader";
import { BooksPage } from "@/pages/books";
import { LibraryPage } from "@/pages/library";
import { MorePage } from "@/pages/more";
import { SavedPage } from "@/pages/saved";
import { NewsItemPage, NewsPage } from "@/pages/news";
import { NotFoundPage } from "@/pages/not-found";
import { LoginPage } from "@/pages/auth/login";
import { RegisterPage } from "@/pages/auth/register";
import { BiblePage } from "@/pages/bible";
import { HymnPage } from "@/pages/hymn";
import { HymnalPage } from "@/pages/hymnal";
import { PodcastPage, PodcastsPage } from "@/pages/podcasts";
import { ExplorePage } from "@/pages/explore";
import { ExploreChurchPage } from "@/pages/explore-church";
import { ExplorePostPage } from "@/pages/explore-post";
import { ExploreMinePage, ExploreWritePage } from "@/pages/explore-write";
import { ReadingsPage } from "@/pages/readings";
import { SaintPage } from "@/pages/saint";
import { SaintsPage } from "@/pages/saints";
import * as S from "@/pages/sections";
import { TeachingPage, TeachingsPage } from "@/pages/teachings";

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
      { path: "explore", element: <ExplorePage /> },
      { path: "explore/posts/:id", element: <ExplorePostPage /> },
      { path: "explore/churches/:id", element: <ExploreChurchPage /> },
      { path: "explore/mine", element: <ExploreMinePage /> },
      { path: "explore/write", element: <ExploreMinePage /> },
      { path: "explore/write/:id", element: <ExploreWritePage /> },
      { path: "podcasts", element: <PodcastsPage /> },
      { path: "podcasts/:slug", element: <PodcastPage /> },
      { path: "hymnal", element: <HymnalPage /> },
      { path: "hymnal/:slug", element: <HymnPage /> },
      { path: "teachings", element: <TeachingsPage /> },
      { path: "teachings/:slug", element: <TeachingPage /> },
      { path: "bible", element: <BiblePage /> },
      { path: "bible/:book/:chapter", element: <BiblePage /> },
      { path: "news", element: <NewsPage /> },
      { path: "news/:slug", element: <NewsItemPage /> },
      { path: "books", element: <BooksPage /> },
      { path: "books/checkout/test", element: <TestCheckoutPage /> },
      { path: "books/orders/:id", element: <BookOrderPage /> },
      { path: "books/:slug", element: <BookPage /> },
      { path: "books/:slug/read", element: <BookReaderPage /> },
      { path: "library", element: <LibraryPage /> },
      { path: "saved", element: <SavedPage /> },
      { path: "more", element: <MorePage /> },
      { path: "subscribe", element: <S.SubscribePage /> },
      { path: "notifications", element: <S.NotificationsPage /> },
      { path: "about", element: <S.AboutPage /> },
      { path: "privacy", element: <S.PrivacyPage /> },
      { path: "terms", element: <S.TermsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
