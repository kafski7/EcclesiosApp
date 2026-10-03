import { TeachingListSchema, TeachingSchema, TeachingTopicListSchema } from "@ecclesios/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "./query";

export function useTeachingTopics() {
  return useQuery({
    queryKey: ["teachings", "topics"],
    queryFn: () => api.get("/public/teachings/topics", TeachingTopicListSchema),
    staleTime: 30 * 60_000,
  });
}

export function useTeachings(q: string, topic: string | null) {
  return useInfiniteQuery({
    queryKey: ["teachings", "list", q.trim(), topic],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ page: String(pageParam) });
      if (q.trim()) p.set("q", q.trim());
      if (topic) p.set("topic", topic);
      return api.get(`/public/teachings?${p}`, TeachingListSchema);
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 10 * 60_000,
  });
}

export function useTeaching(slug: string | undefined) {
  return useQuery({
    queryKey: ["teachings", "one", slug],
    queryFn: () => api.get(`/public/teachings/${slug}`, TeachingSchema),
    enabled: !!slug,
    staleTime: 30 * 60_000,
  });
}

export const minutesLabel = (n: number) => `${n} min read`;
