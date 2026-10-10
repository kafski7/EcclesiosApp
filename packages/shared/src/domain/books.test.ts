import { describe, expect, it } from "vitest";
import {
  bookProblems,
  canEditBookContent,
  canManageBook,
  canMoveOrder,
  canSellBooks,
  formatPrice,
  isOrderExpired,
  nextBookStatus,
  parsePrice,
  refundBlocker,
  sellerBalance,
  splitSale,
  type BookActor,
} from "./books.js";

describe("listing workflow (D-036)", () => {
  it("draft → pending → published → unlisted → pending", () => {
    expect(nextBookStatus("DRAFT", "submit")).toBe("PENDING");
    expect(nextBookStatus("PENDING", "approve")).toBe("PUBLISHED");
    expect(nextBookStatus("PUBLISHED", "unlist")).toBe("UNLISTED");
    expect(nextBookStatus("UNLISTED", "submit")).toBe("PENDING");
    expect(nextBookStatus("PUBLISHED", "submit")).toBe(null);
    expect(nextBookStatus("DRAFT", "approve")).toBe(null);
  });
  it("content edits only off the shelf", () => {
    expect(
      ["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "UNLISTED"].map((s) =>
        canEditBookContent(s as never),
      ),
    ).toEqual([true, false, false, true, true]);
  });
  it("submit needs a file, a description, rights and a valid price", () => {
    expect(
      bookProblems({
        title: "T",
        description: "short",
        fileKey: null,
        priceMinor: 50,
        rightsConfirmed: false,
      }),
    ).toHaveLength(5);
    expect(
      bookProblems({
        title: "Title",
        description: "x".repeat(30),
        fileKey: "k",
        priceMinor: 0,
        rightsConfirmed: true,
      }),
    ).toEqual([]);
  });
});

describe("who may sell", () => {
  const admin: BookActor = { kind: "user", id: "u1", role: "SUPER_ADMIN", privileges: [] };
  const seller: BookActor = { kind: "member", id: "m1", privileges: ["SELL_BOOKS"] };
  const plain: BookActor = { kind: "member", id: "m2", privileges: ["AUTHOR_EXPLORE"] };
  it("privilege or Super-Admin", () => {
    expect([admin, seller, plain].map(canSellBooks)).toEqual([true, true, false]);
    expect(canManageBook(seller, { sellerUserId: null, sellerMemberId: "m1" })).toBe(true);
    expect(canManageBook(seller, { sellerUserId: "m1", sellerMemberId: null })).toBe(false);
    expect(canManageBook(admin, { sellerUserId: null, sellerMemberId: "m1" })).toBe(true);
  });
});

describe("money", () => {
  it("splits always add up", () => {
    expect(splitSale(2500, 2000)).toEqual({ platformMinor: 500, authorMinor: 2000 });
    expect(splitSale(999, 1500)).toEqual({ platformMinor: 150, authorMinor: 849 });
    for (const p of [1, 7, 333, 12345]) {
      const s = splitSale(p, 1750);
      expect(s.platformMinor + s.authorMinor).toBe(p);
    }
    expect(() => splitSale(10.5, 2000)).toThrow();
    expect(() => splitSale(100, 6000)).toThrow();
  });
  it("formats and parses cedis", () => {
    expect(formatPrice(2550)).toBe("GH₵ 25.50");
    expect(formatPrice(0)).toBe("Free");
    expect(parsePrice("25")).toBe(2500);
    expect(parsePrice("25.5")).toBe(2550);
    expect(parsePrice("1,000.05")).toBe(100005);
    expect(parsePrice("2.555")).toBe(null);
    expect(parsePrice("abc")).toBe(null);
  });
  it("balance", () => {
    expect(sellerBalance({ earnedMinor: 10000, refundedMinor: 2000, paidOutMinor: 5000 })).toBe(
      3000,
    );
  });
});

describe("orders and refunds", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const day = 86_400_000;
  const base = {
    status: "PAID" as const,
    paidAt: new Date(now.getTime() - 2 * day),
    percentRead: 3,
    now,
    refundedBefore: false,
    pendingRequest: false,
  };
  it("order transitions and expiry", () => {
    expect(canMoveOrder("PENDING", "PAID")).toBe(true);
    expect(canMoveOrder("PAID", "PENDING")).toBe(false);
    expect(canMoveOrder("PAID", "REFUNDED")).toBe(true);
    expect(
      isOrderExpired(
        { status: "PENDING", createdAt: new Date(now.getTime() - 2 * 3_600_000) },
        now,
      ),
    ).toBe(true);
    expect(isOrderExpired({ status: "PAID", createdAt: new Date(0) }, now)).toBe(false);
  });
  it("refund rules", () => {
    expect(refundBlocker(base)).toBe(null);
    expect(refundBlocker({ ...base, paidAt: new Date(now.getTime() - 8 * day) })).toBe(
      "WINDOW_CLOSED",
    );
    expect(refundBlocker({ ...base, percentRead: 10 })).toBe("READ_TOO_MUCH");
    expect(refundBlocker({ ...base, refundedBefore: true })).toBe("ALREADY_REFUNDED");
    expect(refundBlocker({ ...base, pendingRequest: true })).toBe("ALREADY_REQUESTED");
    expect(refundBlocker({ ...base, status: "PENDING" })).toBe("NOT_PAID");
  });
});
