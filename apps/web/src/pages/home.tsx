import { ArrowRight, Image as ImageIcon, Link2, Search, Smile } from "lucide-react";
import { Link } from "react-router-dom";
import { SaintOfTheDay } from "@/components/saints/saint-of-the-day";
import { PRIMARY_NAV } from "@/nav";

const BLURBS: Record<string, string> = {
  "/readings": "Today's Mass readings",
  "/saints": "Saint of the day & directory",
  "/explore": "Churches, priests & events",
  "/podcasts": "Catholic podcasts",
  "/hymnal": "Hymns, recordings & notation",
  "/teachings": "Learn the faith",
  "/bible": "Read the Scriptures",
};

/**
 * Home in the kit layout (feed + right rail). The blended feed (saint of the day, events,
 * hymns, teachings, episodes, Explore posts) fills the feed column in Phase 5.8.
 */
export function HomePage() {
  const sections = PRIMARY_NAV.filter((n) => n.to !== "/");

  return (
    <div className="home-layout">
      <section className="feed" aria-label="Feed">
        <div className="feed-tabs" role="tablist">
          <button type="button" role="tab" aria-selected className="feed-tab active">
            For You
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            className="feed-tab"
            disabled
            title="After sign-in"
          >
            Following
          </button>
        </div>

        <div className="card composer">
          <span className="avatar av-40 av-brand">KA</span>
          <div className="composer-body">
            <textarea
              className="composer-input"
              rows={1}
              placeholder="Share something with your community…"
              aria-label="Share something with your community"
            />
            <div className="composer-bar">
              <button type="button" className="compose-ic" aria-label="Add image">
                <ImageIcon className="ic" />
              </button>
              <button type="button" className="compose-ic" aria-label="Attach link">
                <Link2 className="ic" />
              </button>
              <button type="button" className="compose-ic" aria-label="Add emoji">
                <Smile className="ic" />
              </button>
              <button type="button" className="btn btn-primary btn-sm">
                Post
              </button>
            </div>
          </div>
        </div>

        {/* Saint of the day (D-025); the welcome card shows when no saint is celebrated today. */}
        <SaintOfTheDay
          fallback={
          <article className="card saint-card">
            <span
              className="saint-photo grid place-items-center bg-[var(--primary-soft)] font-serif text-3xl text-[var(--primary)]"
              aria-hidden
            >
              ✠
            </span>
            <div className="saint-body">
              <p className="saint-kicker">Welcome to Ecclesios</p>
              <h1 className="saint-name">Faith, community and Church — in one place</h1>
              <p className="saint-date">Readings · Saints · Hymns · Bible</p>
              <p className="saint-text">
                Daily readings, saints, hymns, teachings, podcasts and the Bible — and your church,
                connected.
              </p>
            </div>
          </article>
          }
        />

        <article className="card post">
          <h2 className="post-title mt-0">Your feed is on its way</h2>
          <p className="post-text">
            Saint of the day, upcoming events, new teachings and podcast episodes will appear here
            as each section goes live.
          </p>
          <blockquote className="post-quote">
            Where two or three are gathered in my name, there am I among them.
            <cite>Matthew 18:20</cite>
          </blockquote>
          <div className="post-actions">
            <Link to="/readings" className="btn btn-primary btn-sm">
              Today's readings
            </Link>
            <Link to="/bible" className="btn btn-ghost btn-sm">
              Open the Bible
            </Link>
          </div>
        </article>
      </section>

      <aside className="rail" aria-label="Explore Ecclesios">
        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Search className="ic" aria-hidden />
          <input type="search" placeholder="Search Ecclesios" aria-label="Search Ecclesios" />
        </form>

        <div className="card rail-card">
          <div className="rail-head">
            <h2 className="rail-title">Explore Ecclesios</h2>
          </div>
          <ul>
            {sections.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="trend group">
                  <Icon className="ic text-[var(--accent-600)]" aria-hidden />
                  <span className="trend-meta">
                    <b>{label}</b>
                    <small>{BLURBS[to]}</small>
                  </span>
                  <ArrowRight
                    className="ic size-4 text-[var(--text-3)] transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
