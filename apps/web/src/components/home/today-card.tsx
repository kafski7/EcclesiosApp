import type { HomeSummary } from "@ecclesios/shared";
import { Link } from "react-router-dom";
import { SEASON_SWATCH } from "@/lib/home";
import { formatLongDate, SEASON_LABEL } from "@/lib/readings";

/**
 * Today's liturgical day, linking to the readings (D-033). Sits first in the right rail on
 * desktop so it isn't lost in the feed (D-046); where the rail is hidden it stays at the top of
 * the feed, above the Today strip.
 */
export function TodayCard({
  d,
  className = "",
}: {
  d: HomeSummary | undefined;
  className?: string;
}) {
  if (!d) return null;
  return (
    <Link to="/readings" className={`card today-card ${className}`.trim()}>
      <span
        className="today-swatch"
        style={{ background: SEASON_SWATCH[d.today.color] }}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="saint-kicker">{formatLongDate(d.date)}</span>
        <b className="today-title">{d.today.celebration ?? SEASON_LABEL[d.today.season]}</b>
        <small className="muted">
          {d.today.gospel ? `Gospel: ${d.today.gospel} · Today's readings →` : "Today's readings →"}
        </small>
      </span>
    </Link>
  );
}
