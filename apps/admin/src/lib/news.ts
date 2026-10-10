import {
  AdminNewsListSchema,
  AdminNewsSchema,
  HymnOfDaySchema,
  type AdminNews,
  type UpsertNews,
} from "@ecclesios/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";

const base = "/platform/news";

export const useAdminNewsList = () =>
  useQuery({ queryKey: ["platform", "news"], queryFn: () => api.get(base, AdminNewsListSchema) });

export const useAdminNews = (slug: string | undefined) =>
  useQuery({
    queryKey: ["platform", "news", slug],
    queryFn: () => api.get(`${base}/${slug}`, AdminNewsSchema),
    enabled: !!slug,
  });

function useNewsMutation<V>(fn: (v: V) => Promise<AdminNews>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (n) => {
      qc.setQueryData(["platform", "news", n.slug], n);
      void qc.invalidateQueries({ queryKey: ["platform", "news"], exact: true });
    },
  });
}

export const useSaveNews = (slug: string | undefined) =>
  useNewsMutation((b: UpsertNews) =>
    slug ? api.put(`${base}/${slug}`, b, AdminNewsSchema) : api.post(base, b, AdminNewsSchema),
  );

export const useNewsStatus = (slug: string) =>
  useNewsMutation((v: { status: "DRAFT" | "PUBLISHED"; publishAt: string | null }) =>
    api.post(`${base}/${slug}/status`, v, AdminNewsSchema),
  );

export function useDeleteNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.delVoid(`${base}/${slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "news"] }),
  });
}

// hymn of the day (D-033)
const Pick = HymnOfDaySchema.nullable();
export const useHymnOfDay = (date: string) =>
  useQuery({
    queryKey: ["platform", "hymn-of-day", date],
    queryFn: () => api.get(`/platform/hymn-of-day/${date}`, Pick),
    enabled: !!date,
  });

export function usePinHymn(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hymnSlug: string | null) =>
      api.put(`/platform/hymn-of-day/${date}`, { hymnSlug }, Pick),
    onSuccess: (h) => qc.setQueryData(["platform", "hymn-of-day", date], h),
  });
}

/** <input type="datetime-local"> ↔ ISO (local time). */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const STATE_LABEL = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  EXPIRED: "Expired",
} as const;
export const STATE_COLOR = {
  DRAFT: "secondary",
  SCHEDULED: "info",
  LIVE: "success",
  EXPIRED: "warning",
} as const;
