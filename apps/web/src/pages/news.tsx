import { parseLesson } from "@ecclesios/shared/domain";
import { ArrowLeft, ExternalLink, Megaphone, Pin } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Lesson } from "@/components/teachings/lesson";
import { ApiClientError } from "@/lib/api";
import { CATEGORY_LABEL, shortDate, useNews, useNewsList } from "@/lib/news";

/** Ecclesios news (D-032): official announcements, pinned first. */
export function NewsPage() {
  const list = useNewsList();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="content-narrow mx-auto">
      <header className="page-head">
        <h1 className="page-title">Ecclesios news</h1>
        <p className="page-sub">Announcements and updates from the Ecclesios team.</p>
      </header>
      {list.isPending ? <p className="muted small">Loading…</p> : null}
      {list.isError ? <p className="card rail-card">The news could not be loaded.</p> : null}
      {list.isSuccess && !items.length ? <p className="card rail-card muted">No news yet.</p> : null}
      <ul className="flex flex-col gap-3">
        {items.map((n) => (
          <li key={n.slug}>
            <Link to={`/news/${n.slug}`} className="card post block">
              <span className="feed-kicker">
                {n.pinned ? <Pin className="ic" aria-label="Pinned" /> : <Megaphone className="ic" aria-hidden />}
                {CATEGORY_LABEL[n.category]} · {shortDate(n.publishedAt)}
              </span>
              <h2 className="post-title">{n.title}</h2>
              <p className="post-text">{n.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
      {list.hasNextPage ? (
        <div className="mt-5 text-center">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            More news
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function NewsItemPage() {
  const { slug } = useParams();
  const q = useNews(slug);
  const blocks = useMemo(() => (q.data ? parseLesson(q.data.body) : []), [q.data]);
  if (q.isPending) return <p className="content-narrow mx-auto muted small">Loading…</p>;
  if (q.isError)
    return (
      <p className="content-narrow mx-auto card rail-card">
        {q.error instanceof ApiClientError && q.error.code === "NEWS_NOT_FOUND" ? "We couldn't find that news item." : "This page could not be loaded."}
      </p>
    );
  const n = q.data;
  return (
    <div className="content-narrow mx-auto">
      <Link to="/news" className="link mb-4">
        <ArrowLeft className="ic" aria-hidden /> All news
      </Link>
      <article className="card post" style={{ padding: "28px 30px" }}>
        <span className="feed-kicker">
          <Megaphone className="ic" aria-hidden /> {CATEGORY_LABEL[n.category]} · {shortDate(n.publishedAt)}
        </span>
        {n.coverUrl ? <img src={n.coverUrl} alt="" className="mt-3" style={{ borderRadius: 12, width: "100%" }} /> : null}
        <h1 className="page-title" style={{ margin: "10px 0 6px" }}>{n.title}</h1>
        <p className="page-sub mb-4">{n.summary}</p>
        {blocks.length ? <Lesson blocks={blocks} /> : null}
        {n.link ? (
          <a href={n.link.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm mt-4">
            {n.link.label} <ExternalLink className="ic" aria-hidden />
          </a>
        ) : null}
      </article>
    </div>
  );
}
