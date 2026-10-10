import {
  AuthoringOptionsSchema,
  ChurchProfileSchema,
  CommentListSchema,
  MyPostListSchema,
  MyPostSchema,
  PostListSchema,
  PostSchema,
  PresignedUploadSchema,
  type CommentStatus,
  type PostKind,
  type UpdateChurchProfile,
  type UpsertPost,
} from "@ecclesios/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";
import { useSession } from "@/stores/session";

export type ExploreTab = "ALL" | "EVENTS" | "PAST" | "ARTICLES" | "FOLLOWING";

/** Query string for a feed tab (D-031). */
export function feedParams(tab: ExploreTab, opts: { q?: string; church?: string; page: number }) {
  const p = new URLSearchParams({ page: String(opts.page) });
  if (tab === "EVENTS") p.set("kind", "EVENT");
  // Past events, newest first (the API has supported this since D-031; surfaced in D-044).
  if (tab === "PAST") {
    p.set("kind", "EVENT");
    p.set("past", "1");
  }
  if (tab === "ARTICLES") p.set("kind", "ARTICLE");
  if (tab === "FOLLOWING") p.set("following", "1");
  if (opts.q?.trim()) p.set("q", opts.q.trim());
  if (opts.church) p.set("church", opts.church);
  return p.toString();
}

export function useFeed(tab: ExploreTab, q: string, church?: string) {
  const principal = useSession((s) => s.principal);
  return useInfiniteQuery({
    queryKey: ["explore", "feed", tab, q.trim(), church ?? null, principal?.id ?? null],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get(
        `/public/explore/posts?${feedParams(tab, { q, church, page: pageParam })}`,
        PostListSchema,
      ),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 60_000,
  });
}

export const usePost = (id: string | undefined) =>
  useQuery({
    queryKey: ["explore", "post", id],
    queryFn: () => api.get(`/public/explore/posts/${id}`, PostSchema),
    enabled: !!id,
  });

export function useComments(id: string | undefined) {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["explore", "comments", id, principal?.id ?? null],
    queryFn: () => api.get(`/public/explore/posts/${id}/comments`, CommentListSchema),
    enabled: !!id,
  });
}

export function useCommentActions(postId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["explore", "comments", postId] });
  return {
    add: useMutation({
      mutationFn: (body: string) =>
        api.post(`/explore/posts/${postId}/comments`, { body }, CommentListSchema),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delVoid(`/explore/comments/${id}`),
      onSuccess: refresh,
    }),
    report: useMutation({
      mutationFn: (id: string) => api.postVoid(`/explore/comments/${id}/report`, {}),
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: CommentStatus }) =>
        api.putVoid(`/explore/comments/${id}/status`, { status }),
      onSuccess: refresh,
    }),
  };
}

export const useChurch = (id: string | undefined) => {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["explore", "church", id, principal?.id ?? null],
    queryFn: () => api.get(`/public/explore/churches/${id}`, ChurchProfileSchema),
    enabled: !!id,
  });
};

export function useSaveChurch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: UpdateChurchProfile) =>
      api.put(`/explore/churches/${id}`, b, ChurchProfileSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["explore", "church", id] }),
  });
}

/** Follow = see a church's public posts in "Following" (no approval, D-015). */
export function useFollowChurch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (follow: boolean) =>
      follow ? api.putVoid(`/groups/${id}/follow`) : api.delVoid(`/groups/${id}/follow`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["explore", "church", id] });
    },
  });
}

// ------------------------------------------------------------------ authoring

export function useAuthoring() {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["explore", "authoring", principal?.id],
    queryFn: () => api.get("/explore/authoring", AuthoringOptionsSchema),
    enabled: !!principal,
    staleTime: 5 * 60_000,
  });
}

export const canWrite = (o: { asSelf: boolean; churches: unknown[] } | undefined) =>
  !!o && (o.asSelf || o.churches.length > 0);

export const useMyPosts = () =>
  useQuery({
    queryKey: ["explore", "mine"],
    queryFn: () => api.get("/explore/my-posts", MyPostListSchema),
  });

export const useMyPost = (id: string | undefined) =>
  useQuery({
    queryKey: ["explore", "mine", id],
    queryFn: () => api.get(`/explore/my-posts/${id}`, MyPostSchema),
    enabled: !!id,
  });

export function useWriteActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["explore"] });
  return {
    save: useMutation({
      mutationFn: ({ id, body }: { id?: string; body: UpsertPost }) =>
        id
          ? api.put(`/explore/my-posts/${id}`, body, MyPostSchema)
          : api.post("/explore/my-posts", body, MyPostSchema),
      onSuccess: done,
    }),
    submit: useMutation({
      mutationFn: (id: string) => api.post(`/explore/my-posts/${id}/submit`, {}, MyPostSchema),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delVoid(`/explore/my-posts/${id}`),
      onSuccess: done,
    }),
    cover: useMutation({
      mutationFn: async ({ id, file }: { id: string; file: File | null }) => {
        if (!file) return api.put(`/explore/my-posts/${id}/cover`, { key: null }, MyPostSchema);
        const signed = await api.post(
          `/explore/my-posts/${id}/cover-upload`,
          { contentType: file.type, bytes: file.size },
          PresignedUploadSchema,
        );
        const r = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file });
        if (!r.ok) throw new Error(`Upload failed (${r.status})`);
        return api.put(`/explore/my-posts/${id}/cover`, { key: signed.key }, MyPostSchema);
      },
      onSuccess: done,
    }),
  };
}

// ------------------------------------------------------------------ formatting

export const KIND_LABEL: Record<PostKind, string> = { ARTICLE: "Article", EVENT: "Event" };

export function dateBox(iso: string) {
  const d = new Date(iso);
  return { day: d.getDate(), month: d.toLocaleString(undefined, { month: "short" }).toUpperCase() };
}

export function eventWhen(startsAt: string, endsAt: string | null) {
  const s = new Date(startsAt);
  const day = s.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (!endsAt) return `${day} · ${t(s)}`;
  const e = new Date(endsAt);
  return s.toDateString() === e.toDateString()
    ? `${day} · ${t(s)}–${t(e)}`
    : `${day} ${t(s)} – ${e.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${t(e)}`;
}

/** "2026-10-12T09:30" for <input type="datetime-local"> ↔ ISO with offset. */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const STATUS_LABEL = {
  DRAFT: "Draft",
  PENDING: "Waiting for review",
  APPROVED: "Live",
  REJECTED: "Not approved",
  REMOVED: "Taken down",
} as const;
