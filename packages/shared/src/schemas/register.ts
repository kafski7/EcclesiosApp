import { z } from "zod";
import { optionalPhone } from "./common.js";
import { MEMBER_ROLES, MEMBERSHIP_STATUSES } from "../domain/index.js";
import { IsoDateSchema } from "./readings.js";

const Role = z.enum(MEMBER_ROLES);
const optDate = IsoDateSchema.nullable().default(null);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => (v ? v : null));

/** Church register query (D-037). */
export const RegisterQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["ACTIVE", "LEFT"]).default("ACTIVE"),
  role: Role.optional(),
  /** Missing sacraments, for catechesis follow-up. */
  missing: z.enum(["baptism", "communion", "confirmation"]).optional(),
  deceased: z.enum(["include", "only"]).optional(),
  /** Parish only: also list its outstations' members. */
  outstations: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type RegisterQuery = z.input<typeof RegisterQuerySchema>;

export const RegisterRowSchema = z.object({
  personId: z.string().uuid(),
  membershipId: z.string().uuid(),
  firstName: z.string(),
  otherNames: z.string().nullable(),
  lastName: z.string(),
  gender: z.string().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  role: Role,
  status: z.enum(MEMBERSHIP_STATUSES),
  isHome: z.boolean(),
  church: z.object({ id: z.string().uuid(), name: z.string() }),
  isBaptised: z.boolean(),
  isCommunicant: z.boolean(),
  isConfirmed: z.boolean(),
  isDeceased: z.boolean(),
  /** Can sign in to Ecclesios (has a password). */
  hasAccount: z.boolean(),
  joinedAt: z.string().datetime(),
});
export type RegisterRow = z.infer<typeof RegisterRowSchema>;
export const RegisterListSchema = z.object({
  items: z.array(RegisterRowSchema),
  page: z.number().int(),
  hasMore: z.boolean(),
  total: z.number().int(),
});

/** Person details + sacramental record (members table). */
export const PersonDetailsSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  otherNames: optText(100),
  lastName: z.string().trim().min(1).max(100),
  gender: z.enum(["MALE", "FEMALE"]).nullable().default(null),
  dateOfBirth: optDate,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email")
    .max(254)
    .nullable()
    .default(null)
    .or(z.literal("").transform(() => null)),
  telephone: optionalPhone().default(null),
  address: optText(500),
  occupation: optText(150),
  isBaptised: z.boolean().default(false),
  baptismDate: optDate,
  baptismPlace: optText(200),
  isCommunicant: z.boolean().default(false),
  firstCommunionDate: optDate,
  isConfirmed: z.boolean().default(false),
  confirmationDate: optDate,
  isDeceased: z.boolean().default(false),
  deceasedOn: optDate,
});
export type PersonDetails = z.input<typeof PersonDetailsSchema>;

/** Add someone to the register (no app account; D-037). */
export const AddMemberSchema = PersonDetailsSchema.extend({ role: Role.default("PARISHIONER") });
export type AddMember = z.input<typeof AddMemberSchema>;

export const ProfilePersonSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  otherNames: z.string().nullable(),
  lastName: z.string(),
  gender: z.enum(["MALE", "FEMALE"]).nullable(),
  dateOfBirth: IsoDateSchema.nullable(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  address: z.string().nullable(),
  occupation: z.string().nullable(),
  isBaptised: z.boolean(),
  baptismDate: IsoDateSchema.nullable(),
  baptismPlace: z.string().nullable(),
  isCommunicant: z.boolean(),
  firstCommunionDate: IsoDateSchema.nullable(),
  isConfirmed: z.boolean(),
  confirmationDate: IsoDateSchema.nullable(),
  isDeceased: z.boolean(),
  deceasedOn: IsoDateSchema.nullable(),
  photoUrl: z.string().url().nullable(),
  hasAccount: z.boolean(),
});
export type ProfilePerson = z.infer<typeof ProfilePersonSchema>;

export const MemberProfileSchema = z.object({
  person: ProfilePersonSchema,
  /** This person's memberships across churches (what this viewer may see). */
  memberships: z.array(
    z.object({
      id: z.string().uuid(),
      church: z.object({ id: z.string().uuid(), name: z.string(), level: z.string() }),
      role: Role,
      status: z.enum(MEMBERSHIP_STATUSES),
      isHome: z.boolean(),
      joinedAt: z.string().datetime(),
    }),
  ),
  societies: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      isCommittee: z.boolean(),
      position: z.string().nullable(),
    }),
  ),
  /** The membership in the church being viewed. */
  here: z
    .object({
      membershipId: z.string().uuid(),
      role: Role,
      status: z.enum(MEMBERSHIP_STATUSES),
      isHome: z.boolean(),
    })
    .nullable(),
  can: z.object({
    /** Edit details and sacramental record: staff of the home church, or its parish (D-016). */
    edit: z.boolean(),
    /** Change role / remove from this church: its Administrators. */
    manageRole: z.boolean(),
    remove: z.boolean(),
  }),
});
export type MemberProfile = z.infer<typeof MemberProfileSchema>;

export const ChangeRoleSchema = z.object({ role: Role });
export const RemoveMemberSchema = z.object({
  reason: z.string().trim().min(3, "Give a short reason").max(300),
});
export const PhotoUploadSchema = z.object({
  contentType: z.string().max(100),
  bytes: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024),
});
export const AttachPhotoSchema = z.object({ key: z.string().min(5).max(300).nullable() });

export const BirthdaysQuerySchema = z.object({
  days: z.coerce.number().int().min(0).max(60).default(30),
  /** The viewer's local date. */
  today: IsoDateSchema.optional(),
});
export const BirthdayListSchema = z.object({
  today: IsoDateSchema,
  items: z.array(
    z.object({
      personId: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      telephone: z.string().nullable(),
      photoUrl: z.string().url().nullable(),
      dateOfBirth: IsoDateSchema,
      inDays: z.number().int(),
      turning: z.number().int(),
      church: z.string(),
    }),
  ),
});
export type BirthdayList = z.infer<typeof BirthdayListSchema>;
