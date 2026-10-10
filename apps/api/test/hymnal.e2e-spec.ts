import { createDb, hymns } from "@ecclesios/db";
import { like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 5.4 Hymnal (functionality §3.6, D-026). Uses the seeded NCH/CH books and public-domain hymns.
// Presigning is local, so these tests do not need MinIO running.
const SUPER = "superadmin@dev.ecclesios.local";
const THERESA = "theresa.pastor@dev.ecclesios.local";

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const cleanup = () => handle.db.delete(hymns).where(like(hymns.slug, "e2e-%"));

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

describe("books and search", () => {
  it("lists NCH and CH", async () => {
    const r = await http().get("/api/public/hymnal/books").expect(200);
    expect(r.body.items.map((b: { code: string }) => b.code)).toEqual(["NCH", "CH"]);
  });

  it("finds a hymn by number, with or without the book", async () => {
    const a = await http().get("/api/public/hymnal/hymns?q=56").expect(200);
    expect(a.body.matchedNumber).toEqual({ book: null, number: "56" });
    expect(a.body.items[0].slug).toBe("o-come-all-ye-faithful");
    const b = await http()
      .get(`/api/public/hymnal/hymns?q=${encodeURIComponent("NCH 56")}`)
      .expect(200);
    expect(b.body.items[0].numbers[0]).toMatchObject({ book: "NCH", number: "56" });
  });

  it("finds by first line and by lyrics", async () => {
    expect(
      (await http().get("/api/public/hymnal/hymns?q=silent%20night").expect(200)).body.items[0]
        .slug,
    ).toBe("silent-night");
    const lyric = await http().get("/api/public/hymnal/hymns?q=dayspring").expect(200);
    expect(lyric.body.items[0].slug).toBe("o-come-o-come-emmanuel");
  });

  it("browses a book in number order and filters by tag", async () => {
    const book = await http().get("/api/public/hymnal/hymns?book=NCH").expect(200);
    const nums = book.body.items.map((h: { numbers: { number: string }[] }) =>
      Number(h.numbers[0]!.number),
    );
    expect(nums).toEqual([...nums].sort((x, y) => x - y));
    const advent = await http().get("/api/public/hymnal/hymns?tag=advent").expect(200);
    expect(advent.body.items.every((h: { tags: string[] }) => h.tags.includes("advent"))).toBe(
      true,
    );
  });

  it("unknown book → 404", async () => {
    await http().get("/api/public/hymnal/hymns?book=ZZ").expect(404);
  });
});

describe("hymn page", () => {
  it("shows verses and every tune, default first", async () => {
    const r = await http().get("/api/public/hymnal/hymns/away-in-a-manger").expect(200);
    expect(r.body.verses.length).toBeGreaterThan(0);
    expect(r.body.tunes.map((t: { name: string }) => t.name)).toEqual(["CRADLE SONG", "MUELLER"]);
  });
  it("unknown hymn → 404", async () => {
    expect(
      (await http().get("/api/public/hymnal/hymns/no-such-hymn").expect(404)).body.error.code,
    ).toBe("HYMN_NOT_FOUND");
  });
});

describe("console counts (D-033 subquery fix)", () => {
  it("counts each hymn's own tunes and media", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const r = await http()
      .get("/api/platform/hymnal/hymns?q=away")
      .set({ Authorization: `Bearer ${t}` })
      .expect(200);
    expect(r.body.items.find((h: { slug: string }) => h.slug === "away-in-a-manger")).toMatchObject(
      { tunes: 2 },
    );
    const books = await http().get("/api/public/hymnal/books").expect(200);
    expect(
      books.body.items.find((b: { code: string }) => b.code === "NCH").hymnCount,
    ).toBeGreaterThanOrEqual(5);
  });
});

describe("Super-Admin management", () => {
  const body = {
    firstLine: "E2E test hymn first line",
    verses: [{ label: "1", lines: ["A test line."] }],
    numbers: [{ book: "CH", number: "999" }],
    tags: ["Entrance"],
  };

  it("is refused to church members", async () => {
    const t = await token(THERESA);
    await http()
      .post("/api/platform/hymnal/hymns")
      .set({ Authorization: `Bearer ${t}` })
      .send(body)
      .expect(403);
  });

  it("creates a hymn with a default tune; numbers are unique per book", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const auth = { Authorization: `Bearer ${t}` };
    const r = await http()
      .post("/api/platform/hymnal/hymns")
      .set(auth)
      .send({ ...body, title: "E2E Hymn" })
      .expect(201);
    expect(r.body.slug).toBe("e2e-hymn");
    expect(r.body.tags).toEqual(["entrance"]);
    expect(r.body.tunes.length).toBe(1);
    const clash = await http()
      .post("/api/platform/hymnal/hymns")
      .set(auth)
      .send({ ...body, title: "E2E Other", numbers: [{ book: "NCH", number: "56" }] })
      .expect(409);
    expect(clash.body.error.code).toBe("NUMBER_TAKEN");
  });

  it("adds a second tune, a YouTube link with the subscriber default, and signs uploads", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const auth = { Authorization: `Bearer ${t}` };
    const h = await http()
      .post("/api/platform/hymnal/hymns/e2e-hymn/tunes")
      .set(auth)
      .send({ name: "SECOND TUNE" })
      .expect(201);
    const tune = h.body.tunes.find((x: { name: string }) => x.name === "SECOND TUNE");

    await http()
      .post(`/api/platform/hymnal/hymns/e2e-hymn/tunes/${tune.id}/media`)
      .set(auth)
      .send({ kind: "YOUTUBE", url: "https://vimeo.com/1", label: "Choir" })
      .expect(400);
    const yt = await http()
      .post(`/api/platform/hymnal/hymns/e2e-hymn/tunes/${tune.id}/media`)
      .set(auth)
      .send({
        kind: "YOUTUBE",
        url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        label: "Choir",
      })
      .expect(201);
    const item = yt.body.tunes.find((x: { id: string }) => x.id === tune.id).media[0];
    expect(item).toMatchObject({ kind: "YOUTUBE", access: "SUBSCRIBER", youtubeId: "dQw4w9WgXcQ" });

    const up = await http()
      .post(`/api/platform/hymnal/hymns/e2e-hymn/tunes/${tune.id}/uploads`)
      .set(auth)
      .send({
        kind: "SOLFA_PDF",
        contentType: "application/pdf",
        bytes: 1000,
        fileName: "solfa.pdf",
      })
      .expect(201);
    expect(up.body.key.startsWith("hymns/")).toBe(true);
    await http()
      .post(`/api/platform/hymnal/hymns/e2e-hymn/tunes/${tune.id}/uploads`)
      .set(auth)
      .send({ kind: "SOLFA_PDF", contentType: "image/png", bytes: 1000, fileName: "x.png" })
      .expect(400);
    // a key we never issued for this tune is refused
    await http()
      .post(`/api/platform/hymnal/hymns/e2e-hymn/tunes/${tune.id}/media`)
      .set(auth)
      .send({ kind: "MIDI", key: "hymns/other/x.mid", label: "MIDI" })
      .expect(400);
  });

  it("while the paywall is off, subscriber items are open to everyone", async () => {
    const r = await http().get("/api/public/hymnal/hymns/e2e-hymn").expect(200);
    const media = r.body.tunes.flatMap((t: { media: unknown[] }) => t.media);
    expect(media.every((m: { available: boolean }) => m.available)).toBe(true);
  });
});
