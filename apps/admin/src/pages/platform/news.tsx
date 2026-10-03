import { CAlert, CBadge, CButton, CFormInput, CFormLabel, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from "@coreui/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { useAdminHymns } from "@/lib/hymnal";
import { STATE_COLOR, STATE_LABEL, useAdminNewsList, useHymnOfDay, usePinHymn } from "@/lib/news";

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Super-Admin: platform news (D-032) and the hymn of the day (D-033). */
export function PlatformNewsPage() {
  const list = useAdminNewsList();
  const navigate = useNavigate();
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>News</h1>
          <p className="dash-sub">Ecclesios announcements on Home and the news page. Pinned items stay on top.</p>
        </div>
        <CButton color="primary" onClick={() => navigate("/platform/news/new")}>
          New item
        </CButton>
      </div>
      <div className="card panel mb-4">
        <CTable hover responsive className="cms-table">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Title</CTableHeaderCell>
              <CTableHeaderCell>Category</CTableHeaderCell>
              <CTableHeaderCell>Publish</CTableHeaderCell>
              <CTableHeaderCell>State</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {list.isPending ? (
              <CTableRow>
                <CTableDataCell colSpan={4}>Loading…</CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data?.items.map((n) => (
              <CTableRow key={n.slug}>
                <CTableDataCell>
                  <Link to={`/platform/news/${n.slug}`}>
                    <b>{n.title}</b>
                  </Link>
                  {n.pinned ? <CBadge color="warning" className="ms-2">Pinned</CBadge> : null}
                </CTableDataCell>
                <CTableDataCell>{n.category.toLowerCase()}</CTableDataCell>
                <CTableDataCell>{n.publishedAt ? new Date(n.publishedAt).toLocaleString() : "—"}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={STATE_COLOR[n.state]}>{STATE_LABEL[n.state]}</CBadge>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>
      <HymnOfDayPanel />
    </>
  );
}

function HymnOfDayPanel() {
  const [date, setDate] = useState(today());
  const current = useHymnOfDay(date);
  const pin = usePinHymn(date);
  const hymns = useAdminHymns("");
  const [slug, setSlug] = useState("");
  return (
    <div className="card panel">
      <div className="panel-head">
        <h2 className="panel-title">Hymn of the day</h2>
      </div>
      <p className="small muted">
        Chosen automatically for the season (no Christmas carols in July). Pick one yourself for a feast or a special day.
      </p>
      <div className="d-flex gap-2 flex-wrap align-items-end">
        <div>
          <CFormLabel htmlFor="hd">Date</CFormLabel>
          <CFormInput id="hd" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ minWidth: 260 }}>
          <CFormLabel htmlFor="hs">Hymn</CFormLabel>
          <select id="hs" className="form-select" value={slug} onChange={(e) => setSlug(e.target.value)}>
            <option value="">Choose a hymn…</option>
            {hymns.data?.items.filter((h) => h.isPublished).map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.title}
              </option>
            ))}
          </select>
        </div>
        <CButton color="primary" disabled={!slug || pin.isPending} onClick={() => pin.mutate(slug)}>
          Pin for this date
        </CButton>
        {current.data?.pinned ? (
          <CButton color="secondary" variant="ghost" onClick={() => pin.mutate(null)}>
            Back to automatic
          </CButton>
        ) : null}
      </div>
      <p className="mt-3 mb-0">
        {current.data ? (
          <>
            <b>{current.data.title}</b> <span className="small muted">{current.data.pinned ? "· pinned" : "· automatic"}</span>
          </>
        ) : current.isPending ? (
          "…"
        ) : (
          <span className="muted">No published hymns yet.</span>
        )}
      </p>
      {pin.error ? <CAlert color="danger" className="mt-2">{pin.error instanceof ApiClientError ? pin.error.message : "Couldn't save."}</CAlert> : null}
    </div>
  );
}
