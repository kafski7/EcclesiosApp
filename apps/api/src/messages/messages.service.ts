import { Inject, Injectable } from "@nestjs/common";
import { groups, messageRecipients, messages, members, societies, societyMembers } from "@ecclesios/db";
import {
  SMS_MAX_SEGMENTS,
  estimateSegments,
  evaluateSubscription,
  isCmsOpen,
  latestSubscription,
  localIsoDate,
  subscriptionHolderId,
  type ComposeMessageSchema,
  type MessageChannel,
  type MessagePreview,
  type MessageSummary,
  type MessagingOptions,
  type MessageRecipient,
  type RecipientStatus,
} from "@ecclesios/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { maskDestination } from "../auth/core/crypto";
import { DomainError } from "../auth/core/errors";
import { ENV, type Env } from "../config/env";
import { DB, type Database } from "../db/db.module";
import { qcol } from "../db/qualified";
import { Jobs } from "../jobs/jobs.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { AudienceResolver, type Recipient, type Sender } from "./audience";

type Compose = z.output<typeof ComposeMessageSchema>;
type MessageRow = typeof messages.$inferSelect;
const PAGE = 20;
const RECIPIENT_PAGE = 50;

const notFound = () => new DomainError(404, "MESSAGE_NOT_FOUND", "We couldn't find that message here.");

/** Can this person be reached on the channel at all? */
export const reachable = (r: Recipient, channel: MessageChannel) =>
  channel === "SMS" ? !!r.telephone : channel === "EMAIL" ? !!r.email : r.usesApp;

/**
 * Messages (functionality §4.7, D-051). Requests only check, estimate and queue; the
 * `message.expand` / `message.deliver` workers do the sending (MessagesProcessor).
 * Routes are scope-checked for `write` (OWN) — the church's Administrators and Managers.
 */
@Injectable()
export class MessagesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly audience: AudienceResolver,
    private readonly subs: SubscriptionsService,
    private readonly audit: AuditService,
    private readonly jobs: Jobs,
  ) {}

  today() {
    return localIsoDate(new Date(), this.env.APP_TIMEZONE);
  }

  // ------------------------------------------------------------------ SMS credit

  /**
   * Who pays for SMS and the live subscription row holding the credit. Deaneries and above
   * hold no subscription (D-020): no SMS for them until central procurement exists.
   */
  async smsAccount(sender: Sender) {
    const payerId = subscriptionHolderId(sender);
    if (!payerId) return { payer: null, subscriptionId: null, balance: null };
    const [payer] = await this.db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.id, payerId))
      .limit(1);
    const rows = (await this.subs.historyFor([payerId])).get(payerId) ?? [];
    const latest = latestSubscription(rows);
    const open = latest && isCmsOpen(evaluateSubscription(latest, new Date()).state);
    return {
      payer: payer ?? null,
      subscriptionId: latest && open ? latest.id : null,
      balance: latest && open ? latest.smsBalance : 0,
    };
  }

  // ------------------------------------------------------------------ compose screen

  async options(groupId: string): Promise<MessagingOptions> {
    const sender = await this.audience.sender(groupId);
    const [sms, levels, socs, outstations, birthdays] = await Promise.all([
      this.smsAccount(sender),
      this.audience.presentBroadcastLevels(sender),
      this.db
        .select({
          id: societies.id,
          name: societies.name,
          isCommittee: societies.isCommittee,
          members: sql<number>`(select count(*)::int from ${societyMembers} sm where sm.society_id = ${qcol(societies, societies.id)})`,
        })
        .from(societies)
        .where(and(eq(societies.groupId, groupId), eq(societies.isActive, true)))
        .orderBy(asc(societies.isCommittee), asc(societies.name)),
      sender.level === "PARISH" ? this.audience.ownChurches(sender, true) : Promise.resolve([groupId]),
      this.audience.resolve(sender, { kind: "BIRTHDAYS_TODAY", includeOutstations: false }, this.today()),
    ]);
    const smsReason =
      sms.payer === null
        ? "SMS comes with a parish subscription. Deaneries, dioceses and the province can send email and in-app messages."
        : sms.subscriptionId === null
          ? "The parish subscription isn't active."
          : (sms.balance ?? 0) <= 0
            ? "No SMS credit left — top up under Billing."
            : null;
    return {
      church: { id: sender.id, name: sender.name, level: sender.level },
      channels: [
        { channel: "SMS", available: smsReason === null, reason: smsReason },
        { channel: "EMAIL", available: true, reason: null },
        { channel: "IN_APP", available: true, reason: null },
      ],
      smsBalance: sms.balance,
      smsPayer: sms.payer && sms.payer.id !== groupId ? sms.payer : null,
      canIncludeOutstations: outstations.length > 1,
      broadcastLevels: levels,
      societies: socs,
      birthdaysToday: birthdays.length,
    };
  }

  /** What sending would do. Nothing is written. */
  async preview(groupId: string, m: Compose): Promise<MessagePreview> {
    const sender = await this.audience.sender(groupId);
    const people = await this.audience.resolve(sender, m.audience, this.today());
    const reach = people.filter((r) => reachable(r, m.channel)).length;
    if (m.channel !== "SMS")
      return {
        recipients: people.length,
        reachable: reach,
        segments: 0,
        cost: 0,
        smsBalance: null,
        blocker: reach === 0 ? "NO_RECIPIENTS" : null,
      };
    const segments = estimateSegments(m.body, sender.name);
    const sms = await this.smsAccount(sender);
    const cost = segments * reach;
    const blocker =
      reach === 0
        ? "NO_RECIPIENTS"
        : segments > SMS_MAX_SEGMENTS
          ? "SMS_TOO_LONG"
          : !sms.subscriptionId
            ? "SMS_NOT_AVAILABLE"
            : (sms.balance ?? 0) < cost
              ? "INSUFFICIENT_SMS_BALANCE"
              : null;
    return {
      recipients: people.length,
      reachable: reach,
      segments,
      cost,
      smsBalance: sms.balance,
      blocker,
    };
  }

  /** Check, record and queue. 409 with the blocker's code if it can't go. */
  async send(actorId: string, groupId: string, m: Compose, ip: string): Promise<MessageSummary> {
    const p = await this.preview(groupId, m);
    if (p.blocker) throw blocked(p);
    const sender = await this.audience.sender(groupId);
    const [row] = await this.db
      .insert(messages)
      .values({
        groupId,
        senderMemberId: actorId,
        channel: m.channel,
        subject: m.channel === "SMS" ? null : (m.subject ?? null),
        body: m.body,
        audience: m.audience as unknown as Record<string, unknown>,
        audienceLabel: await this.audience.label(sender, m.audience),
        isBroadcast: m.audience.kind === "BROADCAST",
        recipientCount: p.recipients,
      })
      .returning();
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: m.audience.kind === "BROADCAST" ? "message.broadcast" : "message.queued",
      entityType: "message",
      entityId: row!.id,
      metadata: { channel: m.channel, audience: m.audience, recipients: p.recipients, cost: p.cost },
      ip,
    });
    await this.jobs.add("message.expand", { messageId: row!.id }, { jobId: `msg-${row!.id}` });
    return this.detail(groupId, row!.id);
  }

  // ------------------------------------------------------------------ log

  private async summaries(rows: MessageRow[]): Promise<MessageSummary[]> {
    const senderIds = [...new Set(rows.map((r) => r.senderMemberId).filter((x): x is string => !!x))];
    const names = new Map<string, string>();
    if (senderIds.length) {
      const ppl = await this.db
        .select({ id: members.id, f: members.firstName, l: members.lastName })
        .from(members)
        .where(inArray(members.id, senderIds));
      for (const x of ppl) names.set(x.id, `${x.f} ${x.l}`);
    }
    return rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      subject: r.subject,
      body: r.body,
      audienceLabel: r.audienceLabel,
      isBroadcast: r.isBroadcast,
      status: r.status,
      failureReason: r.failureReason,
      sender: r.senderMemberId
        ? { id: r.senderMemberId, name: names.get(r.senderMemberId) ?? "Unknown" }
        : null,
      counts: {
        recipients: r.recipientCount,
        sent: r.sentCount,
        failed: r.failedCount,
        skipped: r.skippedCount,
        pending: Math.max(0, r.recipientCount - r.sentCount - r.failedCount - r.skippedCount),
      },
      smsUsed: r.smsCharged - r.smsRefunded,
      createdAt: r.createdAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    }));
  }

  async list(groupId: string, page: number, channel?: MessageChannel) {
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.groupId, groupId), channel ? eq(messages.channel, channel) : undefined))
      .orderBy(desc(messages.createdAt))
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE);
    return {
      items: await this.summaries(rows.slice(0, PAGE)),
      page,
      hasMore: rows.length > PAGE,
    };
  }

  async detail(groupId: string, id: string): Promise<MessageSummary> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.groupId, groupId)))
      .limit(1);
    if (!row) throw notFound();
    return (await this.summaries([row]))[0]!;
  }

  async recipients(groupId: string, id: string, page: number, status?: RecipientStatus) {
    await this.detail(groupId, id);
    const rows = await this.db
      .select({
        r: messageRecipients,
        church: groups.name,
      })
      .from(messageRecipients)
      .leftJoin(groups, eq(groups.id, messageRecipients.groupId))
      .where(
        and(
          eq(messageRecipients.messageId, id),
          status ? eq(messageRecipients.status, status) : undefined,
        ),
      )
      .orderBy(asc(messageRecipients.name), asc(messageRecipients.id))
      .limit(RECIPIENT_PAGE + 1)
      .offset((page - 1) * RECIPIENT_PAGE);
    const items: MessageRecipient[] = rows.slice(0, RECIPIENT_PAGE).map(({ r, church }) => ({
      id: r.id,
      personId: r.memberId,
      name: r.name,
      church,
      destination: r.destination ? maskDestination(r.destination) : null,
      status: r.status,
      error: r.error,
      segments: r.segments,
      sentAt: r.sentAt?.toISOString() ?? null,
    }));
    return { items, page, hasMore: rows.length > RECIPIENT_PAGE };
  }
}

const BLOCKER_TEXT: Record<NonNullable<MessagePreview["blocker"]>, string> = {
  NO_RECIPIENTS: "Nobody in that audience can be reached this way.",
  SMS_NOT_AVAILABLE: "SMS isn't available for this church.",
  INSUFFICIENT_SMS_BALANCE: "There isn't enough SMS credit for this message.",
  SMS_TOO_LONG: `An SMS can be at most ${SMS_MAX_SEGMENTS} parts. Shorten the message.`,
};

const blocked = (p: MessagePreview) =>
  new DomainError(409, p.blocker!, BLOCKER_TEXT[p.blocker!], {
    cost: p.cost,
    smsBalance: p.smsBalance,
    reachable: p.reachable,
  });

