import type { TeachingSummary } from "@ecclesios/shared";
import { Clock, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { EngageBar } from "@/components/engage/engage-bar";
import { minutesLabel } from "@/lib/teachings";
import { CardTitle, Kicker, type HeadingLevel } from "./kicker";

/** Teaching — one card for the Teachings list, Home feed and anywhere else (D-043). */
export function TeachingCard({
  t,
  at,
  fresh = false,
  level = 2,
  as: Tag = "article",
  latest = false,
}: {
  t: TeachingSummary;
  /** Feed time ("2h"); omitted on the Teachings list. */
  at?: string;
  /** "New teaching · …" in the feed. */
  fresh?: boolean;
  level?: HeadingLevel;
  as?: "article" | "li";
  /** Highlighted as the newest teaching at the top of the list (D-045). */
  latest?: boolean;
}) {
  const href = `/teachings/${t.slug}`;
  const topics = t.topics.map((x) => x.name).join(" · ");
  return (
    <Tag className={`card post c-card${latest ? " c-latest" : ""}`}>
      <Link to={href} className="c-link">
        <Kicker icon={<GraduationCap className="ic" aria-hidden />} at={at}>
          {fresh
            ? `New teaching${topics ? ` · ${topics}` : ""}`
            : latest
              ? `Latest${topics ? ` · ${topics}` : ""}`
              : topics || "Teaching"}
        </Kicker>
        <CardTitle level={level}>{t.title}</CardTitle>
        <p className="post-text">{t.summary}</p>
        <span className="c-meta">
          <Clock className="ic" aria-hidden /> {minutesLabel(t.readingMinutes)}
        </span>
      </Link>
      <EngageBar kind="TEACHING" id={t.id} title={t.title} href={href} />
    </Tag>
  );
}
