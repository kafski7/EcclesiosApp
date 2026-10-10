import {
  CBadge,
  CButton,
  CFormInput,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminHymns } from "@/lib/hymnal";

/** Super-Admin hymn list (todo P5.4, D-026). */
export function PlatformHymnalPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = useAdminHymns(debounced);
  const navigate = useNavigate();

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Hymnal</h1>
          <p className="dash-sub">
            Hymns, their numbers in each hymn book, tunes, recordings and notation.
          </p>
        </div>
        <CButton color="primary" onClick={() => navigate("/platform/hymnal/new")}>
          New hymn
        </CButton>
      </div>
      <div className="card panel">
        <CFormInput
          placeholder="Search by title or first line"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3"
        />
        {list.isError ? <p>The list could not be loaded.</p> : null}
        <CTable hover responsive className="cms-table">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Hymn</CTableHeaderCell>
              <CTableHeaderCell>Numbers</CTableHeaderCell>
              <CTableHeaderCell>Tunes</CTableHeaderCell>
              <CTableHeaderCell>Media</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {list.isPending ? (
              <CTableRow>
                <CTableDataCell colSpan={5}>Loading…</CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data?.items.map((h) => (
              <CTableRow key={h.slug}>
                <CTableDataCell>
                  <Link to={`/platform/hymnal/${h.slug}`}>
                    <b>{h.title}</b>
                  </Link>
                </CTableDataCell>
                <CTableDataCell>
                  {h.numbers.map((n) => `${n.book} ${n.number}`).join(" · ") || "—"}
                </CTableDataCell>
                <CTableDataCell>{h.tunes}</CTableDataCell>
                <CTableDataCell>{h.media}</CTableDataCell>
                <CTableDataCell>
                  {h.isPublished ? (
                    <CBadge color="success">Published</CBadge>
                  ) : (
                    <CBadge color="secondary">Hidden</CBadge>
                  )}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>
    </>
  );
}
