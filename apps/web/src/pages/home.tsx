import type { FeedItem } from "@ecclesios/shared";
import { PenSquare, Rss, Sparkles, UserPlus } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { SignInLink } from "@/components/auth/sign-in-link";
import { ContinueRow } from "@/components/home/continue-row";
import { FeedItemCard } from "@/components/home/feed-item";
import { TodayCard } from "@/components/home/today-card";
import { TodayStrip } from "@/components/home/today-strip";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { HomeRail } from "@/components/home/rail";
import { WatchRow } from "@/components/home/watch-row";
import { canWrite, useAuthoring } from "@/lib/explore";
import { useHomeFeed, useHomeSummary, type HomeTab } from "@/lib/home";
import { useSession } from "@/stores/session";

const TABS = [
  { id: "for-you", label: "For you" },
  { id: "following", label: "Following" },
] as const satisfies readonly { id: HomeTab; label: string }[];

/**
 * Home (functionality §3.1, D-033, D-044): today's card, a blended feed (For you / Following) and a
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
        <Tabs
          label="Feed"
          tabs={TABS}
          value={tab}
          onChange={(t) => setParams(t === "following" ? { tab: t } : {}, { replace: true })}
          panelId="home-feed"
        />

        <div
          id="home-feed"
          role="tabpanel"
          aria-labelledby={`home-feed-tab-${tab}`}
          className="feed-panel"
        >
          {/* Desktop shows this first in the right rail (D-046); here only where the rail is hidden. */}
          <TodayCard d={summary.data} className="today-in-feed" />

          {/* Phones/tablets: news, saint and hymn of the day, since the rail is hidden there (D-044). */}
          {tab === "for-you" ? <TodayStrip data={summary.data} /> : null}

          {/* Episode, books and Bible chapter in progress on this device / in the library (D-044). */}
          {tab === "for-you" ? <ContinueRow /> : null}

          {/* Horizontal video row (D-034) — For you only; hidden when there are no videos. */}
          {tab === "for-you" && summary.data?.watch.length ? (
            <WatchRow items={summary.data.watch} />
          ) : null}

          {/* Only people who may post on Explore see this (D-017). */}
          {canWrite(authoring.data) ? (
            <Link to="/explore/write" className="card composer composer-link">
              <PenSquare className="ic" style={{ color: "var(--accent-600)" }} aria-hidden />
              <span className="muted">Share news or an event with your community…</span>
              <span className="btn btn-primary btn-sm ms-auto">Write</span>
            </Link>
          ) : null}

          {tab === "following" && !isMember ? (
            <EmptyState icon={UserPlus} title="Follow churches and podcasts">
              <SignInLink /> and follow churches and podcasts to see their news here.
            </EmptyState>
          ) : null}
          {feed.isError ? (
            <ErrorState
              title="The feed could not be loaded"
              error={feed.error}
              onRetry={() => feed.refetch()}
              retrying={feed.isRefetching}
            />
          ) : null}
          {feed.isPending && (tab === "for-you" || isMember) ? (
            <Skeleton variant="cards" label="Loading the feed" />
          ) : null}
          {feed.isSuccess && !items.length ? (
            tab === "following" ? (
              <EmptyState icon={Rss} title="Nothing yet from what you follow">
                Find your church on{" "}
                <Link to="/explore" className="link">
                  Explore
                </Link>{" "}
                or a{" "}
                <Link to="/podcasts" className="link">
                  podcast
                </Link>{" "}
                to follow.
              </EmptyState>
            ) : (
              <EmptyState icon={Sparkles} title="Nothing new yet">
                New teachings, posts and episodes will appear here.
              </EmptyState>
            )
          ) : null}

          {items.map((it) => (
            <FeedItemCard key={itemKey(it)} item={it} />
          ))}
          <LoadMore q={feed} label="Show more" />
        </div>
      </section>

      <HomeRail data={summary.data} />
    </div>
  );
}

const itemKey = (it: FeedItem) =>
  it.type === "POST"
    ? `p:${it.post.id}`
    : it.type === "TEACHING"
      ? `t:${it.teaching.slug}`
      : it.type === "EPISODE"
        ? `e:${it.episode.id}`
        : `n:${it.news.slug}`;
