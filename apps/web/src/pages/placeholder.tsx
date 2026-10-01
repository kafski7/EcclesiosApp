import type { ReactNode } from "react";

/** Temporary page body until the section is built. Uses the kit page head + card. */
export function Placeholder({
  title,
  intro,
  coming,
  children,
}: {
  title: string;
  intro: string;
  coming: string;
  children?: ReactNode;
}) {
  return (
    <div className="content-narrow mx-auto">
      <div className="page-head">
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{intro}</p>
      </div>
      <div className="card rail-card">
        <span className="chip chip-gold">
          <span className="chip-dot" /> Coming soon
        </span>
        <p className="post-text mt-3">{coming}</p>
      </div>
      {children}
    </div>
  );
}
