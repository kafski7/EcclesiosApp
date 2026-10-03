import { CAlert, CBadge, CButton, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from "@coreui/react";
import { Link, useNavigate } from "react-router-dom";
import { useStudioPodcasts } from "@/lib/podcasts";

/** Podcast studio list (D-027): all series for Super-Admins, own series for creators. */
export function PlatformPodcastsPage() {
  const list = useStudioPodcasts();
  const navigate = useNavigate();
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Podcasts</h1>
          <p className="dash-sub">Series, episodes and audio. Episodes go live when you publish them.</p>
        </div>
        {list.data?.canCreate ? (
          <CButton color="primary" onClick={() => navigate("/platform/podcasts/new")}>
            New series
          </CButton>
        ) : null}
      </div>
      {list.isError ? <CAlert color="danger">The list could not be loaded.</CAlert> : null}
      <section className="card panel">
        <CTable hover responsive className="cms-table mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Series</CTableHeaderCell>
              <CTableHeaderCell>By</CTableHeaderCell>
              <CTableHeaderCell>Published</CTableHeaderCell>
              <CTableHeaderCell>Drafts</CTableHeaderCell>
              <CTableHeaderCell>Followers</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {list.isPending ? (
              <CTableRow>
                <CTableDataCell colSpan={6} className="muted">Loading…</CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data && !list.data.items.length ? (
              <CTableRow>
                <CTableDataCell colSpan={6} className="muted">No series yet.</CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data?.items.map((p) => (
              <CTableRow key={p.slug}>
                <CTableDataCell>
                  <Link to={`/platform/podcasts/${p.slug}`}><b>{p.title}</b></Link>
                  <div className="small muted">{p.summary}</div>
                </CTableDataCell>
                <CTableDataCell>{p.publisher.name}</CTableDataCell>
                <CTableDataCell>{p.episodeCount}</CTableDataCell>
                <CTableDataCell>{p.drafts}</CTableDataCell>
                <CTableDataCell>{p.followers}</CTableDataCell>
                <CTableDataCell>
                  {p.isPublished ? <CBadge color="success">Visible</CBadge> : <CBadge color="secondary">Hidden</CBadge>}
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </section>
    </>
  );
}
