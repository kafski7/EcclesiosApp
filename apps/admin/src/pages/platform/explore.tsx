import {
  CAlert,
  CBadge,
  CButton,
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
import type { MyPost } from "@ecclesios/shared";
import { parseLesson } from "@ecclesios/shared/domain";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Preview } from "@/components/lesson-preview";
import { ApiClientError } from "@/lib/api";
import { useModeration, useQueue, useReportedComments } from "@/lib/explore";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Explore moderation (functionality §3.4, §6, D-031): pending posts and reported comments. */
export function ExploreModerationPage() {
  const [tab, setTab] = useState<"queue" | "comments">("queue");
  const queue = useQueue();
  const reported = useReportedComments();
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Explore moderation</h1>
          <p className="dash-sub">Posts appear on Explore only after you approve them. Every decision is recorded in the audit log.</p>
        </div>
        <Link to="/platform/explore/mine" className="btn btn-outline btn-sm">My posts</Link>
      </div>
      <CNav variant="underline" className="mb-3">
        <CNavItem>
          <CNavLink active={tab === "queue"} onClick={() => setTab("queue")} as="button">
            Waiting for review {queue.data ? <CBadge color="primary" className="ms-1">{queue.data.items.length}</CBadge> : null}
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink active={tab === "comments"} onClick={() => setTab("comments")} as="button">
            Reported comments{" "}
            {reported.data ? <CBadge color="danger" className="ms-1">{reported.data.items.filter((c) => c.status === "HIDDEN").length}</CBadge> : null}
          </CNavLink>
        </CNavItem>
      </CNav>
      {tab === "queue" ? (
        <>
          {queue.isError ? <CAlert color="danger">{errText(queue.error)}</CAlert> : null}
          {queue.isPending ? <p className="muted">Loading…</p> : null}
          {queue.data && !queue.data.items.length ? <section className="card panel muted">Nothing waiting. 🙏</section> : null}
          {queue.data?.items.map((p) => <QueueItem key={p.id} p={p} />)}
        </>
      ) : (
        <ReportedComments />
      )}
    </>
  );
}

function QueueItem({ p }: { p: MyPost & { submittedBy: string; submittedAt: string | null } }) {
  const m = useModeration();
  const [note, setNote] = useState("");
  const blocks = useMemo(() => parseLesson(p.body), [p.body]);
  return (
    <section className="card panel mb-4">
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        <CBadge color={p.kind === "EVENT" ? "warning" : "info"}>{p.kind === "EVENT" ? "Event" : "Article"}</CBadge>
        <span className="small muted">
          by <b>{p.submittedBy}</b> · submitted {when(p.submittedAt)}
        </span>
      </div>
      <h2 style={{ fontSize: 21, fontWeight: 700 }}>{p.title}</h2>
      {p.summary ? <p className="muted">{p.summary}</p> : null}
      {p.event ? (
        <p className="small">
          <b>{when(p.event.startsAt)}</b>
          {p.event.endsAt ? ` – ${when(p.event.endsAt)}` : ""} · {p.event.place}
          {p.event.onlineUrl ? ` · ${p.event.onlineUrl}` : ""}
        </p>
      ) : null}
      {p.coverUrl ? <img src={p.coverUrl} alt="" style={{ maxHeight: 220, borderRadius: 12, marginBottom: 12 }} /> : null}
      {p.youtubeId ? (
        <p className="small">
          Video: <a href={`https://youtu.be/${p.youtubeId}`} target="_blank" rel="noopener noreferrer">youtu.be/{p.youtubeId}</a>
        </p>
      ) : null}
      <div className="border rounded p-3 mb-3" style={{ maxHeight: 420, overflow: "auto" }}>
        <Preview blocks={blocks} />
      </div>
      <CFormTextarea rows={2} placeholder="Note to the author (required to reject)" value={note} onChange={(e) => setNote(e.target.value)} className="mb-2" />
      {m.decide.error ? <CAlert color="danger">{errText(m.decide.error)}</CAlert> : null}
      <div className="d-flex gap-2">
        <CButton color="primary" disabled={m.decide.isPending} onClick={() => m.decide.mutate({ id: p.id, d: { decision: "approve", note: note.trim() || undefined } })}>
          Approve
        </CButton>
        <CButton color="danger" variant="outline" disabled={m.decide.isPending || note.trim().length < 3} onClick={() => m.decide.mutate({ id: p.id, d: { decision: "reject", note: note.trim() } })}>
          Reject
        </CButton>
      </div>
    </section>
  );
}

function ReportedComments() {
  const list = useReportedComments();
  const m = useModeration();
  if (list.isPending) return <p className="muted">Loading…</p>;
  if (list.isError) return <CAlert color="danger">{errText(list.error)}</CAlert>;
  if (!list.data.items.length) return <section className="card panel muted">No reported comments.</section>;
  return (
    <section className="card panel">
      <CTable responsive className="cms-table mb-0">
        <CTableHead>
          <CTableRow>
            <CTableHeaderCell>Comment</CTableHeaderCell>
            <CTableHeaderCell>On</CTableHeaderCell>
            <CTableHeaderCell>Reports</CTableHeaderCell>
            <CTableHeaderCell>Status</CTableHeaderCell>
            <CTableHeaderCell />
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {list.data.items.map((c) => (
            <CTableRow key={c.id}>
              <CTableDataCell style={{ maxWidth: 420 }}>
                <div style={{ whiteSpace: "pre-line" }}>{c.body}</div>
                <div className="small muted">{c.author} · {when(c.createdAt)}</div>
              </CTableDataCell>
              <CTableDataCell>{c.post.title}</CTableDataCell>
              <CTableDataCell>{c.reports}</CTableDataCell>
              <CTableDataCell>{c.status === "HIDDEN" ? <CBadge color="danger">Hidden</CBadge> : <CBadge color="success">Visible</CBadge>}</CTableDataCell>
              <CTableDataCell className="text-end">
                <CButton size="sm" color={c.status === "HIDDEN" ? "primary" : "danger"} variant="outline" disabled={m.comment.isPending}
                  onClick={() => m.comment.mutate({ id: c.id, status: c.status === "HIDDEN" ? "VISIBLE" : "HIDDEN" })}>
                  {c.status === "HIDDEN" ? "Restore" : "Hide"}
                </CButton>
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
      <p className="small muted mt-3 mb-0">Restoring a comment clears its reports. Comments hide themselves after 3 reports.</p>
    </section>
  );
}
