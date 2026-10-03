import { createDb, notifications, podcastEpisodes, podcasts } from "@ecclesios/db";
import { eq, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 5.5 Podcasts (functionality §3.5, D-027). Presigning is local, so MinIO is not needed.
const SUPER = "superadmin@dev.ecclesios.local";
const CREATOR = "creator@dev.ecclesios.local"; //   platform creator with POST_PODCASTS (owns youth-on-fire)
const THERESA = "theresa.pastor@dev.ecclesios.local"; // member, no podcast grant
const ESI = "esi.mensah@dev.ecclesios.local"; //    member, will follow

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const cleanup = async () => {
  await handle.db.delete(podcasts).where(like(podcasts.slug, "e2e-%"));
  await handle.db.delete(notifications).where(like(notifications.title, "E2E Test Podcast%"));
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

describe("public listening", () => {
  it("lists published series; the count matches the published episodes", async () => {
    const r = await http().get("/api/public/podcasts").expect(200);
    const weekly = r.body.items.find((x: { slug: string }) => x.slug === "ecclesios-weekly");
    expect(weekly).toMatchObject({ publisher: { kind: "PLATFORM", name: "Ecclesios" } });
    // Holds on a fresh seed (0) and after episodes are published by hand in the console.
    const detail = await http().get("/api/public/podcasts/ecclesios-weekly").expect(200);
    expect(weekly.episodeCount).toBe(detail.body.episodes.length);

    const youth = await http().get("/api/public/podcasts/youth-on-fire").expect(200);
    expect(youth.body.publisher.kind).toBe("CREATOR");
    // The public page never lists drafts.
    const studioView = youth.body.episodes.every((e: { publishedAt: string | null }) => e.publishedAt !== null);
    expect(studioView).toBe(true);
  });
  it("searches and 404s", async () => {
    const r = await http().get("/api/public/podcasts?q=gospel").expect(200);
    expect(r.body.items.map((x: { slug: string }) => x.slug)).toContain("ecclesios-weekly");
    expect((await http().get("/api/public/podcasts/nope").expect(404)).body.error.code).toBe("PODCAST_NOT_FOUND");
  });
});

describe("who may publish (D-027)", () => {
  it("a member without the grant can neither create nor see others' series", async () => {
    const t = await token(THERESA);
    const list = await http().get("/api/studio/podcasts").set(auth(t)).expect(200);
    expect(list.body).toEqual({ canCreate: false, items: [] });
    await http().post("/api/studio/podcasts").set(auth(t)).send({ title: "Nope", summary: "Nope" }).expect(403);
    await http().get("/api/studio/podcasts/ecclesios-weekly").set(auth(t)).expect(403);
  });

  it("a creator sees and manages only their own series", async () => {
    const t = await token(CREATOR, undefined, "admin-login");
    const list = await http().get("/api/studio/podcasts").set(auth(t)).expect(200);
    expect(list.body.canCreate).toBe(true);
    expect(list.body.items.map((x: { slug: string }) => x.slug)).toEqual(["youth-on-fire"]);
    await http().get("/api/studio/podcasts/youth-on-fire").set(auth(t)).expect(200);
    await http().get("/api/studio/podcasts/ecclesios-weekly").set(auth(t)).expect(403);
  });
});

describe("publishing an episode", () => {
  let episodeId = "";

  it("Super-Admin creates a series and a draft episode", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const r = await http()
      .post("/api/studio/podcasts")
      .set(auth(t))
      .send({ title: "E2E Test Podcast", summary: "Only used by the end-to-end tests.", category: "Test" })
      .expect(201);
    expect(r.body).toMatchObject({ slug: "e2e-test-podcast", category: "test", episodes: [] });
    const e = await http()
      .post("/api/studio/podcasts/e2e-test-podcast/episodes")
      .set(auth(t))
      .send({ title: "First steps", number: 1 })
      .expect(201);
    episodeId = e.body.episodes[0].id;
    expect(e.body.episodes[0]).toMatchObject({ status: "DRAFT", hasAudio: false });
    const dup = await http()
      .post("/api/studio/podcasts/e2e-test-podcast/episodes")
      .set(auth(t))
      .send({ title: "Clash", number: 1 })
      .expect(409);
    expect(dup.body.error.code).toBe("NUMBER_TAKEN");
  });

  it("cannot publish without audio; uploads are type-checked", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const base = `/api/studio/podcasts/e2e-test-podcast/episodes/${episodeId}`;
    const r = await http().post(`${base}/status`).set(auth(t)).send({ status: "PUBLISHED" }).expect(409);
    expect(r.body.error.code).toBe("AUDIO_REQUIRED");
    await http().post(`${base}/upload`).set(auth(t)).send({ contentType: "video/mp4", bytes: 1000 }).expect(400);
    const ok = await http().post(`${base}/upload`).set(auth(t)).send({ contentType: "audio/mpeg", bytes: 1000 }).expect(201);
    expect(ok.body.key).toMatch(/^podcasts\/.+\/episodes\/.+\.mp3$/);
  });

  it("publishing notifies followers once and shows the episode publicly", async () => {
    const esi = await token(ESI);
    await http().put("/api/podcasts/e2e-test-podcast/follow").set(auth(esi)).expect(204);
    expect((await http().get("/api/podcasts/following").set(auth(esi)).expect(200)).body.slugs).toContain("e2e-test-podcast");

    // Stand-in for a real upload (no storage in e2e): attach a key directly.
    await handle.db.update(podcastEpisodes).set({ audioKey: "podcasts/e2e/episode.mp3", durationSec: 600 }).where(eq(podcastEpisodes.id, episodeId));

    const t = await token(SUPER, undefined, "admin-login");
    const base = `/api/studio/podcasts/e2e-test-podcast/episodes/${episodeId}`;
    await http().post(`${base}/status`).set(auth(t)).send({ status: "PUBLISHED" }).expect(200);
    await http().post(`${base}/status`).set(auth(t)).send({ status: "DRAFT" }).expect(200);
    await http().post(`${base}/status`).set(auth(t)).send({ status: "PUBLISHED" }).expect(200);
    const sent = await handle.db.select().from(notifications).where(like(notifications.title, "E2E Test Podcast%"));
    expect(sent.length).toBe(1);

    // Newest episode first (D-033 subquery fix): the series just published leads the list.
    const listed = await http().get("/api/public/podcasts").expect(200);
    expect(listed.body.items[0].slug).toBe("e2e-test-podcast");

    const pub = await http().get("/api/public/podcasts/e2e-test-podcast").expect(200);
    expect(pub.body.episodes).toMatchObject([{ id: episodeId, title: "First steps", durationSec: 600 }]);
    const url = await http().get(`/api/public/podcasts/episodes/${episodeId}/url`).expect(200);
    expect(url.body.url).toMatch(/^https?:\/\//);
  });

  it("drafts have no public URL; platform accounts cannot follow", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const base = `/api/studio/podcasts/e2e-test-podcast/episodes/${episodeId}`;
    await http().post(`${base}/status`).set(auth(t)).send({ status: "DRAFT" }).expect(200);
    await http().get(`/api/public/podcasts/episodes/${episodeId}/url`).expect(404);
    await http().put("/api/podcasts/e2e-test-podcast/follow").set(auth(t)).expect(403);
  });
});

describe("episode media and extras (D-029)", () => {
  let episodeId = "";
  const base = () => `/api/studio/podcasts/e2e-test-podcast/episodes/${episodeId}`;
  const superToken = () => token(SUPER, undefined, "admin-login");

  it("hosted video can't be chosen yet", async () => {
    const t = await superToken();
    const r = await http()
      .post("/api/studio/podcasts/e2e-test-podcast/episodes")
      .set(auth(t))
      .send({ title: "Video one", mediaKind: "VIDEO" })
      .expect(400);
    expect(r.body.error.code).toBe("VIDEO_NOT_AVAILABLE");
  });

  it("a YouTube-first episode publishes with a link and no audio", async () => {
    const t = await superToken();
    const e = await http()
      .post("/api/studio/podcasts/e2e-test-podcast/episodes")
      .set(auth(t))
      .send({ title: "Watch: the Creed explained", number: 2, mediaKind: "YOUTUBE", transcript: "We believe in one God." })
      .expect(201);
    episodeId = e.body.episodes.find((x: { title: string }) => x.title.startsWith("Watch")).id;

    const blocked = await http().post(`${base()}/status`).set(auth(t)).send({ status: "PUBLISHED" }).expect(409);
    expect(blocked.body.error.code).toBe("YOUTUBE_REQUIRED");
    await http().put(`${base()}/youtube`).set(auth(t)).send({ url: "https://vimeo.com/1" }).expect(400);
    await http().put(`${base()}/youtube`).set(auth(t)).send({ url: "https://youtu.be/dQw4w9WgXcQ" }).expect(200);
    await http().post(`${base()}/status`).set(auth(t)).send({ status: "PUBLISHED" }).expect(200);

    const pub = await http().get("/api/public/podcasts/e2e-test-podcast").expect(200);
    const ep = pub.body.episodes.find((x: { id: string }) => x.id === episodeId);
    expect(ep).toMatchObject({ mediaKind: "YOUTUBE", youtubeId: "dQw4w9WgXcQ", hasAudio: false, available: true, hasTranscript: true });
    expect((await http().get(`/api/public/podcasts/episodes/${episodeId}/transcript`).expect(200)).body.text).toBe("We believe in one God.");
    // no audio → no stream URL
    await http().get(`/api/public/podcasts/episodes/${episodeId}/url`).expect(404);
  });

  it("a live YouTube-first episode keeps its link and can't switch to missing audio", async () => {
    const t = await superToken();
    expect((await http().put(`${base()}/youtube`).set(auth(t)).send({ url: null }).expect(409)).body.error.code).toBe("YOUTUBE_REQUIRED");
    const sw = await http().put(base()).set(auth(t)).send({ title: "Watch: the Creed explained", number: 2, mediaKind: "AUDIO" }).expect(409);
    expect(sw.body.error.code).toBe("AUDIO_REQUIRED");
  });

  it("handouts are PDF only and key-checked; access defaults to free", async () => {
    const t = await superToken();
    await http().post(`${base()}/attachment-upload`).set(auth(t)).send({ contentType: "image/png", bytes: 100 }).expect(400);
    const up = await http().post(`${base()}/attachment-upload`).set(auth(t)).send({ contentType: "application/pdf", bytes: 100 }).expect(201);
    expect(up.body.key).toMatch(/\/files\/.+\.pdf$/);
    await http().post(`${base()}/attachments`).set(auth(t)).send({ key: "podcasts/other/x.pdf", label: "Notes" }).expect(400);
    const studio = await http().get("/api/studio/podcasts/e2e-test-podcast").set(auth(t)).expect(200);
    expect(studio.body.episodes.find((x: { id: string }) => x.id === episodeId)).toMatchObject({ access: "FREE", transcript: "We believe in one God." });
  });
});
