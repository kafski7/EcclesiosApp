import { z } from "zod";
import { HOME_TRANSFER_STATUSES, MEMBERSHIP_STATUSES } from "../domain/memberships.js";
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

export const HomeTransferStatusSchema = z.enum(HOME_TRANSFER_STATUSES);

/** The person's own open request to move their home church (D-016, D-049). */
export const MyHomeTransferSchema = z.object({
  id: z.string().uuid(),
  from: ChurchRefSchema.nullable(),
  to: ChurchRefSchema,
  requestedAt: z.string().datetime(),
});
export type MyHomeTransfer = z.infer<typeof MyHomeTransferSchema>;

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
  /** Open home-church transfer request, if any (D-049). */
  homeTransfer: MyHomeTransferSchema.nullable(),
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

/** POST /api/me/home-transfer — ask to make another church (where you're active) your home. */
export const RequestHomeTransferSchema = z.object({
  toGroupId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
export type RequestHomeTransfer = z.infer<typeof RequestHomeTransferSchema>;
export const HomeTransferResponseSchema = z.object({ homeTransfer: MyHomeTransferSchema });

/** GET /api/groups/:groupId/home-transfers — for the receiving church's approvers (D-049). */
export const HomeTransferRequestSchema = z.object({
  id: z.string().uuid(),
  person: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().nullable(),
    telephone: z.string().nullable(),
  }),
  from: ChurchRefSchema.nullable(),
  to: ChurchRefSchema,
  reason: z.string().nullable(),
  requestedAt: z.string().datetime(),
});
export type HomeTransferRequest = z.infer<typeof HomeTransferRequestSchema>;
export const HomeTransferRequestListSchema = z.object({
  items: z.array(HomeTransferRequestSchema),
});

export const MEMBERSHIP_ERROR_CODES = [
  "CHURCH_NOT_FOUND",
  "ALREADY_MEMBER",
  "REQUEST_PENDING",
  "MEMBERSHIP_NOT_FOUND",
  "NOT_ALLOWED",
  "INVALID_TRANSITION",
  "NOT_AN_ACTIVE_MEMBER",
  "ALREADY_HOME",
  "TRANSFER_PENDING",
  "TRANSFER_NOT_FOUND",
] as const;
