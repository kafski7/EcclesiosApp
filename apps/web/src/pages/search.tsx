import {
  BookMarked,
  Compass,
  GraduationCap,
  Library,
  Mic,
  Music,
  Search as SearchIcon,
  User,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useActiveTranslation, useBibleSearch, chapterPath } from "@/lib/bible";
import { useBooks } from "@/lib/books";
import { useFeed } from "@/lib/explore";
import { useHymnSearch } from "@/lib/hymnal";
import { usePodcasts } from "@/lib/podcasts";
import { feastLabel, useSaints } from "@/lib/saints";
import { isSearchable, normalizeQuery, SEARCH_MIN, sectionSearchPath } from "@/lib/social-shell";
import { useTeachings } from "@/lib/teachings";

/** Results shown per section before "See all" (the section's own page). */
const PER_SECTION = 5;

/**
 * Unified search results (docs/social.md §9.11, D-042), opened from the one top-bar search.
 * Interim client-side fan-out over each section's existing public search endpoint — public
 * content only, never CMS records. A single server-side endpoint replaces this in Phase 9.
 */
export function SearchPage() {
  const [params] = useSearchParams();
  const q = normalizeQuery(params.get("q"));

  return (
    <div className="content-narrow mx-auto" style={{ maxWidth: 860 }}>
      <header className="page-head">
        <h1 className="page-title">{q ? <>Results for “{q}”</> : "Search"}</h1>
        <p className="page-sub">
          Saints, hymns, teachings, podcasts, Explore, books and the Bible.
        </p>
      </header>

      {!isSearchable(q) ? (
        <div className="card rail-card search-empty" role="status">
          <SearchIcon className="ic" aria-hidden />
          <p className="small muted" style={{ margin: 0 }}>
            {q
              ? `Type at least ${SEARCH_MIN} characters to search.`
              : "Use the search box at the top to look across Ecclesios — try a saint, a hymn number such as “NCH 56”, or a word from Scripture."}
          </p>
        </div>
      ) : (
        <div className="search-sections" key={q}>
          <SaintsResults q={q} />
          <HymnResults q={q} />
          <TeachingResults q={q} />
          <PodcastResults q={q} />
          <ExploreResults q={q} />
          <BookResults q={q} />
          <BibleResults q={q} />
        </div>
      )}
    </div>
  );
}

interface Row {
  key: string;
  to: string;
  title: ReactNode;
  meta?: ReactNode;
}

/** One results group: loading, error, empty and the first few rows (social.md §11.4). */
function Group({
  title,
  icon: Icon,
  rows,
  pending,
  error,
  seeAll,
  onRetry,
}: {
  title: string;
  icon: LucideIcon;
  rows: Row[];
  pending: boolean;
  error: boolean;
  seeAll: string | null;
  onRetry?: () => unknown;
}) {
  return (
    <section className="card rail-card search-group" aria-label={title} aria-busy={pending}>
      <div className="rail-head">
        <h2 className="rail-title">
          <Icon className="ic" aria-hidden /> {title}
        </h2>
        {seeAll && rows.length ? (
          <Link className="link small" to={seeAll}>
            See all
          </Link>
        ) : null}
      </div>
      {pending ? (
        <ul className="search-skeleton" aria-hidden>
          <li />
          <li />
        </ul>
      ) : error ? (
        <p className="small muted search-retry">
          {title} could not be searched just now.{" "}
          {onRetry ? (
            <button type="button" className="link" onClick={() => void onRetry()}>
              Try again
            </button>
          ) : null}
        </p>
      ) : !rows.length ? (
        <p className="small muted">No matches.</p>
      ) : (
        <ul className="search-hits">
          {rows.slice(0, PER_SECTION).map((r) => (
            <li key={r.key}>
              <Link to={r.to}>
                <b>{r.title}</b>
                {r.meta ? <p className="post-text small muted">{r.meta}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SaintsResults({ q }: { q: string }) {
  const r = useSaints(q, null);
  const rows = (r.data?.items ?? []).map((s) => ({
    key: s.slug,
    to: `/saints/${s.slug}`,
    title: s.name,
    meta: `${feastLabel(s.feastMonth, s.feastDay)} · ${s.summary}`,
  }));
  return (
    <Group
      title="Saints"
      icon={User}
      rows={rows}
      pending={r.isPending}
      error={r.isError}
      onRetry={() => r.refetch()}
      seeAll={sectionSearchPath("/saints", q)}
    />
  );
}

function HymnResults({ q }: { q: string }) {
  const r = useHymnSearch({ q, book: null, tag: null });
  const rows = (r.data?.pages[0]?.items ?? []).map((h) => ({
    key: h.slug,
    to: `/hymnal/${h.slug}`,
    title: h.title,
    meta: [h.numbers.map((n) => `${n.book} ${n.number}`).join(" · "), h.firstLine]
      .filter(Boolean)
      .join(" — "),
  }));
  return (
    <Group
      title="Hymns"
      icon={Music}
      rows={rows}
      pending={r.isPending}
      error={r.isError}
      onRetry={() => r.refetch()}
      seeAll={sectionSearchPath("/hymnal", q)}
    />
  );
}

function TeachingResults({ q }: { q: string }) {
  const r = useTeachings(q, null);
  const rows = (r.data?.pages[0]?.items ?? []).map((t) => ({
    key: t.slug,
    to: `/teachings/${t.slug}`,
    title: t.title,
    meta: `${t.readingMinutes} min read · ${t.summary}`,
  }));
  return (
    <Group
      title="Teachings"
      icon={GraduationCap}
      rows={rows}
      pending={r.isPending}
      error={r.isError}
      onRetry={() => r.refetch()}
      seeAll={sectionSearchPath("/teachings", q)}
    />
  );
}

function PodcastResults({ q }: { q: string }) {
  const r = usePodcasts(q);
  const rows = (r.data?.pages[0]?.items ?? []).map((p) => ({
    key: p.slug,
    to: `/podcasts/${p.slug}`,
    title: p.title,
    meta: `${p.episodeCount} episode${p.episodeCount === 1 ? "" : "s"} · ${p.summary}`,
  }));
  return (
    <Group
      title="Podcasts"
      icon={Mic}
      rows={rows}
      pending={r.isPending}
      error={r.isError}
      onRetry={() => r.refetch()}
      seeAll={sectionSearchPath("/podcasts", q)}
    />
  );
}

function ExploreResults({ q }: { q: string }) {
  const r = useFeed("ALL", q);
  const rows = (r.data?.pages[0]?.items ?? []).map((p) => ({
    key: p.id,
    to: `/explore/posts/${p.id}`,
    title: p.title,
    meta: p.summary,
  }));
  return (
    <Group
      title="Explore"
      icon={Compass}
      rows={rows}
      pending={r.isPending}
      error={r.isError}
      onRetry={() => r.refetch()}
      seeAll={sectionSearchPath("/explore", q)}
    />
  );
}

function BookResults({ q }: { q: string }) {
  const r = useBooks({ q, category: null, price: null });
  const rows = (r.data?.pages[0]?.items ?? []).map((b) => ({
    key: b.slug,
    to: `/books/${b.slug}`,
    title: b.title,
    meta: b.authorName,
  }));
  return (
    <Group
      title="Books"
      icon={Library}
      rows={rows}
      pending={r.isPending}
      error={r.isError}
      onRetry={() => r.refetch()}
      seeAll={sectionSearchPath("/books", q)}
    />
  );
}

function BibleResults({ q }: { q: string }) {
  const { active, isPending: tPending, isError: tError } = useActiveTranslation();
  const r = useBibleSearch(active?.code, q);
  const hits = r.data?.items ?? [];
  const rows = hits.map((h) => ({
    key: `${h.book}${h.chapter}:${h.verse}`,
    to: `${chapterPath(h.book, h.chapter)}?ref=${encodeURIComponent(`${h.bookName} ${h.chapter}:${h.verse}`)}`,
    title: `${h.bookName} ${h.chapter}:${h.verse}`,
    meta: h.text,
  }));
  // The Bible page keeps ?q= when a chapter is in the path, so "See all" opens the first hit's chapter.
  const first = hits[0];
  const seeAll = first
    ? `${chapterPath(first.book, first.chapter)}?q=${encodeURIComponent(q)}`
    : null;
  return (
    <Group
      title={active ? `Bible · ${active.code}` : "Bible"}
      icon={BookMarked}
      rows={rows}
      pending={tPending || (!!active && r.isPending)}
      error={tError || r.isError || (!tPending && !active)}
      onRetry={r.isError ? () => r.refetch() : undefined}
      seeAll={seeAll}
    />
  );
}
