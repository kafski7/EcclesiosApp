import { safeInternalLink, timeAgo } from "@ecclesios/shared/domain";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isCmsLink, useMarkRead, useNotifications } from "@/lib/account";
import { SignInLink } from "@/components/auth/sign-in-link";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
import { Tabs, tabId } from "@/components/ui/tabs";
import { env } from "@/lib/env";
import { groupByDay } from "@/lib/you";
import { useSession } from "@/stores/session";

const NOTIF_TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
] as const;

/** Your notifications (functionality §4.6, D-039). */
export function NotificationsPage() {
  const principal = useSession((s) => s.principal);
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const q = useNotifications(unreadOnly);
  const mark = useMarkRead();
  const unread = q.data?.pages[0]?.unread ?? 0;

  if (!principal)
    return (
      <div className="content-narrow mx-auto card rail-card">
        <h1 className="page-title">Notifications</h1>
        <p className="page-sub mt-2">
          <SignInLink /> to see news from your church, replies and approvals.
        </p>
      </div>
    );

  const open = (id: string, read: boolean, link: string | null) => {
    if (!read) mark.mutate([id]);
    const to = safeInternalLink(link);
    if (!to) return;
    if (isCmsLink(to)) window.location.href = `${env.VITE_ADMIN_URL}${to}`;
    else navigate(to);
  };

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="content-narrow mx-auto">
      <header className="page-head flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">{unread ? `${unread} unread` : "You're up to date."}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/account#notifications" className="btn btn-ghost btn-sm">
            Settings
          </Link>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={!unread || mark.isPending}
            onClick={() => mark.mutate(undefined)}
          >
            Mark all as read
          </button>
        </div>
      </header>
      <Tabs
        label="Show"
        tabs={NOTIF_TABS}
        value={unreadOnly ? "unread" : "all"}
        onChange={(t) => setUnreadOnly(t === "unread")}
        panelId="notif-list"
        barClass="feed-tabs mb-3"
      />
      <section
        className="card rail-card"
        id="notif-list"
        role="tabpanel"
        aria-labelledby={tabId("notif-list", unreadOnly ? "unread" : "all")}
      >
        {q.isPending ? <Skeleton variant="rows" count={4} label="Loading notifications" /> : null}
        {q.isError ? (
          <ErrorState
            title="Notifications could not be loaded"
            error={q.error}
            onRetry={() => q.refetch()}
            retrying={q.isRefetching}
            compact
          />
        ) : null}
        {q.isSuccess && !items.length ? (
          <EmptyState
            icon={Bell}
            title={unreadOnly ? "You're all caught up" : "Nothing here yet"}
            compact
          >
            {unreadOnly
              ? "No unread notifications."
              : "News from your church, replies and approvals will appear here."}
          </EmptyState>
        ) : null}
        {groupByDay(items).map((g) => (
          <section key={g.label} aria-label={g.label} className="notif-day">
            <h2 className="notif-day-title">{g.label}</h2>
            <ul className="notif-list">
              {g.items.map((n) => (
                <li key={n.id} className={n.read ? "" : "unread"}>
                  <span className="notif-dot" aria-hidden />
                  <button
                    type="button"
                    className="text-left flex-1"
                    onClick={() => open(n.id, n.read, n.link)}
                  >
                    <b>{n.title}</b>
                    {n.body ? <div className="small">{n.body}</div> : null}
                    <div className="small muted">
                      {timeAgo(n.createdAt)}
                      {n.church ? ` · ${n.church.name}` : ""}
                      {n.read ? "" : <span className="sr-only"> · unread</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <LoadMore q={q} label="Older notifications" />
      </section>
    </div>
  );
}
