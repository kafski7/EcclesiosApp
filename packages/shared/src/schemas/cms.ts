import { z } from "zod";
import { PLAN_CODES, SUBSCRIPTION_STATES } from "../domain/subscriptions.js";
import { HierarchyLevelSchema, MemberRoleSchema } from "../enums.js";

export const SubscriptionStateSchema = z.enum(SUBSCRIPTION_STATES);
export const PlanCodeSchema = z.enum(PLAN_CODES);

/** A platform plan (functionality §4.11). Price is a decimal string. */
export const PlanSchema = z.object({
  code: PlanCodeSchema,
  name: z.string(),
  price: z.string(),
  currencyCode: z.string(),
  durationDays: z.number().int(),
  trialDays: z.number().int(),
  smsIncluded: z.number().int(),
  maxMembers: z.number().int().nullable(),
  features: z.array(z.string()),
});
export type Plan = z.infer<typeof PlanSchema>;
export const PlansResponseSchema = z.object({ items: z.array(PlanSchema) });

/** Subscription covering a church — null on the context when the level is not gated (D-020). */
export const SubscriptionSummarySchema = z.object({
  holder: z.object({ id: z.string().uuid(), name: z.string() }),
  state: SubscriptionStateSchema,
  plan: z.object({ code: PlanCodeSchema, name: z.string() }).nullable(),
  expiresAt: z.string().datetime().nullable(),
  daysLeft: z.number().int().nullable(),
  expiringSoon: z.boolean(),
  smsBalance: z.number().int(),
  /** The caller may start the one-time free trial (holder Administrator, never subscribed). */
  canStartTrial: z.boolean(),
});
export type SubscriptionSummary = z.infer<typeof SubscriptionSummarySchema>;

/** One church the signed-in person can manage in the CMS (functionality §4.13). */
export const CmsContextSchema = z.object({
  group: z.object({
    id: z.string().uuid(),
    name: z.string(),
    level: HierarchyLevelSchema,
    /** For outstations: the parish that oversees it. */
    parent: z.string().nullable(),
  }),
  role: MemberRoleSchema,
  subscription: SubscriptionSummarySchema.nullable(),
});
export type CmsContext = z.infer<typeof CmsContextSchema>;

export const CmsContextsResponseSchema = z.object({
  person: z.object({ id: z.string().uuid(), firstName: z.string(), lastName: z.string() }),
  contexts: z.array(CmsContextSchema),
});
export type CmsContextsResponse = z.infer<typeof CmsContextsResponseSchema>;

export const StartTrialRequestSchema = z.object({ planCode: PlanCodeSchema });
export type StartTrialRequest = z.infer<typeof StartTrialRequestSchema>;

/** GET /api/cms/groups/:groupId/dashboard (functionality §4.1). */
export const CmsDashboardSchema = z.object({
  groupId: z.string().uuid(),
  members: z.number().int(),
  pendingRequests: z.number().int(),
  societies: z.number().int(),
  committees: z.number().int(),
  birthdaysToday: z.number().int(),
  unreadNotifications: z.number().int(),
});
export type CmsDashboard = z.infer<typeof CmsDashboardSchema>;

// ------------------------------------------------------------------ platform (Super-Admin)
export const PlatformOverviewSchema = z.object({
  churches: z.object({
    parishes: z.number().int(),
    outstations: z.number().int(),
    total: z.number().int(),
  }),
  people: z.object({ members: z.number().int(), pendingMemberships: z.number().int() }),
  subscriptions: z.object({
    active: z.number().int(),
    trial: z.number().int(),
    expired: z.number().int(),
    none: z.number().int(),
    expiringSoon: z.number().int(),
  }),
});
export type PlatformOverview = z.infer<typeof PlatformOverviewSchema>;

export const PlatformSubscriptionRowSchema = z.object({
  parish: z.object({ id: z.string().uuid(), name: z.string(), code: z.string().nullable() }),
  diocese: z.string().nullable(),
  outstations: z.number().int(),
  state: SubscriptionStateSchema,
  plan: z.object({ code: PlanCodeSchema, name: z.string() }).nullable(),
  expiresAt: z.string().datetime().nullable(),
  daysLeft: z.number().int().nullable(),
  smsBalance: z.number().int(),
});
export type PlatformSubscriptionRow = z.infer<typeof PlatformSubscriptionRowSchema>;
export const PlatformSubscriptionListSchema = z.object({
  items: z.array(PlatformSubscriptionRowSchema),
});

/** Manual activation / renewal / upgrade by a Super-Admin until online payment exists (D-021). */
export const GrantSubscriptionRequestSchema = z.object({
  parishId: z.string().uuid(),
  planCode: PlanCodeSchema,
  /** Length of the new period; defaults to the plan's duration. */
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(3 * 366)
    .optional(),
  /** Free-text reference, e.g. a receipt or mobile-money transaction id. */
  reference: z.string().trim().min(3, "Add a payment reference").max(120),
});
export type GrantSubscriptionRequest = z.infer<typeof GrantSubscriptionRequestSchema>;

export const CMS_ERROR_CODES = [
  "SUBSCRIPTION_REQUIRED",
  "TRIAL_NOT_AVAILABLE",
  "NOT_A_PARISH",
  "PLAN_NOT_FOUND",
  "FORBIDDEN",
] as const;
