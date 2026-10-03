import type { FeedItem, HomeSummary } from "@ecclesios/shared";
import { PenSquare } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { FeedItemCard } from "@/components/home/feed-item";
import { HomeRail } from "@/components/home/rail";
import { WatchRow } from "@/components/home/watch-row";
import { canWrite, useAuthoring } from "@/lib/explore";
import { SEASON_SWATCH, useHomeFeed, useHomeSummary, type HomeTab } from "@/lib/home";
import { formatLongDate, SEASON_LABEL } from "@/lib/readings";
import { useSession } from "@/stores/session";

/**
 * Home (functionality §3.1, D-033): today's card, a blended feed (For you / Following) and a
 * Twitter-style right rail — news, saint and hymn of the day, trending posts, upcoming events.
 */
export function HomePage() {
  const [params, setParams] = useSearchParams();
  const tab: HomeTab = params.get("tab") === "following" ? "following" : "for-you";
  const principal = useSession((s) => s.principal);
  const summary = useHomeSummary();
  const feed = useHomeFeed(tab);
  const authoring = useAuthoring();
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const isMember = principal?.kind === "member";

  return (
    <div className="home-layout">
      <section className="feed" aria-label="Feed">
        <div className="feed-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "for-you"} className={`feed-tab${tab === "for-you" ? " active" : ""}`} onClick={() => setParams({}, { replace: true })}>
            For you
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "following"}
            className={`feed-tab${tab === "following" ? " active" : ""}`}
            onClick={() => setParams({ tab: "following" }, { replace: true })}
          >
            Following
          </button>
        </div>

        <TodayCard d={summary.data} />

        {/* Horizontal video row (D-034) — For you only; hidden when there are no videos. */}
        {tab === "for-you" && summary.data?.watch.length ? <WatchRow items={summary.data.watch} /> : null}

        {/* Only people who may post on Explore see this (D-017). */}
        {canWrite(authoring.data) ? (
          <Link to="/explore/write" className="card composer composer-link">
            <PenSquare className="ic" style={{ color: "var(--accent-600)" }} aria-hidden />
            <span className="muted">Share news or an event with your community…</span>
            <span className="btn btn-primary btn-sm ms-auto">Write</span>
          </Link>
        ) : null}

        {tab === "following" && !isMember ? (
          <div className="card rail-card">
            <p className="post-text">
              <Link to="/login" className="link">Sign in</Link> and follow churches and podcasts to see their news here.
            </p>
          </div>
        ) : null}
        {feed.isError ? <p className="card rail-card">The feed could not be loaded.</p> : null}
        {feed.isPending && (tab === "for-you" || isMember) ? <p className="muted small">Loading…</p> : null}
        {feed.isSuccess && !items.length ? (
          <div className="card rail-card">
            <p className="post-text">
              {tab === "following" ? (
                <>
                  Nothing yet from what you follow. Find your church on <Link to="/explore" className="link">Explore</Link> or a{" "}
                  <Link to="/podcasts" className="link">podcast</Link>.
                </>
              ) : (
                "Nothing new yet."
              )}
            </p>
          </div>
        ) : null}

        {items.map((it) => (
          <FeedItemCard key={itemKey(it)} item={it} />
        ))}
        {feed.hasNextPage ? (
          <div className="text-center">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
              {feed.isFetchingNextPage ? "Loading…" : "Show more"}
            </button>
          </div>
        ) : null}
      </section>

      <HomeRail data={summary.data} />
    </div>
  );
}

const itemKey = (it: FeedItem) =>
  it.type === "POST" ? `p:${it.post.id}` : it.type === "TEACHING" ? `t:${it.teaching.slug}` : it.type === "EPISODE" ? `e:${it.episode.id}` : `n:${it.news.slug}`;

/** Today's liturgical day, linking to the readings. */
function TodayCard({ d }: { d: HomeSummary | undefined }) {
  if (!d) return null;
  return (
    <Link to="/readings" className="card today-card">
      <span className="today-swatch" style={{ background: SEASON_SWATCH[d.today.color] }} aria-hidden />
      <span className="min-w-0">
        <span className="saint-kicker">{formatLongDate(d.date)}</span>
        <b className="today-title">{d.today.celebration ?? SEASON_LABEL[d.today.season]}</b>
        <small className="muted">{d.today.gospel ? `Gospel: ${d.today.gospel} · Today's readings →` : "Today's readings →"}</small>
      </span>
    </Link>
  );
}
