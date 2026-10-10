import { Link } from "react-router-dom";
import { Library } from "lucide-react";
import { SignInLink } from "@/components/auth/sign-in-link";
import { BookCover } from "@/components/books/book-cover";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useLibrary } from "@/lib/books";
import { libraryLabel, sortLibrary } from "@/lib/you";
import { useSession } from "@/stores/session";

/** My library: books bought and free books added (D-036). */
export function LibraryPage() {
  const principal = useSession((s) => s.principal);
  const q = useLibrary();
  if (principal?.kind !== "member")
    return (
      <div className="content-narrow mx-auto card rail-card">
        <SignInLink /> to see your books.
      </div>
    );
  // Reading first, then unstarted, then finished (D-049).
  const items = sortLibrary(q.data?.items ?? []);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <header className="page-head">
        <h1 className="page-title">My library</h1>
        <p className="page-sub">Books you've bought or added. Pick up where you left off.</p>
      </header>
      {q.isPending ? <Skeleton variant="grid" count={4} label="Loading your library" /> : null}
      {q.isError ? (
        <ErrorState
          title="Your library could not be loaded"
          error={q.error}
          onRetry={() => q.refetch()}
          retrying={q.isRefetching}
        />
      ) : null}
      {q.isSuccess && !items.length ? (
        <EmptyState
          icon={Library}
          title="Your library is empty"
          action={
            <Link to="/books" className="btn btn-outline btn-sm">
              Browse books
            </Link>
          }
        >
          Books you buy or add for free appear here.
        </EmptyState>
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
              <small className="muted">{libraryLabel(b.percent)}</small>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
