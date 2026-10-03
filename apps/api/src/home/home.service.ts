import { Inject, Injectable } from "@nestjs/common";
import {
  follows,
  hymnBooks,
  hymnMedia,
  hymnNumbers,
  hymnPicks,
  hymns,
  hymnTags,
  hymnTunes,
  podcastEpisodes,
  podcastFollows,
  podcasts,
  postComments,
  posts,
  reactions,
  teachings,
} from "@ecclesios/db";
import type { FeedItem, HomeFeed, HomeSummary, HymnOfDay, Principal, WatchItem } from "@ecclesios/shared";
import {
  canOpenMedia,
  hymnDisplayTitle,
  hymnOfDay,
  mergeFeed,
  rankTrending,
  selectWatch,
  TRENDING_ACTIVITY_HOURS,
  TRENDING_WINDOW_DAYS,
  WATCH_PER_KIND_MAX,
  type FeedEntry,
} from "@ecclesios/shared/domain";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { ENV, listenerPaywall, type Env } from "../config/env";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { ExploreService } from "../explore/explore.service";
import { MediaService } from "../media/media.service";
import { NewsService } from "../news/news.service";
import { ReadingsService } from "../social/readings.service";
import { SaintsService } from "../social/saints.service";
import { TeachingsService } from "../social/teachings.service";

const FEED_PAGE = 15;
/** Public endpoints: no listener subscription yet (D-026). */
const PUBLIC_VIEWER = { staff: false, subscribed: false };

/** Home (functionality §3.1, D-033): today's summary, the right rail and the blended feed. */
@Injectable()
export class HomeService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly explore: ExploreService,
    private readonly news: NewsService,
    private readonly readings: ReadingsService,
    private readonly saints: SaintsService,
    private readonly teachingsSvc: TeachingsService,
    private readonly media: MediaService,
  ) {}

  // ------------------------------------------------------------------ summary + rail

  async summary(date: string, now = new Date()): Promise<HomeSummary> {
    const [day, saints, hymn, newsItems, trending, events, watch] = await Promise.all([
      this.readings.byDate(date),
      this.saints.today(date),
      this.hymnOfDay(date),
      this.news.current(3, now),
      this.trending(now),
      this.upcomingEvents(now),
      this.watchRow(now),
    ]);
    return {
      date,
      today: {
        season: day.season,
        color: day.color,
        celebration: day.celebration,
        gospel: day.readings.find((r) => r.kind === "GOSPEL")?.citation ?? null,
      },
      saint: saints.saint,
      hymn,
      news: newsItems,
      trending,
      events,
      watch,
    };
  }

  /**
   * Home "Watch" row (D-034): newest YouTube videos from published episodes, approved Explore
   * posts and hymnal media. Items behind the listener paywall are left out (D-026, D-029).
   */
  async watchRow(now: Date): Promise<WatchItem[]> {
    const paywall = listenerPaywall(this.env);
    const open = (access: "FREE" | "SUBSCRIBER") => canOpenMedia(access, PUBLIC_VIEWER, paywall);
    const take = WATCH_PER_KIND_MAX;
    const [eps, postRows, hymnRows] = await Promise.all([
      this.db
        .select({ e: podcastEpisodes, p: { slug: podcasts.slug, title: podcasts.title } })
        .from(podcastEpisodes)
        .innerJoin(podcasts, eq(podcasts.id, podcastEpisodes.podcastId))
        .where(
          and(
            eq(podcastEpisodes.status, "PUBLISHED"),
            eq(podcasts.isPublished, true),
            lte(podcastEpisodes.publishedAt, now),
            isNotNull(podcastEpisodes.youtubeId),
          ),
        )
        .orderBy(desc(podcastEpisodes.publishedAt))
        .limit(take * 2),
      this.db
        .select()
        .from(posts)
        .where(and(eq(posts.status, "APPROVED"), lte(posts.publishedAt, now), isNotNull(posts.youtubeId)))
        .orderBy(desc(posts.publishedAt))
        .limit(take * 2),
      this.db
        .select({ m: hymnMedia, h: { slug: hymns.slug, title: hymns.title, firstLine: hymns.firstLine } })
        .from(hymnMedia)
        .innerJoin(hymnTunes, eq(hymnTunes.id, hymnMedia.tuneId))
        .innerJoin(hymns, eq(hymns.id, hymnTunes.hymnId))
        .where(and(eq(hymnMedia.kind, "YOUTUBE"), eq(hymns.isPublished, true)))
        .orderBy(desc(hymnMedia.createdAt))
        .limit(take * 2),
    ]);
    const author = await this.explore.authors(postRows);
    // `at` is a Date while selecting, then serialised.
    type Candidate = Omit<WatchItem, "at"> & { at: Date };
    const candidates: Candidate[] = [
      ...eps
        .filter(({ e }) => open(e.access))
        .map(({ e, p }): Candidate => ({
          kind: "EPISODE",
          key: e.id,
          youtubeId: e.youtubeId!,
          title: e.title,
          source: p.title,
          href: `/podcasts/${p.slug}`,
          at: e.publishedAt!,
        })),
      ...postRows.map((r): Candidate => ({
        kind: "POST",
        key: r.id,
        youtubeId: r.youtubeId!,
        title: r.title,
        source: author(r).name,
        href: `/explore/posts/${r.id}`,
        at: r.publishedAt!,
      })),
      ...hymnRows
        .filter(({ m }) => open(m.access))
        .map(({ m, h }): Candidate => ({
          kind: "HYMN",
          key: m.id,
          youtubeId: m.youtubeId!,
          title: hymnDisplayTitle(h.title, h.firstLine),
          source: m.label ? `Hymnal · ${m.label}` : "Hymnal",
          href: `/hymnal/${h.slug}`,
          at: m.createdAt,
        })),
    ];
    return selectWatch(candidates).map((c) => ({ ...c, at: c.at.toISOString() }));
  }

  /** Pinned hymn for the date, else a season-appropriate pick (hymnOfDay, D-033). */
  async hymnOfDay(date: string): Promise<HymnOfDay | null> {
    const [rows, tags, [pick]] = await Promise.all([
      this.db.select({ id: hymns.id, slug: hymns.slug }).from(hymns).where(eq(hymns.isPublished, true)),
      this.db.select({ hymnId: hymnTags.hymnId, tag: hymnTags.tag }).from(hymnTags),
      this.db.select({ slug: hymns.slug }).from(hymnPicks).innerJoin(hymns, eq(hymns.id, hymnPicks.hymnId)).where(eq(hymnPicks.date, date)).limit(1),
    ]);
    const chosen = hymnOfDay(
      rows.map((r) => ({ ...r, tags: tags.filter((t) => t.hymnId === r.id).map((t) => t.tag) })),
      date,
      pick?.slug ?? null,
    );
    if (!chosen) return null;
    const [hRows, nums, audioRows] = await Promise.all([
      this.db.select().from(hymns).where(eq(hymns.id, chosen.id)).limit(1),
      this.db
        .select({ book: hymnBooks.code, number: hymnNumbers.number })
        .from(hymnNumbers)
        .innerJoin(hymnBooks, eq(hymnBooks.id, hymnNumbers.bookId))
        .where(eq(hymnNumbers.hymnId, chosen.id))
        .orderBy(asc(hymnBooks.sortOrder)),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(hymnMedia)
        .innerJoin(hymnTunes, eq(hymnTunes.id, hymnMedia.tuneId))
        .where(and(eq(hymnTunes.hymnId, chosen.id), inArray(hymnMedia.kind, ["AUDIO", "YOUTUBE"]))),
    ]);
    const h = hRows[0];
    if (!h) return null;
    const audio = audioRows[0]?.n ?? 0;
    return {
      slug: h.slug,
      title: hymnDisplayTitle(h.title, h.firstLine),
      firstLine: h.firstLine,
      numbers: nums,
      excerpt: (h.verses.find((v) => v.label !== "R") ?? h.verses[0])?.lines.slice(0, 4) ?? [],
      hasAudio: audio > 0,
      pinned: Boolean(pick),
    };
  }

  /** Approved posts of the last 14 days, ranked by recent comments vs age. */
  private async trending(now: Date) {
    const since = new Date(now.getTime() - TRENDING_WINDOW_DAYS * 86_400_000);
    const activitySince = new Date(now.getTime() - TRENDING_ACTIVITY_HOURS * 3_600_000);
    const rows = await this.db
      .select()
      .from(posts)
      .where(and(eq(posts.status, "APPROVED"), gte(posts.publishedAt, since), lte(posts.publishedAt, now)))
      .orderBy(desc(posts.publishedAt))
      .limit(200);
    if (!rows.length) return [];
    const counts = await this.db
      .select({ postId: postComments.postId, n: sql<number>`count(*)::int` })
      .from(postComments)
      .where(and(inArray(postComments.postId, rows.map((r) => r.id)), eq(postComments.status, "VISIBLE"), gte(postComments.createdAt, activitySince)))
      .groupBy(postComments.postId);
    // Likes in the same window count too, a third of a comment each (D-035).
    const likes = await this.db
      .select({ itemId: reactions.itemId, n: sql<number>`count(*)::int` })
      .from(reactions)
      .where(and(eq(reactions.kind, "POST"), eq(reactions.type, "LIKE"), inArray(reactions.itemId, rows.map((r) => r.id)), gte(reactions.createdAt, activitySince)))
      .groupBy(reactions.itemId);
    const ranked = rankTrending(
      rows.map((r) => ({
        id: r.id,
        publishedAt: r.publishedAt!,
        recentComments: counts.find((c) => c.postId === r.id)?.n ?? 0,
        recentLikes: likes.find((l) => l.itemId === r.id)?.n ?? 0,
      })),
      now,
      5,
    );
    return this.explore.summaries(ranked.map((x) => rows.find((r) => r.id === x.id)!));
  }

  private async upcomingEvents(now: Date) {
    const at = sql`${now.toISOString()}::timestamptz`;
    const rows = await this.db
      .select()
      .from(posts)
      .where(and(eq(posts.status, "APPROVED"), eq(posts.kind, "EVENT"), sql`coalesce(${posts.endsAt}, ${posts.startsAt}) >= ${at}`))
      .orderBy(asc(posts.startsAt))
      .limit(3);
    return this.explore.summaries(rows);
  }

  // ------------------------------------------------------------------ feed

  /**
   * For you: everything new — approved posts, published teachings, published episodes, current news.
   * Following (members): posts from churches they follow and episodes of podcasts they follow.
   */
  async feed(tab: "for-you" | "following", page: number, viewer: Principal | undefined, now = new Date()): Promise<HomeFeed> {
    const need = page * FEED_PAGE;
    if (tab === "following" && viewer?.kind !== "member") return { items: [], page, hasMore: false };
    const following = tab === "following" && viewer?.kind === "member" ? viewer.id : null;

    const [postRows, teachingRows, episodeRows, newsRows] = await Promise.all([
      this.db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.status, "APPROVED"),
            lte(posts.publishedAt, now),
            following ? inArray(posts.churchId, this.db.select({ id: follows.groupId }).from(follows).where(eq(follows.memberId, following))) : undefined,
          ),
        )
        .orderBy(desc(posts.publishedAt))
        .limit(need),
      following
        ? Promise.resolve([] as (typeof teachings.$inferSelect)[])
        : this.db.select().from(teachings).where(and(eq(teachings.status, "PUBLISHED"), lte(teachings.publishedAt, now))).orderBy(desc(teachings.publishedAt)).limit(need),
      this.db
        .select({ e: podcastEpisodes, p: podcasts })
        .from(podcastEpisodes)
        .innerJoin(podcasts, eq(podcasts.id, podcastEpisodes.podcastId))
        .where(
          and(
            eq(podcastEpisodes.status, "PUBLISHED"),
            eq(podcasts.isPublished, true),
            lte(podcastEpisodes.publishedAt, now),
            following
              ? inArray(podcasts.id, this.db.select({ id: podcastFollows.podcastId }).from(podcastFollows).where(eq(podcastFollows.memberId, following)))
              : undefined,
          ),
        )
        .orderBy(desc(podcastEpisodes.publishedAt))
        .limit(need),
      following ? Promise.resolve([] as Awaited<ReturnType<NewsService["recentRows"]>>) : this.news.recentRows(need, now),
    ]);

    type Entry = FeedEntry & { load: () => Promise<FeedItem> };
    const entries: Entry[][] = [
      postRows.map((r): Entry => ({ type: "POST", key: r.id, at: r.publishedAt!, load: async () => ({ type: "POST", at: r.publishedAt!.toISOString(), post: (await this.explore.summaries([r]))[0]! }) })),
      teachingRows.map((r): Entry => ({ type: "TEACHING", key: r.id, at: r.publishedAt!, load: async () => ({ type: "TEACHING", at: r.publishedAt!.toISOString(), teaching: (await this.teachingsSvc.summaries([r]))[0]! }) })),
      episodeRows.map(({ e, p }): Entry => ({
        type: "EPISODE",
        key: e.id,
        at: e.publishedAt!,
        load: async () => ({
          type: "EPISODE",
          at: e.publishedAt!.toISOString(),
          episode: {
            id: e.id,
            title: e.title,
            durationSec: e.durationSec,
            mediaKind: e.mediaKind,
            podcast: { slug: p.slug, title: p.title, coverUrl: p.coverKey ? await this.media.presignGet(p.coverKey) : null },
          },
        }),
      })),
      newsRows.map((r): Entry => ({ type: "NEWS", key: r.id, at: r.publishedAt!, load: async () => ({ type: "NEWS", at: r.publishedAt!.toISOString(), news: await this.news.summary(r) }) })),
    ];
    const { items, hasMore } = mergeFeed(entries, page, FEED_PAGE);
    return { items: await Promise.all(items.map((x) => x.load())), page, hasMore };
  }

  // ------------------------------------------------------------------ Super-Admin

  /** Pin (or clear) the hymn of the day for a date. */
  async pinHymn(date: string, hymnSlug: string | null) {
    if (!hymnSlug) {
      await this.db.delete(hymnPicks).where(eq(hymnPicks.date, date));
      return this.hymnOfDay(date);
    }
    const [h] = await this.db.select({ id: hymns.id }).from(hymns).where(and(eq(hymns.slug, hymnSlug), eq(hymns.isPublished, true))).limit(1);
    if (!h) throw new DomainError(404, "HYMN_NOT_FOUND", "We couldn't find that hymn.");
    await this.db.insert(hymnPicks).values({ date, hymnId: h.id }).onConflictDoUpdate({ target: hymnPicks.date, set: { hymnId: h.id } });
    return this.hymnOfDay(date);
  }
}
