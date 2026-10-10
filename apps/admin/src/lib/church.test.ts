import { describe, expect, it } from "vitest";
import { money } from "./church";

describe("money (D-041)", () => {
  it("formats decimal strings without floats", () => {
    expect(money("GHS", "1234.5")).toBe("GH₵ 1,234.50");
    expect(money("NGN", "7")).toBe("NGN 7.00");
  });
});
