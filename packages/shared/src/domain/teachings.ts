/**
 * Teachings (functionality §3.7, D-030). Pure and dependency-free.
 *
 * Lessons are written in a small, safe text format — never HTML — so nothing a writer types
 * can inject markup, and every reader (web, PWA, the future mobile app) renders the same blocks:
 *
 *   ## Heading            ### Sub-heading
 *   Plain paragraph text with **bold**, *italic* and references:
 *     [[John 6:51]]       → Bible passage (opens the reader)
 *     [[CCC 1324]]        → Catechism of the Catholic Church paragraph
 *     [[teaching:slug]]   → another teaching (label optional: [[teaching:slug|the Eucharist]])
 *   > A quotation
 *   > — Source of the quotation
 *   - bullet item         1. numbered item
 *
 * Blocks are separated by a blank line.
 */
import { parseReference } from "./bible.js";

export const TEACHING_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type TeachingStatus = (typeof TEACHING_STATUSES)[number];

/** The Catechism has 2,865 numbered paragraphs. */
export const CCC_MAX = 2865;

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; v: string }
  | { t: "em"; v: string }
  | { t: "bible"; ref: string }
  | { t: "ccc"; n: number }
  | { t: "teaching"; slug: string; label: string | null };

export type Block =
  | { type: "heading"; level: 2 | 3; text: Inline[] }
  | { type: "paragraph"; text: Inline[] }
  | { type: "quote"; text: Inline[]; cite: string | null }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const TOKEN = /\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  const push = (x: Inline) => {
    const last = out[out.length - 1];
    if (x.t === "text" && last?.t === "text") last.v += x.v;
    else out.push(x);
  };
  for (const m of s.matchAll(TOKEN)) {
    if (m.index! > at) push({ t: "text", v: s.slice(at, m.index) });
    at = m.index! + m[0].length;
    if (m[2] !== undefined) {
      push({ t: "strong", v: m[2] });
      continue;
    }
    if (m[3] !== undefined) {
      push({ t: "em", v: m[3] });
      continue;
    }
    const inner = m[1]!.trim();
    const ccc = /^CCC\s*(\d{1,4})$/i.exec(inner);
    const teach = /^teaching:([a-z0-9]+(?:-[a-z0-9]+)*)(?:\|(.+))?$/.exec(inner);
    if (ccc && Number(ccc[1]) >= 1 && Number(ccc[1]) <= CCC_MAX) push({ t: "ccc", n: Number(ccc[1]) });
    else if (teach) push({ t: "teaching", slug: teach[1]!, label: teach[2]?.trim() || null });
    else if (parseReference(inner)) push({ t: "bible", ref: inner });
    else push({ t: "text", v: m[0] }); // not understood: shown as typed (lintLesson reports it)
  }
  if (at < s.length) push({ t: "text", v: s.slice(at) });
  return out;
}

export function parseLesson(source: string): Block[] {
  const blocks: Block[] = [];
  const chunks = source
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((c) => c.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim()))
    .filter((c) => c.length);
  for (const lines of chunks) {
    const first = lines[0]!.trim();
    const h = /^(#{2,3})\s+(.+)$/.exec(first);
    if (h && lines.length === 1) {
      blocks.push({ type: "heading", level: h[1]!.length as 2 | 3, text: parseInline(h[2]!) });
    } else if (lines.every((l) => /^\s*>/.test(l))) {
      const body = lines.map((l) => l.replace(/^\s*>\s?/, ""));
      const citeLine = body.length > 1 && /^[—–-]{1,2}\s*\S/.test(body[body.length - 1]!) ? body.pop()! : null;
      blocks.push({ type: "quote", text: parseInline(body.join(" ")), cite: citeLine ? citeLine.replace(/^[—–-]{1,2}\s*/, "") : null });
    } else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      blocks.push({ type: "list", ordered: false, items: lines.map((l) => parseInline(l.replace(/^\s*[-*]\s+/, ""))) });
    } else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      blocks.push({ type: "list", ordered: true, items: lines.map((l) => parseInline(l.replace(/^\s*\d+[.)]\s+/, ""))) });
    } else {
      blocks.push({ type: "paragraph", text: parseInline(lines.map((l) => l.trim()).join(" ")) });
    }
  }
  return blocks;
}

const inlines = (b: Block): Inline[] =>
  b.type === "list" ? b.items.flat() : b.text;

/** Bible passages, Catechism paragraphs and teachings a lesson cites, in order, without repeats. */
export function lessonReferences(blocks: readonly Block[]) {
  const bible: string[] = [];
  const ccc: number[] = [];
  const teachings: string[] = [];
  for (const b of blocks)
    for (const x of inlines(b)) {
      if (x.t === "bible" && !bible.includes(x.ref)) bible.push(x.ref);
      if (x.t === "ccc" && !ccc.includes(x.n)) ccc.push(x.n);
      if (x.t === "teaching" && !teachings.includes(x.slug)) teachings.push(x.slug);
    }
  return { bible, ccc: [...ccc].sort((a, b) => a - b), teachings };
}

/** Plain text of a lesson (search index, summaries, word count). */
export function lessonText(blocks: readonly Block[]): string {
  const one = (x: Inline) =>
    x.t === "bible" ? x.ref : x.t === "ccc" ? `CCC ${x.n}` : x.t === "teaching" ? (x.label ?? "") : x.v;
  return blocks.map((b) => inlines(b).map(one).join("")).join("\n");
}

/** Minutes to read at ~200 words a minute, at least 1. */
export const readingMinutes = (blocks: readonly Block[]) =>
  Math.max(1, Math.ceil(lessonText(blocks).split(/\s+/).filter(Boolean).length / 200));

/**
 * Problems a writer should fix before publishing: references that weren't understood,
 * and links to teachings that don't exist (`knownSlugs`).
 */
export function lintLesson(source: string, knownSlugs?: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  for (const m of source.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const inner = m[1]!.trim();
    const parsed = parseInline(m[0])[0];
    if (!parsed || parsed.t === "text") problems.push(`Not understood: [[${inner}]] — use a Bible reference, CCC 1–${CCC_MAX}, or teaching:slug`);
    else if (parsed.t === "teaching" && knownSlugs && !knownSlugs.has(parsed.slug)) problems.push(`No teaching called "${parsed.slug}"`);
  }
  if (!parseLesson(source).length) problems.push("The lesson is empty");
  return problems;
}
