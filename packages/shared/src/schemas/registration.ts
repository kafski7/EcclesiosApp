import { z } from "zod";
import { PasswordSchema } from "./auth.js";

/** A church a person can join: a parish or an outstation (D-014). Public data only. */
export const ChurchOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  level: z.enum(["PARISH", "OUTSTATION"]),
  /** For outstations: the parish that oversees it. */
  parish: z.string().nullable(),
  deanery: z.string().nullable(),
  diocese: z.string().nullable(),
});
export type ChurchOption = z.infer<typeof ChurchOptionSchema>;

export const ChurchSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
});
export const ChurchSearchResponseSchema = z.object({ items: z.array(ChurchOptionSchema) });
export type ChurchSearchResponse = z.infer<typeof ChurchSearchResponseSchema>;

const name = z.string().trim().min(1, "Required").max(100);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Self-registration (functionality §2.4, D-014/D-015). Creates the person (who can sign in
 * straight away) and a PENDING home membership request to the chosen church.
 */
export const RegisterRequestSchema = z
  .object({
    churchId: z.string().uuid("Choose your church"),
    firstName: name,
    lastName: name,
    otherNames: optionalText(100),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address")
      .max(254)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    telephone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/, "Use the format +233241234567")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    gender: z.enum(["MALE", "FEMALE"]).optional(),
    dateOfBirth: z
      .string()
      .date("Use YYYY-MM-DD")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    password: PasswordSchema,
  })
  .refine((v) => Boolean(v.email || v.telephone), {
    message: "Give an email address or a phone number so you can sign in",
    path: ["email"],
  });
export type RegisterRequest = z.input<typeof RegisterRequestSchema>;

export const ChurchRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  level: z.string(),
});
export type ChurchRef = z.infer<typeof ChurchRefSchema>;

export const RegisterResponseSchema = z.object({
  status: z.literal("REGISTERED"),
  /** The home membership request, awaiting the church's approval. */
  membership: z.object({ status: z.literal("PENDING"), church: ChurchRefSchema }),
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
