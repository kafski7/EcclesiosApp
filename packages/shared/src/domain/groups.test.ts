import { describe, expect, it } from "vitest";
import { childLevelFor, closeBlocker, suggestCode } from "./groups.js";
import { isValidParent } from "./levels.js";

describe("groups (D-041)", () => {
  it("church Administrators open one level down, and only valid parents", () => {
    expect(childLevelFor("PARISH")).toBe("OUTSTATION");
    expect(childLevelFor("DEANERY")).toBe("PARISH");
    expect(childLevelFor("ARCHDIOCESE")).toBe("DEANERY");
    expect(childLevelFor("OUTSTATION")).toBe(null);
    expect(childLevelFor("PROVINCE")).toBe(null);
    for (const l of ["PARISH", "DEANERY", "DIOCESE", "ARCHDIOCESE"] as const)
      expect(isValidParent(childLevelFor(l)!, l)).toBe(true);
  });
  it("close only when nothing open hangs under it; codes", () => {
    expect(closeBlocker({ activeChildren: 1 })).toBe("HAS_OPEN_CHILDREN");
    expect(closeBlocker({ activeChildren: 0 })).toBe(null);
    expect(suggestCode("St. Monica's  Outstation")).toBe("ST-MONICAS-OUTSTATION");
  });
});
