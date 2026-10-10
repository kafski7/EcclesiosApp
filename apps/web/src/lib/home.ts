import { HomeFeedSchema, HomeSummarySchema } from "@ecclesios/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "./query";
import { localToday } from "./readings";
import { useSession } from "@/stores/session";

export type HomeTab = "for-you" | "following";

/** Rail + today card for the reader's local date (D-033). */
export function useHomeSummary(date = localToday()) {
  return useQuery({
    queryKey: ["home", "summary", date],
    queryFn: () => api.get(`/public/home?date=${date}`, HomeSummarySchema),
    staleTime: 5 * 60_000,
  });
}

export function useHomeFeed(tab: HomeTab) {
  const principal = useSession((s) => s.principal);
  return useInfiniteQuery({
    queryKey: ["home", "feed", tab, principal?.id ?? null],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get(`/public/home/feed?tab=${tab}&page=${pageParam}`, HomeFeedSchema),
    getNextPageParam: (last) => (last.hasMore && last.page < 20 ? last.page + 1 : undefined),
    enabled: tab === "for-you" || principal?.kind === "member",
    staleTime: 60_000,
  });
}

export const SEASON_SWATCH: Record<string, string> = {
  GREEN: "#2f7d4f",
  VIOLET: "#6b3fa0",
  WHITE: "#d9cfae",
  RED: "#b42318",
  ROSE: "#e7a3b8",
  BLACK: "#1a1a1a",
};
