import { commentReports, createDb, follows, notifications, postComments, posts } from "@ecclesios/db";
import { and, eq, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 5.7 Explore (functionality §3.4, D-017, D-031).
const G = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const PAR_A1 = G(107); // St Theresa Parish
const PAR_A2 = G(108);
const ESI_ID = G(522);
const SUPER = "superadmin@dev.ecclesios.local";
const THERESA = "theresa.pastor@dev.ecclesios.local"; // Administrator of St Theresa
const AKOSUA = "akosua.boateng@dev.ecclesios.local"; //  member content creator (AUTHOR_EXPLORE)
const ESI = "esi.mensah@dev.ecclesios.local"; //        ordinary member (pending membership)
const CHRIST = "christ.pastor@dev.ecclesios.local"; //  Administrator of a different parish

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const cleanup = async () => {
  await handle.db.delete(posts).where(like(posts.title, "E2E %"));
  await handle.db.delete(notifications).where(like(notifications.title, "%E2E %"));
  await handle.db.delete(follows).where(and(eq(follows.memberId, ESI_ID), eq(follows.groupId, PAR_A1)));
};
const soon = (days: number, h = 10) => new Date(Date.now() + days * 86_400_000 + h * 3_600_000).toISOString();

beforeAll(async () => {
  await cleanup();
  const t = await createTestApp();
  app = t.app;
  token = signInCache(app, t.otp);
});
afterAll(async () => {
  await app?.close();
  await cleanup();
  await handle.close();
});

describe("public reading", () => {
  it("lists approved posts only, events upcoming first", async () => {
    const all = await http().get("/api/public/explore/posts").expect(200);
    const titles = all.body.items.map((x: { title: string }) => x.title);
    expect(titles).toContain("Preparing well for Sunday Mass");
    expect(titles).not.toContain("Why the rosary still matters for young people"); // pending
    const ev = await http().get("/api/public/explore/posts?kind=EVENT").expect(200);
    expect(ev.body.items.map((x: { title: string }) => x.title)).toEqual(["Parish Harvest Thanksgiving", "Diocesan Youth Rally"]);
    expect(ev.body.items[0].author).toMatchObject({ kind: "CHURCH", id: PAR_A1 });
  });
  it("church page and church filter", async () => {
    const page = await http().get(`/api/public/explore/churches/${PAR_A1}`).expect(200);
    expect(page.body).toMatchObject({ name: "St Theresa Parish", canManage: false });
    expect(page.body.massTimes).toMatch(/Sunday/);
    const r = await http().get(`/api/public/explore/posts?church=${PAR_A2}`).expect(200);
    expect(r.body.items).toEqual([]);
  });
  it("following=1 is empty for guests", async () => {
    expect((await http().get("/api/public/explore/posts?following=1").expect(200)).body.items).toEqual([]);
  });
});

describe("who may post (D-017)", () => {
  it("an ordinary member can't post at all", async () => {
    const t = await token(ESI);
    expect((await http().get("/api/explore/authoring").set(auth(t)).expect(200)).body).toEqual({ asSelf: false, churches: [] });
    await http().post("/api/explore/my-posts").set(auth(t)).send({ kind: "ARTICLE", title: "E2E nope" }).expect(403);
  });
  it("a priest posts in his church's name only", async () => {
    const t = await token(THERESA);
    const o = await http().get("/api/explore/authoring").set(auth(t)).expect(200);
    expect(o.body).toEqual({ asSelf: false, churches: [{ id: PAR_A1, name: "St Theresa Parish" }] });
    await http().post("/api/explore/my-posts").set(auth(t)).send({ kind: "ARTICLE", title: "E2E as me" }).expect(403);
    await http().post("/api/explore/my-posts").set(auth(t)).send({ kind: "ARTICLE", title: "E2E other", churchId: PAR_A2 }).expect(403);
  });
});

describe("draft → submit → review → live", () => {
  let id = "";

  it("a priest drafts an event; incomplete events can't be submitted", async () => {
    const t = await token(THERESA);
    const r = await http()
      .post("/api/explore/my-posts")
      .set(auth(t))
      .send({ kind: "EVENT", churchId: PAR_A1, title: "E2E Choir festival", body: "Come and sing." })
      .expect(201);
    id = r.body.id;
    expect(r.body).toMatchObject({ status: "DRAFT", problems: ["An event needs a start date and time.", "Say where the event takes place."] });
    expect((await http().post(`/api/explore/my-posts/${id}/submit`).set(auth(t)).expect(409)).body.error.code).toBe("POST_INCOMPLETE");
    await http()
      .put(`/api/explore/my-posts/${id}`)
      .set(auth(t))
      .send({ kind: "EVENT", title: "E2E Choir festival", body: "Come and sing.", startsAt: soon(3), endsAt: soon(3, 13), place: "Parish hall" })
      .expect(200);
    const s = await http().post(`/api/explore/my-posts/${id}/submit`).set(auth(t)).expect(200);
    expect(s.body.status).toBe("PENDING");
    await http().get(`/api/public/explore/posts/${id}`).expect(404);
  });

  it("others can't see or touch the draft", async () => {
    await http().get(`/api/explore/my-posts/${id}`).set(auth(await token(CHRIST))).expect(404);
  });

  it("Super-Admin approves; followers are told once; the author is told", async () => {
    const esi = await token(ESI);
    await http().put(`/api/groups/${PAR_A1}/follow`).set(auth(esi)).expect(204);
    const t = await token(SUPER, undefined, "admin-login");
    const q = await http().get("/api/platform/explore/queue").set(auth(t)).expect(200);
    expect(q.body.items.map((x: { id: string }) => x.id)).toContain(id);
    await http().post(`/api/platform/explore/posts/${id}/decision`).set(auth(t)).send({ decision: "reject" }).expect(400);
    const r = await http().post(`/api/platform/explore/posts/${id}/decision`).set(auth(t)).send({ decision: "approve" }).expect(200);
    expect(r.body.status).toBe("APPROVED");
    await http().get(`/api/public/explore/posts/${id}`).expect(200);
    const sent = await handle.db.select().from(notifications).where(like(notifications.title, "%E2E Choir festival%"));
    expect(sent.filter((n) => n.recipientMemberId === ESI_ID)).toHaveLength(1);
    const mine = await http().get("/api/public/explore/posts?following=1").set(auth(esi)).expect(200);
    expect(mine.body.items.map((x: { id: string }) => x.id)).toContain(id);
  });

  it("editing a live post takes it down until it is reviewed again", async () => {
    const t = await token(THERESA);
    const r = await http()
      .put(`/api/explore/my-posts/${id}`)
      .set(auth(t))
      .send({ kind: "EVENT", title: "E2E Choir festival", body: "Come and sing loudly.", startsAt: soon(3), place: "Parish hall" })
      .expect(200);
    expect(r.body.status).toBe("DRAFT");
    await http().get(`/api/public/explore/posts/${id}`).expect(404);
  });
});

describe("content creators", () => {
  it("post under their own name; reject needs a reason; removed posts are final", async () => {
    const t = await token(AKOSUA);
    expect((await http().get("/api/explore/authoring").set(auth(t)).expect(200)).body.asSelf).toBe(true);
    const r = await http()
      .post("/api/explore/my-posts")
      .set(auth(t))
      .send({ kind: "ARTICLE", title: "E2E Serving with joy", body: "## Why\nBecause [[CCC 1070]]." })
      .expect(201);
    await http().post(`/api/explore/my-posts/${r.body.id}/submit`).set(auth(t)).expect(200);
    const admin = await token(SUPER, undefined, "admin-login");
    const base = `/api/platform/explore/posts/${r.body.id}/decision`;
    await http().post(base).set(auth(admin)).send({ decision: "approve" }).expect(200);
    const live = await http().get(`/api/public/explore/posts/${r.body.id}`).expect(200);
    expect(live.body.author).toEqual({ kind: "PERSON", name: "Akosua Boateng" });
    await http().post(base).set(auth(admin)).send({ decision: "remove", note: "Duplicate" }).expect(200);
    await http().post(base).set(auth(admin)).send({ decision: "approve" }).expect(409);
    await http().put(`/api/explore/my-posts/${r.body.id}`).set(auth(t)).send({ kind: "ARTICLE", title: "E2E Serving with joy" }).expect(409);
  });

  it("Super-Admin posts go live without the queue", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const r = await http().post("/api/explore/my-posts").set(auth(t)).send({ kind: "ARTICLE", title: "E2E From Ecclesios", body: "Hello." }).expect(201);
    const s = await http().post(`/api/explore/my-posts/${r.body.id}/submit`).set(auth(t)).expect(200);
    expect(s.body).toMatchObject({ status: "APPROVED", author: { kind: "PLATFORM" } });
  });
});

describe("comments", () => {
  let postId = "";
  let commentId = "";

  it("any member comments; guests and platform accounts can't", async () => {
    const list = await http().get("/api/public/explore/posts?q=Sunday").expect(200);
    postId = list.body.items[0].id;
    await http().post(`/api/explore/posts/${postId}/comments`).send({ body: "hi" }).expect(401);
    await http().post(`/api/explore/posts/${postId}/comments`).set(auth(await token(SUPER, undefined, "admin-login"))).send({ body: "hi" }).expect(403);
    const r = await http().post(`/api/explore/posts/${postId}/comments`).set(auth(await token(ESI))).send({ body: "E2E Amen to this." }).expect(201);
    const mine = r.body.items.find((c: { body: string }) => c.body === "E2E Amen to this.");
    commentId = mine.id;
    expect(mine).toMatchObject({ canDelete: true, canModerate: false, author: { isMe: true } });
  });

  it("the post's church can hide it; the author still sees it, the public doesn't", async () => {
    await http().put(`/api/explore/comments/${commentId}/status`).set(auth(await token(CHRIST))).send({ status: "HIDDEN" }).expect(403);
    await http().put(`/api/explore/comments/${commentId}/status`).set(auth(await token(THERESA))).send({ status: "HIDDEN" }).expect(204);
    const pub = await http().get(`/api/public/explore/posts/${postId}/comments`).expect(200);
    expect(pub.body.items.some((c: { id: string }) => c.id === commentId)).toBe(false);
    const own = await http().get(`/api/public/explore/posts/${postId}/comments`).set(auth(await token(ESI))).expect(200);
    expect(own.body.items.find((c: { id: string }) => c.id === commentId).status).toBe("HIDDEN");
    await http().put(`/api/explore/comments/${commentId}/status`).set(auth(await token(THERESA))).send({ status: "VISIBLE" }).expect(204);
  });

  it("reports count once per person and show up for the Super-Admin", async () => {
    const t = await token(AKOSUA);
    await http().post(`/api/explore/comments/${commentId}/report`).set(auth(t)).expect(204);
    await http().post(`/api/explore/comments/${commentId}/report`).set(auth(t)).expect(204);
    const reports = await handle.db.select().from(commentReports).where(eq(commentReports.commentId, commentId));
    expect(reports).toHaveLength(1);
    const admin = await token(SUPER, undefined, "admin-login");
    const r = await http().get("/api/platform/explore/reported-comments").set(auth(admin)).expect(200);
    expect(r.body.items.find((c: { id: string }) => c.id === commentId)).toMatchObject({ reports: 1, status: "VISIBLE" });
  });

  it("authors delete their own comments only", async () => {
    await http().delete(`/api/explore/comments/${commentId}`).set(auth(await token(AKOSUA))).expect(403);
    await http().delete(`/api/explore/comments/${commentId}`).set(auth(await token(ESI))).expect(204);
    expect(await handle.db.select().from(postComments).where(eq(postComments.id, commentId))).toHaveLength(0);
  });
});

describe("church pages", () => {
  it("only the church's Administrator edits its page", async () => {
    await http().put(`/api/explore/churches/${PAR_A1}`).set(auth(await token(CHRIST))).send({ about: "x" }).expect(403);
    const t = await token(THERESA);
    const r = await http()
      .put(`/api/explore/churches/${PAR_A1}`)
      .set(auth(t))
      .send({ about: "E2E about", massTimes: "Sunday 7:00", website: "https://example.org" })
      .expect(200);
    expect(r.body).toMatchObject({ about: "E2E about", canManage: true });
    await http()
      .put(`/api/explore/churches/${PAR_A1}`)
      .set(auth(t))
      .send({ about: "St Theresa Parish is a lively community of families and societies. All are welcome.", address: "Parish Road, Accra", massTimes: "Sunday: 6:30, 8:30, 10:30\nWeekdays: 6:15\nSaturday vigil: 18:00", phone: "+233200000107" })
      .expect(200);
  });
});
