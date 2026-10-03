import { SaintPortrait } from "./saint-portrait";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { feastLabel, RANK_LABEL, useSaintsToday } from "@/lib/saints";

/** Kit .saint-card with today's saint (functionality §3.3). Falls back to `fallback` when none. */
export function SaintOfTheDay({ fallback = null, headingLevel = 2 }: { fallback?: ReactNode; headingLevel?: 1 | 2 }) {
  const q = useSaintsToday();
  const s = q.data?.saint;
  if (!s) return <>{q.isPending ? null : fallback}</>;
  const H = headingLevel === 1 ? "h1" : "h2";
  return (
    <article className="card saint-card">
      <SaintPortrait name={s.name} imageUrl={s.imageUrl} size="lg" />
      <div className="saint-body">
        <p className="saint-kicker">Saint of the day</p>
        <H className="saint-name">
          <Link to={`/saints/${s.slug}`}>{s.name}</Link>
        </H>
        <p className="saint-date">
          {feastLabel(s.feastMonth, s.feastDay)} · {RANK_LABEL[s.rank]}
          {s.title ? ` · ${s.title}` : ""}
        </p>
        <p className="saint-text">{s.summary}</p>
        {q.data!.others.length ? (
          <p className="small muted mt-2">
            Also today:{" "}
            {q.data!.others.map((o, i) => (
              <span key={o.slug}>
                {i ? ", " : ""}
                <Link to={`/saints/${o.slug}`} className="link">
                  {o.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </article>
  );
}
