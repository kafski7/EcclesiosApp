import type { NewsSummary } from "@ecclesios/shared";
import { Megaphone, Pin } from "lucide-react";
import { Link } from "react-router-dom";
import { CATEGORY_LABEL, shortDate } from "@/lib/news";
import { CardTitle, Kicker, type HeadingLevel } from "./kicker";

/**
 * Ecclesios news — official announcements (D-032), kept visibly distinct from Explore posts
 * (social.md S-007): gold edge, megaphone, "Ecclesios" label. No reactions on news.
 */
export function NewsCard({
  n,
  at,
  level = 2,
  as: Tag = "article",
}: {
  n: NewsSummary;
  /** Feed time; the News list shows the publish date instead. */
  at?: string;
  level?: HeadingLevel;
  as?: "article" | "li";
}) {
  return (
    <Tag className="card post c-card c-news">
      <Link to={`/news/${n.slug}`} className="c-link">
        <Kicker
          icon={
            n.pinned ? (
              <Pin className="ic" aria-label="Pinned" />
            ) : (
              <Megaphone className="ic" aria-hidden />
            )
          }
          at={at}
        >
          Ecclesios · {CATEGORY_LABEL[n.category]}
          {!at && n.publishedAt ? ` · ${shortDate(n.publishedAt)}` : ""}
        </Kicker>
        <CardTitle level={level}>{n.title}</CardTitle>
        <p className="post-text">{n.summary}</p>
      </Link>
    </Tag>
  );
}
