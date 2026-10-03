import { describe, expect, it } from "vitest";
import { makeTree } from "./fixture.js";
import {
  canStartTrial,
  evaluateSubscription,
  isCmsOpen,
  latestSubscription,
  subscriptionHolderId,
} from "./subscriptions.js";

const now = new Date("2026-10-02T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("subscriptionHolderId (functionality §6)", () => {
  const { g } = makeTree();
  it("a parish holds its own; an outstation rides on its parish", () => {
    expect(subscriptionHolderId(g("parA1"))).toBe("parA1");
    expect(subscriptionHolderId(g("outA1a"))).toBe("parA1");
    expect(subscriptionHolderId(g("outA2a"))).toBe("parA2");
  });
  it("monitoring levels are not gated", () => {
    for (const k of ["deanA", "dio", "arch", "prov"]) expect(subscriptionHolderId(g(k))).toBe(null);
  });
});

describe("evaluateSubscription", () => {
  it("NONE when there is no row", () => {
    expect(evaluateSubscription(undefined, now)).toEqual({
      state: "NONE",
      daysLeft: null,
      expiringSoon: false,
    });
  });
  it("ACTIVE and TRIAL while in date", () => {
    expect(
      evaluateSubscription({ status: "ACTIVE", startsAt: days(-30), expiresAt: days(200) }, now),
    ).toMatchObject({
      state: "ACTIVE",
      daysLeft: 200,
      expiringSoon: false,
    });
    expect(
      evaluateSubscription({ status: "TRIAL", startsAt: days(-5), expiresAt: days(3) }, now),
    ).toMatchObject({
      state: "TRIAL",
      expiringSoon: true,
    });
  });
  it("past expiry is EXPIRED even if the status was never flipped", () => {
    expect(
      evaluateSubscription({ status: "ACTIVE", startsAt: days(-400), expiresAt: days(-1) }, now)
        .state,
    ).toBe("EXPIRED");
  });
  it("EXPIRED, CANCELLED and not-yet-started rows are closed", () => {
    expect(
      evaluateSubscription({ status: "EXPIRED", startsAt: days(-400), expiresAt: days(-35) }, now)
        .state,
    ).toBe("EXPIRED");
    expect(
      evaluateSubscription({ status: "CANCELLED", startsAt: days(-10), expiresAt: days(100) }, now)
        .state,
    ).toBe("EXPIRED");
    expect(
      evaluateSubscription({ status: "ACTIVE", startsAt: days(2), expiresAt: days(300) }, now)
        .state,
    ).toBe("EXPIRED");
  });
  it("only ACTIVE and TRIAL open the CMS", () => {
    expect(["ACTIVE", "TRIAL", "EXPIRED", "NONE"].map((s) => isCmsOpen(s as never))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("history helpers", () => {
  const old = { status: "EXPIRED" as const, startsAt: days(-400), expiresAt: days(-35) };
  const cur = { status: "ACTIVE" as const, startsAt: days(-10), expiresAt: days(355) };
  it("latest row wins", () => {
    expect(latestSubscription([old, cur])).toBe(cur);
    expect(latestSubscription([])).toBeUndefined();
  });
  it("trial only if never subscribed", () => {
    expect(canStartTrial([])).toBe(true);
    expect(canStartTrial([old])).toBe(false);
  });
});
