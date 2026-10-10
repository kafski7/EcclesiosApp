import { createDb, readingDays } from "@ecclesios/db";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Phase 5.1 Readings (functionality §3.2, D-022).
const FAR_DATE = "2031-12-25"; // Christmas, Year A (liturgical year 2032), never seeded
const SUPER = "superadmin@dev.ecclesios.local";
const THERESA = "theresa.pastor@dev.ecclesios.local";

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const cleanup = () => handle.db.delete(readingDays).where(eq(readingDays.date, FAR_DATE));

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

describe("GET /api/public/readings/:date", () => {
  it("today has seeded readings (public, no sign-in)", async () => {
    const r = await http().get("/api/public/readings/today").expect(200);
    expect(r.body.available).toBe(true);
    expect(r.body.readings.some((x: { kind: string }) => x.kind === "GOSPEL")).toBe(true);
  });

  it("an unloaded date still returns the computed liturgical context", async () => {
    const r = await http().get(`/api/public/readings/${FAR_DATE}`).expect(200);
    expect(r.body).toMatchObject({
      date: FAR_DATE,
      season: "CHRISTMAS",
      color: "WHITE",
      available: false,
      readings: [],
    });
  });

  it("rejects impossible dates", async () => {
    const r = await http().get("/api/public/readings/2026-02-30").expect(400);
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("PUT /api/platform/readings/:date (Super-Admin)", () => {
  const body = {
    celebration: "The Nativity of the Lord",
    color: "WHITE",
    source: "Test source",
    readings: [
      { kind: "FIRST", citation: "Isaiah 9:1-6", response: null, text: ["Paragraph one."] },
      {
        kind: "PSALM",
        citation: "Psalm 96:1-3, 11-13",
        response: "Today is born our Savior.",
        text: ["Verse."],
      },
      { kind: "GOSPEL", citation: "Luke 2:1-14", response: null, text: ["Paragraph."] },
    ],
  };

  it("church members cannot edit the calendar", async () => {
    const t = await token(THERESA);
    await http().put(`/api/platform/readings/${FAR_DATE}`).set(auth(t)).send(body).expect(403);
  });

  it("a day needs a Gospel", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    await http()
      .put(`/api/platform/readings/${FAR_DATE}`)
      .set(auth(t))
      .send({ ...body, readings: body.readings.slice(0, 2) })
      .expect(400);
  });

  it("creates, then replaces, keeping order", async () => {
    const t = await token(SUPER, undefined, "admin-login");
    const r = await http()
      .put(`/api/platform/readings/${FAR_DATE}`)
      .set(auth(t))
      .send(body)
      .expect(200);
    expect(r.body).toMatchObject({ available: true, celebration: "The Nativity of the Lord" });
    expect(r.body.readings.map((x: { kind: string }) => x.kind)).toEqual([
      "FIRST",
      "PSALM",
      "GOSPEL",
    ]);

    const again = await http()
      .put(`/api/platform/readings/${FAR_DATE}`)
      .set(auth(t))
      .send({ ...body, readings: [body.readings[2]] })
      .expect(200);
    expect(again.body.readings.length).toBe(1);
  });
});
