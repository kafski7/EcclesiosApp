import { describe, expect, it } from "vitest";
import { bookParams, throttleLatest } from "./books";

describe("books helpers (D-036)", () => {
  it("builds catalogue queries", () => {
    expect(bookParams({ q: " saints ", category: "SAINTS", price: "free" }, 2)).toBe("page=2&q=saints&category=SAINTS&price=free");
    expect(bookParams({ q: "", category: null, price: null }, 1)).toBe("page=1");
  });
  it("throttles to the latest value and flushes", () => {
    const seen: number[] = [];
    const t = throttleLatest((n: number) => seen.push(n), 10_000);
    t(1);
    t(2);
    t(3);
    t.flush();
    expect(seen).toEqual([1, 3]);
  });
});
