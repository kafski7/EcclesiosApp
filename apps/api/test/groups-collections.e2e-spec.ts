import {
  createDb,
  groupSettings,
  groups,
  members,
  memberships,
  notifications,
  pendingCollections,
} from "@ecclesios/db";
import { and, eq, gte, inArray, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 6.4 — groups, roll-ups, metropolitan visibility, collections, accounting link, phones (D-040, D-041).
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const ARCH = G(101),
  DIO = G(104),
  DEAN_A = G(105),
  PAR_A1 = G(107),
  OUT_A1A = G(110),
  OUT_A1B = G(111);
const KOFI_ID = G(517);
const THERESA = "theresa.pastor@dev.ecclesios.local"; //     Administrator, St Theresa (parish)
const AMA = "ama.mensah@dev.ecclesios.local"; //             Manager, St Theresa
const MICHAEL = "michael.catechist@dev.ecclesios.local"; //  Administrator, St Michael (outstation of St Theresa)
const MONICA = "monica.catechist@dev.ecclesios.local"; //    Administrator, St Monica (other outstation)
const DEAN = "joseph.dean@dev.ecclesios.local";
const ARCH_ADMIN = "archdiocese.admin@dev.ecclesios.local";
const DIO_ADMIN = "diocese.admin@dev.ecclesios.local";

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const started = new Date();

const cleanup = async () => {
  await handle.db.delete(pendingCollections).where(like(pendingCollections.note, "E2E%"));
  await handle.db
    .delete(notifications)
    .where(
      and(eq(notifications.link, "/admin/collections"), gte(notifications.createdAt, started)),
    );
  const made = await handle.db
    .select({ id: groups.id })
    .from(groups)
    .where(like(groups.name, "E2E %"));
  if (made.length) {
    await handle.db.delete(memberships).where(
      inArray(
        memberships.groupId,
        made.map((g) => g.id),
      ),
    );
    await handle.db.delete(groups).where(
      inArray(
        groups.id,
        made.map((g) => g.id),
      ),
    );
  }
  const phones = await handle.db
    .select({ id: members.id })
    .from(members)
    .where(like(members.lastName, "Phonetest%"));
  if (phones.length) {
    await handle.db.delete(memberships).where(
      inArray(
        memberships.memberId,
        phones.map((p) => p.id),
      ),
    );
    await handle.db.delete(members).where(
      inArray(
        members.id,
        phones.map((p) => p.id),
      ),
    );
  }
  await handle.db
    .update(groupSettings)
    .set({ metropolitanVisibility: "aggregates" })
    .where(eq(groupSettings.groupId, DIO));
  await handle.db
    .update(groupSettings)
    .set({ allowManualTransactionDates: false })
    .where(eq(groupSettings.groupId, OUT_A1A));
};

beforeAll(async () => {
  await cleanup();
  const t = await createTestApp();
  app = t.app;
  token = signInCache(app, t.otp);
});
afterAll(async () => {
  await cleanup();
  await app?.close();
  await handle.close();
});

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe("phone numbers are typed the local way (D-040)", () => {
  it("024 … is stored as +233… and found either way", async () => {
    const t = await token(THERESA);
    const r = await http()
      .post(`/api/cms/groups/${PAR_A1}/members`)
      .set(auth(t))
      .send({ firstName: "E2e", lastName: "Phonetest", telephone: "024 999 0123" })
      .expect(201);
    expect(r.body.person.telephone).toBe("+233249990123");
    const s = await http()
      .get(`/api/cms/groups/${PAR_A1}/members?q=${encodeURIComponent("024 999 0123")}`)
      .set(auth(t))
      .expect(200);
    expect(s.body.items[0].lastName).toBe("Phonetest");
    const bad = await http()
      .post(`/api/cms/groups/${PAR_A1}/members`)
      .set(auth(t))
      .send({ firstName: "E2e", lastName: "Phonetest2", telephone: "12345" })
      .expect(400);
    expect(bad.body.error.details.fieldErrors.telephone[0]).toMatch(/024 123 4567/);
  });
});

describe("collections (D-041)", () => {
  let first = "";
  it("outstation staff record today's collection; back-dated and future dates refused", async () => {
    const t = await token(MICHAEL);
    const base = `/api/cms/groups/${OUT_A1A}/collections`;
    const r = await http()
      .post(base)
      .set(auth(t))
      .send({ amount: "120.50", categoryRef: "SUNDAY_OFFERTORY", note: "E2E offertory" })
      .expect(201);
    first = r.body.id;
    expect(r.body.status).toBe("PENDING");
    expect(
      (
        await http()
          .post(base)
          .set(auth(t))
          .send({ amount: "10", categoryRef: "TITHE", collectedOn: daysAgo(2), note: "E2E old" })
          .expect(400)
      ).body.error.code,
    ).toBe("INVALID_DATE");
    await http()
      .post(base)
      .set(auth(t))
      .send({ amount: "10", categoryRef: "TITHE", collectedOn: "2999-01-01", note: "E2E future" })
      .expect(400);
    await http()
      .post(base)
      .set(auth(t))
      .send({ amount: "0", categoryRef: "TITHE", note: "E2E zero" })
      .expect(400);
    const list = await http().get(base).set(auth(t)).expect(200);
    expect(list.body.mode).toBe("RECORD");
    expect(list.body.items.find((c: { id: string }) => c.id === first)).toMatchObject({
      collectedOn: today(),
      currencyCode: "GHS",
      can: { edit: true, review: false },
    });
  });

  it("back-dating works once the outstation turns it on", async () => {
    await handle.db
      .update(groupSettings)
      .set({ allowManualTransactionDates: true })
      .where(eq(groupSettings.groupId, OUT_A1A));
    await http()
      .post(`/api/cms/groups/${OUT_A1A}/collections`)
      .set(auth(await token(MICHAEL)))
      .send({
        amount: "15.00",
        categoryRef: "DONATION",
        collectedOn: daysAgo(3),
        note: "E2E backdated",
      })
      .expect(201);
  });

  it("other outstations can't see it; the parish can't record", async () => {
    await http()
      .get(`/api/cms/groups/${OUT_A1A}/collections`)
      .set(auth(await token(MONICA)))
      .expect(403);
    const t = await token(THERESA);
    expect(
      (
        await http()
          .post(`/api/cms/groups/${PAR_A1}/collections`)
          .set(auth(t))
          .send({ amount: "5", categoryRef: "TITHE", note: "E2E parish" })
          .expect(400)
      ).body.error.code,
    ).toBe("NOT_AN_OUTSTATION");
  });

  it("the parish's Administrator approves → posted to accounting (SYNCED); Managers can't review", async () => {
    const t = await token(THERESA);
    const list = await http().get(`/api/cms/groups/${PAR_A1}/collections`).set(auth(t)).expect(200);
    expect(list.body.mode).toBe("REVIEW");
    expect(list.body.items.find((c: { id: string }) => c.id === first).can.review).toBe(true);
    await http()
      .post(`/api/cms/groups/${PAR_A1}/collections/${first}/review`)
      .set(auth(await token(AMA)))
      .send({ decision: "approve" })
      .expect(403);
    await http()
      .post(`/api/cms/groups/${PAR_A1}/collections/${first}/review`)
      .set(auth(t))
      .send({ decision: "approve" })
      .expect(204);
    const [row] = await handle.db
      .select()
      .from(pendingCollections)
      .where(eq(pendingCollections.id, first));
    expect(row).toMatchObject({ status: "SYNCED" });
    expect(row!.externalTxnId!.startsWith("DEV-")).toBe(true);
    await http()
      .post(`/api/cms/groups/${PAR_A1}/collections/${first}/review`)
      .set(auth(t))
      .send({ decision: "reject", note: "late" })
      .expect(409);
    await http()
      .put(`/api/cms/groups/${OUT_A1A}/collections/${first}`)
      .set(auth(await token(MICHAEL)))
      .send({ amount: "1.00", categoryRef: "TITHE" })
      .expect(409);
  });

  it("a failed post can be retried; rejecting needs a reason", async () => {
    const m = await token(MICHAEL);
    const t = await token(THERESA);
    const fail = (
      await http()
        .post(`/api/cms/groups/${OUT_A1A}/collections`)
        .set(auth(m))
        .send({ amount: "30.00", categoryRef: "HARVEST_PLEDGE", note: "E2E [fail-sync]" })
        .expect(201)
    ).body.id;
    await http()
      .post(`/api/cms/groups/${PAR_A1}/collections/${fail}/review`)
      .set(auth(t))
      .send({ decision: "approve" })
      .expect(204);
    const [f] = await handle.db
      .select()
      .from(pendingCollections)
      .where(eq(pendingCollections.id, fail));
    expect(f).toMatchObject({ status: "SYNC_FAILED", syncAttempts: 1 });
    await handle.db
      .update(pendingCollections)
      .set({ note: "E2E fixed" })
      .where(eq(pendingCollections.id, fail));
    await http()
      .post(`/api/cms/groups/${PAR_A1}/collections/${fail}/retry`)
      .set(auth(t))
      .expect(204);
    const [g] = await handle.db
      .select()
      .from(pendingCollections)
      .where(eq(pendingCollections.id, fail));
    expect(g).toMatchObject({ status: "SYNCED", syncAttempts: 2, lastSyncError: null });

    const rej = (
      await http()
        .post(`/api/cms/groups/${OUT_A1A}/collections`)
        .set(auth(m))
        .send({ amount: "9.99", categoryRef: "OTHER", note: "E2E to reject" })
        .expect(201)
    ).body.id;
    await http()
      .post(`/api/cms/groups/${PAR_A1}/collections/${rej}/review`)
      .set(auth(t))
      .send({ decision: "reject" })
      .expect(400);
    await http()
      .post(`/api/cms/groups/${PAR_A1}/collections/${rej}/review`)
      .set(auth(t))
      .send({ decision: "reject", note: "Duplicate entry" })
      .expect(204);
    const mine = await http().get(`/api/me/notifications?unread=1`).set(auth(m)).expect(200);
    expect(mine.body.items.some((n: { title: string }) => n.title.includes("not approved"))).toBe(
      true,
    );
  });

  it("the recorder edits or deletes while waiting; others can't", async () => {
    const m = await token(MICHAEL);
    const id = (
      await http()
        .post(`/api/cms/groups/${OUT_A1A}/collections`)
        .set(auth(m))
        .send({ amount: "40", categoryRef: "TITHE", note: "E2E edit me" })
        .expect(201)
    ).body.id;
    await http()
      .put(`/api/cms/groups/${OUT_A1A}/collections/${id}`)
      .set(auth(m))
      .send({ amount: "45.00", categoryRef: "TITHE", note: "E2E edited" })
      .expect(204);
    await http().delete(`/api/cms/groups/${OUT_A1A}/collections/${id}`).set(auth(m)).expect(204);
  });

  it("finance figures come from the accounting service", async () => {
    const f = await http()
      .get(`/api/cms/groups/${PAR_A1}/finance`)
      .set(auth(await token(THERESA)))
      .expect(200);
    expect(f.body).toMatchObject({ connected: true, currencyCode: "GHS" });
    expect(Number(f.body.year.total)).toBeGreaterThanOrEqual(150.5); // 120.50 + 30.00 synced this year
    expect(
      f.body.year.byCategory.some(
        (c: { categoryRef: string }) => c.categoryRef === "SUNDAY_OFFERTORY",
      ),
    ).toBe(true);
  });
});

describe("groups (D-041)", () => {
  let made = "";
  it("a parish lists its outstations and opens a new one with an Administrator", async () => {
    const t = await token(THERESA);
    const base = `/api/cms/groups/${PAR_A1}/children`;
    const l = await http().get(base).set(auth(t)).expect(200);
    expect(l.body).toMatchObject({ childLevel: "OUTSTATION", canManage: true });
    expect(l.body.items.map((g: { id: string }) => g.id)).toEqual(
      expect.arrayContaining([OUT_A1A, OUT_A1B]),
    );
    const r = await http()
      .post(base)
      .set(auth(t))
      .send({ name: "E2E St Jude Outstation", code: "E2E-ST-JUDE", administratorPersonId: KOFI_ID })
      .expect(201);
    made = r.body.items.find((g: { name: string }) => g.name === "E2E St Jude Outstation").id;
    const [m] = await handle.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupId, made), eq(memberships.memberId, KOFI_ID)));
    expect(m).toMatchObject({ status: "ACTIVE", isHome: false });
    expect(
      (
        await http()
          .post(base)
          .set(auth(t))
          .send({ name: "E2E Duplicate", code: "E2E-ST-JUDE" })
          .expect(409)
      ).body.error.code,
    ).toBe("CODE_TAKEN");
    await http()
      .post(base)
      .set(auth(await token(AMA)))
      .send({ name: "E2E Manager try" })
      .expect(403);
  });

  it("closing hides it from sign-up; a group with open groups under it can't close", async () => {
    const t = await token(THERESA);
    await http()
      .post(`/api/cms/groups/${PAR_A1}/children/${made}/status`)
      .set(auth(t))
      .send({ isActive: false })
      .expect(200);
    const s = await http()
      .get(`/api/public/churches?q=${encodeURIComponent("E2E St Jude")}`)
      .expect(200);
    expect(s.body.items).toEqual([]);
    const d = await token(DEAN);
    expect(
      (
        await http()
          .post(`/api/cms/groups/${DEAN_A}/children/${PAR_A1}/status`)
          .set(auth(d))
          .send({ isActive: false })
          .expect(409)
      ).body.error.code,
    ).toBe("HAS_OPEN_CHILDREN");
    const dl = await http().get(`/api/cms/groups/${DEAN_A}/children`).set(auth(d)).expect(200);
    expect(dl.body.childLevel).toBe("PARISH");
    expect(dl.body.items.find((g: { id: string }) => g.id === PAR_A1).members).toBeGreaterThan(0);
  });
});

describe("dashboards roll up what's below (D-041)", () => {
  it("dean, parish and outstation", async () => {
    const d = await http()
      .get(`/api/cms/groups/${DEAN_A}/dashboard`)
      .set(auth(await token(DEAN)))
      .expect(200);
    expect(d.body.rollup).toMatchObject({ parishes: 2 });
    expect(d.body.rollup.outstations).toBeGreaterThanOrEqual(3);
    const p = await http()
      .get(`/api/cms/groups/${PAR_A1}/dashboard`)
      .set(auth(await token(THERESA)))
      .expect(200);
    expect(p.body.rollup).toMatchObject({ parishes: 0 });
    expect(p.body.rollup.outstations).toBeGreaterThanOrEqual(2);
    const o = await http()
      .get(`/api/cms/groups/${OUT_A1A}/dashboard`)
      .set(auth(await token(MICHAEL)))
      .expect(200);
    expect(o.body.rollup).toBe(null);
  });

  it("a suffragan set to hidden disappears from the archdiocese's figures (blueprint §3.4)", async () => {
    const a = await token(ARCH_ADMIN);
    const before = (await http().get(`/api/cms/groups/${ARCH}/dashboard`).set(auth(a)).expect(200))
      .body.rollup;
    expect(before.hiddenDioceses).toBe(0);
    expect(before.parishes).toBeGreaterThanOrEqual(4);

    const dio = await token(DIO_ADMIN);
    const s = await http().get(`/api/cms/groups/${DIO}/settings`).set(auth(dio)).expect(200);
    expect(s.body.metropolitanVisibility).toBe("aggregates");
    expect(
      (
        await http()
          .get(`/api/cms/groups/${PAR_A1}/settings`)
          .set(auth(await token(THERESA)))
          .expect(200)
      ).body.metropolitanVisibility,
    ).toBe(null);
    await http()
      .put(`/api/cms/groups/${DIO}/settings`)
      .set(auth(a))
      .send({ ...s.body, metropolitanVisibility: "detailed" })
      .expect(403);
    const { themeCode, languageCode, currencyCode, allowManualTransactionDates } = s.body;
    await http()
      .put(`/api/cms/groups/${DIO}/settings`)
      .set(auth(dio))
      .send({
        themeCode,
        languageCode,
        currencyCode,
        allowManualTransactionDates,
        metropolitanVisibility: "hidden",
      })
      .expect(200);

    const after = (await http().get(`/api/cms/groups/${ARCH}/dashboard`).set(auth(a)).expect(200))
      .body.rollup;
    expect(after.hiddenDioceses).toBe(1);
    expect(after.parishes).toBe(1); // only the archdiocese's own cathedral parish
    const kids = await http().get(`/api/cms/groups/${ARCH}/children`).set(auth(a)).expect(200);
    expect(kids.body.items.find((g: { id: string }) => g.id === DIO)).toMatchObject({
      hidden: true,
      members: 0,
    });
  });
});
