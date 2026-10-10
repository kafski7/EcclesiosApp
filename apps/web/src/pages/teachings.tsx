import { ArrowLeft, Clock, GraduationCap, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { parseLesson } from "@ecclesios/shared/domain";
import { Lesson } from "@/components/teachings/lesson";
import { ApiClientError } from "@/lib/api";
import { TeachingCard } from "@/components/cards";
import { EngageBar } from "@/components/engage/engage-bar";
import { TextSize, useReadScale } from "@/components/reader/text-size";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
import { minutesLabel, useTeaching, useTeachings, useTeachingTopics } from "@/lib/teachings";

/** Catechesis library: topics, search, list (functionality §3.7, D-030). Filters live in the URL. */
export function TeachingsPage() {
  const [params, setParams] = useSearchParams();
  const topic = params.get("topic");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced.trim()) next.set("q", debounced.trim());
    else next.delete("q");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [debounced, params, setParams]);

  const topics = useTeachingTopics();
  const list = useTeachings(debounced, topic);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const pick = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug && slug !== topic) next.set("topic", slug);
    else next.delete("topic");
    setParams(next);
  };

  return (
    <div className="content-narrow mx-auto" style={{ maxWidth: 980 }}>
      <header className="page-head">
        <h1 className="page-title">Teachings</h1>
        <p className="page-sub">
          Learn the faith: the sacraments, prayer, the moral life, the Church's social teaching and
          more.
        </p>
      </header>

      <label className="search mb-5">
        <Search className="ic" aria-hidden />
        <input
          type="search"
          placeholder="Search teachings, e.g. Eucharist, confession, prayer"
          aria-label="Search teachings"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      {topics.data?.items.length ? (
        <nav className="topic-grid" aria-label="Topics">
          {topics.data.items.map((t) => (
            <button
              key={t.slug}
              type="button"
              className="card topic-tile text-left"
              aria-current={topic === t.slug}
              onClick={() => pick(t.slug)}
            >
              <b>{t.name}</b>
              <small>{t.description}</small>
              <small>
                {t.teachingCount} teaching{t.teachingCount === 1 ? "" : "s"}
              </small>
            </button>
          ))}
        </nav>
      ) : null}

      {topic ? (
        <p className="small muted mb-3">
          Showing {topics.data?.items.find((t) => t.slug === topic)?.name ?? topic} ·{" "}
          <button type="button" className="link" onClick={() => pick(null)}>
            show all
          </button>
        </p>
      ) : null}
      {list.isError ? (
        <ErrorState
          title="The teachings could not be loaded"
          error={list.error}
          onRetry={() => list.refetch()}
          retrying={list.isRefetching}
        />
      ) : null}
      {list.isPending ? <Skeleton variant="cards" label="Loading teachings" /> : null}
      {list.isSuccess && !items.length ? (
        <EmptyState icon={GraduationCap} title="No teachings found">
          {debounced.trim() || topic
            ? "Try other words, or show all topics."
            : "Teachings will appear here once they're published."}
        </EmptyState>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((t, i) => (
          // Newest first: with no search or topic, the first one is shown as "Latest" (D-045).
          <TeachingCard
            key={t.slug}
            t={t}
            as="li"
            latest={i === 0 && !debounced.trim() && !topic}
          />
        ))}
      </ul>
      <LoadMore q={list} label="More teachings" />
    </div>
  );
}

/** One lesson: reading view, references, related teachings. */
export function TeachingPage() {
  const { slug } = useParams();
  const q = useTeaching(slug);
  const blocks = useMemo(() => (q.data ? parseLesson(q.data.body) : []), [q.data]);
  const readScale = useReadScale();

  if (q.isPending)
    return (
      <div className="content-narrow mx-auto">
        <Skeleton variant="page" label="Loading the teaching" />
      </div>
    );
  if (q.isError)
    return (
      <div className="content-narrow mx-auto">
        {q.error instanceof ApiClientError && q.error.code === "TEACHING_NOT_FOUND" ? (
          <EmptyState
            icon={GraduationCap}
            title="We couldn't find that teaching"
            action={
              <Link to="/teachings" className="btn btn-outline btn-sm">
                All teachings
              </Link>
            }
          />
        ) : (
          <ErrorState
            title="This teaching could not be loaded"
            error={q.error}
            onRetry={() => q.refetch()}
            retrying={q.isRefetching}
          />
        )}
      </div>
    );
  const t = q.data;

  return (
    <div className="content-narrow mx-auto" style={readScale}>
      <div className="reader-top">
        <Link to="/teachings" className="link">
          <ArrowLeft className="ic" aria-hidden /> Teachings
        </Link>
        <TextSize />
      </div>
      <article className="card post" style={{ padding: "28px 30px" }}>
        <div className="lit-chips mb-2">
          {t.topics.map((x) => (
            <Link key={x.slug} to={`/teachings?topic=${x.slug}`} className="chip chip-burgundy">
              {x.name}
            </Link>
          ))}
          <span className="chip chip-gold">
            <Clock className="ic" style={{ width: 13, height: 13 }} aria-hidden />{" "}
            {minutesLabel(t.readingMinutes)}
          </span>
        </div>
        <h1 className="page-title" style={{ marginBottom: 6 }}>
          {t.title}
        </h1>
        <p className="page-sub mb-4">{t.summary}</p>
        <Lesson blocks={blocks} />
        <EngageBar
          kind="TEACHING"
          id={t.id}
          title={t.title}
          href={`/teachings/${t.slug}`}
          size="md"
        />
        {t.reviewedBy || t.source ? (
          <p className="all-credits">{[t.reviewedBy, t.source].filter(Boolean).join(" · ")}</p>
        ) : null}
      </article>

      {t.related.length ? (
        <section className="mt-6" aria-label="Related teachings">
          <h2 className="rail-title mb-3">Related teachings</h2>
          <ul className="flex flex-col gap-2">
            {t.related.map((r) => (
              <li key={r.slug}>
                <Link to={`/teachings/${r.slug}`} className="card rail-card block">
                  <b>{r.title}</b>
                  <p className="small muted">{r.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
