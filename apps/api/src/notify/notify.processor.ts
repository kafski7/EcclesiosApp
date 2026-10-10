import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { notificationTypes, notifications } from "@ecclesios/db";
import { isMutableType } from "@ecclesios/shared";
import { eq, sql, type SQL } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";
import type { NotifyJob } from "../jobs/job.types";
import { Jobs } from "../jobs/jobs.service";

const list = (ids: readonly string[]) => sql.join(ids.map((id) => sql`${id}`), sql`, `);

/**
 * The fan-out worker (D-052): who → minus preferences → one INSERT … SELECT.
 * One statement per job, so a retry never leaves half a fan-out behind.
 */
@Injectable()
export class NotifyProcessor implements OnModuleInit {
  private readonly logger = new Logger("Notify");
  private readonly typeIds = new Map<string, number>();
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jobs: Jobs,
  ) {}

  onModuleInit() {
    this.jobs.handle("notify", async (job) => {
      await this.fanOut(job);
    });
  }

  private async typeId(code: string) {
    const hit = this.typeIds.get(code);
    if (hit) return hit;
    const [t] = await this.db
      .select({ id: notificationTypes.id })
      .from(notificationTypes)
      .where(eq(notificationTypes.code, code))
      .limit(1);
    if (t) this.typeIds.set(code, t.id);
    return t?.id ?? null;
  }

  /** SELECT producing one `id` column of member ids, or null when nobody is addressed. */
  private recipients(job: NotifyJob): SQL | null {
    switch (job.to) {
      case "people":
        return job.memberIds?.length
          ? sql`select m.id from members m where m.id in (${list(job.memberIds)}) and m.is_active`
          : null;
      case "staff":
        return job.groupIds.length && job.roles.length
          ? sql`select distinct ms.member_id as id from memberships ms
                join roles r on r.id = ms.role_id
                where ms.group_id in (${list(job.groupIds)}) and ms.status = 'ACTIVE'
                  and r.code::text in (${list(job.roles)})`
          : null;
      case "podcast-followers":
        return sql`select pf.member_id as id from podcast_follows pf where pf.podcast_id = ${job.podcastId}`;
      case "church-followers":
        return sql`select f.member_id as id from follows f where f.group_id = ${job.churchId}
                   and f.member_id is distinct from ${job.exceptMemberId ?? null}::uuid`;
    }
  }

  async fanOut(job: NotifyJob): Promise<number> {
    const typeId = await this.typeId(job.type);
    if (!typeId) {
      this.logger.warn({ type: job.type }, "unknown notification type — nothing sent");
      return 0;
    }
    const title = job.title.slice(0, 200);
    const body = job.body ?? null;
    const link = job.link ?? null;
    const groupId = job.groupId ?? null;
    let count = 0;

    if (job.to === "church-followers" && link) {
      const already = await this.db.execute(sql`
        select 1 from notifications where type_id = ${typeId} and link = ${link} limit 1`);
      if ((already as unknown as unknown[]).length) return 0;
    }

    const who = this.recipients(job);
    if (who) {
      const prefs = isMutableType(job.type)
        ? sql`and not exists (select 1 from notification_preferences p
               where p.member_id = r.id and p.type_id = ${typeId}
                 and p.channel = 'IN_APP' and not p.enabled)`
        : sql``;
      const rows = await this.db.execute(sql`
        insert into notifications (type_id, group_id, recipient_member_id, title, body, link)
        select ${typeId}, ${groupId}::uuid, r.id, ${title}, ${body}, ${link}
        from (${who}) r where r.id is not null ${prefs}
        returning id`);
      count += (rows as unknown as unknown[]).length;
    }

    // Platform accounts have no preferences page — always delivered.
    if (job.to === "people" && job.userIds?.length) {
      const rows = await this.db
        .insert(notifications)
        .values(
          job.userIds.map((recipientUserId) => ({
            typeId,
            groupId,
            recipientUserId,
            title,
            body,
            link,
          })),
        )
        .returning({ id: notifications.id });
      count += rows.length;
    }
    return count;
  }
}
