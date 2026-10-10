import { createDb, saints } from "@ecclesios/db";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 5.3 Saints (functionality §3.3, D-025). Uses the seeded directory.
const SUPER = "superadmin@dev.ecclesios.local";
const TEST_SLUG = "e2e-test-saint";

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const cleanup = () => handle.db.delete(saints).where(eq(saints.slug, TEST_SLUG));

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

describe("saint of the day", () => {
  it("picks the highest rank on a busy day", async () => {
    const r = await http().get("/api/public/saints/today?date=2026-10-04").expect(200);
    expect(r.body.saint).toMatchObject({ slug: "francis-of-assisi", rank: "MEMORIAL" });
  });
  it("a feast outranks others; empty days return null", async () => {
    expect(
      (await http().get("/api/public/saints/today?date=2026-10-18").expect(200)).body.saint.slug,
    ).toBe("luke");
    expect(
      (await http().get("/api/public/saints/today?date=2026-10-03").expect(200)).body,
    ).toMatchObject({ saint: null, others: [] });
  });
  it("rejects bad dates", async () => {
    await http().get("/api/public/saints/today?date=2026-13-01").expect(400);
  });
});

describe("directory", () => {
  it("lists in calendar order and filters by month", async () => {
    const r = await http().get("/api/public/saints?month=10").expect(200);
    const days = r.body.items.map((s: { feastDay: number }) => s.feastDay);
    expect(days).toEqual([...days].sort((a: number, b: number) => a - b));
    expect(r.body.items.every((s: { feastMonth: number }) => s.feastMonth === 10)).toBe(true);
  });
  it("searches names and patronage", async () => {
    expect((await http().get("/api/public/saints?q=lwanga").expect(200)).body.items[0].slug).toBe(
      "charles-lwanga-and-companions",
    );
    const m = await http().get("/api/public/saints?q=missions").expect(200);
    expect(m.body.items.map((s: { slug: string }) => s.slug)).toContain("francis-xavier");
  });
  it("a saint's page; unknown → 404", async () => {
    const r = await http().get("/api/public/saints/augustine").expect(200);
    expect(r.body.biography.length).toBeGreaterThan(0);
    expect((await http().get("/api/public/saints/nobody-at-all").expect(404)).body.error.code).toBe(
      "SAINT_NOT_FOUND",
    );
  });
});

describe("PUT /api/platform/saints/:slug", () => {
  const body = {
    name: "E2E Test Saint",
    feastMonth: 2,
    feastDay: 30,
    rank: "OPTIONAL_MEMORIAL",
    summary: "Only used by the end-to-end tests.",
    biography: ["Test paragraph."],
  };
  it("validates the feast date, then creates; unpublished saints are hidden", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const auth = { Authorization: `Bearer ${t}` };
    await http().put(`/api/platform/saints/${TEST_SLUG}`).set(auth).send(body).expect(400);
    await http()
      .put(`/api/platform/saints/${TEST_SLUG}`)
      .set(auth)
      .send({ ...body, feastDay: 28 })
      .expect(200);
    await http().get(`/api/public/saints/${TEST_SLUG}`).expect(200);
    await http()
      .put(`/api/platform/saints/${TEST_SLUG}`)
      .set(auth)
      .send({ ...body, feastDay: 28, isPublished: false })
      .expect(200);
    await http().get(`/api/public/saints/${TEST_SLUG}`).expect(404);
  });
});
