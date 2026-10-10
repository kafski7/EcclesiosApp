import {
  CAlert,
  CBadge,
  CButton,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import { Link, useNavigate } from "react-router-dom";
import { bpsLabel, formatPrice, STATUS_COLOR, useMyBooks, useStatement } from "@/lib/books";

/** Seller studio (D-036): my books and my statement. */
export function MyBooksPage() {
  const list = useMyBooks();
  const st = useStatement();
  const navigate = useNavigate();
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>My books</h1>
          <p className="dash-sub">
            Upload, price and submit your books. Ecclesios reviews each book before it goes on the
            shelf.
          </p>
        </div>
        {list.data?.canCreate ? (
          <CButton color="primary" onClick={() => navigate("/platform/books/mine/new")}>
            New book
          </CButton>
        ) : null}
      </div>
      {list.data && !list.data.canCreate ? (
        <CAlert color="info">Your account isn't approved to sell books yet.</CAlert>
      ) : null}

      {st.data ? (
        <div className="card panel mb-4">
          <div className="d-flex flex-wrap gap-4">
            <div>
              <small className="muted d-block">Your share</small>
              <b>{bpsLabel(10000 - st.data.commissionBps)}</b>
            </div>
            <div>
              <small className="muted d-block">Earned</small>
              <b>{formatPrice(st.data.earnedMinor)}</b>
            </div>
            <div>
              <small className="muted d-block">Refunded</small>
              <b>{formatPrice(st.data.refundedMinor)}</b>
            </div>
            <div>
              <small className="muted d-block">Paid out</small>
              <b>{formatPrice(st.data.paidOutMinor)}</b>
            </div>
            <div>
              <small className="muted d-block">Owed to you</small>
              <b>{formatPrice(Math.max(0, st.data.balanceMinor))}</b>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card panel mb-4">
        <CTable hover responsive className="cms-table">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Book</CTableHeaderCell>
              <CTableHeaderCell>Price</CTableHeaderCell>
              <CTableHeaderCell>Sold</CTableHeaderCell>
              <CTableHeaderCell>Earned</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {list.isPending ? (
              <CTableRow>
                <CTableDataCell colSpan={5}>Loading…</CTableDataCell>
              </CTableRow>
            ) : null}
            {list.data?.items.map((b) => (
              <CTableRow key={b.slug}>
                <CTableDataCell>
                  <Link to={`/platform/books/mine/${b.slug}`}>
                    <b>{b.title}</b>
                  </Link>
                  <div className="small muted">{b.authorName}</div>
                </CTableDataCell>
                <CTableDataCell>{formatPrice(b.priceMinor)}</CTableDataCell>
                <CTableDataCell>{b.sold}</CTableDataCell>
                <CTableDataCell>{formatPrice(b.earnedMinor)}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={STATUS_COLOR[b.status]}>{b.status.toLowerCase()}</CBadge>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>

      {st.data?.sales.length ? (
        <div className="card panel">
          <div className="panel-head">
            <h2 className="panel-title">Recent sales</h2>
          </div>
          <CTable responsive className="cms-table mb-0">
            <CTableBody>
              {st.data.sales.slice(0, 30).map((s) => (
                <CTableRow key={s.orderId}>
                  <CTableDataCell>{new Date(s.at).toLocaleDateString()}</CTableDataCell>
                  <CTableDataCell>{s.book}</CTableDataCell>
                  <CTableDataCell>{formatPrice(s.priceMinor)}</CTableDataCell>
                  <CTableDataCell>you: {formatPrice(s.authorMinor)}</CTableDataCell>
                  <CTableDataCell>
                    {s.status === "REFUNDED" ? <CBadge color="warning">refunded</CBadge> : null}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </div>
      ) : null}
    </>
  );
}
