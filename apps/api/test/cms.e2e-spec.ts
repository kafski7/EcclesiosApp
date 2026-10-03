import { createDb, groups, memberships, roles, subscriptions } from "@ecclesios/db";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 4: CMS contexts, subscription gate (D-020), trial + manual activation (D-021), platform console.
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const DEAN_A = G(105),
  DEAN_B = G(106),
  PAR_A1 = G(107),
  PAR_A2 = G(108),
  PAR_B1 = G(109),
  OUT_A1A = G(110),
  OUT_B1A = G(113);
const ANTHONY_ID = G(509); // parB1 Administrator (expired subscription)
const THERESA = "theresa.pastor@dev.ecclesios.local";
const MICHAEL = "michael.catechist@dev.ecclesios.local";
const ANTHONY = "anthony.pastor@dev.ecclesios.local";
const AGNES = "agnes.catechist@dev.ecclesios.local";
const CHRIST = "christ.pastor@dev.ecclesios.local";
const DEAN = "joseph.dean@dev.ecclesios.local";
const ESI = "esi.mensah@dev.ecclesios.local";
const SUPER = "superadmin@dev.ecclesios.local";

// A brand-new parish (never subscribed) for the trial path, removed afterwards.
const NEW_PARISH = randomUUID();

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function cleanup() {
  await handle.db.delete(subscriptions).where(eq(subscriptions.groupId, NEW_PARISH));
  await handle.db.delete(memberships).where(eq(memberships.groupId, NEW_PARISH));
  await handle.db.delete(groups).where(eq(groups.id, NEW_PARISH));
  // undo the manual activation of St Anthony (seed state: one EXPIRED row)
  await handle.db
    .delete(subscriptions)
    .where(
      and(
        eq(subscriptions.groupId, PAR_B1),
        inArray(subscriptions.status, ["ACTIVE", "TRIAL", "CANCELLED"]),
      ),
    );
}

beforeAll(async () => {
  await cleanup();
  const [deanB] = await handle.db
    .select({ path: groups.path })
    .from(groups)
    .where(eq(groups.id, DEAN_B));
  await handle.db.insert(groups).values({
    id: NEW_PARISH,
    parentGroupId: DEAN_B,
    level: "PARISH",
    name: "E2E New Parish",
    code: `E2E-${NEW_PARISH.slice(0, 8)}`,
    path: `${deanB!.path}${NEW_PARISH}/`,
  });
  const [admin] = await handle.db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, "ADMINISTRATOR"));
  await handle.db.insert(memberships).values({
    memberId: ANTHONY_ID,
    groupId: NEW_PARISH,
    roleId: admin!.id,
    status: "ACTIVE",
    decidedAt: new Date(),
  });
  const t = await createTestApp();
  app = t.app;
  token = signInCache(app, t.otp);
});

afterAll(async () => {
  await app?.close();
  await cleanup();
  await handle.close();
});

describe("GET /api/cms/contexts (functionality §4.13)", () => {
  it("parish Administrator: own parish, subscribed", async () => {
    const t17 = await token(THERESA);
    const r = await http()
      .get("/api/cms/contexts")
      .set(auth(t17))
      .expect(200);
    const c = r.body.contexts.find((x: { group: { id: string } }) => x.group.id === PAR_A1);
    expect(c).toMatchObject({
      role: "ADMINISTRATOR",
      group: { level: "PARISH", parent: null },
      subscription: { state: "ACTIVE", plan: { code: "PREMIUM" }, canStartTrial: false },
    });
  });

  it("outstation rides on its parish's subscription", async () => {
    const t16 = await token(MICHAEL);
    const r = await http()
      .get("/api/cms/contexts")
      .set(auth(t16))
      .expect(200);
    expect(r.body.contexts).toMatchObject([
      {
        group: { id: OUT_A1A, level: "OUTSTATION", parent: "St Theresa Parish" },
        subscription: { holder: { id: PAR_A1 }, state: "ACTIVE" },
      },
    ]);
  });

  it("monitoring levels are not gated (subscription: null)", async () => {
    const t15 = await token(DEAN);
    const r = await http()
      .get("/api/cms/contexts")
      .set(auth(t15))
      .expect(200);
    expect(r.body.contexts).toMatchObject([{ group: { id: DEAN_A }, subscription: null }]);
  });

  it("parishioners have no CMS contexts; platform accounts are refused", async () => {
    const t14 = await token(ESI);
    const mine = await http().get("/api/cms/contexts").set(auth(t14)).expect(200);
    expect(mine.body.contexts).toEqual([]);
    const t13 = await token(SUPER, undefined, "admin-login");
    await http()
      .get("/api/cms/contexts")
      .set(auth(t13))
      .expect(403);
  });
});

describe("subscription gate (D-020) — GET /api/cms/groups/:id/dashboard", () => {
  it("open for an ACTIVE parish, with counters", async () => {
    const t12 = await token(THERESA);
    const r = await http()
      .get(`/api/cms/groups/${PAR_A1}/dashboard`)
      .set(auth(t12))
      .expect(200);
    expect(r.body.members).toBeGreaterThanOrEqual(7);
    expect(r.body.pendingRequests).toBeGreaterThanOrEqual(1); // Esi
    expect(r.body).toMatchObject({ societies: 2, committees: 1 });
  });

  it("open during a TRIAL", async () => {
    const t11 = await token(CHRIST);
    await http()
      .get(`/api/cms/groups/${PAR_A2}/dashboard`)
      .set(auth(t11))
      .expect(200);
  });

  it("402 for an expired parish and for its outstation", async () => {
    const t10 = await token(ANTHONY);
    const r = await http()
      .get(`/api/cms/groups/${PAR_B1}/dashboard`)
      .set(auth(t10))
      .expect(402);
    expect(r.body.error).toMatchObject({
      code: "SUBSCRIPTION_REQUIRED",
      details: { state: "EXPIRED" },
    });
    const t9 = await token(AGNES);
    await http()
      .get(`/api/cms/groups/${OUT_B1A}/dashboard`)
      .set(auth(t9))
      .expect(402);
  });

  it("scope still comes first: a neighbour gets 403, not 402", async () => {
    const t8 = await token(THERESA);
    await http()
      .get(`/api/cms/groups/${PAR_B1}/dashboard`)
      .set(auth(t8))
      .expect(403);
  });

  it("monitoring levels pass the gate", async () => {
    const t7 = await token(DEAN);
    await http()
      .get(`/api/cms/groups/${DEAN_A}/dashboard`)
      .set(auth(t7))
      .expect(200);
    const t6 = await token(DEAN);
    await http()
      .get(`/api/cms/groups/${PAR_A1}/dashboard`)
      .set(auth(t6))
      .expect(200);
  });
});

describe("free trial (D-021)", () => {
  it("a never-subscribed parish shows NONE and can start a trial once", async () => {
    const t = await token(ANTHONY);
    const ctx = await http().get("/api/cms/contexts").set(auth(t)).expect(200);
    const mine = ctx.body.contexts.find(
      (x: { group: { id: string } }) => x.group.id === NEW_PARISH,
    );
    expect(mine.subscription).toMatchObject({ state: "NONE", canStartTrial: true });
    await http().get(`/api/cms/groups/${NEW_PARISH}/dashboard`).set(auth(t)).expect(402);

    const r = await http()
      .post(`/api/groups/${NEW_PARISH}/subscription/trial`)
      .set(auth(t))
      .send({ planCode: "PREMIUM" })
      .expect(201);
    expect(r.body).toMatchObject({ state: "TRIAL", plan: { code: "PREMIUM" }, smsBalance: 0 });
    await http().get(`/api/cms/groups/${NEW_PARISH}/dashboard`).set(auth(t)).expect(200);

    const again = await http()
      .post(`/api/groups/${NEW_PARISH}/subscription/trial`)
      .set(auth(t))
      .send({ planCode: "BASIC" })
      .expect(409);
    expect(again.body.error.code).toBe("TRIAL_NOT_AVAILABLE");
  });

  it("an expired parish cannot take another trial; outstation admins cannot start one", async () => {
    const t5 = await token(ANTHONY);
    await http()
      .post(`/api/groups/${PAR_B1}/subscription/trial`)
      .set(auth(t5))
      .send({ planCode: "BASIC" })
      .expect(409);
    const t4 = await token(MICHAEL);
    await http()
      .post(`/api/groups/${PAR_A1}/subscription/trial`)
      .set(auth(t4))
      .send({ planCode: "BASIC" })
      .expect(403);
  });
});

describe("platform console (Super-Admin)", () => {
  it("is refused to church members", async () => {
    const t3 = await token(THERESA);
    await http()
      .get("/api/platform/overview")
      .set(auth(t3))
      .expect(403);
  });

  it("overview and subscription list", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const o = await http().get("/api/platform/overview").set(auth(t)).expect(200);
    expect(o.body.churches.parishes).toBeGreaterThanOrEqual(4);
    const list = await http().get("/api/platform/subscriptions").set(auth(t)).expect(200);
    expect(
      list.body.items.find((x: { parish: { id: string } }) => x.parish.id === PAR_B1),
    ).toMatchObject({
      state: "EXPIRED",
      outstations: 1,
      diocese: "Sample Suffragan Diocese",
    });
  });

  it("manual activation needs a reference, then opens the CMS", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    await http()
      .post("/api/platform/subscriptions")
      .set(auth(t))
      .send({ parishId: PAR_B1, planCode: "BASIC" })
      .expect(400);
    const r = await http()
      .post("/api/platform/subscriptions")
      .set(auth(t))
      .send({ parishId: PAR_B1, planCode: "BASIC", reference: "MOMO-123456" })
      .expect(201);
    expect(r.body).toMatchObject({ state: "ACTIVE", plan: { code: "BASIC" }, smsBalance: 100 });
    const t2 = await token(ANTHONY);
    await http()
      .get(`/api/cms/groups/${PAR_B1}/dashboard`)
      .set(auth(t2))
      .expect(200);
    const t1 = await token(AGNES);
    await http()
      .get(`/api/cms/groups/${OUT_B1A}/dashboard`)
      .set(auth(t1))
      .expect(200);
  });

  it("renewing an active plan carries the remaining days over", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const before = (await http().get("/api/platform/subscriptions").set(auth(t))).body.items.find(
      (x: { parish: { id: string } }) => x.parish.id === PAR_B1,
    );
    const r = await http()
      .post("/api/platform/subscriptions")
      .set(auth(t))
      .send({ parishId: PAR_B1, planCode: "PREMIUM", days: 30, reference: "MOMO-654321" })
      .expect(201);
    expect(r.body.plan.code).toBe("PREMIUM");
    expect(r.body.daysLeft).toBeGreaterThanOrEqual(before.daysLeft + 29);
  });

  it("only parishes hold subscriptions", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const r = await http()
      .post("/api/platform/subscriptions")
      .set(auth(t))
      .send({ parishId: OUT_A1A, planCode: "BASIC", reference: "REF-1" })
      .expect(400);
    expect(r.body.error.code).toBe("NOT_A_PARISH");
  });
});
