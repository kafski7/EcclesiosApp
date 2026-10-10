/**
 * "Pick up where you left off" on Home (docs/social.md §7, §9.1, D-044).
 * Everything here is already on this device (player, Bible) or in the member's library —
 * no new API. Pure, so it is unit-tested.
 */

export interface EpisodeProgress {
  episodeId: string;
  title: string;
  podcastTitle: string;
  podcastSlug: string;
  coverUrl: string | null;
  durationSec: number | null;
  /** Seconds listened. */
  position: number;
  /** When the position last changed (ms since epoch), or null for data saved before D-044. */
  at: number | null;
}

export interface BookProgress {
  slug: string;
  title: string;
  authorName: string;
  coverUrl: string | null;
  percent: number;
  lastReadAt: string | null;
}

export interface BibleProgress {
  book: string;
  bookName: string;
  chapter: number;
  translation: string;
  at: number;
}

export type ContinueItem =
  | { kind: "EPISODE"; key: string; at: number; episode: EpisodeProgress; leftSec: number | null }
  | { kind: "BOOK"; key: string; at: number; book: BookProgress }
  | { kind: "BIBLE"; key: string; at: number; bible: BibleProgress };

/** Ignore a few seconds of listening, and treat the last 30 s as finished. */
export const EPISODE_MIN_SEC = 30;
export const EPISODE_END_SEC = 30;
/** Things untouched for longer than this drop off the row. */
export const STALE_DAYS = 30;
export const CONTINUE_MAX = 3;

const DAY = 86_400_000;

export function continueItems(
  input: {
    episode: EpisodeProgress | null;
    books: readonly BookProgress[];
    bible: BibleProgress | null;
  },
  now = Date.now(),
): ContinueItem[] {
  const out: ContinueItem[] = [];
  const fresh = (at: number) => now - at <= STALE_DAYS * DAY;

  const e = input.episode;
  if (e && e.position >= EPISODE_MIN_SEC) {
    const left = e.durationSec ? Math.max(0, Math.round(e.durationSec - e.position)) : null;
    // Older saved state has no timestamp: show it, ranked after anything dated.
    const at = e.at ?? 0;
    if ((left === null || left > EPISODE_END_SEC) && (e.at === null || fresh(at)))
      out.push({ kind: "EPISODE", key: `e:${e.episodeId}`, at, episode: e, leftSec: left });
  }

  for (const b of input.books) {
    if (b.percent <= 0 || b.percent >= 100 || !b.lastReadAt) continue;
    const at = Date.parse(b.lastReadAt);
    if (Number.isNaN(at) || !fresh(at)) continue;
    out.push({ kind: "BOOK", key: `b:${b.slug}`, at, book: b });
  }

  const bi = input.bible;
  if (bi && fresh(bi.at)) out.push({ kind: "BIBLE", key: "bible", at: bi.at, bible: bi });

  return out.sort((a, b) => b.at - a.at).slice(0, CONTINUE_MAX);
}

/** "12 min left", "1 h 5 min left", "under a minute left". */
export function leftLabel(sec: number): string {
  if (sec < 60) return "under a minute left";
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min left` : `${h} h left`;
}
