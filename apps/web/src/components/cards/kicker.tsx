import type { ReactNode } from "react";
import { ago } from "@/lib/news";

/** The small line above a card title: icon · label · (time ago). Card family (D-043). */
export function Kicker({
  icon,
  children,
  at,
}: {
  icon?: ReactNode;
  children: ReactNode;
  at?: string | null;
}) {
  return (
    <span className="feed-kicker">
      {icon}
      <span>{children}</span>
      {at ? (
        <>
          <span aria-hidden>·</span>
          <time dateTime={at}>{ago(at)}</time>
        </>
      ) : null}
    </span>
  );
}

/** h2 on section pages, h3 inside the Home feed (under its own heading). */
export type HeadingLevel = 2 | 3;
export function CardTitle({ level = 2, children }: { level?: HeadingLevel; children: ReactNode }) {
  const H = level === 2 ? "h2" : "h3";
  return <H className="post-title">{children}</H>;
}
