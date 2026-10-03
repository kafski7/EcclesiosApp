import type { HomeSummary } from "@ecclesios/shared";
import { Headphones, Megaphone, Music, Pin } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SaintPortrait } from "@/components/saints/saint-portrait";
import { dateBox, eventWhen } from "@/lib/explore";
import { CATEGORY_LABEL, ago } from "@/lib/news";
import { feastLabel, RANK_LABEL } from "@/lib/saints";

/**
 * Home right rail, Twitter-style (D-033): sticky short cards —
 * Ecclesios news, saint of the day, hymn of the day, trending on Explore, upcoming events.
 * Empty cards are left out.
 */
export function HomeRail({ data }: { data: HomeSummary | undefined }) {
  return (
    <aside className="rail home-rail" aria-label="Today on Ecclesios">
      {data?.news.length ? <NewsCard items={data.news} /> : null}
      {data?.saint ? <SaintCard s={data.saint} /> : null}
      {data?.hymn ? <HymnCard h={data.hymn} /> : null}
      {data?.trending.length ? <TrendingCard items={data.trending} /> : null}
      {data?.events.length ? <EventsCard items={data.events} /> : null}
      <p className="rail-foot small muted">
        <Link to="/about">About</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · © Ecclesios
      </p>
    </aside>
  );
}

function Card({ title, more, children }: { title: string; more?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="card rail-card">
      <div className="rail-head">
        <h2 className="rail-title">{title}</h2>
        {more ? (
          <Link to={more.to} className="link">
            {more.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function NewsCard({ items }: { items: HomeSummary["news"] }) {
  return (
    <Card title="Ecclesios news" more={{ to: "/news", label: "All news" }}>
      <ul>
        {items.map((n) => (
          <li key={n.slug}>
            <Link to={`/news/${n.slug}`} className="trend">
              <Megaphone className="ic" style={{ color: "var(--accent-600)" }} aria-hidden />
              <span className="trend-meta">
                <small>
                  {n.pinned ? <Pin className="inline" style={{ width: 11, height: 11 }} aria-label="Pinned" /> : null} {CATEGORY_LABEL[n.category]} · {ago(n.publishedAt)}
                </small>
                <b>{n.title}</b>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SaintCard({ s }: { s: NonNullable<HomeSummary["saint"]> }) {
  return (
    <Card title="Saint of the day" more={{ to: "/saints", label: "Saints" }}>
      <Link to={`/saints/${s.slug}`} className="saint-mini">
        <SaintPortrait name={s.name} imageUrl={s.imageUrl} size="sm" />
        <span className="trend-meta">
          <b>{s.name}</b>
          <small>
            {feastLabel(s.feastMonth, s.feastDay)} · {RANK_LABEL[s.rank]}
          </small>
        </span>
      </Link>
      <p className="small mt-2" style={{ color: "var(--text-2)" }}>{s.summary}</p>
    </Card>
  );
}

function HymnCard({ h }: { h: NonNullable<HomeSummary["hymn"]> }) {
  return (
    <Card title="Hymn of the day" more={{ to: "/hymnal", label: "Hymnal" }}>
      <Link to={`/hymnal/${h.slug}`} className="block">
        <span className="flex items-center gap-2">
          <Music className="ic" style={{ color: "var(--accent-600)", width: 18, height: 18 }} aria-hidden />
          <b style={{ fontSize: 14.5 }}>{h.title}</b>
          {h.hasAudio ? <Headphones className="ic" style={{ width: 15, height: 15, color: "var(--text-3)" }} aria-label="Has a recording" /> : null}
        </span>
        {h.numbers.length ? <small className="muted block">{h.numbers.map((n) => `${n.book} ${n.number}`).join(" · ")}</small> : null}
        <span className="hymn-excerpt">
          {h.excerpt.map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </span>
      </Link>
    </Card>
  );
}

function TrendingCard({ items }: { items: HomeSummary["trending"] }) {
  return (
    <Card title="Trending on Explore" more={{ to: "/explore", label: "Explore" }}>
      <ol>
        {items.map((p, i) => (
          <li key={p.id}>
            <Link to={`/explore/posts/${p.id}`} className="trend">
              <span className="trend-rank">{i + 1}</span>
              <span className="trend-meta">
                <b>{p.title}</b>
                <small>
                  {p.author.name}
                  {p.commentCount ? ` · ${p.commentCount} comment${p.commentCount === 1 ? "" : "s"}` : ""}
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function EventsCard({ items }: { items: HomeSummary["events"] }) {
  return (
    <Card title="Upcoming events" more={{ to: "/explore?tab=EVENTS", label: "All events" }}>
      <ul>
        {items.map((p) => (
          <li key={p.id}>
            <Link to={`/explore/posts/${p.id}`} className="trend">
              {p.event ? (
                <span className="date-box" aria-hidden>
                  <b>{dateBox(p.event.startsAt).day}</b>
                  <small>{dateBox(p.event.startsAt).month}</small>
                </span>
              ) : null}
              <span className="trend-meta">
                <b>{p.title}</b>
                <small>{p.event ? eventWhen(p.event.startsAt, p.event.endsAt) : p.author.name}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
