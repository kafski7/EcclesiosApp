import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import type { CollectionList, CollectionRow, RecordCollection } from "@ecclesios/shared";
import {
  categoryLabel,
  COLLECTION_CATEGORIES,
  collectionDateProblem,
  COLLECTION_STATUSES,
  type CollectionStatus,
} from "@ecclesios/shared/domain";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiClientError } from "@/lib/api";
import { fieldErrors } from "@/lib/auth-errors";
import {
  money,
  STATUS_TEXT,
  useCollections,
  useDeleteCollection,
  useEditCollection,
  useFinance,
  useRecordCollection,
  useRetryCollection,
  useReviewCollection,
} from "@/lib/church";
import { formatDate, useCurrent } from "@/lib/cms";
import { localToday } from "@/lib/register";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");

/** Collections (blueprint §8.1, D-041): outstations record, parishes review; figures from the accounting service. */
export function CollectionsPage() {
  const ctx = useCurrent();
  const [status, setStatus] = useState<CollectionStatus | null>(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<CollectionRow | "new" | null>(null);
  const q = useCollections(ctx.group.id, status, page);
  const d = q.data;

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Collections</h1>
          <p className="dash-sub">
            {d?.mode === "RECORD"
              ? `${ctx.group.name} records its collections; ${ctx.group.parent ?? "the parish"} approves them.`
              : `Collections from ${ctx.group.name}'s outstations, waiting for approval and already in the accounts.`}
          </p>
        </div>
        {d?.mode === "RECORD" ? (
          <CButton color="primary" onClick={() => setForm("new")}>
            <Plus className="ic" aria-hidden /> Record a collection
          </CButton>
        ) : null}
      </div>

      <FinanceCard groupId={ctx.group.id} />

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <CFormSelect
          style={{ maxWidth: 260 }}
          aria-label="Status"
          value={status ?? ""}
          onChange={(e) => (
            setStatus((e.target.value || null) as CollectionStatus | null),
            setPage(1)
          )}
        >
          <option value="">All</option>
          {COLLECTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_TEXT[s].label}
            </option>
          ))}
        </CFormSelect>
        {d && d.pending.count ? (
          <span className="small">
            <b>{d.pending.count}</b> waiting · {money(d.currencyCode, d.pending.total)}
          </span>
        ) : null}
      </div>

      {q.isError ? <CAlert color="danger">{errText(q.error)}</CAlert> : null}
      {d ? <Table d={d} onEdit={(r) => setForm(r)} /> : null}
      {d && (d.hasMore || page > 1) ? (
        <div className="d-flex gap-2 mt-3">
          <CButton
            size="sm"
            color="secondary"
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Newer
          </CButton>
          <CButton
            size="sm"
            color="secondary"
            variant="ghost"
            disabled={!d.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
          </CButton>
        </div>
      ) : null}
      {form && d ? (
        <RecordModal row={form === "new" ? null : form} list={d} onClose={() => setForm(null)} />
      ) : null}
    </>
  );
}

function Table({ d, onEdit }: { d: CollectionList; onEdit: (r: CollectionRow) => void }) {
  const ctx = useCurrent();
  const review = useReviewCollection(ctx.group.id);
  const retry = useRetryCollection(ctx.group.id);
  const del = useDeleteCollection(ctx.group.id);
  const [rejecting, setRejecting] = useState<CollectionRow | null>(null);
  const err = review.error ?? retry.error ?? del.error;

  return (
    <div className="card panel">
      {err ? <CAlert color="danger">{errText(err)}</CAlert> : null}
      <CTable hover responsive className="cms-table mb-0">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Date</CTableHeaderCell>
            {d.mode === "REVIEW" ? <CTableHeaderCell>Outstation</CTableHeaderCell> : null}
            <CTableHeaderCell>Collection</CTableHeaderCell>
            <CTableHeaderCell className="text-end">Amount</CTableHeaderCell>
            <CTableHeaderCell>Status</CTableHeaderCell>
            <CTableHeaderCell />
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {d.items.map((r) => (
            <CTableRow key={r.id}>
              <CTableDataCell className="small">{formatDate(r.collectedOn)}</CTableDataCell>
              {d.mode === "REVIEW" ? <CTableDataCell>{r.outstation.name}</CTableDataCell> : null}
              <CTableDataCell>
                {categoryLabel(r.categoryRef)}
                <div className="small text-body-secondary">
                  Recorded by {r.recordedBy}
                  {r.note ? ` · ${r.note}` : ""}
                </div>
                {r.reviewNote && r.status === "REJECTED" ? (
                  <div className="small text-danger">{r.reviewNote}</div>
                ) : null}
                {r.lastSyncError && r.status === "SYNC_FAILED" ? (
                  <div className="small text-danger">{r.lastSyncError}</div>
                ) : null}
              </CTableDataCell>
              <CTableDataCell className="text-end">
                <b>{money(r.currencyCode, r.amount)}</b>
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color={STATUS_TEXT[r.status].color}>{STATUS_TEXT[r.status].label}</CBadge>
                {r.reviewedBy ? (
                  <div className="small text-body-secondary">by {r.reviewedBy}</div>
                ) : null}
                {r.externalTxnId ? (
                  <div className="small text-body-secondary">Ref {r.externalTxnId}</div>
                ) : null}
              </CTableDataCell>
              <CTableDataCell className="text-end text-nowrap">
                {r.can.review ? (
                  <>
                    <CButton
                      size="sm"
                      color="success"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: r.id, decision: "approve" })}
                    >
                      Approve
                    </CButton>{" "}
                    <CButton
                      size="sm"
                      color="danger"
                      variant="ghost"
                      onClick={() => setRejecting(r)}
                    >
                      Reject
                    </CButton>
                  </>
                ) : null}
                {r.can.retry ? (
                  <CButton
                    size="sm"
                    color="primary"
                    variant="outline"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(r.id)}
                  >
                    Try again
                  </CButton>
                ) : null}
                {r.can.edit ? (
                  <>
                    <CButton size="sm" color="secondary" variant="ghost" onClick={() => onEdit(r)}>
                      Edit
                    </CButton>
                    <CButton
                      size="sm"
                      color="danger"
                      variant="ghost"
                      onClick={() => confirm("Delete this collection?") && del.mutate(r.id)}
                    >
                      Delete
                    </CButton>
                  </>
                ) : null}
              </CTableDataCell>
            </CTableRow>
          ))}
          {!d.items.length ? (
            <CTableRow>
              <CTableDataCell colSpan={6} className="text-body-secondary">
                No collections here yet.
              </CTableDataCell>
            </CTableRow>
          ) : null}
        </CTableBody>
      </CTable>
      {d.mode === "REVIEW" &&
      d.items.some((r) => r.status === "PENDING") &&
      !d.items.some((r) => r.can.review) ? (
        <p className="small text-body-secondary mt-2 mb-0">
          Only the parish's Administrators approve collections.
        </p>
      ) : null}
      {rejecting ? <RejectModal row={rejecting} onClose={() => setRejecting(null)} /> : null}
    </div>
  );
}

function RejectModal({ row, onClose }: { row: CollectionRow; onClose: () => void }) {
  const ctx = useCurrent();
  const review = useReviewCollection(ctx.group.id);
  const [note, setNote] = useState("");
  return (
    <CModal visible onClose={onClose} alignment="center">
      <CForm
        onSubmit={(e) => (
          e.preventDefault(),
          review.mutate({ id: row.id, decision: "reject", note }, { onSuccess: onClose })
        )}
      >
        <CModalHeader>
          <CModalTitle>
            Reject {money(row.currencyCode, row.amount)} from {row.outstation.name}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {review.error ? <CAlert color="danger">{errText(review.error)}</CAlert> : null}
          <CFormLabel htmlFor="rjn">Reason (the outstation sees it)</CFormLabel>
          <CFormTextarea
            id="rjn"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
          />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose}>
            Cancel
          </CButton>
          <CButton
            type="submit"
            color="danger"
            disabled={review.isPending || note.trim().length < 3}
          >
            Reject
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}

function RecordModal({
  row,
  list,
  onClose,
}: {
  row: CollectionRow | null;
  list: CollectionList;
  onClose: () => void;
}) {
  const ctx = useCurrent();
  const record = useRecordCollection(ctx.group.id);
  const edit = useEditCollection(ctx.group.id);
  const today = localToday();
  const [amount, setAmount] = useState(row?.amount ?? "");
  const [categoryRef, setCategory] = useState<RecordCollection["categoryRef"]>(
    (row?.categoryRef as RecordCollection["categoryRef"]) ?? "SUNDAY_OFFERTORY",
  );
  const [collectedOn, setDate] = useState(row?.collectedOn ?? today);
  const [note, setNote] = useState(row?.note ?? "");
  const m = row ? edit : record;
  const dateProblem = collectionDateProblem(collectedOn, today, list.allowBackdating);
  const fe =
    m.error instanceof ApiClientError && m.error.details ? fieldErrors(m.error.details) : {};
  const amountOk = /^\d{1,12}(\.\d{1,2})?$/.test(amount.trim()) && Number(amount) > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: RecordCollection = {
      amount: amount.trim(),
      categoryRef,
      collectedOn,
      note: note.trim() || null,
    };
    if (row) edit.mutate({ id: row.id, body }, { onSuccess: onClose });
    else record.mutate(body, { onSuccess: onClose });
  };
  return (
    <CModal visible onClose={onClose} alignment="center">
      <CForm onSubmit={submit}>
        <CModalHeader>
          <CModalTitle>{row ? "Edit collection" : "Record a collection"}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {m.error && !Object.keys(fe).length ? (
            <CAlert color="danger">{errText(m.error)}</CAlert>
          ) : null}
          <CFormLabel htmlFor="ca">Amount ({list.currencyCode})</CFormLabel>
          <CFormInput
            id="ca"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mb-3"
            invalid={(!!amount && !amountOk) || !!fe.amount}
            feedbackInvalid={fe.amount ?? "An amount like 120.50"}
            required
          />
          <CFormLabel htmlFor="cc">Collection</CFormLabel>
          <CFormSelect
            id="cc"
            value={categoryRef}
            onChange={(e) => setCategory(e.target.value as RecordCollection["categoryRef"])}
            className="mb-3"
          >
            {COLLECTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </CFormSelect>
          <CFormLabel htmlFor="cd">Date</CFormLabel>
          <CFormInput
            id="cd"
            type="date"
            value={collectedOn}
            max={today}
            disabled={!list.allowBackdating}
            onChange={(e) => setDate(e.target.value)}
            className="mb-3"
            invalid={!!dateProblem || !!fe.collectedOn}
            feedbackInvalid={dateProblem ?? fe.collectedOn}
          />
          {!list.allowBackdating ? (
            <p className="small text-body-secondary mt-n2">
              Today's date. An Administrator can allow back-dated entries in Settings.
            </p>
          ) : null}
          <CFormLabel htmlFor="cn">Note (optional)</CFormLabel>
          <CFormTextarea
            id="cn"
            rows={2}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose}>
            Cancel
          </CButton>
          <CButton
            type="submit"
            color="primary"
            disabled={m.isPending || !amountOk || !!dateProblem}
          >
            {m.isPending ? "Saving…" : row ? "Save" : "Send to the parish"}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}

/** Read-only figures from the accounting service (functionality §4.12). */
export function FinanceCard({ groupId }: { groupId: string }) {
  const f = useFinance(groupId);
  if (!f.data) return null;
  const x = f.data;
  return (
    <section className="card panel mb-3">
      <header className="panel-head">
        <h2 className="panel-title">Finances</h2>
        <span className="small text-body-secondary">
          {x.connected ? `From ${x.provider}` : "Accounting not connected"}
        </span>
      </header>
      {x.connected ? (
        <div className="row g-3 small">
          <div className="col-md-3">
            <div className="text-body-secondary">This month</div>
            <b style={{ fontSize: 18 }}>{money(x.currencyCode, x.month.total)}</b>
          </div>
          <div className="col-md-3">
            <div className="text-body-secondary">This year</div>
            <b style={{ fontSize: 18 }}>{money(x.currencyCode, x.year.total)}</b>
          </div>
          <div className="col-md-3">
            <div className="text-body-secondary">Waiting for approval</div>
            <b>{x.awaitingApproval.count}</b> · {money(x.currencyCode, x.awaitingApproval.total)}
          </div>
          <div className="col-md-3">
            <div className="text-body-secondary">This year by collection</div>
            {x.year.byCategory.slice(0, 4).map((c) => (
              <div key={c.categoryRef}>
                {categoryLabel(c.categoryRef)}: {money(x.currencyCode, c.total)}
              </div>
            ))}
            {!x.year.byCategory.length ? "—" : null}
          </div>
          {x.failedSync ? (
            <div className="col-12 text-danger">
              {x.failedSync} approved collection(s) couldn't reach the accounts. Use "Try again"
              below.
            </div>
          ) : null}
        </div>
      ) : (
        <p className="small text-body-secondary mb-0">
          Approved collections are kept as approved until an accounting service is connected.{" "}
          {x.awaitingApproval.count} waiting for approval.
        </p>
      )}
    </section>
  );
}
