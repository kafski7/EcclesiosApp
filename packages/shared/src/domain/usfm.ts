/**
 * Minimal USFM reader for importing public-domain Bibles (D-023), e.g. the USFM downloads on eBible.org.
 * Keeps verse text, marks words of Jesus (\wj), drops footnotes, cross-references and word-level markup.
 */
import { normalizeBookCode } from "./bible.js";

export interface UsfmVerse {
  chapter: number;
  verse: number;
  text: string;
  /** Text spans that are words of Jesus, as [start, end) offsets into `text`. */
  woj: [number, number][];
}

export interface UsfmBook {
  code: string;
  verses: UsfmVerse[];
}

const NOTE = /\\(f|fe|x|ef|ex)\s.*?\\\1\*/gs;
const WORD_ATTR = /\\\+?w\s+([^|\\]*?)(?:\|[^\\]*)?\\\+?w\*/g;
const CHAR_MARKERS = /\\\+?(?:add|nd|bk|pn|qt|tl|sc|it|bd|em|no|k|sls|qs|ord|dc)\*?\s?/g;

/** Returns null for files that are not canonical books (front matter, glossary…). */
export function parseUsfm(source: string): UsfmBook | null {
  const id = /\\id\s+([A-Z0-9]{3})/.exec(source);
  const code = id ? normalizeBookCode(id[1]!) : null;
  if (!code) return null;

  const body = source.replace(/\r\n?/g, "\n").replace(NOTE, "");
  const verses: UsfmVerse[] = [];
  let chapter = 0;
  let current: { verse: number; raw: string } | null = null;

  const flush = () => {
    if (!current || !chapter) return;
    const { text, woj } = cleanVerse(current.raw);
    if (text) verses.push({ chapter, verse: current.verse, text, woj });
    current = null;
  };

  for (const token of body.split(/(?=\\c\s|\\v\s)/)) {
    const c = /^\\c\s+(\d+)/.exec(token);
    if (c) {
      flush();
      chapter = Number(c[1]);
      continue;
    }
    const v = /^\\v\s+(\d+)(?:-\d+)?\s?([\s\S]*)$/.exec(token);
    if (v) {
      flush();
      current = { verse: Number(v[1]), raw: v[2]! };
      continue;
    }
    if (current) current.raw += " " + token;
  }
  flush();
  return { code, verses };
}

function cleanVerse(raw: string): { text: string; woj: [number, number][] } {
  let s = raw.replace(WORD_ATTR, "$1").replace(CHAR_MARKERS, "");
  // paragraph / poetry / heading markers between verses: drop the marker and any heading text
  s = s.replace(/\\(?:s\d?|ms\d?|mr|r|d|sp|cl)\s[^\\]*/g, " ");
  s = s.replace(/\\[a-z]+\d?\*?/g, (m) => (m.startsWith("\\wj") ? m : " "));

  const woj: [number, number][] = [];
  let out = "";
  let open = -1;
  for (const part of s.split(/(\\wj\*?)/)) {
    if (part === "\\wj") open = out.length;
    else if (part === "\\wj*") {
      if (open >= 0) woj.push([open, out.length]);
      open = -1;
    } else out += part;
  }
  // normalise whitespace while keeping the offsets valid
  const squashed: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < out.length; i++) {
    const ch = /\s/.test(out[i]!) ? " " : out[i]!;
    if (ch === " " && (squashed.length === 0 || squashed[squashed.length - 1] === " ")) {
      map[i] = squashed.length;
      continue;
    }
    map[i] = squashed.length;
    squashed.push(ch);
  }
  map[out.length] = squashed.length;
  let text = squashed.join("");
  const trailing = text.length - text.trimEnd().length;
  text = text.trimEnd();
  return {
    text,
    woj: woj
      .map(([a, b2]) => [map[a]!, Math.min(map[b2]!, text.length)] as [number, number])
      .filter(([a, b2]) => b2 > a)
      .map(([a, b2]) => [a, b2 - (b2 > text.length + trailing ? trailing : 0)] as [number, number]),
  };
}
