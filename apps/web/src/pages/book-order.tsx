import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Order } from "@ecclesios/shared";
import { ApiClientError } from "@/lib/api";
import { formatPrice, testOrder, testSettle, useOrder } from "@/lib/books";

/** Where Hubtel sends the buyer back. Waits until the payment is confirmed by the server. */
export function BookOrderPage() {
  const { id } = useParams();
  const q = useOrder(id);
  const o = q.data;
  return (
    <div className="content-narrow mx-auto card rail-card" style={{ maxWidth: 520, textAlign: "center", padding: 28 }}>
      {q.isError ? <p>We couldn't find that order.</p> : null}
      {!o && !q.isError ? <Loader2 className="ic animate-spin mx-auto" aria-label="Loading" /> : null}
      {o?.status === "PENDING" ? (
        <>
          <Loader2 className="ic animate-spin mx-auto" style={{ width: 32, height: 32 }} aria-hidden />
          <h1 className="page-title mt-3">Confirming your payment…</h1>
          <p className="page-sub">This usually takes a few seconds after you approve the payment on your phone.</p>
        </>
      ) : null}
      {o?.status === "PAID" ? (
        <>
          <CheckCircle2 className="ic mx-auto" style={{ width: 40, height: 40, color: "var(--success)" }} aria-hidden />
          <h1 className="page-title mt-3">Thank you!</h1>
          <p className="page-sub">"{o.book.title}" is in your library.</p>
          <Link to={`/books/${o.book.slug}/read`} className="btn btn-primary btn-sm mt-4">Start reading</Link>
        </>
      ) : null}
      {o && (o.status === "FAILED" || o.status === "CANCELLED") ? (
        <>
          <XCircle className="ic mx-auto" style={{ width: 40, height: 40, color: "var(--danger)" }} aria-hidden />
          <h1 className="page-title mt-3">Payment not completed</h1>
          <p className="page-sub">You haven't been charged for this order.</p>
          <Link to={`/books/${o.book.slug}`} className="btn btn-outline btn-sm mt-4">Back to the book</Link>
        </>
      ) : null}
    </div>
  );
}

/** Development-only checkout (PAYMENTS_GATEWAY=test). Never shown in production. */
export function TestCheckoutPage() {
  const [params] = useSearchParams();
  const ref = params.get("ref") ?? "";
  const navigate = useNavigate();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    testOrder(ref).then(setO).catch((e) => setErr(e instanceof ApiClientError ? e.message : "Not available."));
  }, [ref]);
  const settle = async (outcome: "paid" | "failed") => {
    const r = await testSettle(ref, outcome);
    navigate(`/books/orders/${r.orderId}`);
  };
  return (
    <div className="content-narrow mx-auto card rail-card" style={{ maxWidth: 480, padding: 28 }}>
      <span className="saint-kicker">Test checkout — no real money</span>
      {err ? <p>{err}</p> : null}
      {o ? (
        <>
          <h1 className="page-title mt-2">{o.book.title}</h1>
          <p className="book-price-lg">{formatPrice(o.amountMinor, o.currency)}</p>
          <div className="flex gap-2 mt-4">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void settle("paid")}>Pay (test)</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void settle("failed")}>Fail (test)</button>
          </div>
        </>
      ) : null}
    </div>
  );
}
