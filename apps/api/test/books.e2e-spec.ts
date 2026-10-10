import { bookOrders, bookPayouts, books, createDb, platformSettings } from "@ecclesios/db";
import { eq, inArray, like } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createTestApp, signInCache } from "./app";

// Books (D-036) with the built-in TEST payment gateway (PAYMENTS_GATEWAY=test, the default).
const SUPER = "superadmin@dev.ecclesios.local";
const CREATOR = "creator@dev.ecclesios.local"; //   SELL_BOOKS
const ESI = "esi.mensah@dev.ecclesios.local"; //    buyer
const THERESA = "theresa.pastor@dev.ecclesios.local"; // member without SELL_BOOKS

let app: INestApplication;
let token: ReturnType<typeof signInCache>;
const handle = createDb(process.env.DATABASE_URL, { max: 2 });
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const admin = () => token(SUPER, undefined, "admin-login");
const creator = () => token(CREATOR, undefined, "admin-login");

const cleanup = async () => {
  const ids = (
    await handle.db.select({ id: books.id }).from(books).where(like(books.slug, "e2e-%"))
  ).map((b) => b.id);
  if (ids.length) {
    await handle.db.delete(bookOrders).where(inArray(bookOrders.bookId, ids));
    await handle.db.delete(books).where(inArray(books.id, ids));
  }
  await handle.db.delete(bookPayouts).where(like(bookPayouts.reference, "MOMO-E2E%"));
  await handle.db
    .update(platformSettings)
    .set({ value: 2000 })
    .where(eq(platformSettings.key, "books.commissionBps"));
};
const lesson = {
  title: "E2E Paid Book",
  authorName: "Test Author",
  description: "A book used only by the end-to-end tests of the bookshop.",
  category: "SPIRITUALITY",
  priceMinor: 2500,
  rightsConfirmed: true,
};
const pretendUpload = (slug: string) =>
  handle.db
    .update(books)
    .set({ fileKey: `books/e2e/${slug}.epub`, format: "EPUB", fileBytes: 1000 })
    .where(eq(books.slug, slug));

beforeAll(async () => {
  await cleanup();
  const t = await createTestApp();
  app = t.app;
  token = signInCache(app, t.otp);
});
afterAll(async () => {
  await cleanup();
  await app?.close();
  await handle.close();
});

describe("listing (sellers and review)", () => {
  it("only SELL_BOOKS holders can list", async () => {
    const t = await token(THERESA);
    expect((await http().get("/api/studio/books").set(auth(t)).expect(200)).body.canCreate).toBe(
      false,
    );
    await http().post("/api/studio/books").set(auth(t)).send(lesson).expect(403);
  });

  it("draft → needs a file → pending → approved → on the shelf", async () => {
    const t = await creator();
    const c = await http().post("/api/studio/books").set(auth(t)).send(lesson).expect(201);
    expect(c.body).toMatchObject({
      slug: "e2e-paid-book",
      status: "DRAFT",
      problems: ["Upload the book file (EPUB or PDF)."],
    });
    expect(
      (await http().post("/api/studio/books/e2e-paid-book/submit").set(auth(t)).expect(409)).body
        .error.code,
    ).toBe("BOOK_INCOMPLETE");
    await pretendUpload("e2e-paid-book");
    expect(
      (await http().post("/api/studio/books/e2e-paid-book/submit").set(auth(t)).expect(200)).body
        .status,
    ).toBe("PENDING");
    await http().get("/api/public/books/e2e-paid-book").expect(404);
    await http().put("/api/studio/books/e2e-paid-book").set(auth(t)).send(lesson).expect(409); // locked in review

    const a = await admin();
    await http()
      .post("/api/platform/books/e2e-paid-book/decision")
      .set(auth(a))
      .send({ decision: "reject" })
      .expect(400); // needs a reason
    const ok = await http()
      .post("/api/platform/books/e2e-paid-book/decision")
      .set(auth(a))
      .send({ decision: "approve" })
      .expect(200);
    expect(ok.body.status).toBe("PUBLISHED");
    const shelf = await http().get("/api/public/books?category=SPIRITUALITY").expect(200);
    expect(shelf.body.items.map((b: { slug: string }) => b.slug)).toContain("e2e-paid-book");
  });
});

describe("buying, reading and refunds", () => {
  let orderId = "";
  let ref = "";

  it("checkout, pay (test gateway), read with a watermark", async () => {
    const t = await token(ESI);
    expect(
      (await http().get("/api/books/e2e-paid-book/read").set(auth(t)).expect(403)).body.error.code,
    ).toBe("NOT_OWNED");
    const c = await http().post("/api/books/e2e-paid-book/checkout").set(auth(t)).expect(201);
    orderId = c.body.orderId;
    ref = new URL(c.body.checkoutUrl).searchParams.get("ref")!;
    expect(c.body.checkoutUrl).toContain("/books/checkout/test?ref=");
    const [o] = await handle.db.select().from(bookOrders).where(eq(bookOrders.id, orderId));
    expect(o).toMatchObject({
      amountMinor: 2500,
      commissionBps: 2000,
      platformMinor: 500,
      authorMinor: 2000,
      status: "PENDING",
    });

    // A callback alone pays nothing: the gateway hasn't confirmed.
    await http()
      .post("/api/public/payments/hubtel/callback")
      .send({ Data: { ClientReference: ref } })
      .expect(200);
    expect(
      (await http().get(`/api/books/orders/${orderId}`).set(auth(t)).expect(200)).body.status,
    ).toBe("PENDING");

    await http().post(`/api/public/payments/test/${ref}`).send({ outcome: "paid" }).expect(200);
    expect(
      (await http().get(`/api/books/orders/${orderId}`).set(auth(t)).expect(200)).body.status,
    ).toBe("PAID");
    const read = await http().get("/api/books/e2e-paid-book/read").set(auth(t)).expect(200);
    expect(read.body).toMatchObject({ format: "EPUB", watermark: "Esi Mensah", preview: false });
    await http()
      .put("/api/books/e2e-paid-book/progress")
      .set(auth(t))
      .send({ locator: "epubcfi(/6/4)", percent: 4 })
      .expect(204);
    const lib = await http().get("/api/books/library").set(auth(t)).expect(200);
    expect(lib.body.items.find((b: { slug: string }) => b.slug === "e2e-paid-book")).toMatchObject({
      owned: true,
      percent: 4,
    });
    expect(
      (await http().post("/api/books/e2e-paid-book/checkout").set(auth(t)).expect(409)).body.error
        .code,
    ).toBe("ALREADY_OWNED");
  });

  it("a refund: requested, approved, access removed, author share reversed; only once", async () => {
    const t = await token(ESI);
    const detail = await http().get("/api/public/books/e2e-paid-book").set(auth(t)).expect(200);
    expect(detail.body.order.refund).toMatchObject({ allowed: true });
    await http()
      .post(`/api/books/orders/${orderId}/refund`)
      .set(auth(t))
      .send({ reason: "Bought by mistake" })
      .expect(204);
    await http()
      .post(`/api/books/orders/${orderId}/refund`)
      .set(auth(t))
      .send({ reason: "Again please" })
      .expect(409);

    const a = await admin();
    const list = await http().get("/api/platform/books/refunds").set(auth(a)).expect(200);
    const req = list.body.items.find((r: { orderId: string }) => r.orderId === orderId);
    expect(req).toMatchObject({ status: "REQUESTED", percentRead: 4 });
    await http()
      .post(`/api/platform/books/refunds/${req.id}/decision`)
      .set(auth(a))
      .send({ decision: "approve", note: "Hubtel ref R-123" })
      .expect(204);
    await http().get("/api/books/e2e-paid-book/read").set(auth(t)).expect(403);

    const st = await http()
      .get("/api/studio/books/statement")
      .set(auth(await creator()))
      .expect(200);
    expect(st.body.sales.find((s: { orderId: string }) => s.orderId === orderId)).toMatchObject({
      status: "REFUNDED",
      authorMinor: 2000,
    });

    // Buying again works, but a second refund for the same book doesn't.
    const c2 = await http().post("/api/books/e2e-paid-book/checkout").set(auth(t)).expect(201);
    await http()
      .post(`/api/public/payments/test/${new URL(c2.body.checkoutUrl).searchParams.get("ref")}`)
      .send({ outcome: "paid" })
      .expect(200);
    await http().get(`/api/books/orders/${c2.body.orderId}`).set(auth(t)).expect(200);
    const r2 = await http()
      .post(`/api/books/orders/${c2.body.orderId}/refund`)
      .set(auth(t))
      .send({ reason: "Changed my mind" })
      .expect(409);
    expect(r2.body.error.code).toBe("REFUND_NOT_ALLOWED");
  });
});

describe("commission and payouts", () => {
  it("the platform rate is configurable and frozen on each order", async () => {
    const a = await admin();
    await http()
      .put("/api/platform/books/settings")
      .set(auth(a))
      .send({ commissionBps: 6000 })
      .expect(400);
    await http()
      .put("/api/platform/books/settings")
      .set(auth(a))
      .send({ commissionBps: 1500 })
      .expect(200);
    const t = await token(THERESA);
    const c = await http().post("/api/books/e2e-paid-book/checkout").set(auth(t)).expect(201);
    const [o] = await handle.db.select().from(bookOrders).where(eq(bookOrders.id, c.body.orderId));
    expect(o).toMatchObject({ commissionBps: 1500, platformMinor: 375, authorMinor: 2125 });
  });

  it("payouts can't exceed what the seller is owed", async () => {
    const a = await admin();
    const sellers = await http().get("/api/platform/books/sellers").set(auth(a)).expect(200);
    const s = sellers.body.items.find((x: { name: string }) => x.name === "Sample PYC Creator");
    await http()
      .post(`/api/platform/books/sellers/${s.key}/payouts`)
      .set(auth(a))
      .send({ amountMinor: s.balanceMinor + 1, reference: "MOMO-E2E-1" })
      .expect(409);
    const ok = await http()
      .post(`/api/platform/books/sellers/${s.key}/payouts`)
      .set(auth(a))
      .send({ amountMinor: s.balanceMinor, reference: "MOMO-E2E-1" })
      .expect(201);
    expect(ok.body.balanceMinor).toBe(0);
  });
});

describe("free books", () => {
  it("Super-Admin's own free book goes live on submit; readers add it and read without a watermark", async () => {
    const a = await admin();
    await http()
      .post("/api/studio/books")
      .set(auth(a))
      .send({ ...lesson, title: "E2E Free Classic", priceMinor: 0 })
      .expect(201);
    await pretendUpload("e2e-free-classic");
    expect(
      (await http().post("/api/studio/books/e2e-free-classic/submit").set(auth(a)).expect(200)).body
        .status,
    ).toBe("PUBLISHED");
    const t = await token(ESI);
    await http().post("/api/books/e2e-free-classic/checkout").set(auth(t)).expect(409);
    await http().put("/api/books/e2e-free-classic/library").set(auth(t)).expect(204);
    expect(
      (await http().get("/api/books/e2e-free-classic/read").set(auth(t)).expect(200)).body
        .watermark,
    ).toBe(null);
    await http().delete("/api/books/e2e-free-classic/library").set(auth(t)).expect(204);
  });
});
