import { describe, expect, it } from "vitest";
import { sampleReadingDays } from "./readings";

describe("sample readings (D-022)", () => {
  const days = sampleReadingDays("2026-10-02");
  it("covers 3 days back to 10 days ahead", () => {
    expect(days.length).toBe(14);
    expect(days[0]!.date).toBe("2026-09-29");
    expect(days.at(-1)!.date).toBe("2026-10-12");
  });
  it("Sundays get four readings, weekdays three; every day has a Gospel", () => {
    const sunday = days.find((d) => d.date === "2026-10-04")!;
    expect(sunday.readings.map((r) => r.kind)).toEqual(["FIRST", "PSALM", "SECOND", "GOSPEL"]);
    expect(days.find((d) => d.date === "2026-10-02")!.readings.length).toBe(3);
    expect(days.every((d) => d.readings.some((r) => r.kind === "GOSPEL"))).toBe(true);
  });
  it("is clearly labelled placeholder text, never lectionary prose", () => {
    for (const d of days) for (const r of d.readings) expect(r.text[0]!.startsWith("[Development text]")).toBe(true);
  });
});
