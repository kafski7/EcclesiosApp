import type { HomeSummary } from "@ecclesios/shared";
import { CalendarDays, Megaphone, Music, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { eventWhen } from "@/lib/explore";
import { CATEGORY_LABEL } from "@/lib/news";
import { feastLabel } from "@/lib/saints";

/**
 * Phones and tablets (≤1150px) hide the right rail, which used to hide Ecclesios news, the saint
 * and hymn of the day with it. This strip brings the essentials into the feed column there
 * (docs/social.md §8, §9.10, D-044); on desktop it is hidden and the rail shows them.
 */
export function TodayStrip({ data }: { data: HomeSummary | undefined }) {
  if (!data) return null;
  const news = data.news[0];
  const event = data.events[0];
  const tiles: ReactNode[] = [];
  if (news)
    tiles.push(
      <Tile
        key="news"
        to={`/news/${news.slug}`}
        icon={<Megaphone className="ic" aria-hidden />}
        kicker={`Ecclesios · ${CATEGORY_LABEL[news.category]}`}
        news
      >
        {news.title}
      </Tile>,
    );
  if (data.saint)
    tiles.push(
      <Tile
        key="saint"
        to={`/saints/${data.saint.slug}`}
        icon={<UserRound className="ic" aria-hidden />}
        kicker={`Saint of the day · ${feastLabel(data.saint.feastMonth, data.saint.feastDay)}`}
      >
        {data.saint.name}
      </Tile>,
    );
  if (data.hymn)
    tiles.push(
      <Tile
        key="hymn"
        to={`/hymnal/${data.hymn.slug}`}
        icon={<Music className="ic" aria-hidden />}
        kicker="Hymn of the day"
      >
        {data.hymn.title}
      </Tile>,
    );
  if (event?.event)
    tiles.push(
      <Tile
        key="event"
        to={`/explore/posts/${event.id}`}
        icon={<CalendarDays className="ic" aria-hidden />}
        kicker={eventWhen(event.event.startsAt, event.event.endsAt)}
      >
        {event.title}
      </Tile>,
    );
  if (!tiles.length) return null;
  return (
    <nav className="today-strip" aria-label="Today on Ecclesios">
      <ul>{tiles}</ul>
    </nav>
  );
}

function Tile({
  to,
  icon,
  kicker,
  news = false,
  children,
}: {
  to: string;
  icon: ReactNode;
  kicker: string;
  news?: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <Link to={to} className={`card today-tile${news ? " c-news" : ""}`}>
        <span className="feed-kicker">
          {icon}
          <span>{kicker}</span>
        </span>
        <b>{children}</b>
      </Link>
    </li>
  );
}
