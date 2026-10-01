import { describe, expect, it } from "vitest";
import { levelRank } from "./domain/levels";
import { HierarchyLevelSchema, MemberRoleSchema } from "./enums";

describe("hierarchy", () => {
  it("orders parish above outstation", () => {
    expect(levelRank("PARISH")).toBeLessThan(levelRank("OUTSTATION"));
  });
  it("rejects unknown levels", () => {
    expect(HierarchyLevelSchema.safeParse("CONTINENT").success).toBe(false);
  });
  it("does not treat SUPER_ADMIN as a member role", () => {
    expect(MemberRoleSchema.safeParse("SUPER_ADMIN").success).toBe(false);
  });
});
