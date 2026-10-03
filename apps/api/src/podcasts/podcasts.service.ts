import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  memberPrivileges,
  members,
  notificationTypes,
  podcastAttachments,
  podcastEpisodes,
  podcastFollows,
  podcasts,
  userPrivileges,
  users,
} from "@ecclesios/db";
import type {
  Episode,
  Podcast,
  PodcastSummary,
  Principal,
  StudioPodcast,
  UpsertEpisode,
  UpsertPodcast,
} from "@ecclesios/shared";
import {
  canManageSeries,
  canOpenMedia,
  canPublishPodcasts,
  episodeYouTubeId,
  isPlatformAdmin,
  PODCAST_ATTACHMENT_TYPES,
  PODCAST_AUDIO_TYPES,
  PODCAST_COVER_TYPES,
  publishBlocker,
  slugify,
  type EpisodeStatus,
  type MediaViewer,
  type PodcastActor,
} from "@ecclesios/shared/domain";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { ENV, listenerPaywall, type Env } from "../config/env";
import { DB, type Database } from "../db/db.module";
import { deleteReactions } from "../engage/cleanup";
import { qcol } from "../db/qualified";
import { MediaService } from "../media/media.service";

const PAGE = 24;
type Row = typeof podcasts.$inferSelect;
type EpisodeRow = typeof podcastEpisodes.$inferSelect;
type AttachmentRow = typeof podcastAttachments.$inferSelect;

/** Personal subscriptions don't exist yet: everyone is a non-subscriber; the paywall is off (D-029). */
export const PUBLIC_LISTENER: MediaViewer = { staff: false, subscribed: false };

const PUBLISH_MESSAGES = {
  AUDIO_REQUIRED: "Upload the episode's audio before publishing it.",
  YOUTUBE_REQUIRED: "Add the episode's YouTube link before publishing it.",
  VIDEO_NOT_AVAILABLE: "Hosted video isn't available yet. Use audio or a YouTube link.",
} as const;

const notFound = () => new DomainError(404, "PODCAST_NOT_FOUND", "We couldn't find that podcast.");
const episodeNotFound = () => new DomainError(404, "EPISODE_NOT_FOUND", "We couldn't find that episode.");
const notAllowed = () =>
  new DomainError(403, "NOT_ALLOWED", "Only the podcast's publisher or an Ecclesios administrator can do that.");
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Podcasts (functionality §3.5, D-027): public listening, follows and the publishing studio. */
@Injectable()
export class PodcastsService {
  private readonly logger = new Logger(PodcastsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ helpers

  /** Loads the caller's grants (they are not in the token, D-015). */
  async actor(p: Principal): Promise<PodcastActor> {
    if (p.kind === "user") {
      const rows = await this.db.select({ privilege: userPrivileges.privilege }).from(userPrivileges).where(eq(userPrivileges.userId, p.id));
      return { kind: "user", id: p.id, role: p.role, privileges: rows.map((r) => r.privilege) };
    }
    const rows = await this.db.select({ privilege: memberPrivileges.privilege }).from(memberPrivileges).where(eq(memberPrivileges.memberId, p.id));
    return { kind: "member", id: p.id, privileges: rows.map((r) => r.privilege) };
  }

  private async publishers(rows: Row[]) {
    const userIds = [...new Set(rows.map((r) => r.ownerUserId).filter((x): x is string => !!x))];
    const memberIds = [...new Set(rows.map((r) => r.ownerMemberId).filter((x): x is string => !!x))];
    const [u, m] = await Promise.all([
      userIds.length
        ? this.db.select({ id: users.id, name: users.fullName, role: users.platformRole }).from(users).where(inArray(users.id, userIds))
        : [],
      memberIds.length
        ? this.db.select({ id: members.id, first: members.firstName, last: members.lastName }).from(members).where(inArray(members.id, memberIds))
        : [],
    ]);
    return (r: Row): PodcastSummary["publisher"] => {
      if (r.ownerUserId) {
        const x = u.find((y) => y.id === r.ownerUserId);
        return x?.role === "SUPER_ADMIN" ? { kind: "PLATFORM", name: "Ecclesios" } : { kind: "CREATOR", name: x?.name ?? "Creator" };
      }
      const x = m.find((y) => y.id === r.ownerMemberId);
      return { kind: "MEMBER", name: x ? `${x.first} ${x.last}` : "Member" };
    };
  }

  private async stats(ids: string[]) {
    if (!ids.length) return new Map<string, { count: number; latest: Date | null; drafts: number }>();
    const rows = await this.db
      .select({
        podcastId: podcastEpisodes.podcastId,
        count: sql<number>`count(*) filter (where ${podcastEpisodes.status} = 'PUBLISHED')::int`,
        drafts: sql<number>`count(*) filter (where ${podcastEpisodes.status} = 'DRAFT')::int`,
        latest: sql<Date | null>`max(${podcastEpisodes.publishedAt}) filter (where ${podcastEpisodes.status} = 'PUBLISHED')`,
      })
      .from(podcastEpisodes)
      .where(inArray(podcastEpisodes.podcastId, ids))
      .groupBy(podcastEpisodes.podcastId);
    return new Map(rows.map((r) => [r.podcastId, { count: r.count, drafts: r.drafts, latest: r.latest ? new Date(r.latest) : null }]));
  }

  private async summaries(rows: Row[]): Promise<PodcastSummary[]> {
    const [pub, st] = await Promise.all([this.publishers(rows), this.stats(rows.map((r) => r.id))]);
    return Promise.all(
      rows.map(async (r) => ({
        slug: r.slug,
        title: r.title,
        summary: r.summary,
        category: r.category,
        publisher: pub(r),
        coverUrl: r.coverKey ? await this.media.presignGet(r.coverKey) : null,
        episodeCount: st.get(r.id)?.count ?? 0,
        latestEpisodeAt: st.get(r.id)?.latest?.toISOString() ?? null,
      })),
    );
  }

  private episode(e: EpisodeRow, attachments: AttachmentRow[], viewer: MediaViewer): Episode {
    const available = canOpenMedia(e.access, viewer, listenerPaywall(this.env));
    return {
      id: e.id,
      number: e.number,
      title: e.title,
      notes: e.notes,
      durationSec: e.durationSec,
      publishedAt: e.publishedAt?.toISOString() ?? null,
      mediaKind: e.mediaKind,
      hasAudio: Boolean(e.audioKey),
      youtubeId: available ? e.youtubeId : null,
      access: e.access,
      available,
      hasTranscript: e.transcript.trim().length > 0,
      attachments: attachments
        .filter((a) => a.episodeId === e.id)
        .map((a) => ({ id: a.id, label: a.label })),
    };
  }

  private attachmentsFor(episodeIds: string[]) {
    if (!episodeIds.length) return Promise.resolve([] as AttachmentRow[]);
    return this.db
      .select()
      .from(podcastAttachments)
      .where(inArray(podcastAttachments.episodeId, episodeIds))
      .orderBy(asc(podcastAttachments.position), asc(podcastAttachments.createdAt));
  }

  /** Published episode of a published series, or 404 — the gate for every listener endpoint. */
  private async liveEpisode(id: string) {
    const [row] = await this.db
      .select({ e: podcastEpisodes, live: podcasts.isPublished })
      .from(podcastEpisodes)
      .innerJoin(podcasts, eq(podcasts.id, podcastEpisodes.podcastId))
      .where(eq(podcastEpisodes.id, id))
      .limit(1);
    if (!row || row.e.status !== "PUBLISHED" || !row.live) throw episodeNotFound();
    return row.e;
  }

  private assertOpen(e: EpisodeRow, viewer: MediaViewer) {
    if (!canOpenMedia(e.access, viewer, listenerPaywall(this.env)))
      throw new DomainError(403, "MEDIA_LOCKED", "This episode is for Ecclesios subscribers.");
  }

  private async bySlug(slug: string, includeHidden = false) {
    const [r] = await this.db
      .select()
      .from(podcasts)
      .where(and(eq(podcasts.slug, slug), includeHidden ? undefined : eq(podcasts.isPublished, true)))
      .limit(1);
    if (!r) throw notFound();
    return r;
  }

  // ------------------------------------------------------------------ public

  async list(q: string, category: string | undefined, page: number) {
    const term = q.trim();
    const rows = await this.db
      .select()
      .from(podcasts)
      .where(
        and(
          eq(podcasts.isPublished, true),
          category ? eq(podcasts.category, category.toLowerCase()) : undefined,
          term
            ? or(
                ilike(podcasts.title, `%${escapeLike(term)}%`),
                sql`to_tsvector('english', ${podcasts.title} || ' ' || ${podcasts.summary} || ' ' || ${podcasts.description}) @@ websearch_to_tsquery('english', ${term})`,
              )
            : undefined,
        ),
      )
      .orderBy(
        sql`(select max(e.published_at) from ${podcastEpisodes} e where e.podcast_id = ${qcol(podcasts, podcasts.id)} and e.status = 'PUBLISHED') desc nulls last`,
        podcasts.title,
      )
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE);
    return { items: await this.summaries(rows.slice(0, PAGE)), page, hasMore: rows.length > PAGE };
  }

  async detail(slug: string): Promise<Podcast> {
    const r = await this.bySlug(slug);
    const [[summary], eps] = await Promise.all([
      this.summaries([r]),
      this.db
        .select()
        .from(podcastEpisodes)
        .where(and(eq(podcastEpisodes.podcastId, r.id), eq(podcastEpisodes.status, "PUBLISHED")))
        .orderBy(desc(podcastEpisodes.publishedAt)),
    ]);
    const atts = await this.attachmentsFor(eps.map((e) => e.id));
    return {
      ...summary!,
      description: r.description,
      episodes: eps.map((e) => this.episode(e, atts, PUBLIC_LISTENER)),
    };
  }

  /** Short-lived stream URL for a published episode's audio. */
  async episodeUrl(id: string, viewer: MediaViewer = PUBLIC_LISTENER) {
    const e = await this.liveEpisode(id);
    if (!e.audioKey) throw episodeNotFound();
    this.assertOpen(e, viewer);
    return { url: await this.media.presignGet(e.audioKey), expiresInSeconds: this.media.ttl };
  }

  async transcript(id: string, viewer: MediaViewer = PUBLIC_LISTENER) {
    const e = await this.liveEpisode(id);
    this.assertOpen(e, viewer);
    return { text: e.transcript };
  }

  /** Short-lived download URL for a handout; access follows the episode. */
  async attachmentUrl(id: string, viewer: MediaViewer = PUBLIC_LISTENER) {
    const [a] = await this.db.select().from(podcastAttachments).where(eq(podcastAttachments.id, id)).limit(1);
    if (!a) throw new DomainError(404, "ATTACHMENT_NOT_FOUND", "We couldn't find that file.");
    const e = await this.liveEpisode(a.episodeId);
    this.assertOpen(e, viewer);
    const name = `${slugify(a.label) || "handout"}.pdf`;
    return { url: await this.media.presignGet(a.objectKey, name), expiresInSeconds: this.media.ttl };
  }

  // ------------------------------------------------------------------ follows (members)

  async following(memberId: string) {
    const rows = await this.db
      .select({ slug: podcasts.slug })
      .from(podcastFollows)
      .innerJoin(podcasts, eq(podcasts.id, podcastFollows.podcastId))
      .where(eq(podcastFollows.memberId, memberId));
    return { slugs: rows.map((r) => r.slug) };
  }

  async follow(memberId: string, slug: string) {
    const r = await this.bySlug(slug);
    await this.db.insert(podcastFollows).values({ memberId, podcastId: r.id }).onConflictDoNothing();
  }

  async unfollow(memberId: string, slug: string) {
    const r = await this.bySlug(slug, true);
    await this.db.delete(podcastFollows).where(and(eq(podcastFollows.memberId, memberId), eq(podcastFollows.podcastId, r.id)));
  }

  // ------------------------------------------------------------------ studio

  private async managed(p: Principal, slug: string) {
    const [actor, r] = await Promise.all([this.actor(p), this.bySlug(slug, true)]);
    if (!canManageSeries(actor, r)) throw notAllowed();
    return { actor, row: r };
  }

  private ownerFilter(actor: PodcastActor) {
    if (isPlatformAdmin(actor)) return undefined;
    return actor.kind === "user" ? eq(podcasts.ownerUserId, actor.id) : eq(podcasts.ownerMemberId, actor.id);
  }

  async studioList(p: Principal) {
    const actor = await this.actor(p);
    const rows = await this.db.select().from(podcasts).where(this.ownerFilter(actor)).orderBy(podcasts.title);
    const [base, st, fol] = await Promise.all([
      this.summaries(rows),
      this.stats(rows.map((r) => r.id)),
      this.followerCounts(rows.map((r) => r.id)),
    ]);
    return {
      canCreate: canPublishPodcasts(actor),
      items: base.map((b, i) => ({
        ...b,
        isPublished: rows[i]!.isPublished,
        drafts: st.get(rows[i]!.id)?.drafts ?? 0,
        followers: fol.get(rows[i]!.id) ?? 0,
      })),
    };
  }

  private async followerCounts(ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.db
      .select({ id: podcastFollows.podcastId, n: sql<number>`count(*)::int` })
      .from(podcastFollows)
      .where(inArray(podcastFollows.podcastId, ids))
      .groupBy(podcastFollows.podcastId);
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  async studioDetail(p: Principal, slug: string): Promise<StudioPodcast> {
    const { row } = await this.managed(p, slug);
    return this.studioView(row);
  }

  private async studioView(row: Row): Promise<StudioPodcast> {
    const [[summary], eps, fol] = await Promise.all([
      this.summaries([row]),
      this.db
        .select()
        .from(podcastEpisodes)
        .where(eq(podcastEpisodes.podcastId, row.id))
        .orderBy(sql`${podcastEpisodes.number} desc nulls last`, desc(podcastEpisodes.createdAt)),
      this.followerCounts([row.id]),
    ]);
    const atts = await this.attachmentsFor(eps.map((e) => e.id));
    const staff: MediaViewer = { staff: true, subscribed: true };
    return {
      ...summary!,
      description: row.description,
      isPublished: row.isPublished,
      followers: fol.get(row.id) ?? 0,
      episodes: await Promise.all(
        eps.map(async (e) => ({
          ...this.episode(e, atts, staff),
          status: e.status,
          youtubeId: e.youtubeId,
          transcript: e.transcript,
          audioUrl: e.audioKey ? await this.media.presignGet(e.audioKey) : null,
        })),
      ),
    };
  }

  async create(p: Principal, body: UpsertPodcast, ip: string) {
    const actor = await this.actor(p);
    if (!canPublishPodcasts(actor))
      throw new DomainError(403, "NOT_ALLOWED", "Publishing podcasts needs the podcast privilege. Ask Ecclesios to grant it.");
    const slug = await this.freeSlug(slugify(body.title));
    const [row] = await this.db
      .insert(podcasts)
      .values({
        ...body,
        slug,
        ownerUserId: actor.kind === "user" ? actor.id : null,
        ownerMemberId: actor.kind === "member" ? actor.id : null,
      })
      .returning();
    await this.log(p, "podcast.created", slug, ip);
    return this.studioView(row!);
  }

  async update(p: Principal, slug: string, body: UpsertPodcast, ip: string) {
    const { row } = await this.managed(p, slug);
    const [next] = await this.db.update(podcasts).set(body).where(eq(podcasts.id, row.id)).returning();
    await this.log(p, "podcast.updated", slug, ip);
    return this.studioView(next!);
  }

  private async freeSlug(base: string) {
    const root = base || "podcast";
    for (let i = 1; ; i++) {
      const candidate = i === 1 ? root : `${root}-${i}`;
      const [hit] = await this.db.select({ id: podcasts.id }).from(podcasts).where(eq(podcasts.slug, candidate)).limit(1);
      if (!hit) return candidate;
    }
  }

  // covers
  async presignCover(p: Principal, slug: string, contentType: string, bytes: number) {
    const { row } = await this.managed(p, slug);
    if (!(PODCAST_COVER_TYPES as readonly string[]).includes(contentType))
      throw new DomainError(400, "UPLOAD_REJECTED", "Use a JPEG, PNG or WebP image.");
    return this.media.presignPut(this.media.newKey(`podcasts/${row.id}/cover`, contentType), contentType, bytes);
  }

  async setCover(p: Principal, slug: string, key: string | null, ip: string) {
    const { row } = await this.managed(p, slug);
    if (key) await this.checkUpload(key, `podcasts/${row.id}/cover/`, PODCAST_COVER_TYPES);
    await this.db.update(podcasts).set({ coverKey: key }).where(eq(podcasts.id, row.id));
    if (row.coverKey && row.coverKey !== key) await this.media.remove(row.coverKey);
    await this.log(p, key ? "podcast.cover_set" : "podcast.cover_removed", slug, ip);
    return this.studioView({ ...row, coverKey: key });
  }

  private async checkUpload(key: string, prefix: string, types: readonly string[]) {
    if (!key.startsWith(prefix)) throw new DomainError(400, "UPLOAD_REJECTED", "That upload doesn't belong here.");
    const head = await this.media.head(key);
    if (!head) throw new DomainError(400, "UPLOAD_REJECTED", "The file hasn't finished uploading.");
    if (!head.contentType || !types.includes(head.contentType)) {
      await this.media.remove(key);
      throw new DomainError(400, "UPLOAD_REJECTED", "That file type isn't accepted.");
    }
    return head;
  }

  // episodes
  private async episodeOf(podcastId: string, id: string) {
    const [e] = await this.db
      .select()
      .from(podcastEpisodes)
      .where(and(eq(podcastEpisodes.id, id), eq(podcastEpisodes.podcastId, podcastId)))
      .limit(1);
    if (!e) throw episodeNotFound();
    return e;
  }

  private numberTaken(err: unknown) {
    return (err as { code?: string }).code === "23505"
      ? new DomainError(409, "NUMBER_TAKEN", "Another episode already has that number.")
      : err;
  }

  private noVideoYet(body: UpsertEpisode) {
    if (body.mediaKind === "VIDEO")
      throw new DomainError(400, "VIDEO_NOT_AVAILABLE", PUBLISH_MESSAGES.VIDEO_NOT_AVAILABLE);
  }

  async addEpisode(p: Principal, slug: string, body: UpsertEpisode, ip: string) {
    this.noVideoYet(body);
    const { row } = await this.managed(p, slug);
    try {
      await this.db.insert(podcastEpisodes).values({ ...body, podcastId: row.id });
    } catch (err) {
      throw this.numberTaken(err);
    }
    await this.log(p, "podcast.episode_added", slug, ip);
    return this.studioView(row);
  }

  async updateEpisode(p: Principal, slug: string, id: string, body: UpsertEpisode) {
    this.noVideoYet(body);
    const { row } = await this.managed(p, slug);
    const e = await this.episodeOf(row.id, id);
    // A live episode may not switch to a primary media it doesn't have.
    const blocker = e.status === "PUBLISHED" ? publishBlocker({ ...e, mediaKind: body.mediaKind }) : null;
    if (blocker) throw new DomainError(409, blocker, PUBLISH_MESSAGES[blocker]);
    try {
      await this.db.update(podcastEpisodes).set(body).where(eq(podcastEpisodes.id, id));
    } catch (err) {
      throw this.numberTaken(err);
    }
    return this.studioView(row);
  }

  async presignAudio(p: Principal, slug: string, id: string, contentType: string, bytes: number) {
    const { row } = await this.managed(p, slug);
    await this.episodeOf(row.id, id);
    if (!(PODCAST_AUDIO_TYPES as readonly string[]).includes(contentType))
      throw new DomainError(400, "UPLOAD_REJECTED", "Use an MP3, M4A, AAC or OGG audio file.");
    return this.media.presignPut(this.media.newKey(`podcasts/${row.id}/episodes/${id}`, contentType), contentType, bytes);
  }

  async attachAudio(p: Principal, slug: string, id: string, key: string, durationSec: number | null, ip: string) {
    const { row } = await this.managed(p, slug);
    const e = await this.episodeOf(row.id, id);
    const head = await this.checkUpload(key, `podcasts/${row.id}/episodes/${id}/`, PODCAST_AUDIO_TYPES);
    await this.db
      .update(podcastEpisodes)
      .set({ audioKey: key, contentType: head.contentType, bytes: head.bytes, durationSec })
      .where(eq(podcastEpisodes.id, id));
    if (e.audioKey && e.audioKey !== key) await this.media.remove(e.audioKey);
    await this.log(p, "podcast.audio_set", slug, ip, { episode: id });
    return this.studioView(row);
  }

  /** Set or clear the YouTube / YouTube Music link (D-029). Clearing is refused if it is the live primary. */
  async setYouTube(p: Principal, slug: string, id: string, url: string | null, ip: string) {
    const { row } = await this.managed(p, slug);
    const e = await this.episodeOf(row.id, id);
    const youtubeId = url ? episodeYouTubeId(url) : null;
    if (url && !youtubeId) throw new DomainError(400, "INVALID_YOUTUBE_LINK", "Paste a YouTube or YouTube Music link.");
    if (!youtubeId && e.status === "PUBLISHED" && e.mediaKind === "YOUTUBE")
      throw new DomainError(409, "YOUTUBE_REQUIRED", "This live episode plays from YouTube. Switch it to audio or unpublish it first.");
    await this.db.update(podcastEpisodes).set({ youtubeId }).where(eq(podcastEpisodes.id, id));
    await this.log(p, youtubeId ? "podcast.youtube_set" : "podcast.youtube_removed", slug, ip, { episode: id });
    return this.studioView(row);
  }

  // handouts (D-029)
  async presignAttachment(p: Principal, slug: string, id: string, contentType: string, bytes: number) {
    const { row } = await this.managed(p, slug);
    await this.episodeOf(row.id, id);
    if (!(PODCAST_ATTACHMENT_TYPES as readonly string[]).includes(contentType))
      throw new DomainError(400, "UPLOAD_REJECTED", "Handouts must be PDF files.");
    return this.media.presignPut(this.media.newKey(`podcasts/${row.id}/episodes/${id}/files`, contentType), contentType, bytes);
  }

  async addAttachment(p: Principal, slug: string, id: string, key: string, label: string, ip: string) {
    const { row } = await this.managed(p, slug);
    await this.episodeOf(row.id, id);
    const head = await this.checkUpload(key, `podcasts/${row.id}/episodes/${id}/files/`, PODCAST_ATTACHMENT_TYPES);
    const [{ n }] = (await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(podcastAttachments)
      .where(eq(podcastAttachments.episodeId, id))) as [{ n: number }];
    await this.db
      .insert(podcastAttachments)
      .values({ episodeId: id, label, objectKey: key, contentType: head.contentType!, bytes: head.bytes, position: n });
    await this.log(p, "podcast.attachment_added", slug, ip, { episode: id });
    return this.studioView(row);
  }

  async removeAttachment(p: Principal, slug: string, attachmentId: string, ip: string) {
    const { row } = await this.managed(p, slug);
    const [a] = await this.db
      .select({ a: podcastAttachments })
      .from(podcastAttachments)
      .innerJoin(podcastEpisodes, eq(podcastEpisodes.id, podcastAttachments.episodeId))
      .where(and(eq(podcastAttachments.id, attachmentId), eq(podcastEpisodes.podcastId, row.id)))
      .limit(1);
    if (!a) throw new DomainError(404, "ATTACHMENT_NOT_FOUND", "We couldn't find that file.");
    await this.db.delete(podcastAttachments).where(eq(podcastAttachments.id, attachmentId));
    await this.media.remove(a.a.objectKey);
    await this.log(p, "podcast.attachment_removed", slug, ip, { attachment: attachmentId });
    return this.studioView(row);
  }

  async setStatus(p: Principal, slug: string, id: string, status: EpisodeStatus, ip: string) {
    const { row } = await this.managed(p, slug);
    const e = await this.episodeOf(row.id, id);
    const blocker = status === "PUBLISHED" ? publishBlocker(e) : null;
    if (blocker) throw new DomainError(409, blocker, PUBLISH_MESSAGES[blocker]);
    const firstPublish = status === "PUBLISHED" && !e.publishedAt;
    await this.db
      .update(podcastEpisodes)
      .set({ status, ...(firstPublish ? { publishedAt: new Date() } : {}) })
      .where(eq(podcastEpisodes.id, id));
    await this.log(p, status === "PUBLISHED" ? "podcast.episode_published" : "podcast.episode_unpublished", slug, ip, { episode: id });
    if (firstPublish && row.isPublished) await this.notifyFollowers(row, e.title);
    return this.studioView(row);
  }

  async removeEpisode(p: Principal, slug: string, id: string, ip: string) {
    const { row } = await this.managed(p, slug);
    const e = await this.episodeOf(row.id, id);
    const files = await this.attachmentsFor([id]);
    await this.db.delete(podcastEpisodes).where(eq(podcastEpisodes.id, id));
    await deleteReactions(this.db, "EPISODE", id);
    await Promise.all([e.audioKey, ...files.map((f) => f.objectKey)].filter((k): k is string => !!k).map((k) => this.media.remove(k)));
    await this.log(p, "podcast.episode_removed", slug, ip, { episode: id });
    return this.studioView(row);
  }

  /**
   * One set-based INSERT … SELECT per first publish. Moves to a BullMQ worker with the other
   * fan-outs in Phase 7 (D-027). Never fails the publish.
   */
  private async notifyFollowers(row: Row, episodeTitle: string) {
    try {
      const [type] = await this.db
        .select({ id: notificationTypes.id })
        .from(notificationTypes)
        .where(eq(notificationTypes.code, "PODCAST_EPISODE"))
        .limit(1);
      if (!type) return;
      const title = `${row.title}: ${episodeTitle}`.slice(0, 200);
      await this.db.execute(sql`
        insert into notifications (type_id, recipient_member_id, title, link)
        select ${type.id}, ${podcastFollows.memberId}, ${title}, ${`/podcasts/${row.slug}`}
        from ${podcastFollows} where ${podcastFollows.podcastId} = ${row.id}`);
    } catch (err) {
      this.logger.error({ err, podcast: row.slug }, "could not notify followers");
    }
  }

  private log(p: Principal, action: string, slug: string, ip: string, metadata: Record<string, unknown> = {}) {
    return this.audit.write({
      actorType: p.kind === "user" ? "USER" : "MEMBER",
      actorId: p.id,
      action,
      entityType: "podcast",
      entityId: slug,
      metadata,
      ip,
    });
  }
}

