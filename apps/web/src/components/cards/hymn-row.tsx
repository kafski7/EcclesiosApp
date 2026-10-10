import type { HymnSummary } from "@ecclesios/shared";
import { FileText, Headphones, Music } from "lucide-react";
import { Link } from "react-router-dom";
import { EngageBar } from "@/components/engage/engage-bar";

/**
 * Hymn in a list: book + number badge (the chosen book's number when filtering, D-026),
 * title, first line, audio / notation icons, reactions (D-043).
 */
export function HymnRow({ h, book }: { h: HymnSummary; book?: string | null }) {
  const n = (book && h.numbers.find((x) => x.book === book)) || h.numbers[0];
  const href = `/hymnal/${h.slug}`;
  const has = [h.hasAudio ? "recording" : null, h.hasNotation ? "notation" : null]
    .filter(Boolean)
    .join(" and ");
  return (
    <li>
      <Link
        to={href}
        className="hymn-row"
        aria-label={`${n ? `${n.book} ${n.number}, ` : ""}${h.title}${has ? `, has ${has}` : ""}`}
      >
        <span className="hymn-num" aria-hidden>
          {n ? (
            <>
              <small>{n.book}</small>
              {n.number}
            </>
          ) : (
            <Music className="ic" />
          )}
        </span>
        <span className="min-w-0" aria-hidden>
          <span className="hymn-title block truncate">{h.title}</span>
          <span className="hymn-meta block truncate">
            {h.title !== h.firstLine ? h.firstLine : h.tags.join(" · ")}
          </span>
        </span>
        <span className="hymn-icons" aria-hidden>
          {h.hasAudio ? <Headphones className="ic" /> : null}
          {h.hasNotation ? <FileText className="ic" /> : null}
        </span>
      </Link>
      <EngageBar kind="HYMN" id={h.id} title={h.title} href={href} />
    </li>
  );
}
