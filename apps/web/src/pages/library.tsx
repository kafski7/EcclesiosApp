import { Link } from "react-router-dom";
import { BookCover } from "@/components/books/book-cover";
import { useLibrary } from "@/lib/books";
import { useSession } from "@/stores/session";

/** My library: books bought and free books added (D-036). */
export function LibraryPage() {
  const principal = useSession((s) => s.principal);
  const q = useLibrary();
  if (principal?.kind !== "member")
    return (
      <div className="content-narrow mx-auto card rail-card">
        <Link to="/login" className="link">Sign in</Link> to see your books.
      </div>
    );
  const items = q.data?.items ?? [];
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header className="page-head">
        <h1 className="page-title">My library</h1>
        <p className="page-sub">Books you've bought or added. Pick up where you left off.</p>
      </header>
      {q.isPending ? <p className="muted small">Loading…</p> : null}
      {q.isSuccess && !items.length ? (
        <p className="card rail-card muted">
          Your library is empty. <Link to="/books" className="link">Browse books</Link>.
        </p>
      ) : null}
      <ul className="book-grid">
        {items.map((b) => (
          <li key={b.id} className="book-tile">
            <Link to={`/books/${b.slug}/read`} className="block">
              <BookCover b={b} />
              <b className="book-title">{b.title}</b>
              <small className="muted block">{b.authorName}</small>
              <span className="book-progress" aria-label={`${b.percent}% read`}>
                <span style={{ width: `${b.percent}%` }} />
              </span>
              <small className="muted">{b.percent ? `${b.percent}% read` : "Not started"}</small>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
