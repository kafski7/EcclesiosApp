import { parseLesson } from "@ecclesios/shared/domain";
import { ArrowLeft, ExternalLink, Megaphone } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { NewsCard } from "@/components/cards";
import { TextSize, useReadScale } from "@/components/reader/text-size";
import { ShareButton } from "@/components/ui/share-button";
import { Lesson } from "@/components/teachings/lesson";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
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
      {list.isPending ? <Skeleton variant="cards" label="Loading news" /> : null}
      {list.isError ? (
        <ErrorState
          title="The news could not be loaded"
          error={list.error}
          onRetry={() => list.refetch()}
          retrying={list.isRefetching}
        />
      ) : null}
      {list.isSuccess && !items.length ? <EmptyState icon={Megaphone} title="No news yet" /> : null}
      <ul className="flex flex-col gap-3">
        {items.map((n) => (
          <NewsCard key={n.slug} n={n} as="li" />
        ))}
      </ul>
      <LoadMore q={list} label="More news" />
    </div>
  );
}

export function NewsItemPage() {
  const { slug } = useParams();
  const q = useNews(slug);
  const blocks = useMemo(() => (q.data ? parseLesson(q.data.body) : []), [q.data]);
  const readScale = useReadScale();
  if (q.isPending)
    return (
      <div className="content-narrow mx-auto">
        <Skeleton variant="page" label="Loading" />
      </div>
    );
  if (q.isError)
    return (
      <div className="content-narrow mx-auto">
        {q.error instanceof ApiClientError && q.error.code === "NEWS_NOT_FOUND" ? (
          <EmptyState
            icon={Megaphone}
            title="We couldn't find that news item"
            action={
              <Link to="/news" className="btn btn-outline btn-sm">
                All news
              </Link>
            }
          />
        ) : (
          <ErrorState
            title="This page could not be loaded"
            error={q.error}
            onRetry={() => q.refetch()}
            retrying={q.isRefetching}
          />
        )}
      </div>
    );
  const n = q.data;
  return (
    <div className="content-narrow mx-auto" style={readScale}>
      <div className="reader-top">
        <Link to="/news" className="link">
          <ArrowLeft className="ic" aria-hidden /> All news
        </Link>
        <TextSize />
      </div>
      <article className="card post" style={{ padding: "28px 30px" }}>
        <span className="feed-kicker">
          <Megaphone className="ic" aria-hidden /> {CATEGORY_LABEL[n.category]} ·{" "}
          {shortDate(n.publishedAt)}
        </span>
        {n.coverUrl ? (
          <img
            src={n.coverUrl}
            alt=""
            className="mt-3"
            style={{ borderRadius: 12, width: "100%" }}
          />
        ) : null}
        <h1 className="page-title" style={{ margin: "10px 0 6px" }}>
          {n.title}
        </h1>
        <p className="page-sub mb-4">{n.summary}</p>
        {blocks.length ? <Lesson blocks={blocks} /> : null}
        {n.link ? (
          <a
            href={n.link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm mt-4"
          >
            {n.link.label} <ExternalLink className="ic" aria-hidden />
          </a>
        ) : null}
        <div className="reader-actions">
          <ShareButton title={n.title} href={`/news/${n.slug}`} />
        </div>
      </article>
    </div>
  );
}
