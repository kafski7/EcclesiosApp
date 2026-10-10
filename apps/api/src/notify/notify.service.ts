import { Injectable, Logger } from "@nestjs/common";
import type { MemberRole, NotificationTypeCode } from "@ecclesios/shared";
import type { NotifyContent, NotifyJob } from "../jobs/job.types";
import { Jobs } from "../jobs/jobs.service";

/**
 * In-app notifications (functionality §4.6, D-052). Services describe WHO should hear; the
 * `notify` worker resolves the people, drops anyone who switched the type off, and writes the
 * rows in one statement. Never throws: a notification must not undo the action it reports.
 */
@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);
  constructor(private readonly jobs: Jobs) {}

  async send(job: NotifyJob) {
    try {
      await this.jobs.add("notify", {
        ...job,
        title: job.title.slice(0, 200),
      });
    } catch (err) {
      this.logger.error({ err, type: job.type }, "could not queue a notification");
    }
  }

  /** Named people (members and/or platform accounts). */
  people(
    type: NotificationTypeCode,
    to: { memberIds?: (string | null)[]; userIds?: (string | null)[] },
    content: NotifyContent,
    groupId: string | null = null,
  ) {
    const memberIds = [...new Set((to.memberIds ?? []).filter((x): x is string => !!x))];
    const userIds = [...new Set((to.userIds ?? []).filter((x): x is string => !!x))];
    if (!memberIds.length && !userIds.length) return Promise.resolve();
    return this.send({ type, to: "people", memberIds, userIds, groupId, ...content });
  }

  /** Active holders of `roles` in `groupIds` (e.g. a church's Administrators). */
  staff(
    type: NotificationTypeCode,
    groupIds: string[],
    roles: MemberRole[],
    content: NotifyContent,
    groupId: string | null = groupIds[0] ?? null,
  ) {
    if (!groupIds.length) return Promise.resolve();
    return this.send({ type, to: "staff", groupIds, roles, groupId, ...content });
  }

  podcastFollowers(podcastId: string, content: NotifyContent) {
    return this.send({ type: "PODCAST_EPISODE", to: "podcast-followers", podcastId, ...content });
  }

  /** Once per link: a retried or repeated approval doesn't notify followers twice. */
  churchFollowers(churchId: string, content: NotifyContent, exceptMemberId: string | null = null) {
    return this.send({
      type: "CHURCH_POST",
      to: "church-followers",
      churchId,
      exceptMemberId,
      groupId: churchId,
      ...content,
    });
  }
}
