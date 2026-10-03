import {
  AuthoringOptionsSchema,
  ModerationQueueSchema,
  MyPostListSchema,
  MyPostSchema,
  ReportedCommentListSchema,
  type CommentStatus,
  type PostDecision,
  type UpsertPost,
} from "@ecclesios/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "./query";

/** Explore moderation (Super-Admin) and platform authoring (D-031). */
export const useQueue = () =>
  useQuery({ queryKey: ["explore", "queue"], queryFn: () => api.get("/platform/explore/queue", ModerationQueueSchema) });

export const useReportedComments = () =>
  useQuery({ queryKey: ["explore", "reported"], queryFn: () => api.get("/platform/explore/reported-comments", ReportedCommentListSchema) });

export function useModeration() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["explore"] });
  return {
    decide: useMutation({
      mutationFn: ({ id, d }: { id: string; d: PostDecision }) => api.post(`/platform/explore/posts/${id}/decision`, d, MyPostSchema),
      onSuccess: done,
    }),
    comment: useMutation({
      mutationFn: ({ id, status }: { id: string; status: CommentStatus }) => api.put(`/explore/comments/${id}/status`, { status }, z.unknown()),
      onSuccess: done,
    }),
  };
}

export const useAuthoring = () =>
  useQuery({ queryKey: ["explore", "authoring"], queryFn: () => api.get("/explore/authoring", AuthoringOptionsSchema) });
export const useMyPosts = () => useQuery({ queryKey: ["explore", "mine"], queryFn: () => api.get("/explore/my-posts", MyPostListSchema) });
export const useMyPost = (id: string | undefined) =>
  useQuery({ queryKey: ["explore", "mine", id], queryFn: () => api.get(`/explore/my-posts/${id}`, MyPostSchema), enabled: !!id });

export function useWrite() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["explore"] });
  return {
    save: useMutation({
      mutationFn: ({ id, body }: { id?: string; body: UpsertPost }) =>
        id ? api.put(`/explore/my-posts/${id}`, body, MyPostSchema) : api.post("/explore/my-posts", body, MyPostSchema),
      onSuccess: done,
    }),
    submit: useMutation({ mutationFn: (id: string) => api.post(`/explore/my-posts/${id}/submit`, {}, MyPostSchema), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.delVoid(`/explore/my-posts/${id}`), onSuccess: done }),
  };
}

export const STATUS_COLOR = { DRAFT: "secondary", PENDING: "info", APPROVED: "success", REJECTED: "danger", REMOVED: "dark" } as const;
