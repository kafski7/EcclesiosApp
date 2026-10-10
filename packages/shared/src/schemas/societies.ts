import { z } from "zod";

/** Societies & committees (functionality §4.4–4.5, D-038). */
export const SocietyKindSchema = z.enum(["SOCIETY", "COMMITTEE"]);

export const SocietiesQuerySchema = z.object({
  kind: SocietyKindSchema.default("SOCIETY"),
  archived: z.enum(["0", "1"]).default("0"),
});

const PersonRef = z.object({
  id: z.string().uuid(),
  name: z.string(),
  photoUrl: z.string().url().nullable(),
});

export const SocietySummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  kind: SocietyKindSchema,
  isActive: z.boolean(),
  leader: PersonRef.nullable(),
  rosterCount: z.number().int(),
  /** What the caller may do with it. */
  can: z.object({ read: z.boolean(), roster: z.boolean(), manage: z.boolean() }),
});
export type SocietySummary = z.infer<typeof SocietySummarySchema>;
export const SocietyListSchema = z.object({ items: z.array(SocietySummarySchema) });

export const RosterEntrySchema = z.object({
  personId: z.string().uuid(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  photoUrl: z.string().url().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  position: z.string().nullable(),
  isLeader: z.boolean(),
  /** Where their membership is (an outstation, for a parish society). */
  church: z.object({ id: z.string().uuid(), name: z.string() }),
  joinedAt: z.string().datetime(),
});
export type RosterEntry = z.infer<typeof RosterEntrySchema>;

export const SocietySchema = SocietySummarySchema.extend({ roster: z.array(RosterEntrySchema) });
export type Society = z.infer<typeof SocietySchema>;

export const UpsertSocietySchema = z.object({
  name: z.string().trim().min(2, "Give it a name").max(200),
  description: z.string().trim().max(2000).nullable().default(null),
  /** Must be an active member of this church; null = no leader. */
  leaderPersonId: z.string().uuid().nullable().default(null),
});
export type UpsertSociety = z.input<typeof UpsertSocietySchema>;
export const CreateSocietySchema = UpsertSocietySchema.extend({ kind: SocietyKindSchema });
export type CreateSociety = z.input<typeof CreateSocietySchema>;

export const AddToRosterSchema = z.object({
  personId: z.string().uuid(),
  position: z.string().trim().max(60).nullable().default(null),
});
export const SetPositionSchema = z.object({ position: z.string().trim().max(60).nullable() });

/** People who can join a roster: active members of the church (and its outstations, for a parish). */
export const CandidatesQuerySchema = z.object({ q: z.string().trim().max(100).default("") });
export const CandidateSchema = z.object({
  personId: z.string().uuid(),
  name: z.string(),
  church: z.string(),
  telephone: z.string().nullable(),
  /** Can be chosen as leader (an active member of this church itself, not an outstation). */
  canLead: z.boolean(),
});
export const CandidateListSchema = z.object({ items: z.array(CandidateSchema) });
export type Candidate = z.infer<typeof CandidateSchema>;
