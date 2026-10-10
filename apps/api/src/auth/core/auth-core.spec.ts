import { describe, expect, it } from "vitest";
import { maskDestination, parseDuration } from "./crypto";
import { JwtError, signJwt, verifyJwt } from "./jwt";
import { caught, makeHarness } from "./testing";

const META = { ip: "203.0.113.7" };
const THERESA = "theresa.pastor@dev.ecclesios.local";
const KOFI = "kofi.asante@dev.ecclesios.local";
const PW = "Ecclesios#2026";

async function signIn(
  h: Awaited<ReturnType<typeof makeHarness>>,
  kind: "member" | "user",
  id: string,
) {
  const ch = await h.core.login(kind, id, PW, META);
  const code = h.sent.at(-1)!.code;
  return { ch, res: await h.core.verifyOtp(ch.challengeToken, code, META) };
}

describe("login → OTP → tokens (functionality §2)", () => {
  it("member happy path issues tokens naming the person only (D-015)", async () => {
    const h = await makeHarness();
    const { ch, res } = await signIn(h, "member", THERESA);
    expect(ch.expiresInSeconds).toBe(600);
    expect(ch.delivery.destination).toBe("t***@dev.ecclesios.local");
    expect(res.status).toBe("AUTHENTICATED");
    if (res.status !== "AUTHENTICATED") return;
    expect(res.principal).toEqual({ kind: "member", id: "00000000-0000-4000-8000-000000000507" });
    expect(h.core.verifyAccessToken(res.accessToken)).toEqual(res.principal);
  });

  it("platform user signs in through the users store only", async () => {
    const h = await makeHarness();
    const { res } = await signIn(h, "user", "superadmin@dev.ecclesios.local");
    expect(
      res.status === "AUTHENTICATED" && res.principal.kind === "user" && res.principal.role,
    ).toBe("SUPER_ADMIN");
    const e = await caught(() =>
      h.core.login("member", "superadmin@dev.ecclesios.local", PW, META),
    );
    expect(e.code).toBe("INVALID_CREDENTIALS");
  });

  it("accepts telephone as identifier", async () => {
    const h = await makeHarness();
    const ch = await h.core.login("member", "+2332000000508", PW, META);
    expect(typeof ch.challengeToken).toBe("string");
  });

  it("stores only a hash of the OTP", async () => {
    const h = await makeHarness();
    await h.core.login("member", THERESA, PW, META);
    const row = h.stores.member.rows.get("00000000-0000-4000-8000-000000000507")!;
    expect(row.otpHash === h.sent[0]!.code).toBe(false);
    expect(row.otpHash!.length).toBe(64);
  });
});

describe("credential failures", () => {
  it("unknown account and wrong password look identical", async () => {
    const h = await makeHarness();
    const a = await caught(() => h.core.login("member", "nobody@x.org", PW, META));
    const b = await caught(() => h.core.login("member", THERESA, "wrong-password-1", META));
    expect(a.code).toBe("INVALID_CREDENTIALS");
    expect(b.code).toBe("INVALID_CREDENTIALS");
    expect(a.status).toBe(401);
  });

  it("locks after 5 bad passwords, then refuses even the right one until the lock expires", async () => {
    const h = await makeHarness({
      rate: { ipLimit: 100, identifierLimit: 100, windowMs: 900_000 },
    });
    for (let i = 0; i < 4; i++)
      expect(
        (await caught(() => h.core.login("member", THERESA, "bad-password-0", META))).code,
      ).toBe("INVALID_CREDENTIALS");
    expect((await caught(() => h.core.login("member", THERESA, "bad-password-0", META))).code).toBe(
      "ACCOUNT_LOCKED",
    );
    expect((await caught(() => h.core.login("member", THERESA, PW, META))).code).toBe(
      "ACCOUNT_LOCKED",
    );
    h.advance(15 * 60 + 1);
    const ch = await h.core.login("member", THERESA, PW, META);
    expect(typeof ch.challengeToken).toBe("string");
  });

  it("a person whose church membership is still pending signs in normally (D-015)", async () => {
    const h = await makeHarness();
    const { res } = await signIn(h, "member", "pending@dev.ecclesios.local");
    expect(res.status).toBe("AUTHENTICATED");
  });

  it("disabled accounts are only revealed after a correct password", async () => {
    const h = await makeHarness();
    expect(
      (
        await caught(() =>
          h.core.login("member", "inactive@dev.ecclesios.local", "nope-nope-1", META),
        )
      ).code,
    ).toBe("INVALID_CREDENTIALS");
    expect(
      (await caught(() => h.core.login("member", "inactive@dev.ecclesios.local", PW, META))).code,
    ).toBe("ACCOUNT_DISABLED");
  });
});

describe("OTP rules", () => {
  it("is single-use", async () => {
    const h = await makeHarness();
    const ch = await h.core.login("member", THERESA, PW, META);
    const code = h.sent[0]!.code;
    await h.core.verifyOtp(ch.challengeToken, code, META);
    expect((await caught(() => h.core.verifyOtp(ch.challengeToken, code, META))).code).toBe(
      "INVALID_CHALLENGE",
    );
  });

  it("expires after 10 minutes", async () => {
    const h = await makeHarness();
    const ch = await h.core.login("member", THERESA, PW, META);
    h.advance(601);
    const e = await caught(() => h.core.verifyOtp(ch.challengeToken, h.sent[0]!.code, META));
    expect(["OTP_EXPIRED", "INVALID_CHALLENGE"].includes(e.code!)).toBe(true);
  });

  it("allows 5 wrong codes then kills the challenge", async () => {
    const h = await makeHarness();
    const ch = await h.core.login("member", THERESA, PW, META);
    const wrong = h.sent[0]!.code === "000000" ? "111111" : "000000";
    for (let left = 4; left >= 1; left--) {
      const e = await caught(() => h.core.verifyOtp(ch.challengeToken, wrong, META));
      expect(e.code).toBe("INVALID_OTP");
      expect((e.details as { attemptsLeft: number }).attemptsLeft).toBe(left);
    }
    expect((await caught(() => h.core.verifyOtp(ch.challengeToken, wrong, META))).code).toBe(
      "OTP_ATTEMPTS_EXCEEDED",
    );
    expect(
      (await caught(() => h.core.verifyOtp(ch.challengeToken, h.sent[0]!.code, META))).code,
    ).toBe("INVALID_CHALLENGE");
  });

  it("rejects a tampered challenge token", async () => {
    const h = await makeHarness();
    const ch = await h.core.login("member", THERESA, PW, META);
    const t = ch.challengeToken.slice(0, -2) + (ch.challengeToken.endsWith("A") ? "BB" : "AA");
    expect((await caught(() => h.core.verifyOtp(t, h.sent[0]!.code, META))).code).toBe(
      "INVALID_CHALLENGE",
    );
  });

  it("a challenge token is not an access token", async () => {
    const h = await makeHarness();
    const ch = await h.core.login("member", THERESA, PW, META);
    let threw = false;
    try {
      h.core.verifyAccessToken(ch.challengeToken);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

describe("first login → set password", () => {
  it("returns a tempToken, then set-password signs in and stamps first_login", async () => {
    const h = await makeHarness();
    const { res } = await signIn(h, "member", KOFI);
    expect(res.status).toBe("PASSWORD_SETUP_REQUIRED");
    if (res.status !== "PASSWORD_SETUP_REQUIRED") return;
    expect(res.expiresInSeconds).toBe(900);
    const pair = await h.core.setPassword(res.tempToken, "NewPassword2026", META);
    expect(pair.principal.kind).toBe("member");
    const row = h.stores.member.rows.get("00000000-0000-4000-8000-000000000517")!;
    expect(row.firstLogin !== null && row.tempTokenHash === null).toBe(true);
    // temp token is single use
    expect(
      (await caught(() => h.core.setPassword(res.tempToken, "Another2026pw", META))).code,
    ).toBe("INVALID_TEMP_TOKEN");
    // new password works; next login goes straight to tokens
    const ch = await h.core.login("member", KOFI, "NewPassword2026", META);
    const r2 = await h.core.verifyOtp(ch.challengeToken, h.sent.at(-1)!.code, META);
    expect(r2.status).toBe("AUTHENTICATED");
  });

  it("temp token expires after 15 minutes", async () => {
    const h = await makeHarness();
    const { res } = await signIn(h, "member", KOFI);
    if (res.status !== "PASSWORD_SETUP_REQUIRED") throw new Error("expected setup");
    h.advance(901);
    expect(
      (await caught(() => h.core.setPassword(res.tempToken, "NewPassword2026", META))).code,
    ).toBe("INVALID_TEMP_TOKEN");
  });
});

describe("refresh rotation & logout", () => {
  it("rotates; reusing the old token revokes the session", async () => {
    const h = await makeHarness();
    const { res } = await signIn(h, "member", THERESA);
    if (res.status !== "AUTHENTICATED") throw new Error("expected tokens");
    const second = await h.core.refresh(res.refreshToken, META);
    expect(second.refreshToken === res.refreshToken).toBe(false);
    expect((await caught(() => h.core.refresh(res.refreshToken, META))).code).toBe(
      "INVALID_REFRESH_TOKEN",
    );
    // reuse detection revoked the live token too
    expect((await caught(() => h.core.refresh(second.refreshToken, META))).code).toBe(
      "INVALID_REFRESH_TOKEN",
    );
  });

  it("logout revokes and is idempotent", async () => {
    const h = await makeHarness();
    const { res } = await signIn(h, "member", THERESA);
    if (res.status !== "AUTHENTICATED") throw new Error("expected tokens");
    await h.core.logout(res.refreshToken, META);
    await h.core.logout(res.refreshToken, META);
    await h.core.logout("garbage", META);
    expect((await caught(() => h.core.refresh(res.refreshToken, META))).code).toBe(
      "INVALID_REFRESH_TOKEN",
    );
  });

  it("refresh token expires", async () => {
    const h = await makeHarness();
    const { res } = await signIn(h, "member", THERESA);
    if (res.status !== "AUTHENTICATED") throw new Error("expected tokens");
    h.advance(30 * 86400 + 1);
    expect((await caught(() => h.core.refresh(res.refreshToken, META))).code).toBe(
      "INVALID_REFRESH_TOKEN",
    );
  });
});

describe("rate limiting (functionality §6)", () => {
  it("per identifier: 6th login attempt in the window is refused with Retry-After", async () => {
    const h = await makeHarness();
    for (let i = 0; i < 5; i++)
      await caught(() => h.core.login("member", "nobody@x.org", "whatever-1", META));
    const e = await caught(() => h.core.login("member", "nobody@x.org", "whatever-1", META));
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.status).toBe(429);
    expect((e.retryAfterSec ?? 0) > 0).toBe(true);
  });

  it("per IP across all auth endpoints", async () => {
    const h = await makeHarness({ rate: { ipLimit: 3, identifierLimit: 100, windowMs: 60_000 } });
    for (let i = 0; i < 3; i++)
      await caught(() => h.core.login("member", `u${i}@x.org`, "whatever-1", META));
    expect((await caught(() => h.core.verifyOtp("x".repeat(20), "123456", META))).code).toBe(
      "RATE_LIMITED",
    );
    expect(
      (await caught(() => h.core.login("member", "z@x.org", "whatever-1", { ip: "198.51.100.1" })))
        .code,
    ).toBe("INVALID_CREDENTIALS");
    h.advance(61);
    expect((await caught(() => h.core.login("member", "z@x.org", "whatever-1", META))).code).toBe(
      "INVALID_CREDENTIALS",
    );
  });
});

describe("audit trail", () => {
  it("records failures, OTP sends and successful logins", async () => {
    const h = await makeHarness();
    await caught(() => h.core.login("member", THERESA, "bad-password-0", META));
    await signIn(h, "member", THERESA);
    expect(h.audits.map((a) => a.action)).toEqual([
      "auth.login.failed",
      "auth.otp.sent",
      "auth.login.succeeded",
    ]);
    expect(h.audits[0]!.ip).toBe(META.ip);
  });
});

describe("primitives", () => {
  it("JWT rejects wrong secret, wrong audience, expiry and alg swaps", () => {
    const opts = { issuer: "i", audience: "a" };
    const now = new Date("2026-10-01T00:00:00Z");
    const t = signJwt({ x: 1 }, "s1", 60, opts, now);
    expect(verifyJwt<{ x: number }>(t, "s1", opts, now).x).toBe(1);
    const reason = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as JwtError).reason;
      }
      return "none";
    };
    expect(reason(() => verifyJwt(t, "s2", opts, now))).toBe("signature");
    expect(reason(() => verifyJwt(t, "s1", { issuer: "i", audience: "b" }, now))).toBe("claims");
    expect(reason(() => verifyJwt(t, "s1", opts, new Date(now.getTime() + 61_000)))).toBe(
      "expired",
    );
    const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url");
    expect(reason(() => verifyJwt(`${none}.${t.split(".")[1]}.`, "s1", opts, now))).toBe(
      "malformed",
    );
  });

  it("parses durations and masks destinations", () => {
    expect(parseDuration("15m")).toBe(900);
    expect(parseDuration("30d")).toBe(2_592_000);
    expect(maskDestination("+233241234567")).toBe("+233*****4567");
    let threw = false;
    try {
      parseDuration("15 minutes");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

describe("claim a register entry (D-039)", () => {
  const WALKIN = "00000000-0000-4000-8000-000000000777";
  const addWalkin = (h: Awaited<ReturnType<typeof makeHarness>>) =>
    h.stores.member.add({
      ...h.stores.member.rows.get("00000000-0000-4000-8000-000000000517")!,
      id: WALKIN,
      email: null,
      telephone: "+233209990777",
      passwordHash: null,
      firstLogin: null,
    });

  it("code → set password → signed in; afterwards it can't be claimed again", async () => {
    const h = await makeHarness();
    addWalkin(h);
    const ch = await h.core.startClaim("+233209990777", META);
    const r = await h.core.verifyOtp(ch.challengeToken, h.sent.at(-1)!.code, META);
    expect(r.status).toBe("PASSWORD_SETUP_REQUIRED");
    if (r.status !== "PASSWORD_SETUP_REQUIRED") return;
    const pair = await h.core.setPassword(r.tempToken, "MyNewPass2026", META);
    expect(pair.principal.id).toBe(WALKIN);
    expect((await caught(() => h.core.startClaim("+233209990777", META))).code).toBe(
      "NOTHING_TO_CLAIM",
    );
  });

  it("accounts with a password and unknown details can't be claimed", async () => {
    const h = await makeHarness();
    expect((await caught(() => h.core.startClaim(THERESA, META))).code).toBe("NOTHING_TO_CLAIM");
    expect((await caught(() => h.core.startClaim("nobody@x.org", META))).code).toBe(
      "NOTHING_TO_CLAIM",
    );
  });
});

describe("change password (D-039)", () => {
  it("needs the current password, ends other sessions, keeps this one", async () => {
    const h = await makeHarness();
    const { res } = await signIn(h, "member", THERESA);
    if (res.status !== "AUTHENTICATED") throw new Error("expected tokens");
    const id = res.principal.id;
    expect(
      (
        await caught(() =>
          h.core.changePassword("member", id, "wrong-one-1", "Another2026pw", META),
        )
      ).code,
    ).toBe("WRONG_PASSWORD");
    const pair = await h.core.changePassword("member", id, PW, "Another2026pw", META);
    // This session continues with the new pair; the old refresh token is dead (and replaying it ends everything).
    expect((await h.core.refresh(pair.refreshToken, META)).principal.id).toBe(id);
    expect((await caught(() => h.core.refresh(res.refreshToken, META))).code).toBe(
      "INVALID_REFRESH_TOKEN",
    );
    await h.core.login("member", THERESA, "Another2026pw", META);
  });
});
