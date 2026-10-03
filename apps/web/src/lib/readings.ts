import { ReadingDaySchema, type ReadingKind } from "@ecclesios/shared";
import { addDays, isIsoDate, SEASON_LABEL, type LiturgicalColor } from "@ecclesios/shared/domain";
import { useQuery } from "@tanstack/react-query";
import { api } from "./query";

export const KIND_LABEL: Record<ReadingKind, string> = {
  FIRST: "First Reading",
  PSALM: "Responsorial Psalm",
  SECOND: "Second Reading",
  ALLELUIA: "Alleluia",
  GOSPEL: "Gospel",
};

export const COLOR_HEX: Record<LiturgicalColor, string> = {
  GREEN: "#2f7d4f",
  VIOLET: "#6b3fa0",
  WHITE: "#ffffff",
  RED: "#b42318",
  ROSE: "#e7a3b8",
  BLACK: "#1a1a1a",
};

/** The reader's own calendar date (not UTC) — readings follow the local day. */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Route param → a valid date, falling back to today. */
export const resolveDate = (param: string | undefined, today = localToday()) =>
  param && isIsoDate(param) ? param : today;

export const neighbours = (date: string) => ({ prev: addDays(date, -1), next: addDays(date, 1) });

export function formatLongDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Bible deep link (the reader arrives in Phase 5.2; the route already accepts ?ref=). */
export const bibleHref = (citation: string) => `/bible?ref=${encodeURIComponent(citation)}`;

export { SEASON_LABEL };

export function useReadings(date: string) {
  return useQuery({
    queryKey: ["readings", date],
    queryFn: () => api.get(`/public/readings/${date}`, ReadingDaySchema),
    staleTime: 60 * 60_000,
  });
}
