import { ArrowLeft, BookOpen, Eye, Library, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookCover } from "@/components/books/book-cover";
import { EngageBar } from "@/components/engage/engage-bar";
import { ApiClientError } from "@/lib/api";
import { BOOK_CATEGORY_LABEL, formatPrice, useBook, useBookActions } from "@/lib/books";
import { useSession } from "@/stores/session";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");

/** One book: buy, add free, read, sample, refund (D-036). */
export function BookPage() {
  const { slug } = useParams();
  const q = useBook(slug);
  const act = useBookActions(slug ?? "");
  const principal = useSession((s) => s.principal);
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);

  if (q.isPending) return <p className="muted small">Loading…</p>;
  if (q.isError)
    return <p className="card rail-card">{q.error instanceof ApiClientError && q.error.code === "BOOK_NOT_FOUND" ? "We couldn't find that book." : "This book could not be loaded."}</p>;
  const b = q.data;
  const isMember = principal?.kind === "member";
  const needSignIn = () => (principal ? false : (navigate("/login"), true));
  const err = act.checkout.error ?? act.addFree.error ?? act.refund.error;

  return (
    <div className="content-narrow mx-auto" style={{ maxWidth: 900 }}>
      <Link to="/books" className="link mb-4">
        <ArrowLeft className="ic" aria-hidden /> Books
      </Link>
      <article className="card book-hero">
        <BookCover b={b} size="lg" />
        <div className="min-w-0 flex-1">
          <span className="saint-kicker">{BOOK_CATEGORY_LABEL[b.category]}</span>
          <h1 className="page-title" style={{ margin: "6px 0 2px" }}>{b.title}</h1>
          {b.subtitle ? <p className="page-sub">{b.subtitle}</p> : null}
          <p className="small muted mt-1">by {b.authorName}</p>
          <p className="book-price-lg">{b.owned ? "In your library" : formatPrice(b.priceMinor, b.currency)}</p>

          <div className="flex flex-wrap gap-2 mt-3">
            {b.owned || b.priceMinor === 0 ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => !needSignIn() && navigate(`/books/${b.slug}/read`)}>
                <BookOpen className="ic" aria-hidden /> Read
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" disabled={act.checkout.isPending || (!!principal && !isMember)} onClick={() => !needSignIn() && act.checkout.mutate()}>
                <ShoppingBag className="ic" aria-hidden /> {act.checkout.isPending ? "Opening checkout…" : `Buy · ${formatPrice(b.priceMinor, b.currency)}`}
              </button>
            )}
            {b.priceMinor === 0 && !b.owned && isMember ? (
              <button type="button" className="btn btn-outline btn-sm" disabled={act.addFree.isPending} onClick={() => act.addFree.mutate()}>
                <Library className="ic" aria-hidden /> Add to library
              </button>
            ) : null}
            {b.hasPreview && !b.owned ? (
              <Link to={`/books/${b.slug}/read?preview=1`} className="btn btn-outline btn-sm">
                <Eye className="ic" aria-hidden /> Read a sample
              </Link>
            ) : null}
          </div>
          {principal && !isMember ? <p className="small muted mt-2">Buying and reading books is for member accounts.</p> : null}
          {b.priceMinor > 0 && !b.owned ? <p className="small muted mt-2">Pay with mobile money or card through Hubtel.</p> : null}
          {err ? <p className="small mt-2" style={{ color: "var(--danger)" }}>{errText(err)}</p> : null}
          <EngageBar kind="BOOK" id={b.id} title={b.title} href={`/books/${b.slug}`} size="md" />
        </div>
      </article>

      <section className="card post mt-4" style={{ padding: "24px 26px" }}>
        <h2 className="rail-title mb-2">About this book</h2>
        <p style={{ whiteSpace: "pre-line", color: "var(--text-2)" }}>{b.description}</p>
        {b.aboutAuthor ? (
          <>
            <h3 className="rail-title mt-4 mb-2">About the author</h3>
            <p style={{ whiteSpace: "pre-line", color: "var(--text-2)" }}>{b.aboutAuthor}</p>
          </>
        ) : null}
        <dl className="church-facts">
          <div><dt>Format</dt><dd>{b.format === "PDF" ? "PDF" : "EPUB e-book"}</dd></div>
          {b.pages ? <div><dt>Pages</dt><dd>{b.pages}</dd></div> : null}
          <div><dt>Language</dt><dd>{b.language.toUpperCase()}</dd></div>
          {b.isbn ? <div><dt>ISBN</dt><dd>{b.isbn}</dd></div> : null}
          {b.approbation ? <div><dt>Church approval</dt><dd>{b.approbation}</dd></div> : null}
        </dl>
      </section>

      {b.order ? (
        <section className="card rail-card mt-4" aria-label="Your purchase">
          <p className="small">
            Bought on {new Date(b.order.paidAt).toLocaleDateString()}.{" "}
            {b.order.refund.status === "REQUESTED" ? "Your refund request is being reviewed." : null}
          </p>
          {b.order.refund.allowed ? (
            asking ? (
              <form
                className="mt-2 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  act.refund.mutate({ orderId: b.order!.id, reason }, { onSuccess: () => setAsking(false) });
                }}
              >
                <textarea className="field-input" style={{ minHeight: 70, fontFamily: "inherit" }} placeholder="Why would you like a refund?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={reason.trim().length < 5 || act.refund.isPending}>Request refund</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <button type="button" className="link small" onClick={() => setAsking(true)}>Request a refund</button>
            )
          ) : b.order.refund.reason && b.order.refund.status !== "REQUESTED" ? (
            <p className="small muted">{b.order.refund.reason}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
