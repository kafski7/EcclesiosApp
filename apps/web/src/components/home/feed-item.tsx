import type { FeedItem } from "@ecclesios/shared";
import { formatEpisodeDuration } from "@ecclesios/shared/domain";
import { Clock, GraduationCap, Megaphone, Mic, Play, Youtube } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PostCard } from "@/components/explore/post-card";
import { CATEGORY_LABEL, ago } from "@/lib/news";
import { EngageBar } from "@/components/engage/engage-bar";
import { usePlayer } from "@/stores/player";

/** One blended-feed entry (D-033). Posts reuse the Explore card; the rest are compact cards. */
export function FeedItemCard({ item }: { item: FeedItem }) {
  switch (item.type) {
    case "POST":
      return <PostCard p={item.post} />;
    case "TEACHING":
      return (
        <article className="card post">
          <Link to={`/teachings/${item.teaching.slug}`} className="block">
            <Kicker icon={<GraduationCap className="ic" aria-hidden />} label={`New teaching · ${item.teaching.topics.map((t) => t.name).join(", ")}`} at={item.at} />
            <h3 className="post-title">{item.teaching.title}</h3>
            <p className="post-text">{item.teaching.summary}</p>
            <span className="small muted inline-flex items-center gap-1 mt-2">
              <Clock className="ic" style={{ width: 14, height: 14 }} aria-hidden /> {item.teaching.readingMinutes} min read
            </span>
          </Link>
          <EngageBar kind="TEACHING" id={item.teaching.id} title={item.teaching.title} href={`/teachings/${item.teaching.slug}`} />
        </article>
      );
    case "NEWS":
      return (
        <Link to={`/news/${item.news.slug}`} className="card post block feed-news">
          <Kicker icon={<Megaphone className="ic" aria-hidden />} label={`Ecclesios · ${CATEGORY_LABEL[item.news.category]}`} at={item.at} />
          <h3 className="post-title">{item.news.title}</h3>
          <p className="post-text">{item.news.summary}</p>
        </Link>
      );
    case "EPISODE":
      return <EpisodeCard item={item} />;
  }
}

function EpisodeCard({ item }: { item: Extract<FeedItem, { type: "EPISODE" }> }) {
  const { track, open } = usePlayer();
  const e = item.episode;
  const youtube = e.mediaKind === "YOUTUBE";
  const playing = track?.episodeId === e.id;
  return (
    <article className="card post">
      <Kicker icon={youtube ? <Youtube className="ic" aria-hidden /> : <Mic className="ic" aria-hidden />} label={`New episode · ${e.podcast.title}`} at={item.at} />
      <div className="flex items-center gap-3 mt-2">
        {e.podcast.coverUrl ? <img src={e.podcast.coverUrl} alt="" className="feed-cover" loading="lazy" /> : null}
        <div className="min-w-0 flex-1">
          <Link to={`/podcasts/${e.podcast.slug}`} className="post-title block" style={{ margin: 0 }}>
            {e.title}
          </Link>
          {e.durationSec ? <small className="muted">{formatEpisodeDuration(e.durationSec)}</small> : null}
        </div>
        {youtube ? (
          <Link to={`/podcasts/${e.podcast.slug}`} className="btn btn-outline btn-sm">
            <Youtube className="ic" aria-hidden /> Watch
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={playing}
            onClick={() =>
              open({ episodeId: e.id, title: e.title, podcastTitle: e.podcast.title, podcastSlug: e.podcast.slug, coverUrl: e.podcast.coverUrl, durationSec: e.durationSec })
            }
          >
            <Play className="ic" aria-hidden /> {playing ? "Playing" : "Listen"}
          </button>
        )}
      </div>
      <EngageBar kind="EPISODE" id={e.id} title={e.title} href={`/podcasts/${e.podcast.slug}`} />
    </article>
  );
}

function Kicker({ icon, label, at }: { icon: ReactNode; label: string; at: string }) {
  return (
    <span className="feed-kicker">
      {icon}
      <span>{label}</span>
      <span aria-hidden>·</span>
      <time dateTime={at}>{ago(at)}</time>
    </span>
  );
}
