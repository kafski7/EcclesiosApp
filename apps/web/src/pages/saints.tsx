import { SaintPortrait } from "@/components/saints/saint-portrait";
import { monthName } from "@ecclesios/shared/domain";
import { Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SaintOfTheDay } from "@/components/saints/saint-of-the-day";
import { feastLabel, RANK_LABEL, useSaints } from "@/lib/saints";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Saint of the day + searchable directory (functionality §3.3, D-025). Filters live in the URL. */
export function SaintsPage() {
  const [params, setParams] = useSearchParams();
  const month = Number(params.get("month")) || null;
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced.trim()) next.set("q", debounced.trim());
    else next.delete("q");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [debounced, params, setParams]);

  const list = useSaints(debounced, month);
  const pick = (m: number | null) => {
    const next = new URLSearchParams(params);
    if (m) next.set("month", String(m));
    else next.delete("month");
    setParams(next);
  };

  return (
    <div className="content-narrow mx-auto" style={{ maxWidth: 980 }}>
      <div className="page-head">
        <h1 className="page-title">Saints</h1>
        <p className="page-sub">
          Witnesses of faith — the saint of the day and the Church's calendar of saints.
        </p>
      </div>

      <SaintOfTheDay
        fallback={
          <div className="card rail-card">
            <p className="post-text">
              No saint from our calendar is celebrated today. Browse the directory below.
            </p>
          </div>
        }
      />

      <form className="search mt-6" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search className="ic" aria-hidden />
        <input
          type="search"
          placeholder="Search by name or patronage, e.g. mothers, missions"
          aria-label="Search saints"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      <div className="filter-bar" role="group" aria-label="Filter by month">
        <button type="button" className="f-pill" aria-pressed={!month} onClick={() => pick(null)}>
          All
        </button>
        {MONTHS.map((m) => (
          <button
            key={m}
            type="button"
            className="f-pill"
            aria-pressed={month === m}
            onClick={() => pick(m)}
          >
            {monthName(m).slice(0, 3)}
          </button>
        ))}
      </div>

      {list.isPending ? <Skeleton variant="grid" count={6} label="Loading saints" /> : null}
      {list.isError ? (
        <ErrorState
          title="The directory could not be loaded"
          error={list.error}
          onRetry={() => list.refetch()}
          retrying={list.isRefetching}
        />
      ) : null}
      {list.data && !list.data.items.length ? (
        <EmptyState icon={UserRound} title="No saints match your search">
          Try a name, a patronage such as “teachers”, or another month.
        </EmptyState>
      ) : null}
      <ul className="saint-grid">
        {list.data?.items.map((s) => (
          <li key={s.slug}>
            <Link to={`/saints/${s.slug}`} className="card saint-tile">
              <span className="saint-mini">
                <SaintPortrait name={s.name} imageUrl={s.imageUrl} size="sm" />
                <span>
                  <b>{s.name}</b>
                  <br />
                  <small>
                    {feastLabel(s.feastMonth, s.feastDay)} · {RANK_LABEL[s.rank]}
                  </small>
                </span>
              </span>
              <span className="post-text small">{s.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
