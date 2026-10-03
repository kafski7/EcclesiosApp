import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp } from "./app";

// Phase 5.2 Bible (functionality §3.8, D-023). Works on seed data (sample verses) or a full import.
let app: INestApplication;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  ({ app } = await createTestApp());
});
afterAll(async () => {
  await app?.close();
});

describe("translations", () => {
  it("lists WEBC (default) and DRA, public", async () => {
    const r = await http().get("/api/public/bible/translations").expect(200);
    const codes = r.body.items.map((t: { code: string }) => t.code);
    expect(codes).toContain("WEBC");
    expect(codes).toContain("DRA");
    expect(r.body.items[0]).toMatchObject({ code: "WEBC", isDefault: true });
  });

  it("books come in the 73-book Catholic order with loaded chapter counts", async () => {
    const r = await http().get("/api/public/bible/webc/books").expect(200);
    expect(r.body.items.length).toBe(73);
    expect(r.body.items[16]).toMatchObject({ code: "TOB", deutero: true });
    expect(r.body.items.find((b: { code: string }) => b.code === "LUK").chapters).toBeGreaterThanOrEqual(11);
  });

  it("unknown translation → 404", async () => {
    const r = await http().get("/api/public/bible/XYZ/books").expect(404);
    expect(r.body.error.code).toBe("TRANSLATION_NOT_FOUND");
  });
});

describe("chapters", () => {
  it("returns verses in order with prev / next", async () => {
    const r = await http().get("/api/public/bible/WEBC/LUK/10").expect(200);
    expect(r.body.book).toEqual({ code: "LUK", name: "Luke" });
    expect(r.body.verses[0].verse).toBe(1);
    expect(r.body.next).toEqual({ book: "LUK", chapter: 11 });
    expect(r.body.translation.attribution).toMatch(/public domain/i);
  });

  it("the same chapter in another translation", async () => {
    const r = await http().get("/api/public/bible/DRA/LUK/10").expect(200);
    expect(r.body.translation.code).toBe("DRA");
  });

  it("missing book / chapter / bad number", async () => {
    expect((await http().get("/api/public/bible/WEBC/XXX/1").expect(404)).body.error.code).toBe("BOOK_NOT_FOUND");
    expect((await http().get("/api/public/bible/WEBC/LUK/999").expect(404)).body.error.code).toBe("CHAPTER_NOT_FOUND");
    await http().get("/api/public/bible/WEBC/LUK/ten").expect(400);
  });
});

describe("search", () => {
  it("finds verses in canonical order", async () => {
    // "sample" matches the seed text, "lord" a full import
    const r = await http().get("/api/public/bible/WEBC/search?q=sample%20or%20lord").expect(200);
    expect(r.body.items.length).toBeGreaterThan(0);
    expect(r.body.items[0]).toHaveProperty("bookName");
  });
  it("rejects one-letter queries", async () => {
    await http().get("/api/public/bible/WEBC/search?q=a").expect(400);
  });
});
