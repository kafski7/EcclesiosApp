import type { PostSummary } from "@ecclesios/shared";
import { BookOpen, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { EngageBar } from "@/components/engage/engage-bar";
import { dateBox, eventWhen, KIND_LABEL } from "@/lib/explore";

/** Kit x-card (docs/ecclesios-ui Explore) with likes · comments · save · share under it (D-035). */
export function PostCard({ p }: { p: PostSummary }) {
  const href = `/explore/posts/${p.id}`;
  return (
    <article className="card x-card-outer">
    <Link to={href} className="x-card">
      <div className="x-media">
        {p.coverUrl ? (
          <img src={p.coverUrl} alt="" loading="lazy" />
        ) : p.youtubeId ? (
          <img src={`https://i.ytimg.com/vi/${p.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" />
        ) : p.kind === "EVENT" ? (
          <CalendarDays className="ic" aria-hidden />
        ) : (
          <BookOpen className="ic" aria-hidden />
        )}
      </div>
      <div className="x-body">
        <span className={`x-tag${p.kind === "EVENT" ? " x-tag--gold" : ""}`}>{KIND_LABEL[p.kind]}</span>
        <h3 className="x-title">{p.title}</h3>
        {p.event ? (
          <div className="flex items-center gap-3">
            <span className="date-box" aria-hidden>
              <b>{dateBox(p.event.startsAt).day}</b>
              <small>{dateBox(p.event.startsAt).month}</small>
            </span>
            <span className="x-meta">
              {eventWhen(p.event.startsAt, p.event.endsAt)}
              <br />
              {p.event.place}
            </span>
          </div>
        ) : p.summary ? (
          <p className="x-meta">{p.summary}</p>
        ) : null}
        <span className="x-meta mt-auto pt-2">{p.author.name}</span>
      </div>
    </Link>
      <EngageBar kind="POST" id={p.id} title={p.title} href={href} comments={{ count: p.commentCount, to: `${href}#comments` }} />
    </article>
  );
}
