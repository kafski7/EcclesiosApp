import { SaintPortrait } from "@/components/saints/saint-portrait";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { feastLabel, RANK_LABEL, useSaint } from "@/lib/saints";

/** One saint (functionality §3.3): feast, patronage, life. */
export function SaintPage() {
  const { slug } = useParams();
  const q = useSaint(slug);

  return (
    <div className="content-narrow mx-auto">
      <Link to="/saints" className="link mb-4">
        <ArrowLeft className="ic" aria-hidden /> All saints
      </Link>
      {q.isPending ? <p className="muted small">Loading…</p> : null}
      {q.isError ? (
        <div className="card rail-card">
          {q.error instanceof ApiClientError && q.error.code === "SAINT_NOT_FOUND"
            ? "We couldn't find that saint."
            : "This page could not be loaded."}
        </div>
      ) : null}
      {q.data ? (
        <article className="card post" style={{ padding: 28 }}>
          <div className="saint-card" style={{ padding: 0 }}>
            <SaintPortrait name={q.data.name} imageUrl={q.data.imageUrl} size="lg" />
            <div className="saint-body">
              <p className="saint-kicker">{RANK_LABEL[q.data.rank]}</p>
              <h1 className="saint-name">{q.data.name}</h1>
              {q.data.title ? <p className="saint-date">{q.data.title}</p> : null}
            </div>
          </div>
          <dl className="saint-facts">
            <dt>Feast</dt>
            <dd>{feastLabel(q.data.feastMonth, q.data.feastDay)}</dd>
            {q.data.born ? (
              <>
                <dt>Born</dt>
                <dd>{q.data.born}</dd>
              </>
            ) : null}
            {q.data.died ? (
              <>
                <dt>Died</dt>
                <dd>{q.data.died}</dd>
              </>
            ) : null}
            {q.data.patronage.length ? (
              <>
                <dt>Patron of</dt>
                <dd>{q.data.patronage.join(", ")}</dd>
              </>
            ) : null}
          </dl>
          <div className="saint-bio">
            {q.data.biography.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {q.data.source ? <p className="all-credits">{q.data.source}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
