import type { BibleBook, BibleChapter } from "@ecclesios/shared";
import { ChevronLeft, ChevronRight, Copy, Search, Share2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TextSize, useReadScale } from "@/components/reader/text-size";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { ApiClientError } from "@/lib/api";
import {
  adjustForTranslation,
  chapterPath,
  readerLocation,
  useActiveTranslation,
  useBibleSearch,
  useBooks,
  useChapter,
  verseSegments,
} from "@/lib/bible";
import { displayRef, selectionLink, selectionRef, selectionText } from "@/lib/bible-select";
import { shareLink, shareNote } from "@/lib/engage";
import { useBiblePrefs } from "@/stores/bible";

/** Bible reader in the kit's bible.html layout, with a translation picker (functionality §3.8, D-023). */
export function BiblePage() {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const ref = search.get("ref");
  const {
    active,
    items: translations,
    isPending: tPending,
    isError: tError,
  } = useActiveTranslation();
  // Citations use Hebrew psalm numbers; Douay-Rheims numbers most psalms one lower (D-024).
  const loc = useMemo(
    () =>
      adjustForTranslation(
        readerLocation(params, ref),
        Boolean(ref),
        active?.psalmNumbering ?? "HEBREW",
      ),
    [params, ref, active?.psalmNumbering],
  );
  const { setTranslation, setLastRead } = useBiblePrefs();
  const readScale = useReadScale();
  // Verses picked to copy or share (D-045); cleared when the chapter or translation changes.
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const books = useBooks(active?.code);
  const chapter = useChapter(active?.code, loc.book, loc.chapter, active?.offlineAllowed ?? false);
  const [query, setQuery] = useState(search.get("q") ?? "");
  const submitted = search.get("q") ?? "";

  const chapterKey = `${active?.code}:${loc.book}:${loc.chapter}`;
  useEffect(() => setPicked(new Set()), [chapterKey]);
  const toggleVerse = (n: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  // Remember the chapter for Home's "Continue" row (D-044) — only once it has really loaded.
  const loaded = chapter.data;
  useEffect(() => {
    if (!loaded) return;
    setLastRead({
      book: loaded.book.code,
      bookName: loaded.book.name,
      chapter: loaded.chapter,
      translation: loaded.translation.code,
    });
  }, [loaded, setLastRead]);

  // keep the URL canonical (/bible/luk/10) while preserving highlights from ?ref=
  useEffect(() => {
    if (!params.book && !ref) navigate(chapterPath(loc.book, loc.chapter), { replace: true });
  }, [params.book, ref, loc.book, loc.chapter, navigate]);

  // scroll to the first highlighted verse
  useEffect(() => {
    const first = loc.highlight ? Math.min(...loc.highlight) : null;
    if (first && chapter.data)
      document.getElementById(`v${first}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [loc.highlight, chapter.data]);

  const go = (book: string, ch: number) => navigate(chapterPath(book, ch));
  const bookList = books.data?.items ?? [];
  const current = bookList.find((b) => b.code === loc.book);
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    const next = new URLSearchParams(search);
    if (q.length >= 2) next.set("q", q);
    else next.delete("q");
    setSearch(next);
  };

  if (tError)
    return (
      <div className="content-narrow mx-auto card rail-card" role="alert">
        The Bible could not be loaded. Check your connection and try again.
      </div>
    );

  return (
    <div className="content-narrow mx-auto" style={readScale}>
      <section className="card bible-controls" aria-label="Bible navigation">
        <select
          aria-label="Translation"
          value={active?.code ?? ""}
          onChange={(e) => setTranslation(e.target.value)}
          disabled={tPending}
        >
          {translations.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code} · {t.name}
            </option>
          ))}
        </select>
        <BookPicker books={bookList} value={loc.book} onPick={(b) => go(b, 1)} />
        <select
          aria-label="Chapter"
          value={loc.chapter}
          onChange={(e) => go(loc.book, Number(e.target.value))}
          disabled={!current?.chapters}
        >
          {Array.from({ length: Math.max(current?.chapters ?? 0, loc.chapter) }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <TextSize />
        <form className="search" role="search" onSubmit={onSearch}>
          <Search className="ic" aria-hidden />
          <input
            type="search"
            placeholder={`Search ${active?.code ?? "the Bible"}…`}
            aria-label="Search the Bible"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </section>

      {submitted ? (
        <SearchResults
          translation={active?.code}
          q={submitted}
          onClose={() => {
            setQuery("");
            const next = new URLSearchParams(search);
            next.delete("q");
            setSearch(next);
          }}
        />
      ) : null}

      <article className="card bible-text" aria-live="polite">
        {chapter.isPending ? <Skeleton variant="page" label="Loading the chapter" /> : null}
        {chapter.isError ? (
          <ChapterError
            error={chapter.error}
            onRetry={() => chapter.refetch()}
            retrying={chapter.isRefetching}
          />
        ) : null}
        {chapter.data ? (
          <>
            <h1 className="bible-ref">
              {chapter.data.book.name} {chapter.data.chapter}
            </h1>
            <p className="book-meta">
              {chapter.data.translation.name}
              {chapter.data.book.code === "PSA" && active?.psalmNumbering === "VULGATE"
                ? " · Psalms numbered as in the Vulgate (usually one lower than in modern Bibles)"
                : ""}
            </p>
            <p className="small muted bible-hint">
              Tap a verse number to select verses to copy or share.
            </p>
            {chapter.data.verses.map((v) => (
              <p
                key={v.verse}
                id={`v${v.verse}`}
                className={`verse${loc.highlight?.has(v.verse) ? " hl" : ""}${picked.has(v.verse) ? " picked" : ""}`}
                onClick={() => {
                  // Mouse convenience: tapping the text selects too, unless the reader is selecting text.
                  if (!window.getSelection()?.toString()) toggleVerse(v.verse);
                }}
              >
                <sup>
                  <button
                    type="button"
                    className="verse-num"
                    aria-pressed={picked.has(v.verse)}
                    aria-label={`Verse ${v.verse}${picked.has(v.verse) ? ", selected" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVerse(v.verse);
                    }}
                  >
                    {v.verse}
                  </button>
                </sup>
                {verseSegments(v.text, v.woj).map((s, i) =>
                  s.woj ? (
                    <span key={i} className="woj">
                      {s.text}
                    </span>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </p>
            ))}
            <nav className="chapter-nav" aria-label="Chapters">
              {chapter.data.prev ? (
                <Link
                  className="btn btn-outline btn-sm"
                  to={chapterPath(chapter.data.prev.book, chapter.data.prev.chapter)}
                >
                  <ChevronLeft className="ic" aria-hidden /> Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="ch-label">
                {chapter.data.book.name} {chapter.data.chapter}
              </span>
              {chapter.data.next ? (
                <Link
                  className="btn btn-outline btn-sm"
                  to={chapterPath(chapter.data.next.book, chapter.data.next.chapter)}
                >
                  Next <ChevronRight className="ic" aria-hidden />
                </Link>
              ) : (
                <span />
              )}
            </nav>
            <p className="all-credits">{chapter.data.translation.attribution}</p>
          </>
        ) : null}
      </article>
      {chapter.data && picked.size ? (
        <SelectionBar
          chapter={chapter.data}
          picked={picked}
          vulgatePsalm={chapter.data.book.code === "PSA" && active?.psalmNumbering === "VULGATE"}
          onClear={() => setPicked(new Set())}
        />
      ) : null}
    </div>
  );
}

/** Copy / Share / Clear for the selected verses (D-045). */
function SelectionBar({
  chapter,
  picked,
  vulgatePsalm,
  onClear,
}: {
  chapter: BibleChapter;
  picked: ReadonlySet<number>;
  vulgatePsalm: boolean;
  onClear: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const ref = selectionRef(chapter.book.name, chapter.chapter, picked);
  const link = selectionLink(chapter.book.code, chapter.chapter, ref, vulgatePsalm);
  const say = (t: string | null) => {
    clearTimeout(timer.current);
    setNote(t);
    if (t) timer.current = setTimeout(() => setNote(null), 2500);
  };
  const share = async () => say(shareNote(await shareLink(displayRef(ref), link)));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        selectionText(chapter.verses, picked, ref, chapter.translation.code),
      );
      say("Verses copied");
    } catch {
      say("Couldn't copy — select the text instead");
    }
  };
  return (
    <div className="card selection-bar" role="region" aria-label="Selected verses">
      <b className="selection-ref">{displayRef(ref)}</b>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => void copy()}>
        <Copy className="ic" aria-hidden /> Copy
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void share()}>
        <Share2 className="ic" aria-hidden /> Share
      </button>
      <button type="button" className="icon-btn" onClick={onClear} aria-label="Clear selection">
        <X className="ic" />
      </button>
      <span className="eng-note" role="status" aria-live="polite">
        {note}
      </span>
    </div>
  );
}

function BookPicker({
  books,
  value,
  onPick,
}: {
  books: BibleBook[];
  value: string;
  onPick: (code: string) => void;
}) {
  const group = (t: "OT" | "NT") => books.filter((b) => b.testament === t);
  return (
    <select aria-label="Book" value={value} onChange={(e) => onPick(e.target.value)}>
      {(["OT", "NT"] as const).map((t) => (
        <optgroup key={t} label={t === "OT" ? "Old Testament" : "New Testament"}>
          {group(t).map((b) => (
            <option key={b.code} value={b.code} disabled={b.chapters === 0}>
              {b.name}
              {b.chapters === 0 ? " (not loaded)" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function SearchResults({
  translation,
  q,
  onClose,
}: {
  translation?: string;
  q: string;
  onClose: () => void;
}) {
  const r = useBibleSearch(translation, q);
  return (
    <section className="card rail-card" style={{ marginBottom: 18 }} aria-label="Search results">
      <div className="rail-head">
        <h2 className="rail-title">Results for “{q}”</h2>
        <button type="button" className="icon-btn" aria-label="Close search" onClick={onClose}>
          <X className="ic" />
        </button>
      </div>
      {r.isPending ? <Skeleton variant="rows" count={3} label="Searching" /> : null}
      {r.isError ? (
        <ErrorState
          title="The search could not be completed"
          error={r.error}
          onRetry={() => r.refetch()}
          retrying={r.isRefetching}
          compact
        />
      ) : null}
      {r.data && !r.data.items.length ? <p className="muted small">No verses found.</p> : null}
      <ul className="search-hits">
        {r.data?.items.map((h) => (
          <li key={`${h.book}${h.chapter}:${h.verse}`}>
            <Link
              to={`${chapterPath(h.book, h.chapter)}?ref=${encodeURIComponent(`${h.bookName} ${h.chapter}:${h.verse}`)}`}
            >
              <b>
                {h.bookName} {h.chapter}:{h.verse}
              </b>
              <p className="post-text">{h.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChapterError({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => unknown;
  retrying: boolean;
}) {
  const code = error instanceof ApiClientError ? error.code : null;
  if (code === "CHAPTER_NOT_FOUND")
    return (
      <p className="post-text">
        This chapter isn't loaded in this translation yet. Try another translation or chapter.
      </p>
    );
  return (
    <ErrorState
      title="The chapter could not be loaded"
      message={
        code === "NETWORK_ERROR"
          ? "You're offline and this chapter hasn't been saved on this device yet."
          : undefined
      }
      onRetry={onRetry}
      retrying={retrying}
      compact
    />
  );
}
