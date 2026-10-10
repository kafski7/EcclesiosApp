import type { ReadingDay } from "@ecclesios/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TextSize, useReadScale } from "@/components/reader/text-size";
import { ShareButton } from "@/components/ui/share-button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Tabs, tabId } from "@/components/ui/tabs";
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
  const readScale = useReadScale();
  const title = q.data?.celebration ?? (q.data ? SEASON_LABEL[q.data.season] : "Daily Readings");

  return (
    <div className="content-narrow mx-auto" style={readScale}>
      <section className="card liturgy-head" aria-labelledby="lit-title">
        <p className="lit-date">{formatLongDate(date)}</p>
        <h1 className="lit-feast" id="lit-title">
          {title}
        </h1>
        {q.data ? <Chips day={q.data} /> : null}
        <nav className="lit-nav" aria-label="Choose a day">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => go(prev)}
            aria-label="Previous day"
          >
            <ChevronLeft className="ic" aria-hidden /> Previous
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => go(today)}
            disabled={date === today}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => go(next)}
            aria-label="Next day"
          >
            Next <ChevronRight className="ic" aria-hidden />
          </button>
          <input
            type="date"
            value={date}
            aria-label="Pick a date"
            onChange={(e) => e.target.value && go(e.target.value)}
          />
        </nav>
        <div className="reader-tools">
          <TextSize />
          {/* Readings can't be liked or saved (no reaction kind); sharing a day works signed out. */}
          <ShareButton title={`${title} — ${formatLongDate(date)}`} href={`/readings/${date}`} />
        </div>
      </section>

      {q.isPending ? (
        <div className="mt-6">
          <Skeleton variant="page" label="Loading the readings" />
        </div>
      ) : null}
      {q.isError ? (
        <div className="mt-6">
          <ErrorState
            title="The readings could not be loaded"
            error={q.error}
            onRetry={() => q.refetch()}
            retrying={q.isRefetching}
          />
        </div>
      ) : null}
      {q.data && !q.data.available ? (
        <div className="card rail-card mt-6">
          <span className="chip chip-gold">
            <span className="chip-dot" /> Not available yet
          </span>
          <p className="post-text mt-3">
            The readings for this day haven't been added yet. Try another date.
          </p>
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
  const idx = Math.min(active, day.readings.length - 1);
  const r = day.readings[idx]!;
  return (
    <>
      <Tabs
        label="Readings"
        tabs={day.readings.map((x, i) => ({ id: String(i), label: KIND_LABEL[x.kind] }))}
        value={String(idx)}
        onChange={(id) => setActive(Number(id))}
        panelId="reading-panel"
        barClass="rt-bar"
        tabClass="rt"
      />
      <article
        className="card reading"
        id="reading-panel"
        role="tabpanel"
        aria-labelledby={tabId("reading-panel", String(idx))}
        key={active}
      >
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
