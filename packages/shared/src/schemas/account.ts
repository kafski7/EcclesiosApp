import { z } from "zod";
import { MemberRoleSchema } from "../enums.js";
import { IdentifierSchema, PasswordSchema } from "./auth.js";
import { optionalPhone } from "./common.js";

// ------------------------------------------------------------------ claim & password (D-039)

/** POST /api/auth/claim — a person added by their church proves their email or phone, then sets a password. */
export const ClaimRequestSchema = z.object({ identifier: IdentifierSchema });

export const ChangePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: PasswordSchema })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Choose a different password",
    path: ["newPassword"],
  });
export type ChangePassword = z.input<typeof ChangePasswordSchema>;

// ------------------------------------------------------------------ own profile

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => (v ? v : null));

export const OwnProfileSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  otherNames: z.string().nullable(),
  lastName: z.string(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  address: z.string().nullable(),
  occupation: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  homeChurch: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
});
export type OwnProfile = z.infer<typeof OwnProfileSchema>;

/** Names, birth date and sacraments are kept by the home church (D-016); contact details are the person's own. */
export const UpdateOwnProfileSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address")
      .max(254)
      .nullable()
      .default(null)
      .or(z.literal("").transform(() => null)),
    telephone: optionalPhone().default(null),
    address: optionalText(300),
    occupation: optionalText(120),
  })
  .refine((v) => Boolean(v.email || v.telephone), {
    message: "Keep an email address or a phone number so you can sign in",
    path: ["email"],
  });
export type UpdateOwnProfile = z.input<typeof UpdateOwnProfileSchema>;

// ------------------------------------------------------------------ notifications

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  /** In-app path, or null. */
  link: z.string().nullable(),
  church: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const NotificationQuerySchema = z.object({
  unread: z.enum(["0", "1"]).default("0"),
  /** Only this church's notifications (the CMS uses it). */
  church: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export const NotificationListSchema = z.object({
  items: z.array(NotificationSchema),
  page: z.number().int(),
  hasMore: z.boolean(),
  unread: z.number().int(),
});
export const UnreadCountSchema = z.object({ unread: z.number().int() });

// ------------------------------------------------------------------ staff (Users & Roles)

export const StaffMemberSchema = z.object({
  personId: z.string().uuid(),
  name: z.string(),
  role: MemberRoleSchema,
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  photoUrl: z.string().url().nullable(),
  hasAccount: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  /** Societies / committees they lead here. */
  leads: z.array(z.string()),
  isYou: z.boolean(),
});
export type StaffMember = z.infer<typeof StaffMemberSchema>;
export const StaffListSchema = z.object({
  items: z.array(StaffMemberSchema),
  canManage: z.boolean(),
});

// ------------------------------------------------------------------ church settings

const Option = z.object({ code: z.string(), name: z.string() });
export const ChurchSettingsSchema = z.object({
  themeCode: z.string().nullable(),
  languageCode: z.string().nullable(),
  currencyCode: z.string().nullable(),
  allowManualTransactionDates: z.boolean(),
  /** Suffragan dioceses only (blueprint §3.4, D-002): what the metropolitan archdiocese sees. */
  metropolitanVisibility: z.enum(["hidden", "aggregates", "detailed"]).nullable(),
  canEdit: z.boolean(),
  options: z.object({
    themes: z.array(Option.extend({ primary: z.string().nullable() })),
    languages: z.array(Option),
    currencies: z.array(Option.extend({ symbol: z.string() })),
  }),
});
export type ChurchSettings = z.infer<typeof ChurchSettingsSchema>;

export const UpdateChurchSettingsSchema = z.object({
  themeCode: z.string().max(50).nullable(),
  languageCode: z.string().max(10).nullable(),
  currencyCode: z.string().length(3).nullable(),
  allowManualTransactionDates: z.boolean(),
  /** Ignored unless the church is a suffragan diocese. */
  metropolitanVisibility: z.enum(["hidden", "aggregates", "detailed"]).optional(),
});
export type UpdateChurchSettings = z.input<typeof UpdateChurchSettingsSchema>;
