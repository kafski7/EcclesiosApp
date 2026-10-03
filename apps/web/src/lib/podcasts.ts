import { FollowingPodcastsSchema, MediaUrlSchema, PodcastListSchema, PodcastSchema, TranscriptSchema } from "@ecclesios/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";
import { useSession } from "@/stores/session";

export { formatEpisodeDuration } from "@ecclesios/shared/domain";

export function usePodcasts(q: string) {
  return useInfiniteQuery({
    queryKey: ["podcasts", "list", q.trim()],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ page: String(pageParam) });
      if (q.trim()) p.set("q", q.trim());
      return api.get(`/public/podcasts?${p}`, PodcastListSchema);
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  });
}

export function usePodcast(slug: string | undefined) {
  return useQuery({
    queryKey: ["podcasts", "one", slug],
    queryFn: () => api.get(`/public/podcasts/${slug}`, PodcastSchema),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

/** Slugs the signed-in member follows (empty for guests and platform accounts). */
export function useFollowing() {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["podcasts", "following", principal?.id],
    queryFn: () => api.get("/podcasts/following", FollowingPodcastsSchema),
    enabled: principal?.kind === "member",
    staleTime: 60_000,
  });
}

export function useFollowToggle(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (follow: boolean) =>
      follow ? api.putVoid(`/podcasts/${slug}/follow`) : api.delVoid(`/podcasts/${slug}/follow`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["podcasts", "following"] }),
  });
}

/** Presigned URLs are short-lived: fetch right before playing. */
export const episodeUrl = (id: string) => api.get(`/public/podcasts/episodes/${id}/url`, MediaUrlSchema);
export const attachmentUrl = (id: string) => api.get(`/public/podcasts/attachments/${id}/url`, MediaUrlSchema);

export function useTranscript(episodeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["podcasts", "transcript", episodeId],
    queryFn: () => api.get(`/public/podcasts/episodes/${episodeId}/transcript`, TranscriptSchema),
    enabled,
    staleTime: 60 * 60_000,
  });
}

export const publisherLabel = (kind: "PLATFORM" | "CREATOR" | "MEMBER") =>
  kind === "PLATFORM" ? "Ecclesios" : "Creator";

export const coverInitials = (title: string) =>
  title
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ÿ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
