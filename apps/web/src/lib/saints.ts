import { SaintListSchema, SaintSchema, SaintsTodaySchema } from "@ecclesios/shared";
import { feastLabel, RANK_LABEL } from "@ecclesios/shared/domain";
import { useQuery } from "@tanstack/react-query";
import { api } from "./query";
import { localToday } from "./readings";

export { feastLabel, RANK_LABEL };

/** Saint of the day for the reader's local date (D-025). */
export function useSaintsToday(date = localToday()) {
  return useQuery({
    queryKey: ["saints", "today", date],
    queryFn: () => api.get(`/public/saints/today?date=${date}`, SaintsTodaySchema),
    staleTime: 60 * 60_000,
  });
}

export function useSaints(q: string, month: number | null) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (month) params.set("month", String(month));
  return useQuery({
    queryKey: ["saints", "list", q.trim(), month],
    queryFn: () => api.get(`/public/saints?${params}`, SaintListSchema),
    staleTime: 10 * 60_000,
  });
}

export function useSaint(slug: string | undefined) {
  return useQuery({
    queryKey: ["saints", "one", slug],
    queryFn: () => api.get(`/public/saints/${slug}`, SaintSchema),
    enabled: !!slug,
    staleTime: 60 * 60_000,
  });
}

/** Medal initials when there is no portrait: "Thérèse of the Child Jesus" → "TC". */
export function medalInitials(name: string) {
  const words = name.split(/\s+/).filter((w) => /^[A-ZÀ-Ý]/.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}
