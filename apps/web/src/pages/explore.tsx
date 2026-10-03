import { PenLine, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PostCard } from "@/components/explore/post-card";
import { canWrite, useAuthoring, useFeed, type ExploreTab } from "@/lib/explore";
import { useSession } from "@/stores/session";

const TABS: { id: ExploreTab; label: string; memberOnly?: boolean }[] = [
  { id: "ALL", label: "All" },
  { id: "EVENTS", label: "Upcoming events" },
  { id: "ARTICLES", label: "Articles" },
  { id: "FOLLOWING", label: "Churches I follow", memberOnly: true },
];

/** Explore (functionality §3.4, D-031): approved posts from churches, priests and creators. */
export function ExplorePage() {
  const principal = useSession((s) => s.principal);
  const authoring = useAuthoring();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "ALL") as ExploreTab;
  // ?q= lets other pages (the Home search box) open Explore with a search (D-033).
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const feed = useFeed(tab, debounced);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto" }}>
      <header className="page-head flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Explore</h1>
          <p className="page-sub">Events, articles and news from churches, priests and approved creators.</p>
        </div>
        {canWrite(authoring.data) ? (
          <Link to="/explore/write" className="btn btn-primary btn-sm">
            <PenLine className="ic" aria-hidden /> Write
          </Link>
        ) : null}
      </header>

      <label className="search">
        <Search className="ic" aria-hidden />
        <input type="search" placeholder="Search Explore" aria-label="Search Explore" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <div className="filter-bar" role="toolbar" aria-label="Show">
        {TABS.filter((t) => !t.memberOnly || principal?.kind === "member").map((t) => (
          <button
            key={t.id}
            type="button"
            className="f-pill"
            aria-pressed={tab === t.id}
            onClick={() => setParams(t.id === "ALL" ? {} : { tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feed.isError ? <p className="card rail-card">Explore could not be loaded.</p> : null}
      {feed.isPending ? <p className="muted small">Loading…</p> : null}
      {feed.isSuccess && !items.length ? (
        <p className="card rail-card muted">
          {tab === "FOLLOWING"
            ? "Nothing yet from the churches you follow. Open a church's page and follow it to see its posts here."
            : tab === "EVENTS"
              ? "No upcoming events."
              : "Nothing here yet."}
        </p>
      ) : null}
      <div className="explore-grid">
        {items.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
      {feed.hasNextPage ? (
        <div className="mt-5 text-center">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
            {feed.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
