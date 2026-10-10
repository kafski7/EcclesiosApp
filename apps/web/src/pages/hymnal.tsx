import { Music, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HymnRow } from "@/components/cards";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
import { useHymnBooks, useHymnSearch } from "@/lib/hymnal";

const TAGS = [
  "advent",
  "christmas",
  "lent",
  "easter",
  "entrance",
  "offertory",
  "communion",
  "marian",
  "recessional",
];

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
        <button
          type="button"
          className="f-pill"
          aria-pressed={!book}
          onClick={() => set("book", null)}
        >
          All books
        </button>
        {books.data?.items.map((b) => (
          <button
            key={b.code}
            type="button"
            className="f-pill"
            aria-pressed={book === b.code}
            onClick={() => set("book", b.code)}
            title={b.name}
          >
            {b.code}
          </button>
        ))}
      </div>
      <div
        className="filter-bar"
        role="group"
        aria-label="Season or occasion"
        style={{ marginTop: -10 }}
      >
        {TAGS.map((t) => (
          <button
            key={t}
            type="button"
            className="f-pill"
            aria-pressed={tag === t}
            onClick={() => set("tag", tag === t ? null : t)}
          >
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
      {list.isPending ? <Skeleton variant="rows" count={6} label="Loading hymns" /> : null}
      {list.isError ? (
        <ErrorState
          title="The hymnal could not be loaded"
          error={list.error}
          onRetry={() => list.refetch()}
          retrying={list.isRefetching}
        />
      ) : null}
      {list.isSuccess && !items.length ? (
        <EmptyState icon={Music} title="No hymns found">
          Try the first line, a title, or a number such as 56 or “NCH 56”.
        </EmptyState>
      ) : null}

      {items.length ? (
        <ul className="card rail-card hymn-list">
          {items.map((h) => (
            <HymnRow key={h.slug} h={h} book={book} />
          ))}
        </ul>
      ) : null}
      <LoadMore q={list} label="More hymns" />
    </div>
  );
}
