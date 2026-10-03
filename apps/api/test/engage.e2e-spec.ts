import { createDb, hymns, notifications, postComments, posts, reactions, teachings } from "@ecclesios/db";
import { and, eq, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Likes, saves, comment links and mentions (D-035).
const ESI = "esi.mensah@dev.ecclesios.local"; //       pending member — may still like (D-015)
const THERESA = "theresa.pastor@dev.ecclesios.local"; // St Theresa Administrator
const SUPER = "superadmin@dev.ecclesios.local";

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let postId = "";
let teachingId = "";
let hymnId = "";
let esiId = "";
let theresaId = "";

beforeAll(async () => {
  const t = await createTestApp();
  app = t.app;
  token = signInCache(app, t.otp);
  const [p] = await handle.db.select({ id: posts.id }).from(posts).where(eq(posts.status, "APPROVED")).limit(1);
  const [te] = await handle.db.select({ id: teachings.id }).from(teachings).where(eq(teachings.slug, "baptism")).limit(1);
  const [h] = await handle.db.select({ id: hymns.id }).from(hymns).where(eq(hymns.slug, "silent-night")).limit(1);
  postId = p!.id;
  teachingId = te!.id;
  hymnId = h!.id;
  const me = (t: string) => http().get("/api/me").set(auth(t));
  esiId = (await me(await token(ESI))).body.id;
  theresaId = (await me(await token(THERESA))).body.id;
  await handle.db.delete(reactions).where(eq(reactions.memberId, esiId));
});
afterAll(async () => {
  await handle.db.delete(reactions).where(eq(reactions.memberId, esiId));
  await handle.db.delete(postComments).where(like(postComments.body, "E2E%"));
  await handle.db.delete(notifications).where(and(eq(notifications.recipientMemberId, theresaId), like(notifications.title, "%mentioned you%")));
  await app?.close();
  await handle.close();
});

describe("likes and saves", () => {
  it("guests see counts; members like once; unlike is idempotent", async () => {
    const key = `TEACHING:${teachingId}`;
    const before = (await http().get(`/api/public/engage?items=${key}`).expect(200)).body.items[0];
    expect(before).toMatchObject({ key, liked: false, saved: false });

    const t = await token(ESI);
    const a = await http().put(`/api/engage/TEACHING/${teachingId}/like`).set(auth(t)).expect(200);
    expect(a.body).toMatchObject({ liked: true, likes: before.likes + 1 });
    const b = await http().put(`/api/engage/TEACHING/${teachingId}/like`).set(auth(t)).expect(200);
    expect(b.body.likes).toBe(before.likes + 1);
    await http().delete(`/api/engage/TEACHING/${teachingId}/like`).set(auth(t)).expect(200);
    await http().delete(`/api/engage/TEACHING/${teachingId}/like`).set(auth(t)).expect(200);
  });

  it("guests and platform accounts cannot like; unknown items 404; bad keys 400", async () => {
    await http().put(`/api/engage/POST/${postId}/like`).expect(401);
    const s = await token(SUPER, undefined, "admin-login");
    await http().put(`/api/engage/POST/${postId}/like`).set(auth(s)).expect(403);
    const t = await token(ESI);
    await http().put("/api/engage/HYMN/00000000-0000-4000-8000-000000000999/like").set(auth(t)).expect(404);
    await http().get("/api/public/engage?items=NEWS:abc").expect(400);
  });

  it("saves appear on the Saved list, newest first, and personal state shows", async () => {
    const t = await token(ESI);
    await http().put(`/api/engage/HYMN/${hymnId}/save`).set(auth(t)).expect(200);
    await http().put(`/api/engage/POST/${postId}/save`).set(auth(t)).expect(200);
    const saved = await http().get("/api/engage/saved").set(auth(t)).expect(200);
    expect(saved.body.items.map((x: { kind: string }) => x.kind)).toEqual(["POST", "HYMN"]);
    expect(saved.body.items[1].href).toBe("/hymnal/silent-night");
    const st = await http().get(`/api/public/engage?items=HYMN:${hymnId},POST:${postId}`).set(auth(t)).expect(200);
    expect(st.body.items.every((x: { saved: boolean }) => x.saved)).toBe(true);
  });
});

describe("comments: no links, mentions", () => {
  it("refuses links", async () => {
    const t = await token(ESI);
    for (const body of ["E2E see https://x.com", "E2E www.example.org", "E2E visit example.com"]) {
      const r = await http().post(`/api/explore/posts/${postId}/comments`).set(auth(t)).send({ body }).expect(400);
      expect(r.body.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("mentions people from the conversation or your church, and notifies them", async () => {
    const theresa = await token(THERESA);
    await http().post(`/api/explore/posts/${postId}/comments`).set(auth(theresa)).send({ body: "E2E thanks all" }).expect(201);

    const t = await token(ESI);
    const sug = await http().get(`/api/explore/posts/${postId}/mention-suggestions?q=ther`).set(auth(t)).expect(200);
    expect(sug.body.items.some((x: { id: string }) => x.id === theresaId)).toBe(true);

    const r = await http()
      .post(`/api/explore/posts/${postId}/comments`)
      .set(auth(t))
      .send({ body: `E2E agreed @{${theresaId}}` })
      .expect(201);
    const mine = r.body.items.find((c: { body: string }) => c.body.includes(theresaId));
    expect(mine.mentions).toEqual([{ id: theresaId, name: expect.any(String) }]);
    const note = await handle.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientMemberId, theresaId), like(notifications.title, "%mentioned you%")));
    expect(note.length).toBe(1);
  });

  it("refuses mentions of people you can't reach", async () => {
    const t = await token(ESI);
    const r = await http()
      .post(`/api/explore/posts/${postId}/comments`)
      .set(auth(t))
      .send({ body: "E2E hi @{00000000-0000-4000-8000-000000000999}" })
      .expect(400);
    expect(r.body.error.code).toBe("MENTION_NOT_ALLOWED");
  });
});
