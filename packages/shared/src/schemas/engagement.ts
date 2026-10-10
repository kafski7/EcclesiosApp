import { z } from "zod";
import { ENGAGE_KINDS, parseEngageKey } from "../domain/engagement.js";

export const EngageKindSchema = z.enum(ENGAGE_KINDS);
export type EngageKindT = z.infer<typeof EngageKindSchema>;

/** GET /api/public/engage?items=POST:<id>,TEACHING:<id> — up to 100 keys (D-035). */
export const EngageQuerySchema = z.object({
  items: z
    .string()
    .max(100 * 50)
    .transform((s) => [
      ...new Set(
        s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ])
    .refine((keys) => keys.length > 0 && keys.length <= 100, "Between 1 and 100 items")
    .refine((keys) => keys.every((k) => parseEngageKey(k)), "Use KIND:id, e.g. POST:<uuid>"),
});

export const EngageStateSchema = z.object({
  key: z.string(),
  likes: z.number().int(),
  /** The signed-in member's own state; false for guests. */
  liked: z.boolean(),
  saved: z.boolean(),
});
export type EngageState = z.infer<typeof EngageStateSchema>;
export const EngageStateListSchema = z.object({ items: z.array(EngageStateSchema) });

/** One saved item on the Saved page. */
export const SavedItemSchema = z.object({
  kind: EngageKindSchema,
  id: z.string().uuid(),
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
  savedAt: z.string().datetime(),
});
export type SavedItem = z.infer<typeof SavedItemSchema>;
export const SavedListSchema = z.object({ items: z.array(SavedItemSchema) });

/** GET /api/explore/posts/:id/mention-suggestions?q= */
export const MentionQuerySchema = z.object({ q: z.string().trim().max(40).default("") });
export const MentionSuggestionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /** Why they are suggested: in this conversation, or from your church. */
  hint: z.string().nullable(),
});
export type MentionSuggestion = z.infer<typeof MentionSuggestionSchema>;
export const MentionSuggestionListSchema = z.object({ items: z.array(MentionSuggestionSchema) });
