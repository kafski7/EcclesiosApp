import { createDb, hymnMedia, hymnPicks, hymns, hymnTunes, news } from "@ecclesios/db";
import { eq, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Platform news (D-032) and Home (D-033). Uses the seed: two live news items (one pinned), a draft.
const SUPER = "superadmin@dev.ecclesios.local";
const CREATOR = "creator@dev.ecclesios.local";
const ESI = "esi.mensah@dev.ecclesios.local";
const PIN_DATE = "2031-07-15"; // Ordinary Time, far from the seed's data

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const cleanup = async () => {
  await handle.db.delete(news).where(like(news.slug, "e2e-%"));
  await handle.db.delete(hymnPicks).where(eq(hymnPicks.date, PIN_DATE));
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

describe("news (D-032)", () => {
  it("lists live items, pinned first; drafts are hidden", async () => {
    const r = await http().get("/api/public/news").expect(200);
    expect(r.body.items[0]).toMatchObject({ slug: "welcome-to-ecclesios", pinned: true });
    expect(r.body.items.some((n: { slug: string }) => n.slug === "draft-advent-reminder")).toBe(
      false,
    );
    await http().get("/api/public/news/draft-advent-reminder").expect(404);
    const one = await http().get("/api/public/news/hymnal-now-searchable-by-number").expect(200);
    expect(one.body.body).toContain("NCH");
  });

  it("only Super-Admins write news", async () => {
    const t = await token(CREATOR, undefined, "admin-login");
    await http()
      .post("/api/platform/news")
      .set(auth(t))
      .send({ title: "Nope", summary: "Not allowed to post this." })
      .expect(403);
  });

  it("draft → scheduled → live; expiry takes it off Home but keeps the page", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const c = await http()
      .post("/api/platform/news")
      .set(auth(t))
      .send({
        title: "E2E News",
        summary: "Only used by the end-to-end tests.",
        body: "See [[John 3:16]].",
      })
      .expect(201);
    expect(c.body).toMatchObject({ slug: "e2e-news", state: "DRAFT", problems: [] });

    const future = new Date(Date.now() + 86_400_000).toISOString();
    const sch = await http()
      .post("/api/platform/news/e2e-news/status")
      .set(auth(t))
      .send({ status: "PUBLISHED", publishAt: future })
      .expect(200);
    expect(sch.body.state).toBe("SCHEDULED");
    await http().get("/api/public/news/e2e-news").expect(404);

    const live = await http()
      .post("/api/platform/news/e2e-news/status")
      .set(auth(t))
      .send({ status: "PUBLISHED" })
      .expect(200);
    expect(live.body.state).toBe("LIVE");
    await http().get("/api/public/news/e2e-news").expect(200);

    const past = new Date(Date.now() - 60_000).toISOString();
    await http()
      .put("/api/platform/news/e2e-news")
      .set(auth(t))
      .send({
        title: "E2E News",
        summary: "Only used by the end-to-end tests.",
        body: "See [[John 3:16]].",
        expiresAt: past,
      })
      .expect(200);
    const home = await http().get("/api/public/home").expect(200);
    expect(home.body.news.some((n: { slug: string }) => n.slug === "e2e-news")).toBe(false);
    await http().get("/api/public/news/e2e-news").expect(200);
  });

  it("problems in the text block publishing", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    await http()
      .post("/api/platform/news")
      .set(auth(t))
      .send({
        title: "E2E Broken",
        summary: "Only used by the end-to-end tests.",
        body: "Bad [[CCC 9999]].",
      })
      .expect(201);
    const r = await http()
      .post("/api/platform/news/e2e-broken/status")
      .set(auth(t))
      .send({ status: "PUBLISHED" })
      .expect(409);
    expect(r.body.error.code).toBe("NEWS_HAS_PROBLEMS");
  });
});

describe("home (D-033)", () => {
  it("summary: today, saint, hymn of the day, news, trending, events", async () => {
    const r = await http().get("/api/public/home?date=2026-10-04").expect(200);
    expect(r.body.today.season).toBe("ORDINARY");
    expect(r.body.saint.slug).toBe("francis-of-assisi");
    expect(r.body.hymn).toBeTruthy();
    expect(r.body.hymn.slug).not.toBe("silent-night"); // no Christmas carols in October
    expect(r.body.news[0].slug).toBe("welcome-to-ecclesios");
    expect(Array.isArray(r.body.trending)).toBe(true);
    expect(Array.isArray(r.body.events)).toBe(true);
  });

  it("the hymn of the day is stable for a date and can be pinned", async () => {
    const a = await http().get(`/api/public/home?date=${PIN_DATE}`).expect(200);
    const b = await http().get(`/api/public/home?date=${PIN_DATE}`).expect(200);
    expect(a.body.hymn.slug).toBe(b.body.hymn.slug);
    const t = await token(SUPER, undefined, "admin-login");
    const pinned = await http()
      .put(`/api/platform/hymn-of-day/${PIN_DATE}`)
      .set(auth(t))
      .send({ hymnSlug: "silent-night" })
      .expect(200);
    expect(pinned.body).toMatchObject({ slug: "silent-night", pinned: true });
    expect((await http().get(`/api/public/home?date=${PIN_DATE}`).expect(200)).body.hymn.slug).toBe(
      "silent-night",
    );
    await http()
      .put(`/api/platform/hymn-of-day/${PIN_DATE}`)
      .set(auth(t))
      .send({ hymnSlug: null })
      .expect(200);
  });

  it("feed blends content types, newest first, and pages", async () => {
    const r = await http().get("/api/public/home/feed").expect(200);
    const types = new Set(r.body.items.map((i: { type: string }) => i.type));
    expect(types.has("TEACHING")).toBe(true);
    expect(types.has("NEWS")).toBe(true);
    const times = r.body.items.map((i: { at: string }) => Date.parse(i.at));
    expect(times).toEqual([...times].sort((x: number, y: number) => y - x));
  });

  it("Following needs a member; it holds only followed sources", async () => {
    expect(
      (await http().get("/api/public/home/feed?tab=following").expect(200)).body.items,
    ).toEqual([]);
    const t = await token(ESI);
    const r = await http().get("/api/public/home/feed?tab=following").set(auth(t)).expect(200);
    for (const i of r.body.items) expect(["POST", "EPISODE"]).toContain(i.type);
  });
});

describe("watch row (D-034)", () => {
  const VIDEO = "e2eWatchRow"; // 11 chars, like a YouTube id
  afterAll(async () => {
    await handle.db.delete(hymnMedia).where(eq(hymnMedia.youtubeId, VIDEO));
  });

  it("lists the newest YouTube videos with their source page", async () => {
    const [tune] = await handle.db
      .select({ id: hymnTunes.id })
      .from(hymnTunes)
      .innerJoin(hymns, eq(hymns.id, hymnTunes.hymnId))
      .where(eq(hymns.slug, "silent-night"))
      .limit(1);
    await handle.db.insert(hymnMedia).values({
      tuneId: tune!.id,
      kind: "YOUTUBE",
      label: "Choir",
      access: "FREE",
      youtubeId: VIDEO,
    });

    const r = await http().get("/api/public/home").expect(200);
    expect(Array.isArray(r.body.watch)).toBe(true);
    expect(r.body.watch[0]).toMatchObject({
      kind: "HYMN",
      youtubeId: VIDEO,
      href: "/hymnal/silent-night",
      source: "Hymnal · Choir",
    });
    // each video once
    const ids = r.body.watch.map((w: { youtubeId: string }) => w.youtubeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
