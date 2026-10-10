import { CAlert, CButton, CFormSwitch } from "@coreui/react";
import { safeInternalLink, timeAgo } from "@ecclesios/shared/domain";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMarkRead, useNotifications } from "@/lib/account";
import { ApiClientError } from "@/lib/api";

/**
 * Notification centre (functionality §4.6, D-039), shared by the CMS and the platform console.
 * In the CMS it can narrow to the current church.
 */
export function NotificationsPage({ church }: { church?: { id: string; name: string } }) {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [onlyHere, setOnlyHere] = useState(false);
  const [page, setPage] = useState(1);
  const q = useNotifications({
    unread: unreadOnly,
    church: onlyHere ? church?.id : undefined,
    page,
  });
  const mark = useMarkRead();

  const open = (id: string, read: boolean, link: string | null) => {
    if (!read) mark.mutate({ ids: [id] });
    // CMS links point at /admin/*; web-app links (/explore…) are only shown, not followed here.
    const to = safeInternalLink(link);
    if (to && (to.startsWith("/admin") || to.startsWith("/platform"))) navigate(to);
  };

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Notifications</h1>
          <p className="dash-sub">{q.data ? `${q.data.unread} unread` : "…"}</p>
        </div>
        <CButton
          color="secondary"
          variant="outline"
          disabled={!q.data?.unread || mark.isPending}
          onClick={() => mark.mutate({ church: onlyHere ? church?.id : undefined })}
        >
          Mark all as read
        </CButton>
      </div>
      <div className="d-flex flex-wrap gap-4 mb-3">
        <CFormSwitch
          id="nu"
          label="Unread only"
          checked={unreadOnly}
          onChange={(e) => (setUnreadOnly(e.target.checked), setPage(1))}
        />
        {church ? (
          <CFormSwitch
            id="nc"
            label={`Only ${church.name}`}
            checked={onlyHere}
            onChange={(e) => (setOnlyHere(e.target.checked), setPage(1))}
          />
        ) : null}
      </div>
      {q.isError ? (
        <CAlert color="danger">
          {q.error instanceof ApiClientError
            ? q.error.message
            : "The notifications could not be loaded."}
        </CAlert>
      ) : null}
      <div className="card panel">
        {q.data && !q.data.items.length ? (
          <p className="small text-body-secondary mb-0">Nothing here.</p>
        ) : null}
        <ul className="notif-list">
          {q.data?.items.map((n) => (
            <li key={n.id} className={n.read ? "" : "unread"}>
              <span className="notif-dot" aria-hidden />
              <button
                type="button"
                className="text-start flex-grow-1 bg-transparent border-0 p-0"
                onClick={() => open(n.id, n.read, n.link)}
              >
                <b>{n.title}</b>
                {n.body ? <div className="small">{n.body}</div> : null}
                <div className="small text-body-secondary">
                  {timeAgo(n.createdAt)}
                  {n.church ? ` · ${n.church.name}` : ""}
                  {n.read ? "" : " · unread"}
                </div>
              </button>
            </li>
          ))}
        </ul>
        {q.data && (q.data.hasMore || page > 1) ? (
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
              disabled={!q.data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Older
            </CButton>
          </div>
        ) : null}
      </div>
    </>
  );
}
