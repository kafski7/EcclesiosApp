import type { Block, Inline } from "@ecclesios/shared/domain";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { bibleHref } from "@/lib/readings";

/**
 * Renders a lesson from parsed blocks (D-030). Plain React elements only — no HTML strings,
 * so lesson text can never inject markup.
 */
export function Lesson({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div className="lesson">
      {blocks.map((b, i) => {
        if (b.type === "heading")
          return b.level === 2 ? (
            <h2 key={i}>
              <Spans xs={b.text} />
            </h2>
          ) : (
            <h3 key={i}>
              <Spans xs={b.text} />
            </h3>
          );
        if (b.type === "quote")
          return (
            <blockquote key={i} className="post-quote">
              <Spans xs={b.text} />
              {b.cite ? <cite>{b.cite}</cite> : null}
            </blockquote>
          );
        if (b.type === "list") {
          const L = b.ordered ? "ol" : "ul";
          return (
            <L key={i}>
              {b.items.map((it, j) => (
                <li key={j}>
                  <Spans xs={it} />
                </li>
              ))}
            </L>
          );
        }
        return (
          <p key={i}>
            <Spans xs={b.text} />
          </p>
        );
      })}
    </div>
  );
}

function Spans({ xs }: { xs: readonly Inline[] }) {
  return (
    <>
      {xs.map((x, i) => {
        switch (x.t) {
          case "strong":
            return <strong key={i}>{x.v}</strong>;
          case "em":
            return <em key={i}>{x.v}</em>;
          case "bible":
            return (
              <Link key={i} to={bibleHref(x.ref)} className="ref ref-bible">
                {x.ref}
              </Link>
            );
          case "ccc":
            // The Catechism text is not reproduced; the paragraph number is the reference (D-030).
            return (
              <span
                key={i}
                className="ref ref-ccc"
                title={`Catechism of the Catholic Church, paragraph ${x.n}`}
              >
                CCC {x.n}
              </span>
            );
          case "teaching":
            return (
              <Link key={i} to={`/teachings/${x.slug}`} className="link">
                {x.label ?? x.slug.replace(/-/g, " ")}
              </Link>
            );
          default:
            return <Fragment key={i}>{x.v}</Fragment>;
        }
      })}
    </>
  );
}
