import { createDb, members, notifications } from "@ecclesios/db";
import { inArray, sql } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache, type CapturingOtpSender } from "./app";

// D-014 – D-016: register with a parish or outstation, sign in at once, join more churches, get approved.
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const PAR_A1 = G(107); //  St Theresa Parish
const PAR_A2 = G(108);
const OUT_A1A = G(110); // St Michael Outstation (under St Theresa)
const DEAN_A = G(105);
const stamp = Date.now();
const ADA = `ada.${stamp}@dev.ecclesios.local`;
const BEN = `ben.${stamp}@dev.ecclesios.local`;
const ADA_PW = "AdaPassword2026";
const THERESA = "theresa.pastor@dev.ecclesios.local"; //   parA1 Administrator (backup approver for outA1a)
const MICHAEL = "michael.catechist@dev.ecclesios.local"; // outA1a Administrator
const CHRIST = "christ.pastor@dev.ecclesios.local"; //     parA2 Administrator

let app: INestApplication;
let otp: CapturingOtpSender;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());

const cleanup = async () => {
  await handle.db.delete(members).where(inArray(sql`lower(${members.email})`, [ADA, BEN]));
  await handle.db
    .delete(notifications)
    .where(
      sql`${notifications.title} like ${"Ada Owusu%"} or ${notifications.title} like ${"Ben Tetteh%"}`,
    );
};

let token: ReturnType<typeof signInCache>;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  await cleanup();
  ({ app, otp } = await createTestApp());
  token = signInCache(app, otp);
});
afterAll(async () => {
  await app?.close();
  await cleanup();
  await handle.close();
});

describe("GET /api/public/churches", () => {
  it("lists parishes AND outstations with context", async () => {
    const r = await http().get("/api/public/churches?q=michael").expect(200);
    expect(r.body.items).toEqual([
      {
        id: OUT_A1A,
        name: "St Michael Outstation",
        level: "OUTSTATION",
        parish: "St Theresa Parish",
        deanery: "St Joseph Deanery",
        diocese: "Sample Suffragan Diocese",
      },
    ]);
  });
  it("never offers deaneries or dioceses", async () => {
    const r = await http().get("/api/public/churches?q=deanery").expect(200);
    expect(r.body.items).toEqual([]);
  });
});

describe("register → sign in straight away (D-015)", () => {
  it("registers with an outstation; membership is PENDING", async () => {
    const r = await http()
      .post("/api/auth/register")
      .send({
        churchId: OUT_A1A,
        firstName: "Ada",
        lastName: "Owusu",
        email: ADA,
        password: ADA_PW,
      })
      .expect(201);
    expect(r.body).toEqual({
      status: "REGISTERED",
      membership: {
        status: "PENDING",
        church: { id: OUT_A1A, name: "St Michael Outstation", level: "OUTSTATION" },
      },
    });
  });

  it("can sign in before approval and sees the pending home request in /me", async () => {
    const t = await token(ADA, ADA_PW);
    const me = await http().get("/api/me").set(auth(t)).expect(200);
    expect(me.body.memberships).toMatchObject([
      { church: { id: OUT_A1A }, status: "PENDING", isHome: true, role: "PARISHIONER" },
    ]);
    expect(me.body.follows.map((f: { id: string }) => f.id)).toEqual([OUT_A1A]); // joining also follows
  });

  it("a pending membership grants no church-scoped access", async () => {
    const t = await token(ADA, ADA_PW);
    await http().get(`/api/groups/${OUT_A1A}/member-access`).set(auth(t)).expect(403);
  });

  it("duplicate email → 409; deanery as church → 400", async () => {
    await http()
      .post("/api/auth/register")
      .send({ churchId: PAR_A1, firstName: "A", lastName: "B", email: ADA, password: ADA_PW })
      .expect(409);
    const r = await http()
      .post("/api/auth/register")
      .send({
        churchId: DEAN_A,
        firstName: "Ben",
        lastName: "Tetteh",
        email: BEN,
        password: ADA_PW,
      })
      .expect(400);
    expect(r.body.error.code).toBe("CHURCH_NOT_FOUND");
  });
});

describe("approval (D-016): church Administrator, or its parish as backup", () => {
  it("a neighbouring parish cannot see or decide the request", async () => {
    const t = await token(CHRIST);
    await http().get(`/api/groups/${OUT_A1A}/membership-requests`).set(auth(t)).expect(403);
  });

  it("the parish Administrator approves an outstation request", async () => {
    const t = await token(THERESA);
    const list = await http()
      .get(`/api/groups/${OUT_A1A}/membership-requests`)
      .set(auth(t))
      .expect(200);
    const req = list.body.items.find((i: { person: { email: string } }) => i.person.email === ADA);
    expect(req).toBeTruthy();
    const r = await http()
      .post(`/api/membership-requests/${req.id}/decision`)
      .set(auth(t))
      .send({ decision: "approve" })
      .expect(200);
    expect(r.body.status).toBe("ACTIVE");
    await http()
      .post(`/api/membership-requests/${req.id}/decision`)
      .set(auth(t))
      .send({ decision: "approve" })
      .expect(409);
  });

  it("once approved, the member gets member access to that church", async () => {
    const t = await token(ADA, ADA_PW);
    const r = await http().get(`/api/groups/${OUT_A1A}/member-access`).set(auth(t)).expect(200);
    expect(r.body.access).toEqual(["MEMBER"]);
  });
});

describe("joining more churches (D-014)", () => {
  it("joins a second church; not home; rejects reason required", async () => {
    const t = await token(ADA, ADA_PW);
    const j = await http().post(`/api/groups/${PAR_A2}/join`).set(auth(t)).expect(201);
    expect(j.body.membership).toMatchObject({ status: "PENDING", isHome: false });
    await http().post(`/api/groups/${PAR_A2}/join`).set(auth(t)).expect(409);

    const admin = await token(CHRIST);
    const list = await http()
      .get(`/api/groups/${PAR_A2}/membership-requests`)
      .set(auth(admin))
      .expect(200);
    const req = list.body.items.find((i: { person: { email: string } }) => i.person.email === ADA);
    await http()
      .post(`/api/membership-requests/${req.id}/decision`)
      .set(auth(admin))
      .send({ decision: "reject" })
      .expect(400);
    const r = await http()
      .post(`/api/membership-requests/${req.id}/decision`)
      .set(auth(admin))
      .send({ decision: "reject", note: "Please visit the office first." })
      .expect(200);
    expect(r.body.status).toBe("REJECTED");
  });

  it("can rejoin after rejection, and cancel a pending request", async () => {
    const t = await token(ADA, ADA_PW);
    await http().post(`/api/groups/${PAR_A2}/join`).set(auth(t)).expect(201);
    await http().delete(`/api/groups/${PAR_A2}/membership`).set(auth(t)).expect(204);
    const me = await http().get("/api/me").set(auth(t)).expect(200);
    expect(me.body.memberships.map((m: { church: { id: string } }) => m.church.id)).toEqual([
      OUT_A1A,
    ]);
  });

  it("follow / unfollow without approval", async () => {
    const t = await token(ADA, ADA_PW);
    await http().put(`/api/groups/${PAR_A1}/follow`).set(auth(t)).expect(204);
    let me = await http().get("/api/me").set(auth(t)).expect(200);
    expect(me.body.follows.some((f: { id: string }) => f.id === PAR_A1)).toBe(true);
    await http().delete(`/api/groups/${PAR_A1}/follow`).set(auth(t)).expect(204);
    me = await http().get("/api/me").set(auth(t)).expect(200);
    expect(me.body.follows.some((f: { id: string }) => f.id === PAR_A1)).toBe(false);
  });

  it("the outstation Administrator can also decide its own requests", async () => {
    const t = await token(MICHAEL);
    await http().get(`/api/groups/${OUT_A1A}/membership-requests`).set(auth(t)).expect(200);
  });
});

describe("seeded people", () => {
  it("Esi (pending home request) signs in normally", async () => {
    await token("esi.mensah@dev.ecclesios.local");
  });
});
