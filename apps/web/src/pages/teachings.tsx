import { ArrowLeft, Clock, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { parseLesson } from "@ecclesios/shared/domain";
import { Lesson } from "@/components/teachings/lesson";
import { ApiClientError } from "@/lib/api";
import { EngageBar } from "@/components/engage/engage-bar";
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
        <p className="page-sub">Learn the faith: the sacraments, prayer, the moral life, the Church's social teaching and more.</p>
      </header>

      <label className="search mb-5">
        <Search className="ic" aria-hidden />
        <input type="search" placeholder="Search teachings, e.g. Eucharist, confession, prayer" aria-label="Search teachings" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {topics.data?.items.length ? (
        <nav className="topic-grid" aria-label="Topics">
          {topics.data.items.map((t) => (
            <button key={t.slug} type="button" className="card topic-tile text-left" aria-current={topic === t.slug} onClick={() => pick(t.slug)}>
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
      {list.isError ? <p className="card rail-card">The teachings could not be loaded.</p> : null}
      {list.isPending ? <p className="muted small">Loading…</p> : null}
      {list.isSuccess && !items.length ? <p className="card rail-card muted">No teachings found.</p> : null}

      <ul className="flex flex-col gap-3">
        {items.map((t) => (
          <li key={t.slug} className="card post">
            <Link to={`/teachings/${t.slug}`} className="block">
              <span className="saint-kicker">{t.topics.map((x) => x.name).join(" · ")}</span>
              <h2 className="post-title" style={{ marginTop: 6 }}>{t.title}</h2>
              <p className="post-text">{t.summary}</p>
              <span className="small muted inline-flex items-center gap-1 mt-2">
                <Clock className="ic" style={{ width: 14, height: 14 }} aria-hidden /> {minutesLabel(t.readingMinutes)}
              </span>
            </Link>
            <EngageBar kind="TEACHING" id={t.id} title={t.title} href={`/teachings/${t.slug}`} />
          </li>
        ))}
      </ul>
      {list.hasNextPage ? (
        <div className="mt-5 text-center">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? "Loading…" : "More teachings"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** One lesson: reading view, references, related teachings. */
export function TeachingPage() {
  const { slug } = useParams();
  const q = useTeaching(slug);
  const blocks = useMemo(() => (q.data ? parseLesson(q.data.body) : []), [q.data]);

  if (q.isPending) return <p className="content-narrow mx-auto muted small">Loading…</p>;
  if (q.isError)
    return (
      <p className="content-narrow mx-auto card rail-card">
        {q.error instanceof ApiClientError && q.error.code === "TEACHING_NOT_FOUND" ? "We couldn't find that teaching." : "This teaching could not be loaded."}
      </p>
    );
  const t = q.data;

  return (
    <div className="content-narrow mx-auto">
      <Link to="/teachings" className="link mb-4">
        <ArrowLeft className="ic" aria-hidden /> Teachings
      </Link>
      <article className="card post" style={{ padding: "28px 30px" }}>
        <div className="lit-chips mb-2">
          {t.topics.map((x) => (
            <Link key={x.slug} to={`/teachings?topic=${x.slug}`} className="chip chip-burgundy">
              {x.name}
            </Link>
          ))}
          <span className="chip chip-gold">
            <Clock className="ic" style={{ width: 13, height: 13 }} aria-hidden /> {minutesLabel(t.readingMinutes)}
          </span>
        </div>
        <h1 className="page-title" style={{ marginBottom: 6 }}>{t.title}</h1>
        <p className="page-sub mb-4">{t.summary}</p>
        <Lesson blocks={blocks} />
        <EngageBar kind="TEACHING" id={t.id} title={t.title} href={`/teachings/${t.slug}`} size="md" />
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
