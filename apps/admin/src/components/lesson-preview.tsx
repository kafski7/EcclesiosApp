import type { Inline, parseLesson } from "@ecclesios/shared/domain";

/** Admin preview — same blocks as the web reader, without router links. */
export function Preview({ blocks }: { blocks: ReturnType<typeof parseLesson> }) {
  const span = (xs: readonly Inline[]) =>
    xs.map((x, i) =>
      x.t === "strong" ? (
        <strong key={i}>{x.v}</strong>
      ) : x.t === "em" ? (
        <em key={i}>{x.v}</em>
      ) : x.t === "bible" ? (
        <span key={i} className="badge text-bg-light border mx-1">{x.ref}</span>
      ) : x.t === "ccc" ? (
        <span key={i} className="badge text-bg-warning mx-1">CCC {x.n}</span>
      ) : x.t === "teaching" ? (
        <u key={i}>{x.label ?? x.slug}</u>
      ) : (
        <span key={i}>{x.v}</span>
      ),
    );
  return (
    <div style={{ lineHeight: 1.75 }}>
      {blocks.map((b, i) =>
        b.type === "heading" ? (
          b.level === 2 ? <h3 key={i} style={{ fontSize: 18, fontWeight: 700, marginTop: 18 }}>{span(b.text)}</h3> : <h4 key={i} style={{ fontSize: 16, fontWeight: 700 }}>{span(b.text)}</h4>
        ) : b.type === "quote" ? (
          <blockquote key={i} className="post-quote">
            {span(b.text)}
            {b.cite ? <cite>{b.cite}</cite> : null}
          </blockquote>
        ) : b.type === "list" ? (
          b.ordered ? (
            <ol key={i}>{b.items.map((it, j) => <li key={j}>{span(it)}</li>)}</ol>
          ) : (
            <ul key={i}>{b.items.map((it, j) => <li key={j}>{span(it)}</li>)}</ul>
          )
        ) : (
          <p key={i}>{span(b.text)}</p>
        ),
      )}
    </div>
  );
}
