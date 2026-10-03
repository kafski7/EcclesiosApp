/**
 * Loads a Bible translation from USFM files (D-023).
 *
 *   pnpm bible:import -- --translation WEBC --dir ./downloads/webc-usfm
 *
 * - The translation must already exist (the seed registers WEBC and DRA; add others the same way).
 * - Every *.usfm / *.sfm file in --dir is parsed; front matter and non-canonical books are skipped.
 * - Each book is replaced atomically, so the import can be re-run safely.
 * - Only import text you are licensed to publish (public domain, or a licence on file).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseUsfm } from "@ecclesios/shared/domain";
import { and, eq } from "drizzle-orm";
import { createDb } from "../client";
import { loadEnv } from "../env";
import { bibleTranslations, bibleVerses } from "../schema";

loadEnv();

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const code = arg("translation")?.toUpperCase();
  // pnpm runs this inside packages/db; resolve --dir from where the command was typed.
  const rawDir = arg("dir");
  const dir = rawDir ? resolve(process.env.INIT_CWD ?? process.cwd(), rawDir) : undefined;
  if (!code || !dir) throw new Error("Usage: pnpm bible:import -- --translation WEBC --dir <folder of .usfm files>");

  const { db, close } = createDb(undefined, { max: 1 });
  try {
    const [t] = await db.select().from(bibleTranslations).where(eq(bibleTranslations.code, code)).limit(1);
    if (!t) throw new Error(`Translation ${code} is not registered. Seed it or insert it into bible_translations first.`);

    const files = readdirSync(dir).filter((f) => /\.(usfm|sfm)$/i.test(f)).sort();
    if (!files.length) throw new Error(`No .usfm/.sfm files in ${dir}`);

    let books = 0;
    let verses = 0;
    for (const file of files) {
      const book = parseUsfm(readFileSync(join(dir, file), "utf8"));
      if (!book || !book.verses.length) continue;
      await db.transaction(async (tx) => {
        await tx.delete(bibleVerses).where(and(eq(bibleVerses.translationId, t.id), eq(bibleVerses.book, book.code)));
        for (let i = 0; i < book.verses.length; i += 1000) {
          await tx.insert(bibleVerses).values(
            book.verses.slice(i, i + 1000).map((v) => ({
              translationId: t.id,
              book: book.code,
              chapter: v.chapter,
              verse: v.verse,
              text: v.text,
              woj: v.woj,
            })),
          );
        }
      });
      books += 1;
      verses += book.verses.length;
      console.info(`  ${book.code.padEnd(3)} ${book.verses.length} verses`);
    }
    console.info(`Imported ${books} books, ${verses} verses into ${code}.`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
