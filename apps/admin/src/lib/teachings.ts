import {
  AdminTeachingListSchema,
  AdminTeachingSchema,
  TeachingTopicListSchema,
  type AdminTeaching,
  type TeachingStatus,
  type UpsertTeaching,
  type UpsertTopic,
} from "@ecclesios/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";

const base = "/platform/teachings";

export function useAdminTeachings(q: string) {
  return useQuery({
    queryKey: ["platform", "teachings", q],
    queryFn: () => api.get(`${base}?q=${encodeURIComponent(q)}`, AdminTeachingListSchema),
  });
}

export function useAdminTeaching(slug: string | undefined) {
  return useQuery({
    queryKey: ["platform", "teaching", slug],
    queryFn: () => api.get(`${base}/${slug}`, AdminTeachingSchema),
    enabled: !!slug,
  });
}

export function useAdminTopics() {
  return useQuery({
    queryKey: ["platform", "teaching-topics"],
    queryFn: () => api.get(`${base}/topics`, TeachingTopicListSchema),
  });
}

function useTeachingMutation<V>(fn: (v: V) => Promise<AdminTeaching>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (t) => {
      qc.setQueryData(["platform", "teaching", t.slug], t);
      void qc.invalidateQueries({ queryKey: ["platform", "teachings"] });
    },
  });
}

export const useSaveTeaching = (slug: string | undefined) =>
  useTeachingMutation((body: UpsertTeaching) =>
    slug
      ? api.put(`${base}/${slug}`, body, AdminTeachingSchema)
      : api.post(base, body, AdminTeachingSchema),
  );

export const useTeachingStatus = (slug: string) =>
  useTeachingMutation((status: TeachingStatus) =>
    api.post(`${base}/${slug}/status`, { status }, AdminTeachingSchema),
  );

export function useDeleteTeaching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.delVoid(`${base}/${slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "teachings"] }),
  });
}

function useTopicMutation<V>(fn: (v: V) => Promise<{ items: unknown[] }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "teaching-topics"] }),
  });
}

export const useAddTopic = () =>
  useTopicMutation((b: UpsertTopic) => api.post(`${base}/topics`, b, TeachingTopicListSchema));
export const useRemoveTopic = () =>
  useTopicMutation((slug: string) => api.del(`${base}/topics/${slug}`, TeachingTopicListSchema));

/** Snippets the editor's toolbar inserts (D-030 format). */
export const SNIPPETS = {
  heading: "\n\n## Heading\n\n",
  quote: "\n\n> Quotation\n> — Source\n\n",
  list: "\n\n- First point\n- Second point\n\n",
  bible: "[[John 3:16]]",
  ccc: "[[CCC 1131]]",
  teaching: "[[teaching:slug|label]]",
} as const;
