import {
  CAlert,
  CBadge,
  CButton,
  CFormInput,
  CFormTextarea,
  CNav,
  CNavItem,
  CNavLink,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import type { StudioBook } from "@ecclesios/shared";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import {
  bpsLabel,
  formatPrice,
  parsePrice,
  STATUS_COLOR,
  useAllBooks,
  useBookSettings,
  useDecideBook,
  useRefundDecision,
  useRefunds,
  useSaveBookSettings,
  useSellerActions,
  useSellers,
} from "@/lib/books";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");
type Tab = "review" | "all" | "refunds" | "sellers" | "settings";

/** Super-Admin: review, refunds, sellers & payouts, commission (D-036). */
export function PlatformBooksPage() {
  const [tab, setTab] = useState<Tab>("review");
  const pending = useAllBooks("PENDING");
  const refunds = useRefunds();
  const waiting = refunds.data?.items.filter((r) => r.status === "REQUESTED").length ?? 0;
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Books</h1>
          <p className="dash-sub">Review new books, handle refunds, pay sellers and set the commission.</p>
        </div>
        <Link to="/platform/books/mine" className="btn btn-outline btn-sm">Ecclesios's own books</Link>
      </div>
      <CNav variant="underline" className="mb-3">
        {(
          [
            ["review", <>To review {pending.data ? <CBadge color="primary" className="ms-1">{pending.data.items.length}</CBadge> : null}</>],
            ["all", "All books"],
            ["refunds", <>Refunds {waiting ? <CBadge color="danger" className="ms-1">{waiting}</CBadge> : null}</>],
            ["sellers", "Sellers & payouts"],
            ["settings", "Commission"],
          ] as const
        ).map(([id, label]) => (
          <CNavItem key={id}>
            <CNavLink as="button" active={tab === id} onClick={() => setTab(id)}>
              {label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>
      {tab === "review" ? <Review /> : tab === "all" ? <AllBooks /> : tab === "refunds" ? <Refunds /> : tab === "sellers" ? <Sellers /> : <Settings />}
    </>
  );
}

function Review() {
  const q = useAllBooks("PENDING");
  if (q.isPending) return <p className="muted">Loading…</p>;
  if (!q.data?.items.length) return <section className="card panel muted">Nothing waiting.</section>;
  return <>{q.data.items.map((b) => <ReviewCard key={b.slug} b={b} />)}</>;
}

function ReviewCard({ b }: { b: StudioBook }) {
  const decide = useDecideBook();
  const [note, setNote] = useState("");
  return (
    <section className="card panel mb-4">
      <div className="d-flex gap-4 flex-wrap">
        {b.coverUrl ? <img src={b.coverUrl} alt="" style={{ width: 110, borderRadius: 8 }} /> : null}
        <div className="flex-grow-1" style={{ minWidth: 260 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{b.title}</h2>
          <p className="small muted mb-1">
            {b.authorName} · listed by <b>{b.seller}</b> · {formatPrice(b.priceMinor)} · {b.format}
          </p>
          {b.approbation ? <p className="small mb-1">Church approval: {b.approbation}</p> : null}
          <p style={{ whiteSpace: "pre-line" }}>{b.description}</p>
          <p className="small muted">Check the content is suitable and that the seller has the rights (confirmed: {b.rightsConfirmed ? "yes" : "no"}).</p>
        </div>
      </div>
      <CFormTextarea rows={2} className="mb-2" placeholder="Note to the seller (required to reject)" value={note} onChange={(e) => setNote(e.target.value)} />
      {decide.error ? <CAlert color="danger">{errText(decide.error)}</CAlert> : null}
      <div className="d-flex gap-2">
        <CButton color="primary" disabled={decide.isPending} onClick={() => decide.mutate({ slug: b.slug, d: { decision: "approve", note: note.trim() || undefined } })}>Approve</CButton>
        <CButton color="danger" variant="outline" disabled={decide.isPending || note.trim().length < 3} onClick={() => decide.mutate({ slug: b.slug, d: { decision: "reject", note: note.trim() } })}>Reject</CButton>
      </div>
    </section>
  );
}

function AllBooks() {
  const q = useAllBooks(null);
  const decide = useDecideBook();
  return (
    <section className="card panel">
      {decide.error ? <CAlert color="danger">{errText(decide.error)}</CAlert> : null}
      <CTable hover responsive className="cms-table mb-0">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Book</CTableHeaderCell>
            <CTableHeaderCell>Seller</CTableHeaderCell>
            <CTableHeaderCell>Price</CTableHeaderCell>
            <CTableHeaderCell>Sold</CTableHeaderCell>
            <CTableHeaderCell>Status</CTableHeaderCell>
            <CTableHeaderCell />
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {q.data?.items.map((b) => (
            <CTableRow key={b.slug}>
              <CTableDataCell><b>{b.title}</b><div className="small muted">{b.authorName}</div></CTableDataCell>
              <CTableDataCell>{b.seller}</CTableDataCell>
              <CTableDataCell>{formatPrice(b.priceMinor)}</CTableDataCell>
              <CTableDataCell>{b.sold}</CTableDataCell>
              <CTableDataCell><CBadge color={STATUS_COLOR[b.status]}>{b.status.toLowerCase()}</CBadge></CTableDataCell>
              <CTableDataCell className="text-end">
                {b.status === "PUBLISHED" ? (
                  <CButton
                    size="sm"
                    color="danger"
                    variant="ghost"
                    onClick={() => {
                      const note = prompt("Why take this book off the shelf? The seller will see this.");
                      if (note && note.trim().length >= 3) decide.mutate({ slug: b.slug, d: { decision: "unlist", note: note.trim() } });
                    }}
                  >
                    Unlist
                  </CButton>
                ) : null}
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </section>
  );
}

function Refunds() {
  const q = useRefunds();
  const decide = useRefundDecision();
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (q.isPending) return <p className="muted">Loading…</p>;
  if (!q.data?.items.length) return <section className="card panel muted">No refund requests.</section>;
  return (
    <section className="card panel">
      <p className="small muted">
        Send the money back through Hubtel first, then approve with the transfer reference. Approving removes the book from the buyer's library and
        takes the amount off the seller's balance.
      </p>
      {decide.error ? <CAlert color="danger">{errText(decide.error)}</CAlert> : null}
      <CTable responsive className="cms-table mb-0">
        <CTableBody>
          {q.data.items.map((r) => (
            <CTableRow key={r.id}>
              <CTableDataCell style={{ minWidth: 220 }}>
                <b>{r.book}</b>
                <div className="small muted">{r.buyer} · {formatPrice(r.amountMinor)} · read {r.percentRead}%</div>
                <div className="small">"{r.reason}"</div>
              </CTableDataCell>
              <CTableDataCell>{new Date(r.requestedAt).toLocaleDateString()}</CTableDataCell>
              <CTableDataCell style={{ minWidth: 300 }}>
                {r.status === "REQUESTED" ? (
                  <div className="d-flex gap-2">
                    <CFormInput size="sm" placeholder="Hubtel reference or reason" value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                    <CButton size="sm" color="primary" disabled={(notes[r.id] ?? "").trim().length < 3} onClick={() => decide.mutate({ id: r.id, decision: "approve", note: notes[r.id]!.trim() })}>Approve</CButton>
                    <CButton size="sm" color="secondary" variant="outline" disabled={(notes[r.id] ?? "").trim().length < 3} onClick={() => decide.mutate({ id: r.id, decision: "decline", note: notes[r.id]!.trim() })}>Decline</CButton>
                  </div>
                ) : (
                  <CBadge color={r.status === "APPROVED" ? "success" : "secondary"}>{r.status.toLowerCase()}</CBadge>
                )}
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </section>
  );
}

function Sellers() {
  const q = useSellers();
  const act = useSellerActions();
  const [edit, setEdit] = useState<{ key: string; rate: string; payoutTo: string } | null>(null);
  const [pay, setPay] = useState<{ key: string; amount: string; reference: string } | null>(null);
  if (q.isPending) return <p className="muted">Loading…</p>;
  const err = act.terms.error ?? act.payout.error;
  return (
    <section className="card panel">
      <p className="small muted">Default commission: {bpsLabel(q.data?.defaultCommissionBps ?? 0)}. Pay sellers by mobile money or bank, then record the payout here.</p>
      {err ? <CAlert color="danger">{errText(err)}</CAlert> : null}
      <CTable responsive className="cms-table mb-0">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Seller</CTableHeaderCell>
            <CTableHeaderCell>Books</CTableHeaderCell>
            <CTableHeaderCell>Commission</CTableHeaderCell>
            <CTableHeaderCell>Pay to</CTableHeaderCell>
            <CTableHeaderCell>Owed</CTableHeaderCell>
            <CTableHeaderCell />
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {q.data?.items.map((s) => (
            <CTableRow key={s.key}>
              <CTableDataCell><b>{s.name}</b></CTableDataCell>
              <CTableDataCell>{s.books}</CTableDataCell>
              <CTableDataCell>{s.commissionBps === null ? `default (${bpsLabel(q.data.defaultCommissionBps)})` : bpsLabel(s.commissionBps)}</CTableDataCell>
              <CTableDataCell>{s.payoutTo ?? "—"}</CTableDataCell>
              <CTableDataCell>{formatPrice(Math.max(0, s.balanceMinor))}</CTableDataCell>
              <CTableDataCell className="text-end">
                <CButton size="sm" color="secondary" variant="ghost" onClick={() => setEdit({ key: s.key, rate: s.commissionBps === null ? "" : String(s.commissionBps / 100), payoutTo: s.payoutTo ?? "" })}>Terms</CButton>
                <CButton size="sm" color="primary" variant="ghost" disabled={s.balanceMinor <= 0} onClick={() => setPay({ key: s.key, amount: (s.balanceMinor / 100).toFixed(2), reference: "" })}>Record payout</CButton>
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
      {edit ? (
        <div className="d-flex gap-2 align-items-end flex-wrap mt-3">
          <div><small>Commission % (empty = default)</small><CFormInput value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: e.target.value })} style={{ maxWidth: 120 }} /></div>
          <div className="flex-grow-1"><small>Pay to (MoMo number / bank)</small><CFormInput value={edit.payoutTo} onChange={(e) => setEdit({ ...edit, payoutTo: e.target.value })} /></div>
          <CButton
            color="primary"
            onClick={() =>
              act.terms.mutate(
                { key: edit.key, commissionBps: edit.rate.trim() === "" ? null : Math.round(Number(edit.rate) * 100), payoutTo: edit.payoutTo.trim() || null },
                { onSuccess: () => setEdit(null) },
              )
            }
          >
            Save terms
          </CButton>
          <CButton color="secondary" variant="ghost" onClick={() => setEdit(null)}>Cancel</CButton>
        </div>
      ) : null}
      {pay ? (
        <div className="d-flex gap-2 align-items-end flex-wrap mt-3">
          <div><small>Amount (GH₵)</small><CFormInput value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} style={{ maxWidth: 140 }} /></div>
          <div className="flex-grow-1"><small>Transfer reference</small><CFormInput value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></div>
          <CButton
            color="primary"
            disabled={!parsePrice(pay.amount) || pay.reference.trim().length < 3}
            onClick={() => act.payout.mutate({ key: pay.key, amountMinor: parsePrice(pay.amount)!, reference: pay.reference.trim() }, { onSuccess: () => setPay(null) })}
          >
            Record
          </CButton>
          <CButton color="secondary" variant="ghost" onClick={() => setPay(null)}>Cancel</CButton>
        </div>
      ) : null}
    </section>
  );
}

function Settings() {
  const q = useBookSettings();
  const save = useSaveBookSettings();
  const [rate, setRate] = useState<string | null>(null);
  const value = rate ?? (q.data ? String(q.data.commissionBps / 100) : "");
  const bps = Math.round(Number(value) * 100);
  const ok = value.trim() !== "" && Number.isFinite(bps) && bps >= 0 && bps <= 5000;
  return (
    <section className="card panel" style={{ maxWidth: 520 }}>
      <h2 className="panel-title mb-2">Platform commission</h2>
      <p className="small muted">
        Ecclesios keeps this share of each sale; the author gets the rest. Hubtel's fees come out of the Ecclesios share. A change applies to new orders only.
        Individual sellers can have their own rate (Sellers & payouts).
      </p>
      <div className="d-flex gap-2 align-items-end">
        <div><small>Commission %</small><CFormInput value={value} onChange={(e) => setRate(e.target.value)} invalid={!ok} style={{ maxWidth: 120 }} /></div>
        <CButton color="primary" disabled={!ok || save.isPending} onClick={() => save.mutate(bps, { onSuccess: () => setRate(null) })}>Save</CButton>
      </div>
      {ok ? <p className="small mt-2">On a GH₵ 50.00 book: Ecclesios {formatPrice(Math.round(5000 * bps / 10000))}, author {formatPrice(5000 - Math.round(5000 * bps / 10000))}.</p> : <p className="small text-danger mt-2">Between 0 and 50%.</p>}
      {save.error ? <CAlert color="danger">{errText(save.error)}</CAlert> : null}
      {save.isSuccess ? <CAlert color="success">Saved.</CAlert> : null}
    </section>
  );
}
