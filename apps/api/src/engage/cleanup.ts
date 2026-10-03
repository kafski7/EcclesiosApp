import { reactions } from "@ecclesios/db";
import type { EngageKind } from "@ecclesios/shared/domain";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/db.module";

/** Reactions have no FK to their item (D-035): call this when an item is deleted. */
export const deleteReactions = (db: Database, kind: EngageKind, itemId: string) =>
  db.delete(reactions).where(and(eq(reactions.kind, kind), eq(reactions.itemId, itemId)));
