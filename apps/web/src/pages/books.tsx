import { Library, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { BookCategory } from "@ecclesios/shared";
import { BookTile } from "@/components/cards";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
import { BOOK_CATEGORIES, BOOK_CATEGORY_LABEL, useBooks } from "@/lib/books";
import { useSession } from "@/stores/session";

/** Books (functionality §3.10, D-036): Catholic e-books, free and paid. Filters live in the URL. */
export function BooksPage() {
  const principal = useSession((s) => s.principal);
  const [params, setParams] = useSearchParams();
  const category = (params.get("category") as BookCategory | null) ?? null;
  const price = (params.get("price") as "free" | "paid" | null) ?? null;
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = useBooks({ q: debounced, category, price });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header className="page-head flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Books</h1>
          <p className="page-sub">
            Catholic books to read on Ecclesios — classics free, new titles from Catholic writers.
          </p>
        </div>
        {principal?.kind === "member" ? (
          <Link to="/library" className="btn btn-outline btn-sm">
            My library
          </Link>
        ) : null}
      </header>

      <label className="search">
        <Search className="ic" aria-hidden />
        <input
          type="search"
          placeholder="Search by title or author"
          aria-label="Search books"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="filter-bar" role="toolbar" aria-label="Price">
        {([null, "free", "paid"] as const).map((p) => (
          <button
            key={p ?? "all"}
            type="button"
            className="f-pill"
            aria-pressed={price === p}
            onClick={() => set("price", p)}
          >
            {p === null ? "All" : p === "free" ? "Free" : "Paid"}
          </button>
        ))}
        <span className="mx-1" />
        {BOOK_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className="f-pill"
            aria-pressed={category === c}
            onClick={() => set("category", category === c ? null : c)}
          >
            {BOOK_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {list.isError ? (
        <ErrorState
          title="The books could not be loaded"
          error={list.error}
          onRetry={() => list.refetch()}
          retrying={list.isRefetching}
        />
      ) : null}
      {list.isPending ? <Skeleton variant="grid" count={6} label="Loading books" /> : null}
      {list.isSuccess && !items.length ? (
        <EmptyState icon={Library} title="No books here yet">
          {q.trim() || category || price
            ? "Try another search or filter."
            : "Books will appear here once they're published."}
        </EmptyState>
      ) : null}
      <ul className="book-grid">
        {items.map((b) => (
          <BookTile key={b.id} b={b} />
        ))}
      </ul>
      <LoadMore q={list} label="More books" />
    </div>
  );
}
