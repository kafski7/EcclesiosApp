import {
  createDb,
  groupSettings,
  groups,
  members,
  memberships,
  notifications,
  notificationTypes,
} from "@ecclesios/db";
import { eq, inArray, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache, type CapturingOtpSender } from "./app";

// Phase 6.3 — claim, own profile & password, notifications, staff, settings, leader dashboard (D-039).
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const PAR_A1 = G(107);
const THERESA_ID = G(507);
const THERESA = "theresa.pastor@dev.ecclesios.local"; // Administrator
const AMA = "ama.mensah@dev.ecclesios.local"; //        Manager
const KWAME = "kwame.owusu@dev.ecclesios.local"; //     Society-Leader (CYO)
const PHONE = "+233209990555";

let app: INestApplication;
let otp: CapturingOtpSender;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let before: {
  themeId: number | null;
  languageCode: string | null;
  currencyCode: string | null;
} | null = null;

const cleanup = async () => {
  const rows = await handle.db
    .select({ id: members.id })
    .from(members)
    .where(like(members.lastName, "Claimtest%"));
  if (rows.length) {
    await handle.db.delete(memberships).where(
      inArray(
        memberships.memberId,
        rows.map((r) => r.id),
      ),
    );
    await handle.db.delete(members).where(
      inArray(
        members.id,
        rows.map((r) => r.id),
      ),
    );
  }
  await handle.db.delete(notifications).where(like(notifications.title, "E2E %"));
  if (before) await handle.db.update(groups).set(before).where(eq(groups.id, PAR_A1));
  await handle.db
    .update(groupSettings)
    .set({ allowManualTransactionDates: false })
    .where(eq(groupSettings.groupId, PAR_A1));
};

beforeAll(async () => {
  const [g] = await handle.db
    .select({
      themeId: groups.themeId,
      languageCode: groups.languageCode,
      currencyCode: groups.currencyCode,
    })
    .from(groups)
    .where(eq(groups.id, PAR_A1));
  before = g ?? null;
  await cleanup();
  const t = await createTestApp();
  app = t.app;
  otp = t.otp;
  token = signInCache(app, t.otp);
});
afterAll(async () => {
  await cleanup();
  await app?.close();
  await handle.close();
});

describe("claim a register entry (D-039)", () => {
  let access = "";
  it("staff add someone; registering with their phone points them to claim", async () => {
    await http()
      .post(`/api/cms/groups/${PAR_A1}/members`)
      .set(auth(await token(THERESA)))
      .send({ firstName: "E2e", lastName: "Claimtest", telephone: PHONE })
      .expect(201);
    const r = await http()
      .post("/api/auth/register")
      .send({
        churchId: PAR_A1,
        firstName: "E2e",
        lastName: "Claimtest",
        telephone: PHONE,
        password: "Claimed2026pw",
      })
      .expect(409);
    expect(r.body.error.code).toBe("CLAIM_ACCOUNT");
  });

  it("code → set password → signed in, with their church already there", async () => {
    const ch = await http().post("/api/auth/claim").send({ identifier: PHONE }).expect(200);
    const v = await http()
      .post("/api/auth/verify-otp")
      .send({ challengeToken: ch.body.challengeToken, otp: otp.last() })
      .expect(200);
    expect(v.body.status).toBe("PASSWORD_SETUP_REQUIRED");
    const s = await http()
      .post("/api/auth/set-password")
      .send({ tempToken: v.body.tempToken, newPassword: "Claimed2026pw" })
      .expect(200);
    access = s.body.accessToken;
    const me = await http().get("/api/me/profile").set(auth(access)).expect(200);
    expect(me.body).toMatchObject({ telephone: PHONE, homeChurch: { id: PAR_A1 } });
    expect(
      (await http().post("/api/auth/claim").send({ identifier: PHONE }).expect(404)).body.error
        .code,
    ).toBe("NOTHING_TO_CLAIM");
    expect(
      (await http().post("/api/auth/claim").send({ identifier: THERESA }).expect(404)).body.error
        .code,
    ).toBe("NOTHING_TO_CLAIM");
  });

  it("edits own contact details (not someone else's phone) and changes password", async () => {
    const r = await http()
      .put("/api/me/profile")
      .set(auth(access))
      .send({ telephone: PHONE, email: "claimtest@example.org", occupation: "Teacher" })
      .expect(200);
    expect(r.body).toMatchObject({ email: "claimtest@example.org", occupation: "Teacher" });
    expect(
      (await http().put("/api/me/profile").set(auth(access)).send({ email: THERESA }).expect(409))
        .body.error.code,
    ).toBe("PERSON_EXISTS");
    await http()
      .put("/api/me/profile")
      .set(auth(access))
      .send({ email: "", telephone: "" })
      .expect(400);
    expect(
      (
        await http()
          .post("/api/me/password")
          .set(auth(access))
          .send({ currentPassword: "nope-nope-1", newPassword: "Another2026pw" })
          .expect(400)
      ).body.error.code,
    ).toBe("WRONG_PASSWORD");
    const p = await http()
      .post("/api/me/password")
      .set(auth(access))
      .send({ currentPassword: "Claimed2026pw", newPassword: "Another2026pw" })
      .expect(200);
    expect(typeof p.body.refreshToken).toBe("string");
    await http()
      .post("/api/auth/login")
      .send({ identifier: PHONE, password: "Another2026pw" })
      .expect(200);
  });
});

describe("notifications", () => {
  it("lists newest first, counts unread, marks read (one or all, per church)", async () => {
    const [type] = await handle.db
      .select({ id: notificationTypes.id })
      .from(notificationTypes)
      .limit(1);
    const at = (m: number) => new Date(Date.now() - m * 60_000);
    await handle.db.insert(notifications).values([
      {
        typeId: type!.id,
        recipientMemberId: THERESA_ID,
        groupId: PAR_A1,
        title: "E2E older",
        link: "/admin/members",
        createdAt: at(10),
      },
      {
        typeId: type!.id,
        recipientMemberId: THERESA_ID,
        groupId: PAR_A1,
        title: "E2E newer",
        link: "https://evil.example",
        createdAt: at(1),
      },
      {
        typeId: type!.id,
        recipientMemberId: THERESA_ID,
        groupId: null,
        title: "E2E personal",
        createdAt: at(5),
      },
    ]);
    const t = await token(THERESA);
    const all = await http().get("/api/me/notifications").set(auth(t)).expect(200);
    const mine = all.body.items.filter((n: { title: string }) => n.title.startsWith("E2E "));
    expect(mine.map((n: { title: string }) => n.title)).toEqual([
      "E2E newer",
      "E2E personal",
      "E2E older",
    ]);
    expect(mine[0].link).toBe(null); // outside links are dropped
    const church = await http()
      .get(`/api/me/notifications?church=${PAR_A1}&unread=1`)
      .set(auth(t))
      .expect(200);
    expect(
      church.body.items.every((n: { church: { id: string } | null }) => n.church?.id === PAR_A1),
    ).toBe(true);
    const before = (await http().get("/api/me/notifications/unread").set(auth(t)).expect(200)).body
      .unread;
    await http()
      .post("/api/me/notifications/read")
      .set(auth(t))
      .send({ ids: [mine[2].id] })
      .expect(200);
    expect(
      (await http().get("/api/me/notifications/unread").set(auth(t)).expect(200)).body.unread,
    ).toBe(before - 1);
    const done = await http()
      .post("/api/me/notifications/read")
      .set(auth(t))
      .send({ church: PAR_A1 })
      .expect(200);
    expect(done.body.unread).toBe(0);
    expect(
      (await http().get("/api/me/notifications/unread").set(auth(t)).expect(200)).body.unread,
    ).toBeGreaterThanOrEqual(1); // the personal one
  });
});

describe("Users & Roles, Settings", () => {
  it("lists staff, Administrators first; Managers read but can't manage", async () => {
    const r = await http()
      .get(`/api/cms/groups/${PAR_A1}/staff`)
      .set(auth(await token(THERESA)))
      .expect(200);
    expect(r.body.canManage).toBe(true);
    expect(r.body.items[0]).toMatchObject({ role: "ADMINISTRATOR" });
    expect(r.body.items.some((s: { role: string }) => s.role === "SOCIETY_LEADER")).toBe(true);
    expect(r.body.items.find((s: { isYou: boolean }) => s.isYou).personId).toBe(THERESA_ID);
    expect(
      (
        await http()
          .get(`/api/cms/groups/${PAR_A1}/staff`)
          .set(auth(await token(AMA)))
          .expect(200)
      ).body.canManage,
    ).toBe(false);
    await http()
      .get(`/api/cms/groups/${PAR_A1}/staff`)
      .set(auth(await token(KWAME)))
      .expect(403);
  });

  it("settings: Administrators change, Managers read, unknown codes refused", async () => {
    const t = await token(THERESA);
    const s = await http().get(`/api/cms/groups/${PAR_A1}/settings`).set(auth(t)).expect(200);
    const theme = s.body.options.themes.at(-1).code;
    const body = {
      themeCode: theme,
      languageCode: "en",
      currencyCode: "GHS",
      allowManualTransactionDates: true,
    };
    const r = await http()
      .put(`/api/cms/groups/${PAR_A1}/settings`)
      .set(auth(t))
      .send(body)
      .expect(200);
    expect(r.body).toMatchObject({ themeCode: theme, allowManualTransactionDates: true });
    await http()
      .put(`/api/cms/groups/${PAR_A1}/settings`)
      .set(auth(t))
      .send({ ...body, currencyCode: "XYZ" })
      .expect(400);
    await http()
      .put(`/api/cms/groups/${PAR_A1}/settings`)
      .set(auth(await token(AMA)))
      .send(body)
      .expect(403);
  });
});

describe("dashboard for Society-Leaders", () => {
  it("shows what they lead instead of refusing", async () => {
    const r = await http()
      .get(`/api/cms/groups/${PAR_A1}/dashboard`)
      .set(auth(await token(KWAME)))
      .expect(200);
    expect(r.body).toMatchObject({ view: "LEADER", members: 0, societies: 1 });
    expect(
      (
        await http()
          .get(`/api/cms/groups/${PAR_A1}/dashboard`)
          .set(auth(await token(THERESA)))
          .expect(200)
      ).body.view,
    ).toBe("FULL");
  });
});
