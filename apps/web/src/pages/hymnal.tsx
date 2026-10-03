import { FileText, Headphones, Music, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EngageBar } from "@/components/engage/engage-bar";
import { useHymnBooks, useHymnSearch } from "@/lib/hymnal";

const TAGS = ["advent", "christmas", "lent", "easter", "entrance", "offertory", "communion", "marian", "recessional"];

/** Hymn browser (functionality §3.6, D-026): search by number ("56", "NCH 56"), first line or lyrics. */
export function HymnalPage() {
  const [params, setParams] = useSearchParams();
  const book = params.get("book");
  const tag = params.get("tag");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced.trim()) next.set("q", debounced.trim());
    else next.delete("q");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [debounced, params, setParams]);

  const books = useHymnBooks();
  const list = useHymnSearch({ q: debounced, book, tag });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const matched = list.data?.pages[0]?.matchedNumber;
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <div className="content-narrow mx-auto">
      <div className="page-head">
        <h1 className="page-title">Hymnal</h1>
        <p className="page-sub">Search by hymn number, first line or any words of the hymn.</p>
      </div>

      <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search className="ic" aria-hidden />
        <input
          type="search"
          inputMode="search"
          placeholder="e.g. 56, NCH 512, Silent night"
          aria-label="Search hymns"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      <div className="filter-bar" role="group" aria-label="Hymn book">
        <button type="button" className="f-pill" aria-pressed={!book} onClick={() => set("book", null)}>
          All books
        </button>
        {books.data?.items.map((b) => (
          <button key={b.code} type="button" className="f-pill" aria-pressed={book === b.code} onClick={() => set("book", b.code)} title={b.name}>
            {b.code}
          </button>
        ))}
      </div>
      <div className="filter-bar" role="group" aria-label="Season or occasion" style={{ marginTop: -10 }}>
        {TAGS.map((t) => (
          <button key={t} type="button" className="f-pill" aria-pressed={tag === t} onClick={() => set("tag", tag === t ? null : t)}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {matched ? (
        <p className="small muted mb-3">
          Hymns numbered {matched.number}
          {matched.book ? ` in ${matched.book}` : " in any hymn book"}
        </p>
      ) : null}
      {list.isPending ? <p className="muted small">Loading hymns…</p> : null}
      {list.isError ? <p className="small">The hymnal could not be loaded.</p> : null}
      {list.data && !items.length ? <p className="muted small">No hymns found. Try the first line, or a number like 56.</p> : null}

      {items.length ? (
        <ul className="card rail-card hymn-list">
          {items.map((h) => {
            const n = (book && h.numbers.find((x) => x.book === book)) || h.numbers[0];
            return (
              <li key={h.slug}>
                <Link to={`/hymnal/${h.slug}`} className="hymn-row">
                  <span className="hymn-num">
                    {n ? (
                      <>
                        <small>{n.book}</small>
                        {n.number}
                      </>
                    ) : (
                      <Music className="ic" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="hymn-title block truncate">{h.title}</span>
                    <span className="hymn-meta block truncate">
                      {h.title !== h.firstLine ? h.firstLine : h.tags.join(" · ")}
                    </span>
                  </span>
                  <span className="hymn-icons" aria-hidden>
                    {h.hasAudio ? <Headphones className="ic" /> : null}
                    {h.hasNotation ? <FileText className="ic" /> : null}
                  </span>
                </Link>
                <EngageBar kind="HYMN" id={h.id} title={h.title} href={`/hymnal/${h.slug}`} />
              </li>
            );
          })}
        </ul>
      ) : null}
      {list.hasNextPage ? (
        <div className="mt-4 text-center">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? "Loading…" : "More hymns"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
