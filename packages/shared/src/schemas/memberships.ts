import { z } from "zod";
import { MEMBERSHIP_STATUSES } from "../domain/memberships.js";
import { MemberRoleSchema, PlatformPrivilegeSchema } from "../enums.js";
import { ChurchRefSchema } from "./registration.js";

export const MembershipStatusSchema = z.enum(MEMBERSHIP_STATUSES);

export const MyMembershipSchema = z.object({
  id: z.string().uuid(),
  church: ChurchRefSchema,
  role: MemberRoleSchema,
  status: MembershipStatusSchema,
  isHome: z.boolean(),
  requestedAt: z.string().datetime(),
});
export type MyMembership = z.infer<typeof MyMembershipSchema>;

/** GET /api/me — the signed-in person, their churches and follows (D-014/D-015). */
export const MeResponseSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  privileges: z.array(PlatformPrivilegeSchema),
  memberships: z.array(MyMembershipSchema),
  follows: z.array(ChurchRefSchema),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/** POST /api/groups/:groupId/join — request membership (also follows the church). */
export const JoinResponseSchema = z.object({ membership: MyMembershipSchema });
export type JoinResponse = z.infer<typeof JoinResponseSchema>;

/** GET /api/groups/:groupId/membership-requests — for the church's Administrators (and its parish). */
export const MembershipRequestSchema = z.object({
  id: z.string().uuid(),
  person: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().nullable(),
    telephone: z.string().nullable(),
  }),
  church: ChurchRefSchema,
  isHome: z.boolean(),
  requestedAt: z.string().datetime(),
});
export type MembershipRequest = z.infer<typeof MembershipRequestSchema>;
export const MembershipRequestListSchema = z.object({ items: z.array(MembershipRequestSchema) });

export const MembershipDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), note: z.string().trim().max(500).optional() }),
  z.object({
    decision: z.literal("reject"),
    note: z.string().trim().min(3, "Give a short reason").max(500),
  }),
]);
export type MembershipDecision = z.infer<typeof MembershipDecisionSchema>;

export const MEMBERSHIP_ERROR_CODES = [
  "CHURCH_NOT_FOUND",
  "ALREADY_MEMBER",
  "REQUEST_PENDING",
  "MEMBERSHIP_NOT_FOUND",
  "NOT_ALLOWED",
  "INVALID_TRANSITION",
] as const;
