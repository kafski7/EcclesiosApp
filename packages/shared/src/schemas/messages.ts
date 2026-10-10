import { z } from "zod";
import {
  BROADCAST_PEOPLE,
  MESSAGE_CHANNELS,
  MESSAGE_LIMITS,
  MESSAGE_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPE_CODES,
  RECIPIENT_STATUSES,
} from "../domain/messaging.js";
import { HierarchyLevelSchema } from "../enums.js";

/** Messages & broadcasts (functionality §4.7, blueprint §3.3; D-051). */
export const MessageChannelSchema = z.enum(MESSAGE_CHANNELS);
export const MessageStatusSchema = z.enum(MESSAGE_STATUSES);
export const RecipientStatusSchema = z.enum(RECIPIENT_STATUSES);

const ids = z.array(z.string().uuid()).min(1).max(500);

/**
 * Who receives it. CHURCH / SOCIETIES / PEOPLE / BIRTHDAYS_TODAY stay inside the sender's own
 * church (a parish may add its outstations); BROADCAST goes to churches below it.
 */
export const AudienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CHURCH"), includeOutstations: z.boolean().default(false) }),
  z.object({ kind: z.literal("SOCIETIES"), ids }),
  z.object({ kind: z.literal("PEOPLE"), ids }),
  z.object({ kind: z.literal("BIRTHDAYS_TODAY"), includeOutstations: z.boolean().default(false) }),
  z.object({
    kind: z.literal("BROADCAST"),
    levels: z.array(HierarchyLevelSchema).min(1),
    people: z.enum(BROADCAST_PEOPLE).default("STAFF"),
  }),
]);
export type Audience = z.output<typeof AudienceSchema>;
export type AudienceInput = z.input<typeof AudienceSchema>;

export const ComposeMessageSchema = z
  .object({
    channel: MessageChannelSchema,
    audience: AudienceSchema,
    subject: z.string().trim().max(MESSAGE_LIMITS.subject).nullish(),
    body: z.string().trim().min(1, "Write the message"),
  })
  .superRefine((m, ctx) => {
    if (m.body.length > MESSAGE_LIMITS.body[m.channel])
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: `Keep it under ${MESSAGE_LIMITS.body[m.channel]} characters`,
      });
    if (m.channel !== "SMS" && !m.subject)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subject"], message: "Add a subject" });
  });
export type ComposeMessage = z.input<typeof ComposeMessageSchema>;

/** Same body as compose; nothing is sent. */
export const MessagePreviewSchema = z.object({
  recipients: z.number().int(),
  /** Of those, how many can be reached on this channel (phone / email / app). */
  reachable: z.number().int(),
  /** SMS parts per message (estimate; placeholders filled with long stand-ins). */
  segments: z.number().int(),
  /** SMS credit this would use, at most. 0 for email and in-app. */
  cost: z.number().int(),
  smsBalance: z.number().int().nullable(),
  /** Why it can't be sent as it is, or null. */
  blocker: z
    .enum(["NO_RECIPIENTS", "SMS_NOT_AVAILABLE", "INSUFFICIENT_SMS_BALANCE", "SMS_TOO_LONG"])
    .nullable(),
});
export type MessagePreview = z.infer<typeof MessagePreviewSchema>;

/** What the compose screen may offer this church. */
export const MessagingOptionsSchema = z.object({
  church: z.object({ id: z.string().uuid(), name: z.string(), level: HierarchyLevelSchema }),
  channels: z.array(
    z.object({ channel: MessageChannelSchema, available: z.boolean(), reason: z.string().nullable() }),
  ),
  smsBalance: z.number().int().nullable(),
  /** Payer of SMS (the parish), when it isn't this church. */
  smsPayer: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  canIncludeOutstations: z.boolean(),
  broadcastLevels: z.array(HierarchyLevelSchema),
  societies: z.array(
    z.object({ id: z.string().uuid(), name: z.string(), isCommittee: z.boolean(), members: z.number().int() }),
  ),
  birthdaysToday: z.number().int(),
});
export type MessagingOptions = z.infer<typeof MessagingOptionsSchema>;

export const MessageSummarySchema = z.object({
  id: z.string().uuid(),
  channel: MessageChannelSchema,
  subject: z.string().nullable(),
  body: z.string(),
  audienceLabel: z.string(),
  isBroadcast: z.boolean(),
  status: MessageStatusSchema,
  failureReason: z.string().nullable(),
  sender: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  counts: z.object({
    recipients: z.number().int(),
    sent: z.number().int(),
    failed: z.number().int(),
    skipped: z.number().int(),
    pending: z.number().int(),
  }),
  smsUsed: z.number().int(),
  createdAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
});
export type MessageSummary = z.infer<typeof MessageSummarySchema>;

export const MessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  channel: MessageChannelSchema.optional(),
});
export const MessageListSchema = z.object({
  items: z.array(MessageSummarySchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});

export const RecipientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: RecipientStatusSchema.optional(),
});
export const MessageRecipientSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid().nullable(),
  name: z.string(),
  church: z.string().nullable(),
  /** Masked phone / email; null for in-app. */
  destination: z.string().nullable(),
  status: RecipientStatusSchema,
  error: z.string().nullable(),
  segments: z.number().int(),
  sentAt: z.string().datetime().nullable(),
});
export const MessageRecipientListSchema = z.object({
  items: z.array(MessageRecipientSchema),
  page: z.number().int(),
  hasMore: z.boolean(),
});
export type MessageRecipient = z.infer<typeof MessageRecipientSchema>;

// ------------------------------------------------------------------ notification preferences (D-052)

export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export const NotificationTypeCodeSchema = z.enum(NOTIFICATION_TYPE_CODES);

export const NotificationPreferenceSchema = z.object({
  type: NotificationTypeCodeSchema,
  label: z.string(),
  hint: z.string(),
  mutable: z.boolean(),
  /** One entry per channel offered today (in-app only for now). */
  channels: z.array(z.object({ channel: NotificationChannelSchema, enabled: z.boolean() })),
});
export const NotificationPreferencesSchema = z.object({
  items: z.array(NotificationPreferenceSchema),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdateNotificationPreferencesSchema = z.object({
  changes: z
    .array(
      z.object({
        type: NotificationTypeCodeSchema,
        channel: NotificationChannelSchema.default("IN_APP"),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(50),
});
export type UpdateNotificationPreferences = z.input<typeof UpdateNotificationPreferencesSchema>;
