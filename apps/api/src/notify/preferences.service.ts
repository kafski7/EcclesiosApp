import { Inject, Injectable } from "@nestjs/common";
import { memberships, notificationPreferences, notificationTypes, roles } from "@ecclesios/db";
import {
  PREFERENCE_TYPES,
  isDelivered,
  isMutableType,
  type NotificationChannel,
  type NotificationPreferences,
  type UpdateNotificationPreferences,
} from "@ecclesios/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";

/** Channels the settings page offers today. SMS / email / push join later (D-052). */
const OFFERED: readonly NotificationChannel[] = ["IN_APP"];

/** Your notification settings (`/api/me/notification-preferences`, D-052). */
@Injectable()
export class PreferencesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async saved(memberId: string) {
    return this.db
      .select({
        code: notificationTypes.code,
        channel: notificationPreferences.channel,
        enabled: notificationPreferences.enabled,
      })
      .from(notificationPreferences)
      .innerJoin(notificationTypes, eq(notificationTypes.id, notificationPreferences.typeId))
      .where(eq(notificationPreferences.memberId, memberId));
  }

  /** Staff-only types (digests, requests, collections) are listed only for people who run a church. */
  private async runsAChurch(memberId: string) {
    const [r] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.memberId, memberId),
          eq(memberships.status, "ACTIVE"),
          inArray(roles.code, ["ADMINISTRATOR", "MANAGER", "SOCIETY_LEADER"]),
        ),
      );
    return (r?.n ?? 0) > 0;
  }

  async get(memberId: string): Promise<NotificationPreferences> {
    const [saved, staff] = await Promise.all([this.saved(memberId), this.runsAChurch(memberId)]);
    return {
      items: PREFERENCE_TYPES.filter((t) => staff || !t.staffOnly).map((t) => ({
        type: t.code,
        label: t.label,
        hint: t.hint,
        mutable: t.mutable,
        channels: OFFERED.map((channel) => ({
          channel,
          enabled: isDelivered(t.code, channel, saved),
        })),
      })),
    };
  }

  async update(
    memberId: string,
    body: UpdateNotificationPreferences,
  ): Promise<NotificationPreferences> {
    const changes = body.changes.map((c) => ({ ...c, channel: c.channel ?? "IN_APP" }));
    for (const c of changes) {
      if (!isMutableType(c.type))
        throw new DomainError(400, "ALWAYS_ON", "That notification can't be turned off.");
      if (!OFFERED.includes(c.channel))
        throw new DomainError(400, "CHANNEL_NOT_OFFERED", "That channel isn't available yet.");
    }
    const types = await this.db
      .select({ id: notificationTypes.id, code: notificationTypes.code })
      .from(notificationTypes)
      .where(inArray(notificationTypes.code, [...new Set(changes.map((c) => c.type))]));
    const idOf = new Map(types.map((t) => [t.code, t.id]));
    const rows = changes.flatMap((c) => {
      const typeId = idOf.get(c.type);
      return typeId ? [{ memberId, typeId, channel: c.channel, enabled: c.enabled }] : [];
    });
    if (rows.length)
      await this.db
        .insert(notificationPreferences)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            notificationPreferences.memberId,
            notificationPreferences.typeId,
            notificationPreferences.channel,
          ],
          set: { enabled: sql`excluded.enabled`, updatedAt: new Date() },
        });
    return this.get(memberId);
  }
}
