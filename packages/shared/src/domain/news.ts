/**
 * Platform news (D-032): short official announcements from Ecclesios — app updates, notices
 * from the Bishops' Conference, liturgical reminders. Pure rules only.
 */
export const NEWS_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];

export const NEWS_CATEGORIES = ["ANNOUNCEMENT", "UPDATE", "NOTICE"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export interface NewsWindow {
  status: NewsStatus;
  publishedAt: Date | null;
  /** After this moment the item leaves Home and the rail, but its page stays readable. */
  expiresAt: Date | null;
}

/** Shown on the news list and its page. */
export const isNewsLive = (n: NewsWindow, now: Date) =>
  n.status === "PUBLISHED" && n.publishedAt !== null && n.publishedAt <= now;

/** Shown on Home (rail + feed): live and not yet expired. */
export const isNewsCurrent = (n: NewsWindow, now: Date) =>
  isNewsLive(n, now) && (!n.expiresAt || n.expiresAt > now);

/** Rail order: pinned first, then newest. */
export function orderNews<T extends { pinned: boolean; publishedAt: Date | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );
}
