import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { digestRuns, groups, members, memberships } from "@ecclesios/db";
import {
  birthdayDigestLine,
  daysUntilBirthday,
  localIsoDate,
  turningAge,
} from "@ecclesios/shared";
import { and, eq, sql } from "drizzle-orm";
import { ENV, type Env } from "../config/env";
import { DB, type Database } from "../db/db.module";
import { Jobs } from "../jobs/jobs.service";
import { NotifyService } from "../notify/notify.service";

/**
 * Daily birthday digest (functionality §4.3, D-052): each morning (BIRTHDAY_DIGEST_CRON,
 * APP_TIMEZONE) the Administrators and Managers of every church with celebrants get one
 * BIRTHDAY notification listing them. A day runs once (`digest_runs`), however often the job fires.
 */
@Injectable()
export class BirthdayDigest implements OnModuleInit {
  private readonly logger = new Logger("BirthdayDigest");
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly jobs: Jobs,
    private readonly notify: NotifyService,
  ) {}

  onModuleInit() {
    this.jobs.handle("digest.birthdays", (j) => this.run(j.day).then(() => undefined));
    this.jobs.schedule("birthday-digest", "digest.birthdays", this.env.BIRTHDAY_DIGEST_CRON, {});
  }

  /** Returns the number of churches notified, or null if the day had already run. */
  async run(day = localIsoDate(new Date(), this.env.APP_TIMEZONE)): Promise<number | null> {
    const claimed = await this.db
      .insert(digestRuns)
      .values({ kind: "birthdays", day })
      .onConflictDoNothing()
      .returning({ day: digestRuns.day });
    if (!claimed.length) return null;

    const month = Number(day.slice(5, 7));
    // Same month, then exact rule in JS (29 Feb → 28 Feb in common years).
    const rows = await this.db
      .select({
        groupId: groups.id,
        church: groups.name,
        firstName: members.firstName,
        lastName: members.lastName,
        dateOfBirth: members.dateOfBirth,
      })
      .from(memberships)
      .innerJoin(members, eq(members.id, memberships.memberId))
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .where(
        and(
          eq(memberships.status, "ACTIVE"),
          eq(members.isActive, true),
          eq(members.isDeceased, false),
          eq(groups.isActive, true),
          sql`extract(month from ${members.dateOfBirth}) = ${month}`,
        ),
      );
    const byChurch = new Map<string, { church: string; people: { name: string; turning: number }[] }>();
    for (const r of rows) {
      if (!r.dateOfBirth || daysUntilBirthday(r.dateOfBirth, day) !== 0) continue;
      const e = byChurch.get(r.groupId) ?? { church: r.church, people: [] };
      e.people.push({ name: `${r.firstName} ${r.lastName}`, turning: turningAge(r.dateOfBirth, day) });
      byChurch.set(r.groupId, e);
    }
    for (const [groupId, e] of byChurch) {
      e.people.sort((a, b) => a.name.localeCompare(b.name));
      const n = e.people.length;
      await this.notify.staff("BIRTHDAY", [groupId], ["ADMINISTRATOR", "MANAGER"], {
        title: `${n} birthday${n === 1 ? "" : "s"} today at ${e.church}`,
        body: birthdayDigestLine(e.people),
        link: "/admin/birthdays",
      });
    }
    await this.db
      .update(digestRuns)
      .set({ notified: byChurch.size })
      .where(and(eq(digestRuns.kind, "birthdays"), eq(digestRuns.day, day)));
    this.logger.log({ day, churches: byChurch.size }, "birthday digest sent");
    return byChurch.size;
  }
}
