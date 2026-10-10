import { CalendarDays, Compass, PenLine, Rss, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PostCard } from "@/components/cards";
import { ChurchesBar } from "@/components/explore/churches-bar";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
import { canWrite, useAuthoring, useFeed, type ExploreTab } from "@/lib/explore";
import { useSession } from "@/stores/session";

const TABS: { id: ExploreTab; label: string; memberOnly?: boolean }[] = [
  { id: "ALL", label: "All" },
  { id: "EVENTS", label: "Upcoming events" },
  { id: "PAST", label: "Past events" },
  { id: "ARTICLES", label: "Articles" },
  { id: "FOLLOWING", label: "Churches I follow", memberOnly: true },
];

/**
 * Explore (functionality §3.4, D-031, D-044): approved posts from churches, priests and creators,
 * with the member's churches, Find a church, and upcoming / past events.
 */
export function ExplorePage() {
  const principal = useSession((s) => s.principal);
  const authoring = useAuthoring();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "ALL") as ExploreTab;
  // ?q= opens Explore with a search (global search's "See all", D-042) and is kept in the URL
  // as you type, so a refresh or a shared link keeps it (D-044).
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [debounced, setDebounced] = useState(q);
  // What this page last put in the URL — anything else is an outside change (Back, a link).
  const written = useRef(urlQ.trim());
  useEffect(() => {
    if (urlQ.trim() === written.current) return;
    written.current = urlQ.trim();
    setQ(urlQ);
    setDebounced(urlQ);
  }, [urlQ]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const term = debounced.trim();
    if (term === written.current) return;
    written.current = term;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (term) next.set("q", term);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  }, [debounced, setParams]);
  const feed = useFeed(tab, debounced);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto" }}>
      <header className="page-head flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Explore</h1>
          <p className="page-sub">
            Events, articles and news from churches, priests and approved creators.
          </p>
        </div>
        {canWrite(authoring.data) ? (
          <Link to="/explore/write" className="btn btn-primary btn-sm">
            <PenLine className="ic" aria-hidden /> Write
          </Link>
        ) : null}
      </header>

      <label className="search">
        <Search className="ic" aria-hidden />
        <input
          type="search"
          placeholder="Search Explore"
          aria-label="Search Explore"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <ChurchesBar />

      <div className="filter-bar" role="toolbar" aria-label="Show">
        {TABS.filter((t) => !t.memberOnly || principal?.kind === "member").map((t) => (
          <button
            key={t.id}
            type="button"
            className="f-pill"
            aria-pressed={tab === t.id}
            onClick={() => {
              const next = new URLSearchParams(params);
              if (t.id === "ALL") next.delete("tab");
              else next.set("tab", t.id);
              setParams(next, { replace: true });
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feed.isError ? (
        <ErrorState
          title="Explore could not be loaded"
          error={feed.error}
          onRetry={() => feed.refetch()}
          retrying={feed.isRefetching}
        />
      ) : null}
      {feed.isPending ? <Skeleton variant="cards" count={4} label="Loading posts" /> : null}
      {feed.isSuccess && !items.length ? (
        tab === "FOLLOWING" ? (
          <EmptyState icon={Rss} title="Nothing yet from the churches you follow">
            Open a church's page and follow it to see its posts here.
          </EmptyState>
        ) : tab === "EVENTS" ? (
          <EmptyState icon={CalendarDays} title="No upcoming events" />
        ) : tab === "PAST" ? (
          <EmptyState icon={CalendarDays} title="No past events" />
        ) : (
          <EmptyState
            icon={Compass}
            title={q.trim() ? "No posts match your search" : "Nothing here yet"}
          />
        )
      ) : null}
      <div className="explore-grid">
        {items.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
      <LoadMore q={feed} label="More posts" />
    </div>
  );
}
