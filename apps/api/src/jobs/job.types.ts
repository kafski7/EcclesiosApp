import type { AccountKind, MemberRole, NotificationTypeCode } from "@ecclesios/shared";

/**
 * Every background job, its queue and retry policy (functionality §6, D-050).
 * Nothing slow runs in a request handler: handlers add a job; a worker does the work.
 */
export const QUEUES = ["messages", "notifications", "scheduled", "accounting"] as const;
export type QueueName = (typeof QUEUES)[number];

/** A one-time code on its way out. Held in Redis only until sent (removed on completion and failure). */
export interface OtpJob {
  kind: AccountKind;
  accountId: string;
  destination: string;
  code: string;
  expiresAt: string;
}

export interface NotifyContent {
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Who a notification goes to; the worker resolves it, drops whoever switched the type off, and inserts. */
export type NotifyJob = NotifyContent & {
  type: NotificationTypeCode;
  /** The church it's about (the console filters on it). */
  groupId?: string | null;
} & (
    | { to: "people"; memberIds?: string[]; userIds?: string[] }
    | { to: "staff"; groupIds: string[]; roles: MemberRole[] }
    | { to: "podcast-followers"; podcastId: string }
    | { to: "church-followers"; churchId: string; exceptMemberId?: string | null }
  );

export interface JobPayloads {
  "otp.send": OtpJob;
  /** Resolve the audience, charge SMS credit, write recipients, queue delivery. */
  "message.expand": { messageId: string };
  /** Send to a batch of recipients; failures are retried, then recorded. */
  "message.deliver": { messageId: string; recipientIds: string[] };
  notify: NotifyJob;
  /** Daily: today's celebrants to each church's staff. `day` (YYYY-MM-DD) for a manual run. */
  "digest.birthdays": { day?: string };
  /** Post an approved outstation collection to the accounting service (D-041). */
  "collection.sync": { collectionId: string; actorId: string; parishId: string; ip: string | null };
}
export type JobName = keyof JobPayloads;

export interface JobSpec {
  queue: QueueName;
  attempts: number;
  /** First retry delay; doubles each time. */
  backoffMs: number;
  /** Drop the job from Redis once done (always for anything holding a secret). */
  forget?: boolean;
}

export const JOB_SPECS: Record<JobName, JobSpec> = {
  "otp.send": { queue: "messages", attempts: 3, backoffMs: 2_000, forget: true },
  "message.expand": { queue: "messages", attempts: 3, backoffMs: 10_000 },
  "message.deliver": { queue: "messages", attempts: 4, backoffMs: 30_000 },
  notify: { queue: "notifications", attempts: 3, backoffMs: 5_000 },
  "digest.birthdays": { queue: "scheduled", attempts: 3, backoffMs: 60_000 },
  "collection.sync": { queue: "accounting", attempts: 3, backoffMs: 60_000 },
};

export interface JobContext {
  /** 1-based. */
  attempt: number;
  /** No retry follows if this attempt throws — record the failure now. */
  final: boolean;
}

export type JobHandler<N extends JobName> = (data: JobPayloads[N], ctx: JobContext) => Promise<void>;

export interface AddOptions {
  /** Same id = same job (BullMQ ignores the duplicate). No ":" allowed. */
  jobId?: string;
  delayMs?: number;
}
