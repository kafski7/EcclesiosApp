import {
  createDb,
  digestRuns,
  members,
  messageRecipients,
  messages,
  notificationPreferences,
  notifications,
  subscriptions,
} from "@ecclesios/db";
import { and, eq, inArray, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { BirthdayDigest } from "../src/digests/birthday-digest";
import { createTestApp, signInCache } from "./app";

// Phase 7 — messages, broadcasts, preferences, birthday digest (D-050 – D-052). Jobs run inline.
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const ARCH = G(101);
const DEAN_A = G(105);
const PAR_A1 = G(107);
const OUT_A1A = G(110);
const KOFI_ID = G(517);
const THERESA = "theresa.pastor@dev.ecclesios.local"; //     parA1 Administrator
const AMA = "ama.mensah@dev.ecclesios.local"; //             parA1 Manager
const KWAME = "kwame.owusu@dev.ecclesios.local"; //          parA1 Society-Leader
const KOFI = "kofi.asante@dev.ecclesios.local"; //           parA1 Parishioner
const JOSEPH = "joseph.dean@dev.ecclesios.local"; //         deanA Administrator
const ARCHA = "archdiocese.admin@dev.ecclesios.local"; //    archdiocese Administrator
const MICHAEL = "michael.catechist@dev.ecclesios.local"; //  outA1a Administrator
const DIGEST_DAY = "2091-10-01"; // Theresa Pastor's birthday, a year no real run uses

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const base = (g: string) => `/api/cms/groups/${g}/messages`;
let balanceBefore: number | null = null;
const started = new Date();

const parishSub = async () => {
  const [s] = await handle.db
    .select({ id: subscriptions.id, sms: subscriptions.smsBalance })
    .from(subscriptions)
    .where(and(eq(subscriptions.groupId, PAR_A1), inArray(subscriptions.status, ["ACTIVE", "TRIAL"])));
  return s!;
};

const cleanup = async () => {
  const mine = await handle.db
    .select({ id: messages.id })
    .from(messages)
    .where(like(messages.body, "E2E %"));
  if (mine.length) {
    const ids = mine.map((m) => m.id);
    await handle.db.delete(messageRecipients).where(inArray(messageRecipients.messageId, ids));
    await handle.db.delete(messages).where(inArray(messages.id, ids));
  }
  await handle.db.delete(notifications).where(like(notifications.title, "E2E %"));
  await handle.db.delete(notifications).where(like(notifications.body, "E2E %"));
  await handle.db.delete(notifications).where(like(notifications.title, "%birthday% today at %"));
  await handle.db.delete(digestRuns).where(eq(digestRuns.day, DIGEST_DAY));
  await handle.db.delete(notificationPreferences).where(eq(notificationPreferences.memberId, KOFI_ID));
  if (balanceBefore !== null) {
    const s = await parishSub();
    await handle.db.update(subscriptions).set({ smsBalance: balanceBefore }).where(eq(subscriptions.id, s.id));
  }
};

beforeAll(async () => {
  balanceBefore = (await parishSub()).sms;
  await cleanup();
  await handle.db
    .update(members)
    .set({ firstLogin: new Date() })
    .where(eq(members.id, KOFI_ID));
  const t = await createTestApp();
  app = t.app;
  token = signInCache(app, t.otp);
});
afterAll(async () => {
  await cleanup();
  await app?.close();
  await handle.close();
});

describe("who may send (scope: own church, write)", () => {
  it("Administrators and Managers open Messages; Society-Leaders and Parishioners can't", async () => {
    const o = await http().get(`${base(PAR_A1)}/options`).set(auth(await token(THERESA))).expect(200);
    expect(o.body).toMatchObject({
      church: { id: PAR_A1, level: "PARISH" },
      canIncludeOutstations: true,
      broadcastLevels: ["OUTSTATION"],
    });
    expect(o.body.channels.find((c: { channel: string }) => c.channel === "SMS").available).toBe(true);
    await http().get(`${base(PAR_A1)}/options`).set(auth(await token(AMA))).expect(200);
    for (const who of [KWAME, KOFI])
      expect(
        (await http().get(`${base(PAR_A1)}/options`).set(auth(await token(who))).expect(403)).body
          .error.code,
      ).toBe("SCOPE_DENIED");
  });

  it("a parish can't message the neighbouring deanery's churches through its own URL", async () => {
    await http().get(`${base(DEAN_A)}/options`).set(auth(await token(THERESA))).expect(403);
  });
});

describe("SMS: estimate, charge, send, log (D-051)", () => {
  it("preview costs one part per reachable person and checks the balance", async () => {
    const r = await http()
      .post(`${base(PAR_A1)}/preview`)
      .set(auth(await token(THERESA)))
      .send({ channel: "SMS", audience: { kind: "CHURCH" }, body: "E2E Mass at 7am, {firstName}." })
      .expect(200);
    expect(r.body.segments).toBe(1);
    expect(r.body.reachable).toBeGreaterThan(0);
    expect(r.body.cost).toBe(r.body.reachable);
    expect(r.body.blocker).toBeNull();
  });

  it("sends: credit taken for the sent, recipients logged, final status SENT", async () => {
    const before = (await parishSub()).sms;
    const r = await http()
      .post(base(PAR_A1))
      .set(auth(await token(AMA)))
      .send({ channel: "SMS", audience: { kind: "CHURCH" }, body: "E2E Choir practice tonight, {firstName}." })
      .expect(202);
    const d = await http().get(`${base(PAR_A1)}/${r.body.id}`).set(auth(await token(AMA))).expect(200);
    expect(d.body.status).toBe("SENT");
    expect(d.body.counts.pending).toBe(0);
    expect(d.body.counts.sent).toBeGreaterThan(0);
    expect(d.body.smsUsed).toBe(d.body.counts.sent);
    expect((await parishSub()).sms).toBe(before - d.body.smsUsed);
    const rec = await http()
      .get(`${base(PAR_A1)}/${r.body.id}/recipients`)
      .set(auth(await token(AMA)))
      .expect(200);
    expect(rec.body.items[0].destination).toMatch(/\*/); // masked
    const list = await http().get(base(PAR_A1)).set(auth(await token(THERESA))).expect(200);
    expect(list.body.items[0].id).toBe(r.body.id);
  });

  it("not enough credit → 409, nothing queued", async () => {
    const s = await parishSub();
    await handle.db.update(subscriptions).set({ smsBalance: 0 }).where(eq(subscriptions.id, s.id));
    const r = await http()
      .post(base(PAR_A1))
      .set(auth(await token(THERESA)))
      .send({ channel: "SMS", audience: { kind: "CHURCH" }, body: "E2E no credit" })
      .expect(409);
    expect(r.body.error.code).toBe("INSUFFICIENT_SMS_BALANCE");
    await handle.db.update(subscriptions).set({ smsBalance: s.sms }).where(eq(subscriptions.id, s.id));
  });

  it("email and in-app need a subject", async () => {
    const r = await http()
      .post(`${base(PAR_A1)}/preview`)
      .set(auth(await token(THERESA)))
      .send({ channel: "EMAIL", audience: { kind: "CHURCH" }, body: "E2E x" })
      .expect(400);
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("broadcasts (blueprint §3.3)", () => {
  it("deanery → staff of its parishes, in-app", async () => {
    await http()
      .post(base(DEAN_A))
      .set(auth(await token(JOSEPH)))
      .send({
        channel: "IN_APP",
        subject: "E2E Deanery meeting",
        audience: { kind: "BROADCAST", levels: ["PARISH"], people: "STAFF" },
        body: "E2E Deanery meeting on Saturday.",
      })
      .expect(202);
    const inbox = await http().get("/api/me/notifications?unread=1").set(auth(await token(THERESA))).expect(200);
    expect(inbox.body.items.some((n: { title: string }) => n.title === "E2E Deanery meeting")).toBe(true);
    const kofi = await http().get("/api/me/notifications?unread=1").set(auth(await token(KOFI))).expect(200);
    expect(kofi.body.items.some((n: { title: string }) => n.title === "E2E Deanery meeting")).toBe(false);
  });

  it("levels above or beside the sender are refused", async () => {
    const r = await http()
      .post(`${base(DEAN_A)}/preview`)
      .set(auth(await token(JOSEPH)))
      .send({
        channel: "IN_APP",
        subject: "x",
        audience: { kind: "BROADCAST", levels: ["DEANERY"] },
        body: "E2E x",
      })
      .expect(403);
    expect(r.body.error.code).toBe("BROADCAST_NOT_ALLOWED");
    expect(
      (
        await http()
          .post(`${base(OUT_A1A)}/preview`)
          .set(auth(await token(MICHAEL)))
          .send({ channel: "IN_APP", subject: "x", audience: { kind: "BROADCAST", levels: ["OUTSTATION"] }, body: "E2E x" })
          .expect(403)
      ).body.error.code,
    ).toBe("BROADCAST_NOT_ALLOWED");
  });

  it("the metropolitan archdiocese doesn't reach into its suffragan", async () => {
    const r = await http()
      .post(`${base(ARCH)}/preview`)
      .set(auth(await token(ARCHA)))
      .send({
        channel: "IN_APP",
        subject: "x",
        audience: { kind: "BROADCAST", levels: ["PARISH"], people: "STAFF" },
        body: "E2E x",
      })
      .expect(200);
    expect(r.body.recipients).toBe(1); // the cathedral parish's Administrator only
  });

  it("deaneries have no SMS (no subscription)", async () => {
    const o = await http().get(`${base(DEAN_A)}/options`).set(auth(await token(JOSEPH))).expect(200);
    expect(o.body.channels.find((c: { channel: string }) => c.channel === "SMS").available).toBe(false);
  });
});

describe("notification preferences (D-052)", () => {
  it("lists types; always-on ones can't be switched off", async () => {
    const p = await http().get("/api/me/notification-preferences").set(auth(await token(KOFI))).expect(200);
    expect(p.body.items.some((i: { type: string }) => i.type === "MESSAGE")).toBe(true);
    expect(p.body.items.some((i: { type: string }) => i.type === "BIRTHDAY")).toBe(false); // staff only
    const r = await http()
      .put("/api/me/notification-preferences")
      .set(auth(await token(KOFI)))
      .send({ changes: [{ type: "SYSTEM", enabled: false }] })
      .expect(400);
    expect(r.body.error.code).toBe("ALWAYS_ON");
  });

  it("turning church messages off skips you in in-app messages", async () => {
    await http()
      .put("/api/me/notification-preferences")
      .set(auth(await token(KOFI)))
      .send({ changes: [{ type: "MESSAGE", enabled: false }] })
      .expect(200);
    const sent = await http()
      .post(base(PAR_A1))
      .set(auth(await token(THERESA)))
      .send({ channel: "IN_APP", subject: "E2E Notice", audience: { kind: "PEOPLE", ids: [KOFI_ID] }, body: "E2E notice" })
      .expect(202);
    const rec = await http()
      .get(`${base(PAR_A1)}/${sent.body.id}/recipients`)
      .set(auth(await token(THERESA)))
      .expect(200);
    expect(rec.body.items[0]).toMatchObject({ status: "SKIPPED", error: "Turned these notifications off" });
  });
});

describe("birthday digest", () => {
  it("tells the church's staff once per day", async () => {
    const digest = app.get(BirthdayDigest);
    expect(await digest.run(DIGEST_DAY)).toBeGreaterThan(0);
    expect(await digest.run(DIGEST_DAY)).toBeNull();
    const n = await handle.db
      .select({ title: notifications.title, body: notifications.body })
      .from(notifications)
      .where(like(notifications.title, "%today at St Theresa Parish"));
    expect(n.length).toBeGreaterThanOrEqual(2); // Administrator + Manager
    expect(n[0]!.body).toContain("Theresa Pastor");
    expect(started).toBeInstanceOf(Date);
  });
});
