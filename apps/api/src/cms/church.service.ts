import { Inject, Injectable } from "@nestjs/common";
import {
  currencies,
  groups,
  groupSettings,
  languages,
  members,
  memberships,
  roles,
  societies,
  themes,
} from "@ecclesios/db";
import type { ChurchSettings, StaffMember, UpdateChurchSettingsSchema } from "@ecclesios/shared";
import { compareStaff, STAFF_ORDER } from "@ecclesios/shared/domain";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";

type UpdateSettings = z.output<typeof UpdateChurchSettingsSchema>;

/** Users & Roles and church settings (functionality §4.8, §4.10, D-039). */
@Injectable()
export class ChurchService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  async isAdministratorOf(memberId: string, groupId: string) {
    const [r] = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.memberId, memberId),
          eq(memberships.groupId, groupId),
          eq(memberships.status, "ACTIVE"),
          eq(roles.code, "ADMINISTRATOR"),
        ),
      )
      .limit(1);
    return Boolean(r);
  }

  async administrators(groupId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ id: memberships.memberId })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.groupId, groupId),
          eq(memberships.status, "ACTIVE"),
          eq(roles.code, "ADMINISTRATOR"),
        ),
      );
    return rows.map((r) => r.id);
  }

  /** Everyone with a CMS role in this church. Roles are changed on the member profile (D-037). */
  async staff(actorId: string, groupId: string) {
    const rows = await this.db
      .select({ p: members, role: roles.code })
      .from(memberships)
      .innerJoin(members, eq(members.id, memberships.memberId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.groupId, groupId),
          eq(memberships.status, "ACTIVE"),
          inArray(roles.code, [...STAFF_ORDER]),
        ),
      );
    const ids = rows.map((r) => r.p.id);
    const led = ids.length
      ? await this.db
          .select({ leader: societies.leaderMemberId, name: societies.name })
          .from(societies)
          .where(
            and(
              eq(societies.groupId, groupId),
              eq(societies.isActive, true),
              inArray(societies.leaderMemberId, ids),
            ),
          )
          .orderBy(asc(societies.name))
      : [];
    const items: StaffMember[] = await Promise.all(
      rows.map(async ({ p, role }) => ({
        personId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        role,
        telephone: p.telephone,
        email: p.email,
        photoUrl: p.photoKey ? await this.media.presignGet(p.photoKey) : null,
        hasAccount: Boolean(p.passwordHash),
        lastLoginAt: p.lastLoginAt?.toISOString() ?? null,
        leads: led.filter((l) => l.leader === p.id).map((l) => l.name),
        isYou: p.id === actorId,
      })),
    );
    return {
      items: items.sort(compareStaff),
      canManage: await this.isAdministratorOf(actorId, groupId),
    };
  }

  // ------------------------------------------------------------------ settings

  async settings(actorId: string, groupId: string): Promise<ChurchSettings> {
    const [[g], [gs], th, lang, cur] = await Promise.all([
      this.db
        .select({
          themeCode: themes.code,
          languageCode: groups.languageCode,
          currencyCode: groups.currencyCode,
          level: groups.level,
          parentId: groups.parentGroupId,
        })
        .from(groups)
        .leftJoin(themes, eq(themes.id, groups.themeId))
        .where(eq(groups.id, groupId))
        .limit(1),
      this.db.select().from(groupSettings).where(eq(groupSettings.groupId, groupId)).limit(1),
      this.db.select().from(themes).orderBy(asc(themes.name)),
      this.db.select().from(languages).orderBy(asc(languages.name)),
      this.db.select().from(currencies).orderBy(asc(currencies.name)),
    ]);
    if (!g) throw new DomainError(404, "NOT_FOUND", "Church not found.");
    const suffragan = await this.isSuffragan(g.level, g.parentId);
    return {
      themeCode: g.themeCode ?? null,
      languageCode: g.languageCode,
      currencyCode: g.currencyCode,
      allowManualTransactionDates: gs?.allowManualTransactionDates ?? false,
      metropolitanVisibility: suffragan ? (gs?.metropolitanVisibility ?? "aggregates") : null,
      canEdit: await this.isAdministratorOf(actorId, groupId),
      options: {
        themes: th.map((t) => ({ code: t.code, name: t.name, primary: t.tokens.primary ?? null })),
        languages: lang.map((l) => ({ code: l.code, name: l.name })),
        currencies: cur.map((c) => ({ code: c.code, name: c.name, symbol: c.symbol })),
      },
    };
  }

  /** A diocese directly under an archdiocese (blueprint §3.4). */
  private async isSuffragan(level: string, parentId: string | null) {
    if (level !== "DIOCESE" || !parentId) return false;
    const [p] = await this.db
      .select({ level: groups.level })
      .from(groups)
      .where(eq(groups.id, parentId))
      .limit(1);
    return p?.level === "ARCHDIOCESE";
  }

  async updateSettings(actorId: string, groupId: string, b: UpdateSettings, ip: string) {
    if (!(await this.isAdministratorOf(actorId, groupId)))
      throw new DomainError(
        403,
        "NOT_ALLOWED",
        "Only this church's Administrators can change its settings.",
      );
    const current = await this.settings(actorId, groupId);
    const pick = <T extends { code: string }>(list: T[], code: string | null, what: string) => {
      if (code && !list.some((x) => x.code === code))
        throw new DomainError(400, "INVALID_SETTING", `Unknown ${what}.`);
      return code;
    };
    pick(current.options.themes, b.themeCode, "theme");
    pick(current.options.languages, b.languageCode, "language");
    pick(current.options.currencies, b.currencyCode, "currency");
    // Only a suffragan diocese's own Administrators decide what the archdiocese sees (D-002).
    const vis =
      current.metropolitanVisibility !== null && b.metropolitanVisibility
        ? { metropolitanVisibility: b.metropolitanVisibility }
        : {};
    const [theme] = b.themeCode
      ? await this.db
          .select({ id: themes.id })
          .from(themes)
          .where(eq(themes.code, b.themeCode))
          .limit(1)
      : [];
    await this.db.transaction(async (tx) => {
      await tx
        .update(groups)
        .set({
          themeId: theme?.id ?? null,
          languageCode: b.languageCode,
          currencyCode: b.currencyCode,
        })
        .where(eq(groups.id, groupId));
      await tx
        .insert(groupSettings)
        .values({
          groupId,
          allowManualTransactionDates: b.allowManualTransactionDates,
          updatedByMemberId: actorId,
          ...vis,
        })
        .onConflictDoUpdate({
          target: groupSettings.groupId,
          set: {
            allowManualTransactionDates: b.allowManualTransactionDates,
            updatedByMemberId: actorId,
            ...vis,
          },
        });
    });
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "church.settings_updated",
      entityType: "group",
      entityId: groupId,
      metadata: { ...b },
      ip,
    });
    return this.settings(actorId, groupId);
  }
}
