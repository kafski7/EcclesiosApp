import type { SavedItem } from "@ecclesios/shared";
import { episodePath } from "./podcasts";

/**
 * Small rules for the "You" pages — Saved, My library, Notifications (docs/social.md §9.12, D-049).
 * Pure, so they are unit-tested.
 */

/**
 * Saved episodes come back from the API linking to their podcast (`/podcasts/:slug`). The app
 * has episode pages since D-045, so open the episode itself. Anything else is left alone.
 */
export function savedHref(i: Pick<SavedItem, "kind" | "id" | "href">): string {
  if (i.kind !== "EPISODE") return i.href;
  const m = /^\/podcasts\/([^/?#]+)\/?$/.exec(i.href);
  return m ? episodePath(decodeURIComponent(m[1]!), i.id) : i.href;
}

/** In-progress books first (most recently read), then unstarted (newest added), then finished. */
export function sortLibrary<T extends { percent: number; lastReadAt: string | null; addedAt: string }>(
  items: readonly T[],
): T[] {
  const bucket = (b: T) => (b.percent >= 100 ? 2 : b.percent > 0 ? 0 : 1);
  const when = (b: T) => Date.parse(b.lastReadAt ?? b.addedAt) || 0;
  return [...items].sort((a, b) => bucket(a) - bucket(b) || when(b) - when(a));
}

export const libraryLabel = (percent: number) =>
  percent >= 100 ? "Finished" : percent > 0 ? `${percent}% read` : "Not started";

export type DayGroup = "Today" | "Yesterday" | "Earlier this week" | "Older";

/** Notifications under day headings, newest first (social.md §9.12 "grouping to reduce noise"). */
export function groupByDay<T extends { createdAt: string }>(
  items: readonly T[],
  now = new Date(),
): { label: DayGroup; items: T[] }[] {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOf(now);
  const DAY = 86_400_000;
  const label = (iso: string): DayGroup => {
    const t = Date.parse(iso);
    if (t >= today) return "Today";
    if (t >= today - DAY) return "Yesterday";
    if (t >= today - 6 * DAY) return "Earlier this week";
    return "Older";
  };
  const out: { label: DayGroup; items: T[] }[] = [];
  for (const it of items) {
    const l = label(it.createdAt);
    const last = out[out.length - 1];
    if (last?.label === l) last.items.push(it);
    else out.push({ label: l, items: [it] });
  }
  return out;
}
