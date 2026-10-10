/**
 * Likes, saves, shares and comment rules (D-035). Pure and dependency-free.
 */

/** What can be liked / saved / shared. Comments stay on Explore posts only (D-031). */
export const ENGAGE_KINDS = ["POST", "TEACHING", "EPISODE", "HYMN", "BOOK"] as const;
export type EngageKind = (typeof ENGAGE_KINDS)[number];

export const REACTION_TYPES = ["LIKE", "SAVE"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

/** "POST:<uuid>" — the key used in batch requests and caches. */
export const engageKey = (kind: EngageKind, id: string) => `${kind}:${id}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEngageKey(key: string): { kind: EngageKind; id: string } | null {
  const i = key.indexOf(":");
  if (i < 0) return null;
  const kind = key.slice(0, i) as EngageKind;
  const id = key.slice(i + 1);
  return (ENGAGE_KINDS as readonly string[]).includes(kind) && UUID.test(id) ? { kind, id } : null;
}

/** Web path of an item, for sharing and the Saved page. */
export function engageHref(
  kind: EngageKind,
  ref: { id: string; slug?: string; podcastSlug?: string },
): string {
  switch (kind) {
    case "BOOK":
      return `/books/${ref.slug ?? ""}`;
    case "POST":
      return `/explore/posts/${ref.id}`;
    case "TEACHING":
      return `/teachings/${ref.slug ?? ""}`;
    case "EPISODE":
      return `/podcasts/${ref.podcastSlug ?? ""}`;
    case "HYMN":
      return `/hymnal/${ref.slug ?? ""}`;
  }
}

/** "1.2k", "15k" — compact counts for cards. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

// ------------------------------------------------------------------ comments: no links

/**
 * Comments may not contain links (D-035): http(s) URLs, www.…, or bare domains such as
 * example.com / bit.ly/x. Common abbreviations ("e.g.", "St.", "a.m.") and Bible
 * references ("Jn 3.16") are not links. Email addresses count as links too.
 */
const LINK_PATTERNS: RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/i, // any scheme://
  /\bwww\.[^\s]+/i,
  /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|info|biz|io|co|me|app|dev|ly|gl|gh|ng|ke|za|uk|us|tv|xyz|site|online|link|page|live|news|church|faith)\b(?:\/\S*)?/i,
  /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i,
];

export const containsLink = (text: string) => LINK_PATTERNS.some((p) => p.test(text));

// ------------------------------------------------------------------ comments: @mentions

/**
 * Stored form of a mention: `@{<member uuid>}`. The server turns tokens into names when it
 * lists comments, so a renamed member shows their new name and nobody can fake a mention.
 */
const TOKEN = /@\{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}/gi;

export const MAX_MENTIONS = 5;

/** Unique member ids mentioned in a stored comment, in order. */
export function mentionIds(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(TOKEN)) {
    const id = m[1]!.toLowerCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export type CommentSegment = { t: "text"; v: string } | { t: "mention"; id: string; name: string };

/** Split a stored comment into text and mentions; unknown ids show as "@someone". */
export function commentSegments(
  body: string,
  names: ReadonlyMap<string, string>,
): CommentSegment[] {
  const out: CommentSegment[] = [];
  let at = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index! > at) out.push({ t: "text", v: body.slice(at, m.index) });
    const id = m[1]!.toLowerCase();
    const name = names.get(id);
    out.push(name ? { t: "mention", id, name } : { t: "text", v: "@someone" });
    at = m.index! + m[0].length;
  }
  if (at < body.length) out.push({ t: "text", v: body.slice(at) });
  return out;
}

/**
 * Composer → stored form. The writer types "@Kofi Asante"; picking a suggestion records
 * {id, name}. Each picked "@Name" becomes "@{id}" — longest names first, so "@Ama Mensah"
 * isn't swallowed by "@Ama". Names typed without picking stay plain text.
 */
export function encodeMentions(
  text: string,
  picked: readonly { id: string; name: string }[],
): string {
  let out = text;
  const sorted = [...picked].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, "gu"), `@{${p.id}}`);
  }
  return out;
}

/** The text being typed after "@" at the caret, for suggestions; null if not in a mention. */
export function mentionQueryAt(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(?:^|\s)@([\p{L}\p{N}' -]{0,30})$/u.exec(before);
  if (!m) return null;
  const query = m[1]!;
  if (/\s{2,}/.test(query) || query.split(" ").length > 3) return null;
  return { start: caret - query.length - 1, query };
}
