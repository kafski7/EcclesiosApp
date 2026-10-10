import { createDb, members, notifications } from "@ecclesios/db";
import { inArray, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache, type CapturingOtpSender } from "./app";

// D-016, D-049: move your home church to another church where you're active; the receiving
// church (or its parish) decides; the previous home is told.
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const PAR_A1 = G(107); //  St Theresa Parish
const PAR_A2 = G(108); //  second parish
const OUT_A1A = G(110); // St Michael Outstation (under St Theresa)
const stamp = Date.now();
const KOFI = `kofi.${stamp}@dev.ecclesios.local`;
const KOFI_PW = "KofiPassword2026";
const THERESA = "theresa.pastor@dev.ecclesios.local"; // parA1 Administrator (backup for outA1a)
const CHRIST = "christ.pastor@dev.ecclesios.local"; //   parA2 Administrator

let app: INestApplication;
let otp: CapturingOtpSender;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
let token: ReturnType<typeof signInCache>;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const cleanup = async () => {
  await handle.db.delete(members).where(inArray(sql`lower(${members.email})`, [KOFI]));
  await handle.db
    .delete(notifications)
    .where(sql`${notifications.title} like ${"Kofi Boateng%"}`);
};

/** Approve Kofi's pending request at `church` as `admin`. */
async function approveJoin(admin: string, church: string) {
  const t = await token(admin);
  const list = await http().get(`/api/groups/${church}/membership-requests`).set(auth(t)).expect(200);
  const req = list.body.items.find((i: { person: { email: string } }) => i.person.email === KOFI);
  expect(req).toBeTruthy();
  await http()
    .post(`/api/membership-requests/${req.id}/decision`)
    .set(auth(t))
    .send({ decision: "approve" })
    .expect(200);
}

const homeOf = async (t: string) => {
  const me = await http().get("/api/me").set(auth(t)).expect(200);
  return {
    home: me.body.memberships.find((m: { isHome: boolean }) => m.isHome)?.church.id ?? null,
    transfer: me.body.homeTransfer,
  };
};

beforeAll(async () => {
  await cleanup();
  ({ app, otp } = await createTestApp());
  token = signInCache(app, otp);
  // Kofi: home at St Michael (outstation), also an active member of the second parish.
  await http()
    .post("/api/auth/register")
    .send({ churchId: OUT_A1A, firstName: "Kofi", lastName: "Boateng", email: KOFI, password: KOFI_PW })
    .expect(201);
  await approveJoin(THERESA, OUT_A1A);
  const t = await token(KOFI, KOFI_PW);
  await http().post(`/api/groups/${PAR_A2}/join`).set(auth(t)).expect(201);
  await approveJoin(CHRIST, PAR_A2);
});
afterAll(async () => {
  await app?.close();
  await cleanup();
  await handle.close();
});

describe("asking to move your home church", () => {
  it("/me has no open request to begin with", async () => {
    const t = await token(KOFI, KOFI_PW);
    expect(await homeOf(t)).toEqual({ home: OUT_A1A, transfer: null });
  });

  it("only to a church where you're an active member, and not your current home", async () => {
    const t = await token(KOFI, KOFI_PW);
    const no = await http()
      .post("/api/me/home-transfer")
      .set(auth(t))
      .send({ toGroupId: PAR_A1 })
      .expect(409);
    expect(no.body.error.code).toBe("NOT_AN_ACTIVE_MEMBER");
    const same = await http()
      .post("/api/me/home-transfer")
      .set(auth(t))
      .send({ toGroupId: OUT_A1A })
      .expect(409);
    expect(same.body.error.code).toBe("ALREADY_HOME");
  });

  it("requests, shows in /me, refuses a second request, and can be cancelled", async () => {
    const t = await token(KOFI, KOFI_PW);
    const r = await http()
      .post("/api/me/home-transfer")
      .set(auth(t))
      .send({ toGroupId: PAR_A2, reason: "We moved house." })
      .expect(201);
    expect(r.body.homeTransfer).toMatchObject({ from: { id: OUT_A1A }, to: { id: PAR_A2 } });
    expect((await homeOf(t)).transfer?.to.id).toBe(PAR_A2);
    const again = await http()
      .post("/api/me/home-transfer")
      .set(auth(t))
      .send({ toGroupId: PAR_A2 })
      .expect(409);
    expect(again.body.error.code).toBe("TRANSFER_PENDING");
    await http().delete("/api/me/home-transfer").set(auth(t)).expect(204);
    expect((await homeOf(t)).transfer).toBeNull();
    await http().delete("/api/me/home-transfer").set(auth(t)).expect(404);
  });

  it("platform accounts and visitors can't ask", async () => {
    await http().post("/api/me/home-transfer").send({ toGroupId: PAR_A2 }).expect((r) => {
      expect([401, 403]).toContain(r.status);
    });
  });
});

describe("deciding (D-016): the receiving church's Administrator, or its parish", () => {
  it("another church can't list or decide it", async () => {
    const t = await token(KOFI, KOFI_PW);
    await http().post("/api/me/home-transfer").set(auth(t)).send({ toGroupId: PAR_A2 }).expect(201);
    const other = await token(THERESA);
    await http().get(`/api/groups/${PAR_A2}/home-transfers`).set(auth(other)).expect(403);
    const mine = await token(CHRIST);
    const list = await http().get(`/api/groups/${PAR_A2}/home-transfers`).set(auth(mine)).expect(200);
    const item = list.body.items.find((i: { person: { email: string } }) => i.person.email === KOFI);
    await http()
      .post(`/api/home-transfers/${item.id}/decision`)
      .set(auth(other))
      .send({ decision: "approve" })
      .expect(403);
  });

  it("declining needs a reason, then leaves the home where it was", async () => {
    const admin = await token(CHRIST);
    const list = await http().get(`/api/groups/${PAR_A2}/home-transfers`).set(auth(admin)).expect(200);
    const item = list.body.items.find((i: { person: { email: string } }) => i.person.email === KOFI);
    expect(item).toMatchObject({ from: { id: OUT_A1A }, to: { id: PAR_A2 } });
    await http()
      .post(`/api/home-transfers/${item.id}/decision`)
      .set(auth(admin))
      .send({ decision: "reject" })
      .expect(400);
    const r = await http()
      .post(`/api/home-transfers/${item.id}/decision`)
      .set(auth(admin))
      .send({ decision: "reject", note: "Please speak to the office first." })
      .expect(200);
    expect(r.body.status).toBe("REJECTED");
    const t = await token(KOFI, KOFI_PW);
    expect(await homeOf(t)).toEqual({ home: OUT_A1A, transfer: null });
  });

  it("approving moves the home, once; the old home's staff are told", async () => {
    const t = await token(KOFI, KOFI_PW);
    await http().post("/api/me/home-transfer").set(auth(t)).send({ toGroupId: PAR_A2 }).expect(201);
    const admin = await token(CHRIST);
    const list = await http().get(`/api/groups/${PAR_A2}/home-transfers`).set(auth(admin)).expect(200);
    const item = list.body.items.find((i: { person: { email: string } }) => i.person.email === KOFI);
    const r = await http()
      .post(`/api/home-transfers/${item.id}/decision`)
      .set(auth(admin))
      .send({ decision: "approve" })
      .expect(200);
    expect(r.body.status).toBe("APPROVED");
    await http()
      .post(`/api/home-transfers/${item.id}/decision`)
      .set(auth(admin))
      .send({ decision: "approve" })
      .expect(409);
    expect(await homeOf(t)).toEqual({ home: PAR_A2, transfer: null });

    const told = await handle.db
      .select({ title: notifications.title })
      .from(notifications)
      .where(sql`${notifications.title} like ${"Kofi Boateng moved their home church%"}`);
    expect(told.length).toBeGreaterThan(0);
  });

  it("leaving the church you asked to move to cancels the request", async () => {
    const t = await token(KOFI, KOFI_PW);
    // Home is now PAR_A2; ask to move back to the outstation, then leave it.
    await http().post("/api/me/home-transfer").set(auth(t)).send({ toGroupId: OUT_A1A }).expect(201);
    await http().delete(`/api/groups/${OUT_A1A}/membership`).set(auth(t)).expect(204);
    expect(await homeOf(t)).toEqual({ home: PAR_A2, transfer: null });
  });
});
