import { auditLogs, createDb, memberships, roles, societies, societyMembers } from "@ecclesios/db";
import { and, eq, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 6.2 — societies & committees (functionality §4.4–4.5, D-038).
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const PAR_A1 = G(107),
  OUT_A1A = G(110);
const CYO = G(700),
  CMA = G(701),
  FINANCE = G(702),
  CHOIR = G(703); // St Michael outstation
const KWAME_ID = G(515),
  KOFI_ID = G(517),
  ABENA_ID = G(520);
const THERESA = "theresa.pastor@dev.ecclesios.local"; // Administrator, St Theresa
const KWAME = "kwame.owusu@dev.ecclesios.local"; //      Society-Leader, leads the CYO
const MICHAEL = "michael.catechist@dev.ecclesios.local"; // Administrator, St Michael outstation
const CHRIST = "christ.pastor@dev.ecclesios.local"; //   neighbouring parish
const DEAN = "joseph.dean@dev.ecclesios.local";

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const base = `/api/cms/groups/${PAR_A1}/societies`;
let kofiRole: number | null = null;

const cleanup = async () => {
  await handle.db.delete(societies).where(like(societies.name, "E2E %"));
  await handle.db
    .delete(societyMembers)
    .where(and(eq(societyMembers.societyId, CYO), eq(societyMembers.memberId, ABENA_ID)));
  if (kofiRole)
    await handle.db
      .update(memberships)
      .set({ roleId: kofiRole })
      .where(and(eq(memberships.memberId, KOFI_ID), eq(memberships.groupId, PAR_A1)));
};

beforeAll(async () => {
  const [k] = await handle.db
    .select({ roleId: memberships.roleId })
    .from(memberships)
    .where(and(eq(memberships.memberId, KOFI_ID), eq(memberships.groupId, PAR_A1)));
  kofiRole = k?.roleId ?? null;
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

describe("who sees what", () => {
  it("staff see every society and committee, with leaders and counts", async () => {
    const t = await token(THERESA);
    const s = await http().get(base).set(auth(t)).expect(200);
    const cyo = s.body.items.find((x: { id: string }) => x.id === CYO);
    expect(cyo).toMatchObject({
      kind: "SOCIETY",
      leader: { id: KWAME_ID },
      can: { manage: true, roster: true },
    });
    expect(cyo.rosterCount).toBeGreaterThanOrEqual(3);
    expect(s.body.items.some((x: { id: string }) => x.id === FINANCE)).toBe(false);
    const c = await http().get(`${base}?kind=COMMITTEE`).set(auth(t)).expect(200);
    expect(c.body.items.map((x: { id: string }) => x.id)).toContain(FINANCE);
  });

  it("a leader sees only what they lead, and can keep its roster but not manage it", async () => {
    const t = await token(KWAME);
    const s = await http().get(base).set(auth(t)).expect(200);
    expect(s.body.items.map((x: { id: string }) => x.id)).toEqual([CYO]);
    expect(
      (await http().get(`${base}?kind=COMMITTEE`).set(auth(t)).expect(200)).body.items,
    ).toEqual([]); // on the roster, not the leader
    const d = await http().get(`${base}/${CYO}`).set(auth(t)).expect(200);
    expect(d.body.can).toEqual({ read: true, roster: true, manage: false });
    expect(d.body.roster[0]).toMatchObject({ personId: KWAME_ID, isLeader: true });
    await http().get(`${base}/${CMA}`).set(auth(t)).expect(404);
    await http().put(`${base}/${CYO}`).set(auth(t)).send({ name: "Renamed" }).expect(403);
  });

  it("neighbours, the dean and the outstation get nothing", async () => {
    for (const who of [CHRIST, DEAN, MICHAEL])
      await http()
        .get(base)
        .set(auth(await token(who)))
        .expect(403);
  });

  it("the parish reads its outstation's societies but doesn't run them", async () => {
    const t = await token(THERESA);
    const r = await http()
      .get(`/api/cms/groups/${OUT_A1A}/societies/${CHOIR}`)
      .set(auth(t))
      .expect(200);
    expect(r.body.can).toEqual({ read: true, roster: false, manage: false });
    await http()
      .post(`/api/cms/groups/${OUT_A1A}/societies/${CHOIR}/roster`)
      .set(auth(t))
      .send({ personId: KOFI_ID })
      .expect(403);
    const m = await http()
      .get(`/api/cms/groups/${OUT_A1A}/societies/${CHOIR}`)
      .set(auth(await token(MICHAEL)))
      .expect(200);
    expect(m.body.can.manage).toBe(true);
  });
});

describe("rosters", () => {
  it("a leader adds an outstation member to a parish society, sets a position, removes them", async () => {
    const t = await token(KWAME);
    const cand = await http().get(`${base}/${CYO}/candidates?q=osei`).set(auth(t)).expect(200);
    expect(cand.body.items[0]).toMatchObject({
      personId: ABENA_ID,
      church: "St Michael Outstation",
      canLead: false,
    });
    const added = await http()
      .post(`${base}/${CYO}/roster`)
      .set(auth(t))
      .send({ personId: ABENA_ID })
      .expect(201);
    expect(
      added.body.roster.find((r: { personId: string }) => r.personId === ABENA_ID).church.id,
    ).toBe(OUT_A1A);
    await http()
      .post(`${base}/${CYO}/roster`)
      .set(auth(t))
      .send({ personId: ABENA_ID })
      .expect(409);
    const pos = await http()
      .put(`${base}/${CYO}/roster/${ABENA_ID}`)
      .set(auth(t))
      .send({ position: "  financial secretary " })
      .expect(200);
    expect(
      pos.body.roster.find((r: { personId: string }) => r.personId === ABENA_ID).position,
    ).toBe("Financial Secretary");
    await http().delete(`${base}/${CYO}/roster/${ABENA_ID}`).set(auth(t)).expect(200);
    expect(
      (await http().delete(`${base}/${CYO}/roster/${KWAME_ID}`).set(auth(t)).expect(409)).body.error
        .code,
    ).toBe("IS_LEADER");
  });

  it("only church members can join; the roster exports to CSV", async () => {
    const t = await token(THERESA);
    const outsider = G(508); // Christ the King's pastor
    expect(
      (
        await http()
          .post(`${base}/${CYO}/roster`)
          .set(auth(t))
          .send({ personId: outsider })
          .expect(400)
      ).body.error.code,
    ).toBe("NOT_A_MEMBER");
    const csv = await http().get(`${base}/${CYO}/roster.csv`).set(auth(t)).expect(200);
    expect(csv.text.startsWith("\uFEFFName,Position,Leader")).toBe(true);
    expect(csv.text).toContain("Owusu");
  });
});

describe("managing societies", () => {
  let id = "";
  it("creates a committee; a Parishioner leader becomes Society-Leader", async () => {
    const t = await token(THERESA);
    const r = await http()
      .post(base)
      .set(auth(t))
      .send({ kind: "COMMITTEE", name: "E2E Liturgy Committee", leaderPersonId: KOFI_ID })
      .expect(201);
    id = r.body.id;
    expect(r.body).toMatchObject({ kind: "COMMITTEE", leader: { id: KOFI_ID }, rosterCount: 1 });
    const [m] = await handle.db
      .select({ role: roles.code })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(and(eq(memberships.memberId, KOFI_ID), eq(memberships.groupId, PAR_A1)));
    expect(m!.role).toBe("SOCIETY_LEADER");
    const audit = await handle.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "society.created"), eq(auditLogs.entityId, id)));
    expect(audit.length).toBe(1);
  });

  it("rejects duplicate names and leaders from elsewhere", async () => {
    const t = await token(THERESA);
    expect(
      (
        await http()
          .post(base)
          .set(auth(t))
          .send({ kind: "SOCIETY", name: "e2e liturgy committee" })
          .expect(409)
      ).body.error.code,
    ).toBe("NAME_TAKEN");
    expect(
      (
        await http()
          .put(`${base}/${id}`)
          .set(auth(t))
          .send({ name: "E2E Liturgy Committee", leaderPersonId: ABENA_ID })
          .expect(400)
      ).body.error.code,
    ).toBe("LEADER_NOT_MEMBER");
  });

  it("archive → frozen; delete only when archived and empty", async () => {
    const t = await token(THERESA);
    expect((await http().delete(`${base}/${id}`).set(auth(t)).expect(409)).body.error.code).toBe(
      "ARCHIVE_FIRST",
    );
    await http().post(`${base}/${id}/archive`).set(auth(t)).expect(200);
    expect(
      (await http().get(`${base}?kind=COMMITTEE`).set(auth(t)).expect(200)).body.items.some(
        (x: { id: string }) => x.id === id,
      ),
    ).toBe(false);
    expect(
      (await http().get(`${base}?kind=COMMITTEE&archived=1`).set(auth(t)).expect(200)).body.items[0]
        .id,
    ).toBe(id);
    await http().post(`${base}/${id}/roster`).set(auth(t)).send({ personId: KWAME_ID }).expect(409);
    expect((await http().delete(`${base}/${id}`).set(auth(t)).expect(409)).body.error.code).toBe(
      "NOT_EMPTY",
    );
    await http().post(`${base}/${id}/restore`).set(auth(t)).expect(200);
    await http()
      .put(`${base}/${id}`)
      .set(auth(t))
      .send({ name: "E2E Liturgy Committee", leaderPersonId: null })
      .expect(200);
    await http().delete(`${base}/${id}/roster/${KOFI_ID}`).set(auth(t)).expect(200);
    await http().post(`${base}/${id}/archive`).set(auth(t)).expect(200);
    await http().delete(`${base}/${id}`).set(auth(t)).expect(204);
  });
});
