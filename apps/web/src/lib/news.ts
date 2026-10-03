import { NewsItemSchema, NewsListSchema, type NewsCategory } from "@ecclesios/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "./query";

export const CATEGORY_LABEL: Record<NewsCategory, string> = {
  ANNOUNCEMENT: "Announcement",
  UPDATE: "App update",
  NOTICE: "Notice",
};

export function useNewsList() {
  return useInfiniteQuery({
    queryKey: ["news", "list"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get(`/public/news?page=${pageParam}`, NewsListSchema),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
}

export function useNews(slug: string | undefined) {
  return useQuery({
    queryKey: ["news", "one", slug],
    queryFn: () => api.get(`/public/news/${slug}`, NewsItemSchema),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

/** "3 Oct" this year, "3 Oct 2025" otherwise. */
export function shortDate(iso: string, now = new Date()) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** "now", "5m", "3h", "2d", then a date — Twitter-style relative time for the feed. */
export function ago(iso: string, now = new Date()) {
  const s = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return shortDate(iso, now);
}
