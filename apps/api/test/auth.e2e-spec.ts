import { hash } from "@node-rs/argon2";
import { createDb, members, users } from "@ecclesios/db";
import { eq, inArray, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, type CapturingOtpSender } from "./app";

// Seed fixtures (packages/db/src/seed/data.ts — deterministic ids)
const PW = process.env.SEED_DEV_PASSWORD || "Ecclesios#2026";
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const GROUP = { arch: G(101), dio: G(104), deanA: G(105), parA1: G(107), parA2: G(108), outA1a: G(110), outA2a: G(112) };
const THERESA = "theresa.pastor@dev.ecclesios.local"; //  parA1 Administrator
const MICHAEL = "michael.catechist@dev.ecclesios.local"; // outA1a Administrator
const DEAN = "joseph.dean@dev.ecclesios.local"; //        deanA Administrator
const ARCH = "archdiocese.admin@dev.ecclesios.local";
const KOFI = "kofi.asante@dev.ecclesios.local"; //        first-login account
const SUPER = "superadmin@dev.ecclesios.local";

let app: INestApplication;
let otp: CapturingOtpSender;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });

/** Make the run repeatable: reset auth state of every account the tests touch. */
async function resetAccounts() {
  const passwordHash = await hash(PW);
  const clean = {
    otpHash: null, otpExpiresAt: null, otpAttempts: 0, tempTokenHash: null, tempTokenExpiresAt: null,
    refreshTokenHash: null, refreshTokenExpiresAt: null, failedLoginCount: 0, lockedUntil: null, passwordHash,
  };
  await handle.db
    .update(members)
    .set({ ...clean, firstLogin: new Date() })
    .where(inArray(sql`lower(${members.email})`, [THERESA, MICHAEL, DEAN, ARCH]));
  await handle.db.update(members).set({ ...clean, firstLogin: null }).where(sql`lower(${members.email}) = ${KOFI}`);
  await handle.db.update(users).set({ ...clean, firstLogin: new Date() }).where(eq(users.email, SUPER));
}

async function signIn(path: "login" | "admin-login", identifier: string, password = PW) {
  const r1 = await request(app.getHttpServer()).post(`/api/auth/${path}`).send({ identifier, password }).expect(200);
  const r2 = await request(app.getHttpServer())
    .post("/api/auth/verify-otp")
    .send({ challengeToken: r1.body.challengeToken, otp: otp.last() })
    .expect(200);
  return r2.body;
}

beforeAll(async () => {
  await resetAccounts();
  ({ app, otp } = await createTestApp());
});
afterAll(async () => {
  await app?.close();
  await resetAccounts();
  await handle.close();
});

describe("health", () => {
  it("GET /api/health → ok with database up", async () => {
    const r = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(r.body).toMatchObject({ status: "ok", service: "ecclesios-api", checks: { database: "up" } });
    expect(r.headers["x-request-id"]).toBeTruthy();
  });
});

describe("auth — members (/api/auth/login)", () => {
  it("password → OTP → tokens carrying role, group and level", async () => {
    const body = await signIn("login", THERESA);
    expect(body.status).toBe("AUTHENTICATED");
    expect(body.principal).toEqual({ kind: "member", id: G(507), role: "ADMINISTRATOR", groupId: GROUP.parA1, hierarchyLevel: "PARISH" });
  });

  it("wrong password → 401 INVALID_CREDENTIALS in the error envelope", async () => {
    const r = await request(app.getHttpServer()).post("/api/auth/login").send({ identifier: THERESA, password: "not-the-password-1" }).expect(401);
    expect(r.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(r.body.error.requestId).toBeTruthy();
  });

  it("validation errors → 400 VALIDATION_FAILED", async () => {
    const r = await request(app.getHttpServer()).post("/api/auth/login").send({ identifier: "x" }).expect(400);
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("a platform account cannot use the member login", async () => {
    const r = await request(app.getHttpServer()).post("/api/auth/login").send({ identifier: SUPER, password: PW }).expect(401);
    expect(r.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("auth — platform (/api/auth/admin-login)", () => {
  it("Super-Admin signs in against the users table", async () => {
    const body = await signIn("admin-login", SUPER);
    expect(body.principal).toEqual({ kind: "user", id: G(900), role: "SUPER_ADMIN" });
  });
});

describe("first login → set password", () => {
  it("returns PASSWORD_SETUP_REQUIRED, then set-password signs in", async () => {
    const body = await signIn("login", KOFI);
    expect(body.status).toBe("PASSWORD_SETUP_REQUIRED");
    const weak = await request(app.getHttpServer()).post("/api/auth/set-password").send({ tempToken: body.tempToken, newPassword: "short" }).expect(400);
    expect(weak.body.error.code).toBe("VALIDATION_FAILED");
    const r = await request(app.getHttpServer())
      .post("/api/auth/set-password")
      .send({ tempToken: body.tempToken, newPassword: "KofiNewPass2026" })
      .expect(200);
    expect(r.body.principal.role).toBe("PARISHIONER");
    const again = await signIn("login", KOFI, "KofiNewPass2026");
    expect(again.status).toBe("AUTHENTICATED");
  });
});

describe("refresh & logout", () => {
  it("rotates refresh tokens and revokes on logout", async () => {
    const s = await signIn("login", THERESA);
    const r = await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken: s.refreshToken }).expect(200);
    expect(r.body.refreshToken).not.toBe(s.refreshToken);
    await request(app.getHttpServer()).post("/api/auth/logout").send({ refreshToken: r.body.refreshToken }).expect(204);
    const after = await request(app.getHttpServer()).post("/api/auth/refresh").send({ refreshToken: r.body.refreshToken }).expect(401);
    expect(after.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });
});

describe("rate limiting", () => {
  it("6th login for the same identifier → 429 with Retry-After", async () => {
    const id = `ratelimit-${Date.now()}@nowhere.test`;
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer()).post("/api/auth/login").send({ identifier: id, password: "whatever-123" }).expect(401);
    const r = await request(app.getHttpServer()).post("/api/auth/login").send({ identifier: id, password: "whatever-123" }).expect(429);
    expect(r.body.error.code).toBe("RATE_LIMITED");
    expect(Number(r.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("RBAC scope guard (blueprint §3.5) — GET /api/groups/:id/access", () => {
  const access = (token: string | null, groupId: string) => {
    const req = request(app.getHttpServer()).get(`/api/groups/${groupId}/access`);
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  };

  it("requires a Bearer token", async () => {
    const r = await access(null, GROUP.parA1).expect(401);
    expect(r.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("parish: OWN on itself, OVERSIGHT on its outstation, denied on the neighbour", async () => {
    const t = (await signIn("login", THERESA)).accessToken;
    expect((await access(t, GROUP.parA1).expect(200)).body.access).toBe("OWN");
    const o = await access(t, GROUP.outA1a).expect(200);
    expect(o.body).toMatchObject({ access: "OVERSIGHT", can: { write: false, approve: true } });
    expect((await access(t, GROUP.outA2a).expect(403)).body.error.code).toBe("SCOPE_DENIED");
    await access(t, GROUP.parA2).expect(403);
    await access(t, GROUP.deanA).expect(403); // no upward access
  });

  it("outstation cannot see its parish", async () => {
    const t = (await signIn("login", MICHAEL)).accessToken;
    await access(t, GROUP.parA1).expect(403);
  });

  it("dean monitors parishes in detail; archdiocese sees the suffragan as aggregates", async () => {
    const dean = (await signIn("login", DEAN)).accessToken;
    expect((await access(dean, GROUP.parA1).expect(200)).body.access).toBe("MONITOR_DETAILED");
    const arch = (await signIn("login", ARCH)).accessToken;
    expect((await access(arch, GROUP.parA1).expect(200)).body.access).toBe("MONITOR_AGGREGATE");
  });

  it("platform accounts have no church scope", async () => {
    const t = (await signIn("admin-login", SUPER)).accessToken;
    await access(t, GROUP.parA1).expect(403);
  });

  it("denials are audited", async () => {
    const t = (await signIn("login", MICHAEL)).accessToken;
    await access(t, GROUP.outA2a).expect(403);
    const rows = await handle.db.execute(
      sql`select count(*)::int as n from audit_logs where action = 'access.denied' and entity_id = ${GROUP.outA2a}`,
    );
    expect(Number((rows as unknown as { n: number }[])[0]?.n)).toBeGreaterThan(0);
  });

  it("malformed group id → 400", async () => {
    const t = (await signIn("login", THERESA)).accessToken;
    await access(t, "not-a-uuid").expect(400);
  });
});
