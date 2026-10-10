import { auditLogs, createDb, members, memberships, roles } from "@ecclesios/db";
import { and, eq, inArray, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 6.1 — church register, roles, removal, birthdays (functionality §4.2–4.3, D-037).
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const PAR_A1 = G(107),
  OUT_A1A = G(110);
const THERESA_ID = G(507),
  AMA_ID = G(514),
  KOFI_ID = G(517),
  ABENA_ID = G(520);
const THERESA = "theresa.pastor@dev.ecclesios.local"; // Administrator, St Theresa (parish of St Michael)
const AMA = "ama.mensah@dev.ecclesios.local"; //        Manager, St Theresa
const MICHAEL = "michael.catechist@dev.ecclesios.local"; // Administrator, St Michael outstation
const CHRIST = "christ.pastor@dev.ecclesios.local"; //   Administrator of a neighbouring parish
const DEAN = "joseph.dean@dev.ecclesios.local"; //       Dean: summaries, not records

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const base = `/api/cms/groups/${PAR_A1}`;

const person = {
  firstName: "E2e",
  lastName: "Walkin",
  gender: "FEMALE",
  dateOfBirth: "1960-01-15",
  telephone: "+233209990001",
  isBaptised: true,
  baptismDate: "1960-03-01",
};
let ama: { roleId: number } | null = null;

const cleanup = async () => {
  const walkins = await handle.db
    .select({ id: members.id })
    .from(members)
    .where(like(members.lastName, "Walkin%"));
  if (walkins.length) {
    await handle.db.delete(memberships).where(
      inArray(
        memberships.memberId,
        walkins.map((w) => w.id),
      ),
    );
    await handle.db.delete(members).where(
      inArray(
        members.id,
        walkins.map((w) => w.id),
      ),
    );
  }
  if (ama)
    await handle.db
      .update(memberships)
      .set({ roleId: ama.roleId, status: "ACTIVE" })
      .where(and(eq(memberships.memberId, AMA_ID), eq(memberships.groupId, PAR_A1)));
};

beforeAll(async () => {
  const [m] = await handle.db
    .select({ roleId: memberships.roleId })
    .from(memberships)
    .where(and(eq(memberships.memberId, AMA_ID), eq(memberships.groupId, PAR_A1)));
  ama = m ?? null;
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

describe("who may read the register", () => {
  it("own church and parish oversight: yes; neighbours and the dean: no", async () => {
    const t = await token(THERESA);
    const r = await http().get(`${base}/members`).set(auth(t)).expect(200);
    expect(r.body.items.map((x: { personId: string }) => x.personId)).toContain(KOFI_ID);
    expect(r.body.total).toBeGreaterThan(3);
    // The parish reads its outstation's register, and can include it in its own list.
    await http().get(`/api/cms/groups/${OUT_A1A}/members`).set(auth(t)).expect(200);
    const both = await http().get(`${base}/members?outstations=1`).set(auth(t)).expect(200);
    expect(both.body.items.map((x: { personId: string }) => x.personId)).toContain(ABENA_ID);

    await http()
      .get(`${base}/members`)
      .set(auth(await token(CHRIST)))
      .expect(403);
    await http()
      .get(`${base}/members`)
      .set(auth(await token(DEAN)))
      .expect(403);
    // The outstation cannot read its parish.
    await http()
      .get(`${base}/members`)
      .set(auth(await token(MICHAEL)))
      .expect(403);
  });

  it("filters and search", async () => {
    const t = await token(THERESA);
    const admins = await http().get(`${base}/members?role=ADMINISTRATOR`).set(auth(t)).expect(200);
    expect(admins.body.items.every((x: { role: string }) => x.role === "ADMINISTRATOR")).toBe(true);
    const kofi = await http().get(`${base}/members?q=asante`).set(auth(t)).expect(200);
    expect(kofi.body.items[0]).toMatchObject({ personId: KOFI_ID, hasAccount: true });
  });

  it("CSV export is a spreadsheet with a header row", async () => {
    const r = await http()
      .get(`${base}/members.csv`)
      .set(auth(await token(THERESA)))
      .expect(200);
    expect(r.headers["content-type"]).toContain("text/csv");
    expect(r.text).toContain("Last name,First name");
    expect(r.text).toContain("Asante");
  });
});

describe("adding and editing records", () => {
  let walkinId = "";

  it("a Manager adds someone without an app account; staff roles need an Administrator", async () => {
    const t = await token(AMA);
    await http()
      .post(`${base}/members`)
      .set(auth(t))
      .send({ ...person, role: "MANAGER" })
      .expect(403);
    const r = await http().post(`${base}/members`).set(auth(t)).send(person).expect(201);
    walkinId = r.body.person.id;
    expect(r.body).toMatchObject({
      person: { hasAccount: false, isBaptised: true },
      here: { role: "PARISHIONER", status: "ACTIVE", isHome: true },
      can: { edit: true },
    });
    const dup = await http()
      .post(`${base}/members`)
      .set(auth(t))
      .send({ ...person, lastName: "Walkin Two" })
      .expect(409);
    expect(dup.body.error.code).toBe("PERSON_EXISTS");
  });

  it("inconsistent sacramental records are refused", async () => {
    const t = await token(THERESA);
    const bad = await http()
      .put(`${base}/members/${walkinId}`)
      .set(auth(t))
      .send({ ...person, baptismDate: "1959-01-01" })
      .expect(400);
    expect(bad.body.error.code).toBe("INVALID_RECORD");
    const ok = await http()
      .put(`${base}/members/${walkinId}`)
      .set(auth(t))
      .send({ ...person, isConfirmed: true, confirmationDate: "1975-06-01" })
      .expect(200);
    expect(ok.body.person).toMatchObject({ isConfirmed: true, confirmationDate: "1975-06-01" });
  });

  it("the parish edits an outstation member's record (home church rule, D-016)", async () => {
    const r = await http()
      .get(`/api/cms/groups/${OUT_A1A}/members/${ABENA_ID}`)
      .set(auth(await token(THERESA)))
      .expect(200);
    expect(r.body.can.edit).toBe(true);
    expect(r.body.can.manageRole).toBe(false); // roles belong to the outstation's own Administrators
  });

  it("a person who isn't in this church is 404", async () => {
    await http()
      .get(`${base}/members/${ABENA_ID}`)
      .set(auth(await token(THERESA)))
      .expect(404);
  });
});

describe("roles and removal", () => {
  it("Administrators change roles here; Managers can't; your own role is off-limits", async () => {
    await http()
      .put(`${base}/members/${KOFI_ID}/role`)
      .set(auth(await token(AMA)))
      .send({ role: "MANAGER" })
      .expect(403);
    const t = await token(THERESA);
    await http()
      .put(`${base}/members/${THERESA_ID}/role`)
      .set(auth(t))
      .send({ role: "MANAGER" })
      .expect(409);
    const r = await http()
      .put(`${base}/members/${AMA_ID}/role`)
      .set(auth(t))
      .send({ role: "SOCIETY_LEADER" })
      .expect(200);
    expect(r.body.here.role).toBe("SOCIETY_LEADER");
    const [mgr] = await handle.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, "MANAGER"));
    await handle.db
      .update(memberships)
      .set({ roleId: mgr!.id })
      .where(and(eq(memberships.memberId, AMA_ID), eq(memberships.groupId, PAR_A1)));
  });

  it("removing needs a reason, keeps the person, and is audited", async () => {
    const t = await token(THERESA);
    const r = await http().get(`${base}/members?q=walkin`).set(auth(t)).expect(200);
    const id = r.body.items[0].personId;
    await http().post(`${base}/members/${id}/remove`).set(auth(t)).send({ reason: "" }).expect(400);
    await http()
      .post(`${base}/members/${id}/remove`)
      .set(auth(t))
      .send({ reason: "Moved to Kumasi" })
      .expect(204);
    expect(
      (await http().get(`${base}/members?q=walkin`).set(auth(t)).expect(200)).body.items,
    ).toHaveLength(0);
    expect(
      (await http().get(`${base}/members?q=walkin&status=LEFT`).set(auth(t)).expect(200)).body
        .items,
    ).toHaveLength(1);
    const logs = await handle.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "register.removed"), eq(auditLogs.groupId, PAR_A1)));
    expect(logs.length).toBeGreaterThan(0);
  });
});

describe("birthdays", () => {
  it("lists living members with a birthday in the window, soonest first", async () => {
    const t = await token(THERESA);
    const r = await http()
      .get(`${base}/birthdays?days=60&today=2026-04-01`)
      .set(auth(t))
      .expect(200);
    // Ama Mensah: 12 April; Akosua Boateng: 31 May.
    const names = r.body.items.map((x: { lastName: string }) => x.lastName);
    expect(names.indexOf("Mensah")).toBeLessThan(names.indexOf("Boateng"));
    expect(
      r.body.items.find(
        (x: { firstName: string; lastName: string }) =>
          x.firstName === "Ama" && x.lastName === "Mensah",
      ),
    ).toMatchObject({ inDays: 11, turning: 41 });
    await http()
      .get(`${base}/birthdays`)
      .set(auth(await token(CHRIST)))
      .expect(403);
  });
});
