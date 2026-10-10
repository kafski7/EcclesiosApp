import type { Episode, PodcastSummary } from "@ecclesios/shared";
import { youTubeEmbedUrl } from "@ecclesios/shared/domain";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Download,
  FileText,
  Lock,
  Mic,
  Play,
  Search,
  Youtube,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { episodeActions } from "@/lib/player";
import {
  attachmentUrl,
  coverInitials,
  episodePath,
  formatEpisodeDuration,
  useFollowing,
  useFollowToggle,
  usePodcast,
  usePodcasts,
  otherEpisodes,
  useTranscript,
} from "@/lib/podcasts";
import { usePlayer } from "@/stores/player";
import { SignInLink } from "@/components/auth/sign-in-link";
import { EngageBar } from "@/components/engage/engage-bar";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
import { useSession } from "@/stores/session";

function Cover({ p, size }: { p: Pick<PodcastSummary, "title" | "coverUrl">; size: number }) {
  const style = { width: size, height: size, borderRadius: 14, flexShrink: 0 } as const;
  if (p.coverUrl)
    return <img src={p.coverUrl} alt="" style={{ ...style, objectFit: "cover" }} loading="lazy" />;
  return (
    <span
      className="saint-medal"
      style={{ ...style, fontSize: size / 3, borderRadius: 14 }}
      aria-hidden
    >
      {coverInitials(p.title)}
    </span>
  );
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

/** Podcast library (functionality §3.5, D-027). */
export function PodcastsPage() {
  // ?q= lets the global search's "See all" open this page with the query (D-042).
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = usePodcasts(debounced);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="content-narrow mx-auto" style={{ maxWidth: 980 }}>
      <header className="page-head">
        <h1 className="page-title">Podcasts</h1>
        <p className="page-sub">Catholic podcasts from Ecclesios and approved creators.</p>
      </header>
      <label className="search mb-5">
        <Search className="ic" aria-hidden />
        <input
          type="search"
          placeholder="Search podcasts"
          aria-label="Search podcasts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {list.isError ? (
        <ErrorState
          title="The podcasts could not be loaded"
          error={list.error}
          onRetry={() => list.refetch()}
          retrying={list.isRefetching}
        />
      ) : null}
      {list.isPending ? <Skeleton variant="grid" count={4} label="Loading podcasts" /> : null}
      {list.isSuccess && !items.length ? (
        <EmptyState icon={Mic} title="No podcasts found">
          {debounced.trim()
            ? "Try other words."
            : "Podcasts will appear here once they're published."}
        </EmptyState>
      ) : null}
      <div className="saint-grid">
        {items.map((p) => (
          <Link key={p.slug} to={`/podcasts/${p.slug}`} className="card saint-tile">
            <div className="flex items-center gap-3">
              <Cover p={p} size={64} />
              <div className="min-w-0">
                <b>{p.title}</b>
                <small className="block">{p.publisher.name}</small>
              </div>
            </div>
            <p className="small" style={{ color: "var(--text-2)" }}>
              {p.summary}
            </p>
            <small>
              {p.episodeCount} episode{p.episodeCount === 1 ? "" : "s"}
              {p.latestEpisodeAt ? ` · latest ${when(p.latestEpisodeAt)}` : ""}
            </small>
          </Link>
        ))}
      </div>
      <LoadMore q={list} label="More podcasts" />
    </div>
  );
}

/** One series: about, follow, episodes with a player. */
export function PodcastPage() {
  const { slug } = useParams();
  const q = usePodcast(slug);
  const principal = useSession((s) => s.principal);
  const following = useFollowing();
  const toggle = useFollowToggle(slug ?? "");
  const isFollowing = !!slug && (following.data?.slugs.includes(slug) ?? false);

  if (q.isPending) return <Skeleton variant="page" label="Loading the podcast" />;
  if (q.isError)
    return q.error instanceof ApiClientError && q.error.code === "PODCAST_NOT_FOUND" ? (
      <EmptyState
        icon={Mic}
        title="We couldn't find that podcast"
        action={
          <Link to="/podcasts" className="btn btn-outline btn-sm">
            All podcasts
          </Link>
        }
      />
    ) : (
      <ErrorState
        title="This podcast could not be loaded"
        error={q.error}
        onRetry={() => q.refetch()}
        retrying={q.isRefetching}
      />
    );
  const p = q.data;

  return (
    <div className="content-narrow mx-auto">
      <Link to="/podcasts" className="link mb-4">
        <ArrowLeft className="ic" aria-hidden /> Podcasts
      </Link>
      <section className="card hymn-head flex gap-5" style={{ flexWrap: "wrap" }}>
        <Cover p={p} size={120} />
        <div className="min-w-0 flex-1">
          <span className="saint-kicker">{p.category ?? "Podcast"}</span>
          <h1 style={{ fontSize: 27, fontWeight: 700, margin: "6px 0 4px" }}>{p.title}</h1>
          <p className="small muted">by {p.publisher.name}</p>
          <p className="mt-3" style={{ color: "var(--text-2)" }}>
            {p.description || p.summary}
          </p>
          {principal?.kind === "member" ? (
            <button
              type="button"
              className={`btn btn-sm mt-4 ${isFollowing ? "btn-outline" : "btn-primary"}`}
              onClick={() => toggle.mutate(!isFollowing)}
              disabled={toggle.isPending || following.isPending}
              aria-pressed={isFollowing}
            >
              {isFollowing ? (
                <BellOff className="ic" aria-hidden />
              ) : (
                <Bell className="ic" aria-hidden />
              )}
              {isFollowing ? "Following" : "Follow"}
            </button>
          ) : !principal ? (
            <p className="small muted mt-4">
              <SignInLink /> to follow and hear about new episodes.
            </p>
          ) : null}
        </div>
      </section>

      <section className="card tune-card mt-4" aria-label="Episodes">
        <h2 className="panel-title mb-2">Episodes</h2>
        {p.episodes.length ? (
          <ul>
            {p.episodes.map((e) => (
              <EpisodeRow key={e.id} e={e} podcast={p} />
            ))}
          </ul>
        ) : (
          <p className="small muted">No episodes yet. Follow to hear when the first one is out.</p>
        )}
      </section>
    </div>
  );
}

function EpisodeRow({
  e,
  podcast,
  detail = false,
}: {
  e: Episode;
  podcast: Pick<PodcastSummary, "slug" | "title" | "coverUrl">;
  /** On the episode's own page: title as the heading, transcript open by default. */
  detail?: boolean;
}) {
  const { track, open } = usePlayer();
  const [watch, setWatch] = useState(false);
  const [showTranscript, setShowTranscript] = useState(detail);
  const [err, setErr] = useState<string | null>(null);
  const transcript = useTranscript(e.id, showTranscript);
  const act = episodeActions(e);
  const current = track?.episodeId === e.id;

  const listen = () =>
    open({
      episodeId: e.id,
      title: e.title,
      podcastTitle: podcast.title,
      podcastSlug: podcast.slug,
      coverUrl: podcast.coverUrl,
      durationSec: e.durationSec,
    });
  const download = async (id: string) => {
    setErr(null);
    try {
      window.open((await attachmentUrl(id)).url, "_blank", "noopener");
    } catch {
      setErr("Couldn't open the file.");
    }
  };

  return (
    <li className="media-row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
      {act.primary === "watch" ? (
        <Youtube className="ic" aria-hidden />
      ) : (
        <Mic className="ic" aria-hidden />
      )}
      <div className="grow">
        {detail ? (
          <h1 className="episode-title">
            {e.number ? `${e.number}. ` : ""}
            {e.title}
          </h1>
        ) : (
          <Link to={episodePath(podcast.slug, e.id)} className="episode-link">
            {e.number ? `${e.number}. ` : ""}
            {e.title}
          </Link>
        )}
        <div className="small muted">
          {[when(e.publishedAt), formatEpisodeDuration(e.durationSec)].filter(Boolean).join(" · ")}
        </div>
        {e.notes ? (
          <p className="small mt-1" style={{ color: "var(--text-2)", whiteSpace: "pre-line" }}>
            {e.notes}
          </p>
        ) : null}
        {!act.locked && (e.hasTranscript || e.attachments.length) ? (
          <div className="flex flex-wrap gap-3 mt-2 small">
            {e.hasTranscript ? (
              <button
                type="button"
                className="link"
                onClick={() => setShowTranscript((v) => !v)}
                aria-expanded={showTranscript}
              >
                <FileText className="ic" aria-hidden />{" "}
                {showTranscript ? "Hide transcript" : "Transcript"}
              </button>
            ) : null}
            {e.attachments.map((a) => (
              <button key={a.id} type="button" className="link" onClick={() => void download(a.id)}>
                <Download className="ic" aria-hidden /> {a.label}
              </button>
            ))}
          </div>
        ) : null}
        {showTranscript ? (
          <div className="transcript">
            {transcript.isPending ? "Loading…" : transcript.data?.text || "No transcript."}
          </div>
        ) : null}
        {err ? (
          <span className="small" style={{ color: "var(--danger)" }}>
            {err}
          </span>
        ) : null}
        {watch && e.youtubeId ? (
          // YouTube's terms: the player stays visible — no audio-only playback of YouTube (D-026, D-029).
          <div className="yt-frame">
            <iframe
              src={youTubeEmbedUrl(e.youtubeId)}
              title={e.title}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null}
        {act.locked ? null : (
          <EngageBar
            kind="EPISODE"
            id={e.id}
            title={e.title}
            href={episodePath(podcast.slug, e.id)}
          />
        )}
      </div>
      <div className="flex gap-2">
        {act.locked ? (
          <span className="chip chip-gold">
            <Lock className="ic" aria-hidden /> Subscribers
          </span>
        ) : null}
        {act.watch ? (
          <button
            type="button"
            className={`btn btn-sm ${act.primary === "watch" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setWatch((v) => !v)}
            aria-expanded={watch}
          >
            <Youtube className="ic" aria-hidden /> {watch ? "Hide" : "Watch"}
          </button>
        ) : null}
        {act.listen ? (
          <button
            type="button"
            className={`btn btn-sm ${act.primary === "listen" ? "btn-primary" : "btn-outline"}`}
            onClick={listen}
            disabled={current}
            aria-label={current ? "Now playing" : "Listen"}
          >
            <Play className="ic" aria-hidden /> {current ? "Playing" : "Listen"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * One episode's own page (docs/social.md §9.5, D-045): a link to share, the player buttons,
 * transcript and handouts, and more from the same podcast. Built from the podcast's data — no
 * extra API call.
 */
export function EpisodePage() {
  const { slug, id } = useParams();
  const q = usePodcast(slug);

  if (q.isPending) return <Skeleton variant="page" label="Loading the episode" />;
  if (q.isError)
    return q.error instanceof ApiClientError && q.error.code === "PODCAST_NOT_FOUND" ? (
      <EmptyState
        icon={Mic}
        title="We couldn't find that podcast"
        action={
          <Link to="/podcasts" className="btn btn-outline btn-sm">
            All podcasts
          </Link>
        }
      />
    ) : (
      <ErrorState
        title="This episode could not be loaded"
        error={q.error}
        onRetry={() => q.refetch()}
        retrying={q.isRefetching}
      />
    );
  const p = q.data;
  const e = p.episodes.find((x) => x.id === id);
  if (!e)
    return (
      <EmptyState
        icon={Mic}
        title="We couldn't find that episode"
        action={
          <Link to={`/podcasts/${p.slug}`} className="btn btn-outline btn-sm">
            All episodes of {p.title}
          </Link>
        }
      >
        It may have been taken down.
      </EmptyState>
    );
  const more = otherEpisodes(p.episodes, e.id);

  return (
    <div className="content-narrow mx-auto">
      <Link to={`/podcasts/${p.slug}`} className="link mb-4">
        <ArrowLeft className="ic" aria-hidden /> {p.title}
      </Link>
      <section className="card tune-card episode-page">
        <Link to={`/podcasts/${p.slug}`} className="episode-show">
          <Cover p={p} size={56} />
          <span className="min-w-0">
            <span className="saint-kicker">{p.category ?? "Podcast"}</span>
            <b className="block truncate">{p.title}</b>
            <small className="muted">by {p.publisher.name}</small>
          </span>
        </Link>
        <ul>
          <EpisodeRow e={e} podcast={p} detail />
        </ul>
      </section>

      {more.length ? (
        <section className="card tune-card mt-4" aria-label={`More from ${p.title}`}>
          <h2 className="panel-title mb-2">More from {p.title}</h2>
          <ul>
            {more.map((x) => (
              <EpisodeRow key={x.id} e={x} podcast={p} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
