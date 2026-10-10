import { createDb, teachings, teachingTopics } from "@ecclesios/db";
import { like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 5.6 Teachings (functionality §3.7, D-030). Uses the seeded topics and lessons.
const SUPER = "superadmin@dev.ecclesios.local";
const CREATOR = "creator@dev.ecclesios.local";

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const cleanup = async () => {
  await handle.db.delete(teachings).where(like(teachings.slug, "e2e-%"));
  await handle.db.delete(teachingTopics).where(like(teachingTopics.slug, "e2e-%"));
};

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

describe("reading", () => {
  it("lists topics that have teachings", async () => {
    const r = await http().get("/api/public/teachings/topics").expect(200);
    const sac = r.body.items.find((t: { slug: string }) => t.slug === "sacraments");
    expect(sac.teachingCount).toBeGreaterThanOrEqual(3);
    expect(r.body.items.some((t: { slug: string }) => t.slug === "church-history")).toBe(false); // empty
  });

  it("filters by topic and searches the lesson text", async () => {
    const topic = await http().get("/api/public/teachings?topic=prayer").expect(200);
    expect(topic.body.items.map((t: { slug: string }) => t.slug)).toContain("what-is-prayer");
    const q = await http().get("/api/public/teachings?q=genuflect").expect(200); // only in the Eucharist body
    expect(q.body.items[0].slug).toBe("the-eucharist");
    await http().get("/api/public/teachings?topic=nope").expect(404);
  });

  it("a lesson with its source, topics and related teachings", async () => {
    const r = await http().get("/api/public/teachings/what-is-a-sacrament").expect(200);
    expect(r.body.body).toContain("[[CCC 1131]]");
    expect(r.body.readingMinutes).toBeGreaterThanOrEqual(1);
    expect(r.body.related.map((t: { slug: string }) => t.slug).slice(0, 2)).toEqual([
      "baptism",
      "the-eucharist",
    ]);
    expect((await http().get("/api/public/teachings/nope").expect(404)).body.error.code).toBe(
      "TEACHING_NOT_FOUND",
    );
  });
});

describe("authoring (Super-Admin only)", () => {
  const lesson = {
    title: "E2E Lesson",
    summary: "Only used by the end-to-end tests.",
    body: "## Heading\n\nSee [[CCC 1131]] and [[teaching:baptism|Baptism]].",
    topics: ["sacraments"],
  };

  it("creators cannot write teachings", async () => {
    const t = await token(CREATOR, undefined, "admin-login");
    await http().post("/api/platform/teachings").set(auth(t)).send(lesson).expect(403);
  });

  it("creates a draft; body links become related; drafts are hidden", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const r = await http().post("/api/platform/teachings").set(auth(t)).send(lesson).expect(201);
    expect(r.body).toMatchObject({
      slug: "e2e-lesson",
      status: "DRAFT",
      relatedSlugs: ["baptism"],
      problems: [],
    });
    await http().get("/api/public/teachings/e2e-lesson").expect(404);
    await http()
      .post("/api/platform/teachings")
      .set(auth(t))
      .send({ ...lesson, topics: ["nope"] })
      .expect(400);
  });

  it("can't publish with problems; publishes once fixed", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const bad = await http()
      .put("/api/platform/teachings/e2e-lesson")
      .set(auth(t))
      .send({ ...lesson, body: "Broken [[teaching:does-not-exist]] and [[CCC 9999]]." })
      .expect(200);
    expect(bad.body.problems.length).toBe(2);
    const blocked = await http()
      .post("/api/platform/teachings/e2e-lesson/status")
      .set(auth(t))
      .send({ status: "PUBLISHED" })
      .expect(409);
    expect(blocked.body.error.code).toBe("LESSON_HAS_PROBLEMS");

    await http().put("/api/platform/teachings/e2e-lesson").set(auth(t)).send(lesson).expect(200);
    await http()
      .post("/api/platform/teachings/e2e-lesson/status")
      .set(auth(t))
      .send({ status: "PUBLISHED" })
      .expect(200);
    await http().get("/api/public/teachings/e2e-lesson").expect(200);
  });

  it("topics: create, refuse duplicates, refuse deleting one in use", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    await http()
      .post("/api/platform/teachings/topics")
      .set(auth(t))
      .send({ name: "E2E Topic" })
      .expect(201);
    await http()
      .post("/api/platform/teachings/topics")
      .set(auth(t))
      .send({ name: "E2E Topic" })
      .expect(409);
    await http().delete("/api/platform/teachings/topics/sacraments").set(auth(t)).expect(409);
    await http().delete("/api/platform/teachings/topics/e2e-topic").set(auth(t)).expect(200);
  });
});
