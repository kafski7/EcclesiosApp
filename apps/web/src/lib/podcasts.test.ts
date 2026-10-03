import { describe, expect, it } from "vitest";
import { coverInitials, formatEpisodeDuration } from "./podcasts";

describe("podcast helpers", () => {
  it("cover initials", () => {
    expect(coverInitials("Ecclesios Weekly")).toBe("EW");
    expect(coverInitials("Youth on Fire")).toBe("YO");
  });
  it("durations", () => {
    expect(formatEpisodeDuration(600)).toBe("10:00");
  });
});
