import { Inject, Injectable } from "@nestjs/common";
import { churchProfiles, follows, groups } from "@ecclesios/db";
import type { ChurchProfile, Principal, UpdateChurchProfile } from "@ecclesios/shared";
import { canPostAsChurch, JOINABLE_LEVELS } from "@ecclesios/shared/domain";
import { and, eq, inArray, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";
import { ancestorIds, describeChurch, type NamedNode } from "../registration/parish-label";
import { ExploreAccess } from "./explore-access";

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const notFound = () => new DomainError(404, "CHURCH_NOT_FOUND", "We couldn't find that church.");

/** Church pages on Explore (D-031): edited by the church's Administrators, shown at once. */
@Injectable()
export class ChurchPagesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly access: ExploreAccess,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  private async church(id: string) {
    const [g] = await this.db
      .select({ id: groups.id, name: groups.name, level: groups.level, path: groups.path })
      .from(groups)
      .where(and(eq(groups.id, id), eq(groups.isActive, true), inArray(groups.level, [...JOINABLE_LEVELS])))
      .limit(1);
    if (!g) throw notFound();
    return g;
  }

  async profile(id: string, viewer: Principal | undefined): Promise<ChurchProfile> {
    const g = await this.church(id);
    const ids = ancestorIds([g.path]);
    const [anc, [profile], [fol], actor] = await Promise.all([
      ids.length ? this.db.select({ id: groups.id, name: groups.name, level: groups.level }).from(groups).where(inArray(groups.id, ids)) : [],
      this.db.select().from(churchProfiles).where(eq(churchProfiles.groupId, id)).limit(1),
      this.db.select({ n: sql<number>`count(*)::int` }).from(follows).where(eq(follows.groupId, id)),
      viewer ? this.access.actor(viewer) : null,
    ]);
    const ctx = describeChurch(g.path, g.level, new Map<string, NamedNode>(anc.map((a) => [a.id, a])));
    const context =
      g.level === "OUTSTATION" ? [`Outstation of ${ctx.parish ?? "a parish"}`, ctx.diocese] : [ctx.deanery, ctx.diocese];
    return {
      id: g.id,
      name: g.name,
      level: g.level,
      context: context.filter(Boolean).join(" · "),
      about: profile?.about ?? "",
      address: profile?.address ?? null,
      massTimes: profile?.massTimes ?? null,
      phone: profile?.phone ?? null,
      website: profile?.website ?? null,
      coverUrl: profile?.coverKey ? await this.media.presignGet(profile.coverKey) : null,
      followers: fol?.n ?? 0,
      canManage: actor ? canPostAsChurch(actor, id) : false,
    };
  }

  private async assertAdmin(p: Principal, id: string) {
    await this.church(id);
    const actor = await this.access.actor(p);
    if (!canPostAsChurch(actor, id)) throw new DomainError(403, "NOT_ALLOWED", "Only this church's Administrator can edit its page.");
    return actor;
  }

  async update(p: Principal, id: string, b: UpdateChurchProfile, ip: string) {
    const actor = await this.assertAdmin(p, id);
    await this.db
      .insert(churchProfiles)
      .values({ groupId: id, ...b })
      .onConflictDoUpdate({ target: churchProfiles.groupId, set: b });
    await this.audit.write({ actorType: "MEMBER", actorId: actor.id, groupId: id, action: "explore.church_profile_updated", ip });
    return this.profile(id, p);
  }

  async presignCover(p: Principal, id: string, contentType: string, bytes: number) {
    await this.assertAdmin(p, id);
    if (!COVER_TYPES.includes(contentType)) throw new DomainError(400, "UPLOAD_REJECTED", "Use a JPEG, PNG or WebP image.");
    return this.media.presignPut(this.media.newKey(`churches/${id}`, contentType), contentType, bytes);
  }

  async setCover(p: Principal, id: string, key: string | null) {
    await this.assertAdmin(p, id);
    if (key) {
      if (!key.startsWith(`churches/${id}/`)) throw new DomainError(400, "UPLOAD_REJECTED", "That upload doesn't belong here.");
      const head = await this.media.head(key);
      if (!head?.contentType || !COVER_TYPES.includes(head.contentType))
        throw new DomainError(400, "UPLOAD_REJECTED", "The image hasn't finished uploading or isn't a supported type.");
    }
    const [old] = await this.db.select({ k: churchProfiles.coverKey }).from(churchProfiles).where(eq(churchProfiles.groupId, id));
    await this.db
      .insert(churchProfiles)
      .values({ groupId: id, coverKey: key })
      .onConflictDoUpdate({ target: churchProfiles.groupId, set: { coverKey: key } });
    if (old?.k && old.k !== key) await this.media.remove(old.k);
    return this.profile(id, p);
  }
}
