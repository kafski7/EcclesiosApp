import type { FeedItem } from "@ecclesios/shared";
import { formatEpisodeDuration } from "@ecclesios/shared/domain";
import { Mic, Play, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { EngageBar } from "@/components/engage/engage-bar";
import { episodePath } from "@/lib/podcasts";
import { usePlayer } from "@/stores/player";
import { CardTitle, Kicker, type HeadingLevel } from "./kicker";

type FeedEpisode = Extract<FeedItem, { type: "EPISODE" }>["episode"];

/** New podcast episode in a feed: cover, title, Listen (mini-player) or Watch (D-029, D-043). */
export function EpisodeCard({
  e,
  at,
  level = 3,
}: {
  e: FeedEpisode;
  at?: string;
  level?: HeadingLevel;
}) {
  const { track, open } = usePlayer();
  const youtube = e.mediaKind === "YOUTUBE";
  const playing = track?.episodeId === e.id;
  const href = episodePath(e.podcast.slug, e.id);
  return (
    <article className="card post c-card">
      <Kicker
        icon={youtube ? <Youtube className="ic" aria-hidden /> : <Mic className="ic" aria-hidden />}
        at={at}
      >
        New episode · {e.podcast.title}
      </Kicker>
      <div className="c-row">
        {e.podcast.coverUrl ? (
          <img src={e.podcast.coverUrl} alt="" className="feed-cover" loading="lazy" />
        ) : null}
        <div className="min-w-0 flex-1">
          <Link to={href} className="c-title-link">
            <CardTitle level={level}>{e.title}</CardTitle>
          </Link>
          {e.durationSec ? (
            <small className="muted">{formatEpisodeDuration(e.durationSec)}</small>
          ) : null}
        </div>
        {youtube ? (
          <Link to={href} className="btn btn-outline btn-sm" aria-label={`Watch ${e.title}`}>
            <Youtube className="ic" aria-hidden /> Watch
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={playing}
            aria-label={playing ? `${e.title} is playing` : `Listen to ${e.title}`}
            onClick={() =>
              open({
                episodeId: e.id,
                title: e.title,
                podcastTitle: e.podcast.title,
                podcastSlug: e.podcast.slug,
                coverUrl: e.podcast.coverUrl,
                durationSec: e.durationSec,
              })
            }
          >
            <Play className="ic" aria-hidden /> {playing ? "Playing" : "Listen"}
          </button>
        )}
      </div>
      <EngageBar kind="EPISODE" id={e.id} title={e.title} href={href} />
    </article>
  );
}
