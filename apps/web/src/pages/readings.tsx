import type { ReadingDay } from "@ecclesios/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  bibleHref,
  COLOR_HEX,
  formatLongDate,
  KIND_LABEL,
  localToday,
  neighbours,
  resolveDate,
  SEASON_LABEL,
  useReadings,
} from "@/lib/readings";

/** Daily Mass readings in the kit's readings.html layout (functionality §3.2, D-022). */
export function ReadingsPage() {
  const { date: param } = useParams();
  const today = localToday();
  const date = resolveDate(param, today);
  const navigate = useNavigate();
  const q = useReadings(date);
  const { prev, next } = neighbours(date);
  const go = (d: string) => navigate(d === today ? "/readings" : `/readings/${d}`);

  return (
    <div className="content-narrow mx-auto">
      <section className="card liturgy-head" aria-labelledby="lit-title">
        <p className="lit-date">{formatLongDate(date)}</p>
        <h1 className="lit-feast" id="lit-title">
          {q.data?.celebration ?? (q.data ? SEASON_LABEL[q.data.season] : "Daily Readings")}
        </h1>
        {q.data ? <Chips day={q.data} /> : null}
        <nav className="lit-nav" aria-label="Choose a day">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => go(prev)} aria-label="Previous day">
            <ChevronLeft className="ic" aria-hidden /> Previous
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => go(today)} disabled={date === today}>
            Today
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => go(next)} aria-label="Next day">
            Next <ChevronRight className="ic" aria-hidden />
          </button>
          <input
            type="date"
            value={date}
            aria-label="Pick a date"
            onChange={(e) => e.target.value && go(e.target.value)}
          />
        </nav>
      </section>

      {q.isPending ? <p className="muted small mt-6">Loading the readings…</p> : null}
      {q.isError ? (
        <div className="card rail-card mt-6" role="alert">
          The readings could not be loaded. Check your connection and try again.
        </div>
      ) : null}
      {q.data && !q.data.available ? (
        <div className="card rail-card mt-6">
          <span className="chip chip-gold">
            <span className="chip-dot" /> Not available yet
          </span>
          <p className="post-text mt-3">The readings for this day haven't been added yet. Try another date.</p>
        </div>
      ) : null}
      {q.data?.available ? <ReadingTabs day={q.data} /> : null}
    </div>
  );
}

function Chips({ day }: { day: ReadingDay }) {
  return (
    <div className="lit-chips">
      <span className="chip chip-burgundy">
        <span className="lit-swatch" style={{ background: COLOR_HEX[day.color] }} aria-hidden />
        {SEASON_LABEL[day.season]}
      </span>
      <span className="chip chip-gold">
        Year {day.sundayCycle} · Weekday {day.weekdayCycle}
      </span>
    </div>
  );
}

function ReadingTabs({ day }: { day: ReadingDay }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [day.date]);
  const r = day.readings[Math.min(active, day.readings.length - 1)]!;
  return (
    <>
      <div className="rt-bar" role="tablist" aria-label="Readings">
        {day.readings.map((x, i) => (
          <button
            key={`${x.kind}-${i}`}
            type="button"
            role="tab"
            id={`rt-${i}`}
            aria-selected={i === active}
            aria-controls="reading-panel"
            className="rt"
            onClick={() => setActive(i)}
          >
            {KIND_LABEL[x.kind]}
          </button>
        ))}
      </div>
      <article className="card reading" id="reading-panel" role="tabpanel" aria-labelledby={`rt-${active}`} key={active}>
        <h2>{KIND_LABEL[r.kind]}</h2>
        <Link className="citation" to={bibleHref(r.citation)}>
          {r.citation}
        </Link>
        {r.response ? (
          <p className="responsory">
            <span className="r">R.</span>
            <span>{r.response}</span>
          </p>
        ) : null}
        {r.text.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      {day.source ? <p className="all-credits">{day.source}</p> : null}
    </>
  );
}
