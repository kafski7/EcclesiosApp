import { describe, expect, it } from "vitest";
import {
  addDays,
  baptismOfTheLord,
  easterSunday,
  firstSundayOfAdvent,
  isIsoDate,
  liturgicalDay,
  toIsoDate,
} from "./liturgy.js";

describe("computus and anchor dates", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2038, "2038-04-25"],
  ] as const)("Easter %s = %s", (y, iso) => {
    expect(toIsoDate(easterSunday(y))).toBe(iso);
  });
  it("First Sunday of Advent falls 27 Nov – 3 Dec", () => {
    expect(toIsoDate(firstSundayOfAdvent(2025))).toBe("2025-11-30");
    expect(toIsoDate(firstSundayOfAdvent(2026))).toBe("2026-11-29");
    expect(toIsoDate(firstSundayOfAdvent(2022))).toBe("2022-11-27");
    expect(toIsoDate(firstSundayOfAdvent(2023))).toBe("2023-12-03");
  });
  it("Baptism of the Lord is the Sunday after 6 January", () => {
    expect(toIsoDate(baptismOfTheLord(2026))).toBe("2026-01-11");
    expect(toIsoDate(baptismOfTheLord(2030))).toBe("2030-01-13"); // 6 Jan 2030 is a Sunday
  });
});

describe("liturgicalDay", () => {
  const season = (iso: string) => liturgicalDay(iso).season;
  it("seasons around Easter 2026", () => {
    expect(season("2026-02-17")).toBe("ORDINARY");
    expect(season("2026-02-18")).toBe("LENT"); // Ash Wednesday
    expect(season("2026-04-01")).toBe("LENT"); // Holy Wednesday
    expect(season("2026-04-02")).toBe("TRIDUUM"); // Holy Thursday
    expect(season("2026-04-05")).toBe("EASTER");
    expect(season("2026-05-24")).toBe("EASTER"); // Pentecost
    expect(season("2026-05-25")).toBe("ORDINARY");
  });
  it("Advent and Christmas across the year boundary", () => {
    expect(season("2026-11-28")).toBe("ORDINARY");
    expect(season("2026-11-29")).toBe("ADVENT");
    expect(season("2026-12-24")).toBe("ADVENT");
    expect(season("2026-12-25")).toBe("CHRISTMAS");
    expect(season("2027-01-01")).toBe("CHRISTMAS");
    expect(season("2026-01-11")).toBe("CHRISTMAS"); // Baptism of the Lord
    expect(season("2026-01-12")).toBe("ORDINARY");
  });
  it("Sunday and weekday cycles switch on the First Sunday of Advent", () => {
    expect(liturgicalDay("2026-10-04")).toMatchObject({ sundayCycle: "A", weekdayCycle: "II", isSunday: true });
    expect(liturgicalDay("2026-11-29")).toMatchObject({ sundayCycle: "B", weekdayCycle: "I", liturgicalYear: 2027 });
    expect(liturgicalDay("2025-11-29")).toMatchObject({ sundayCycle: "C", weekdayCycle: "I" });
  });
  it("default colours", () => {
    expect(liturgicalDay("2026-10-02").color).toBe("GREEN");
    expect(liturgicalDay("2026-12-01").color).toBe("VIOLET");
    expect(liturgicalDay("2026-04-12").color).toBe("WHITE");
  });
  it("validates dates strictly", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
