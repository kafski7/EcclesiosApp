import { SaintPortrait } from "@/components/saints/saint-portrait";
import { ArrowLeft, UserRound } from "lucide-react";
import { TextSize, useReadScale } from "@/components/reader/text-size";
import { ShareButton } from "@/components/ui/share-button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { feastLabel, RANK_LABEL, useSaint } from "@/lib/saints";

/** One saint (functionality §3.3): feast, patronage, life. */
export function SaintPage() {
  const { slug } = useParams();
  const q = useSaint(slug);
  const readScale = useReadScale();

  return (
    <div className="content-narrow mx-auto" style={readScale}>
      <div className="reader-top">
        <Link to="/saints" className="link">
          <ArrowLeft className="ic" aria-hidden /> All saints
        </Link>
        <TextSize />
      </div>
      {q.isPending ? <Skeleton variant="page" label="Loading the saint" /> : null}
      {q.isError ? (
        q.error instanceof ApiClientError && q.error.code === "SAINT_NOT_FOUND" ? (
          <EmptyState icon={UserRound} title="We couldn't find that saint" />
        ) : (
          <ErrorState
            title="This page could not be loaded"
            error={q.error}
            onRetry={() => q.refetch()}
            retrying={q.isRefetching}
          />
        )
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
          {/* Saints can be shared, not liked or saved (no reaction kind for saints yet). */}
          <div className="reader-actions">
            <ShareButton title={q.data.name} href={`/saints/${q.data.slug}`} />
          </div>
        </article>
      ) : null}
    </div>
  );
}
