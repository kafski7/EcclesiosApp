import { describe, expect, it } from "vitest";
import {
  csvField,
  csvRow,
  daysUntilBirthday,
  leavesNoAdministrator,
  recordProblems,
  turningAge,
  upcomingBirthdays,
} from "./register.js";

describe("birthdays (D-037)", () => {
  it("counts days to the next birthday, across the new year and for 29 February", () => {
    expect(daysUntilBirthday("1990-10-06", "2026-10-06")).toBe(0);
    expect(daysUntilBirthday("1990-10-10", "2026-10-06")).toBe(4);
    expect(daysUntilBirthday("1990-01-02", "2026-12-31")).toBe(2);
    expect(daysUntilBirthday("2000-02-29", "2027-02-27")).toBe(1); // 28 Feb in a common year
    expect(daysUntilBirthday("2000-02-29", "2028-02-27")).toBe(2);
  });
  it("the age they're turning", () => {
    expect(turningAge("1990-10-06", "2026-10-06")).toBe(36);
    expect(turningAge("1990-01-02", "2026-12-31")).toBe(37);
  });
  it("lists the living, soonest first, within the window", () => {
    const rows = [
      { firstName: "A", lastName: "Z", dateOfBirth: "1990-10-08", isDeceased: false },
      { firstName: "B", lastName: "Y", dateOfBirth: "1980-10-06", isDeceased: false },
      { firstName: "C", lastName: "X", dateOfBirth: "1970-10-06", isDeceased: true },
      { firstName: "D", lastName: "W", dateOfBirth: null, isDeceased: false },
      { firstName: "E", lastName: "V", dateOfBirth: "1970-12-25", isDeceased: false },
    ];
    expect(
      upcomingBirthdays(rows, "2026-10-06", 30).map((r) => [r.firstName, r.inDays, r.turning]),
    ).toEqual([
      ["B", 0, 46],
      ["A", 2, 36],
    ]);
  });
});

describe("last administrator", () => {
  const roles = [
    { membershipId: "a", role: "ADMINISTRATOR" as const },
    { membershipId: "b", role: "MANAGER" as const },
  ];
  it("blocks removing or demoting the only Administrator", () => {
    expect(leavesNoAdministrator(roles, { membershipId: "a", to: "MANAGER" })).toBe(true);
    expect(leavesNoAdministrator(roles, { membershipId: "a", to: null })).toBe(true);
    expect(leavesNoAdministrator(roles, { membershipId: "b", to: null })).toBe(false);
    expect(
      leavesNoAdministrator([...roles, { membershipId: "c", role: "ADMINISTRATOR" }], {
        membershipId: "a",
        to: null,
      }),
    ).toBe(false);
  });
});

describe("sacramental records", () => {
  const ok = {
    dateOfBirth: "1990-01-01",
    isBaptised: true,
    baptismDate: "1990-02-01",
    isCommunicant: true,
    firstCommunionDate: "1998-05-01",
    isConfirmed: false,
    confirmationDate: null,
    isDeceased: false,
    deceasedOn: null,
  };
  it("accepts a consistent record", () => {
    expect(recordProblems(ok, "2026-10-06")).toEqual([]);
  });
  it("catches order, future dates and missing ticks", () => {
    expect(recordProblems({ ...ok, baptismDate: "1989-01-01" }, "2026-10-06")).toContain(
      "Baptism can't be before birth.",
    );
    expect(
      recordProblems({ ...ok, confirmationDate: "2030-01-01", isConfirmed: true }, "2026-10-06"),
    ).toContain("Confirmation date can't be in the future.");
    expect(recordProblems({ ...ok, isBaptised: false, baptismDate: null }, "2026-10-06")).toContain(
      "First Communion and Confirmation need Baptism first.",
    );
    expect(recordProblems({ ...ok, deceasedOn: "2020-01-01" }, "2026-10-06")).toContain(
      "Tick Deceased, or remove the date of death.",
    );
  });
});

describe("csv", () => {
  it("quotes and neutralises formulas", () => {
    expect(csvField('He said "hi", then left')).toBe('"He said ""hi"", then left"');
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("+233241234567")).toBe("'+233241234567");
    expect(csvRow(["a", null, 3])).toBe("a,,3");
  });
});
