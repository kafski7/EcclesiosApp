import type { BibleChapter } from "@ecclesios/shared";
import Dexie, { type Table } from "dexie";

/**
 * Offline copy of chapters the reader has opened (functionality §6, D-023). Only translations whose
 * licence allows offline use are stored. Whole-translation download comes with the PWA polish (Phase 9).
 */
interface StoredChapter {
  key: string; // "WEBC:LUK:10"
  savedAt: number;
  chapter: BibleChapter;
}

class BibleDb extends Dexie {
  chapters!: Table<StoredChapter, string>;
  constructor() {
    super("ecclesios-bible");
    this.version(1).stores({ chapters: "key, savedAt" });
  }
}

let db: BibleDb | null = null;
const open = () => {
  if (typeof indexedDB === "undefined") return null;
  db ??= new BibleDb();
  return db;
};

export const chapterKey = (translation: string, book: string, chapter: number) =>
  `${translation.toUpperCase()}:${book.toUpperCase()}:${chapter}`;

export async function saveChapter(c: BibleChapter) {
  try {
    await open()?.chapters.put({ key: chapterKey(c.translation.code, c.book.code, c.chapter), savedAt: Date.now(), chapter: c });
  } catch {
    /* storage full or blocked: reading still works online */
  }
}

export async function loadChapter(translation: string, book: string, chapter: number) {
  try {
    return (await open()?.chapters.get(chapterKey(translation, book, chapter)))?.chapter ?? null;
  } catch {
    return null;
  }
}
