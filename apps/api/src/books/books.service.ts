import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  bookOrders,
  bookRefunds,
  books,
  libraryItems,
  members,
} from "@ecclesios/db";
import type { Book, BookSummary, Order, Principal, ReadUrl } from "@ecclesios/shared";
import {
  canMoveOrder,
  isOrderExpired,
  REFUND_MESSAGES,
  refundBlocker,
  splitSale,
  type BookCategory,
  type OrderStatus,
} from "@ecclesios/shared/domain";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { ENV, type Env } from "../config/env";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";
import { NotifyService } from "../notify/notify.service";
import { GatewayError, PAYMENT_GATEWAY, type PaymentGateway } from "../payments/gateway";
import { TestGateway } from "../payments/test.gateway";
import { BookAccess } from "./book-access";

const PAGE = 24;
type Row = typeof books.$inferSelect;
type OrderRow = typeof bookOrders.$inferSelect;
export const bookNotFound = () =>
  new DomainError(404, "BOOK_NOT_FOUND", "We couldn't find that book.");
const orderNotFound = () => new DomainError(404, "ORDER_NOT_FOUND", "We couldn't find that order.");
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Readers: catalogue, library, reading, checkout, refunds (functionality §3.10, D-036). */
@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly media: MediaService,
    private readonly access: BookAccess,
    private readonly audit: AuditService,
    private readonly notifier: NotifyService,
  ) {}

  // ------------------------------------------------------------------ mapping

  private async ownedIds(memberId: string | null, ids: string[]) {
    if (!memberId || !ids.length) return new Set<string>();
    const rows = await this.db
      .select({ id: libraryItems.bookId })
      .from(libraryItems)
      .where(and(eq(libraryItems.memberId, memberId), inArray(libraryItems.bookId, ids)));
    return new Set(rows.map((r) => r.id));
  }

  async summaries(rows: Row[], memberId: string | null): Promise<BookSummary[]> {
    const owned = await this.ownedIds(
      memberId,
      rows.map((r) => r.id),
    );
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        subtitle: r.subtitle,
        authorName: r.authorName,
        category: r.category,
        coverUrl: r.coverKey ? await this.media.presignGet(r.coverKey) : null,
        priceMinor: r.priceMinor,
        currency: r.currency,
        format: r.format ?? "EPUB",
        owned: owned.has(r.id),
      })),
    );
  }

  private memberOf = (p: Principal | undefined) => (p?.kind === "member" ? p.id : null);

  // ------------------------------------------------------------------ catalogue

  async list(
    q: { q: string; category?: BookCategory; price?: "free" | "paid"; page: number },
    viewer?: Principal,
  ) {
    const term = q.q.trim();
    const rows = await this.db
      .select()
      .from(books)
      .where(
        and(
          eq(books.status, "PUBLISHED"),
          q.category ? eq(books.category, q.category) : undefined,
          q.price === "free"
            ? eq(books.priceMinor, 0)
            : q.price === "paid"
              ? ne(books.priceMinor, 0)
              : undefined,
          term
            ? or(
                ilike(books.title, `%${escapeLike(term)}%`),
                ilike(books.authorName, `%${escapeLike(term)}%`),
                sql`to_tsvector('english', ${books.title} || ' ' || coalesce(${books.subtitle}, '') || ' ' || ${books.authorName} || ' ' || ${books.description}) @@ websearch_to_tsquery('english', ${term})`,
              )
            : undefined,
        ),
      )
      .orderBy(desc(books.publishedAt))
      .limit(PAGE + 1)
      .offset((q.page - 1) * PAGE);
    return {
      items: await this.summaries(rows.slice(0, PAGE), this.memberOf(viewer)),
      page: q.page,
      hasMore: rows.length > PAGE,
    };
  }

  /** PUBLISHED books for everyone; an UNLISTED book still opens for people who own it. */
  private async visible(slug: string, memberId: string | null) {
    const [r] = await this.db.select().from(books).where(eq(books.slug, slug)).limit(1);
    if (!r) throw bookNotFound();
    if (r.status === "PUBLISHED") return r;
    if (memberId && (await this.ownedIds(memberId, [r.id])).has(r.id)) return r;
    throw bookNotFound();
  }

  async detail(slug: string, viewer?: Principal): Promise<Book> {
    const memberId = this.memberOf(viewer);
    const r = await this.visible(slug, memberId);
    const [summary] = await this.summaries([r], memberId);
    return {
      ...summary!,
      description: r.description,
      aboutAuthor: r.aboutAuthor,
      language: r.language,
      pages: r.pages,
      isbn: r.isbn,
      approbation: r.approbation,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      hasPreview: Boolean(r.previewKey),
      order: memberId ? await this.orderInfo(memberId, r.id) : null,
    };
  }

  private async orderInfo(memberId: string, bookId: string): Promise<Book["order"]> {
    const [o] = await this.db
      .select()
      .from(bookOrders)
      .where(
        and(
          eq(bookOrders.memberId, memberId),
          eq(bookOrders.bookId, bookId),
          eq(bookOrders.status, "PAID"),
        ),
      )
      .orderBy(desc(bookOrders.paidAt))
      .limit(1);
    if (!o?.paidAt) return null;
    const check = await this.refundCheck(o);
    return { id: o.id, paidAt: o.paidAt.toISOString(), refund: check };
  }

  // ------------------------------------------------------------------ library + reading

  async library(memberId: string) {
    const rows = await this.db
      .select({ b: books, li: libraryItems })
      .from(libraryItems)
      .innerJoin(books, eq(books.id, libraryItems.bookId))
      .where(eq(libraryItems.memberId, memberId))
      .orderBy(desc(sql`coalesce(${libraryItems.lastReadAt}, ${libraryItems.addedAt})`));
    const base = await this.summaries(
      rows.map((r) => r.b),
      memberId,
    );
    return {
      items: base.map((b, i) => ({
        ...b,
        percent: rows[i]!.li.percent,
        addedAt: rows[i]!.li.addedAt.toISOString(),
        lastReadAt: rows[i]!.li.lastReadAt?.toISOString() ?? null,
      })),
    };
  }

  /** Add a FREE book to the library. */
  async addFree(memberId: string, slug: string) {
    const r = await this.visible(slug, memberId);
    if (r.priceMinor !== 0) throw new DomainError(409, "NOT_FREE", "This book must be bought.");
    await this.db.insert(libraryItems).values({ memberId, bookId: r.id }).onConflictDoNothing();
  }

  /** Remove a free book from the library (bought books stay — they were paid for). */
  async removeFree(memberId: string, slug: string) {
    const [r] = await this.db.select().from(books).where(eq(books.slug, slug)).limit(1);
    if (!r) throw bookNotFound();
    const [li] = await this.db
      .select()
      .from(libraryItems)
      .where(and(eq(libraryItems.memberId, memberId), eq(libraryItems.bookId, r.id)))
      .limit(1);
    if (li?.orderId) throw new DomainError(409, "BOUGHT", "Books you bought stay in your library.");
    await this.db
      .delete(libraryItems)
      .where(and(eq(libraryItems.memberId, memberId), eq(libraryItems.bookId, r.id)));
  }

  /** Full book for owners (watermarked with their name); free books are added on first read. */
  async read(memberId: string, slug: string): Promise<ReadUrl> {
    const r = await this.visible(slug, memberId);
    if (!r.fileKey || !r.format)
      throw new DomainError(409, "NO_FILE", "This book has no file yet.");
    let [li] = await this.db
      .select()
      .from(libraryItems)
      .where(and(eq(libraryItems.memberId, memberId), eq(libraryItems.bookId, r.id)))
      .limit(1);
    if (!li && r.priceMinor === 0) {
      await this.addFree(memberId, slug);
      [li] = await this.db
        .select()
        .from(libraryItems)
        .where(and(eq(libraryItems.memberId, memberId), eq(libraryItems.bookId, r.id)))
        .limit(1);
    }
    if (!li) throw new DomainError(403, "NOT_OWNED", "Buy this book to read it in full.");
    const [m] = await this.db
      .select({ f: members.firstName, l: members.lastName })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    await this.db
      .update(libraryItems)
      .set({ lastReadAt: new Date() })
      .where(and(eq(libraryItems.memberId, memberId), eq(libraryItems.bookId, r.id)));
    return {
      url: await this.media.presignGet(r.fileKey),
      format: r.format,
      expiresInSeconds: this.media.ttl,
      watermark: r.priceMinor > 0 && m ? `${m.f} ${m.l}` : null,
      progress: { locator: li.locator, percent: li.percent },
      preview: false,
    };
  }

  /** The seller's sample file, for anyone. */
  async preview(slug: string): Promise<ReadUrl> {
    const r = await this.visible(slug, null);
    if (!r.previewKey) throw new DomainError(404, "NO_PREVIEW", "This book has no preview.");
    const format = r.previewKey.endsWith(".pdf") ? "PDF" : "EPUB";
    return {
      url: await this.media.presignGet(r.previewKey),
      format,
      expiresInSeconds: this.media.ttl,
      watermark: null,
      progress: { locator: null, percent: 0 },
      preview: true,
    };
  }

  async saveProgress(memberId: string, slug: string, locator: string | null, percent: number) {
    const [r] = await this.db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.slug, slug))
      .limit(1);
    if (!r) throw bookNotFound();
    const res = await this.db
      .update(libraryItems)
      .set({ locator, percent, lastReadAt: new Date() })
      .where(and(eq(libraryItems.memberId, memberId), eq(libraryItems.bookId, r.id)))
      .returning({ b: libraryItems.bookId });
    if (!res.length) throw new DomainError(403, "NOT_OWNED", "This book isn't in your library.");
  }

  // ------------------------------------------------------------------ checkout

  async checkout(memberId: string, slug: string, ip: string) {
    const r = await this.visible(slug, null);
    if (r.status !== "PUBLISHED") throw bookNotFound();
    if (r.priceMinor === 0)
      throw new DomainError(409, "FREE_BOOK", "This book is free — add it to your library.");
    if ((await this.ownedIds(memberId, [r.id])).has(r.id))
      throw new DomainError(409, "ALREADY_OWNED", "This book is already in your library.");

    // Abandon earlier unpaid attempts for the same book.
    await this.db
      .update(bookOrders)
      .set({ status: "CANCELLED" })
      .where(
        and(
          eq(bookOrders.memberId, memberId),
          eq(bookOrders.bookId, r.id),
          eq(bookOrders.status, "PENDING"),
        ),
      );

    const bps = await this.access.commissionFor(r);
    const split = splitSale(r.priceMinor, bps);
    const clientReference = randomBytes(12).toString("hex"); // 24 chars
    const [order] = await this.db
      .insert(bookOrders)
      .values({
        memberId,
        bookId: r.id,
        amountMinor: r.priceMinor,
        currency: r.currency,
        commissionBps: bps,
        platformMinor: split.platformMinor,
        authorMinor: split.authorMinor,
        gateway: this.gateway.name,
        clientReference,
      })
      .returning();
    try {
      const init = await this.gateway.initiate({
        clientReference,
        amountMinor: r.priceMinor,
        description: `Ecclesios e-book: ${r.title}`,
        callbackUrl: `${this.env.PUBLIC_API_URL}/api/public/payments/hubtel/callback`,
        returnUrl: `${this.env.PUBLIC_WEB_URL}/books/orders/${order!.id}`,
        cancelUrl: `${this.env.PUBLIC_WEB_URL}/books/${r.slug}`,
      });
      await this.db
        .update(bookOrders)
        .set({
          checkoutUrl: init.checkoutUrl,
          gatewayRef: init.gatewayRef,
          gatewayPayload: init.raw as object,
        })
        .where(eq(bookOrders.id, order!.id));
      await this.audit.write({
        actorType: "MEMBER",
        actorId: memberId,
        action: "books.checkout_started",
        entityType: "book_order",
        entityId: order!.id,
        metadata: { book: r.slug, amountMinor: r.priceMinor },
        ip,
      });
      return { orderId: order!.id, checkoutUrl: init.checkoutUrl };
    } catch (err) {
      await this.db
        .update(bookOrders)
        .set({ status: "FAILED" })
        .where(eq(bookOrders.id, order!.id));
      this.logger.error({ err, order: order!.id }, "checkout could not start");
      throw new DomainError(
        502,
        "PAYMENT_UNAVAILABLE",
        "Payments are unavailable right now. Please try again shortly.",
      );
    }
  }

  private async toOrder(o: OrderRow): Promise<Order> {
    const [b] = await this.db
      .select({ slug: books.slug, title: books.title })
      .from(books)
      .where(eq(books.id, o.bookId))
      .limit(1);
    return {
      id: o.id,
      status: o.status,
      amountMinor: o.amountMinor,
      currency: o.currency,
      book: { slug: b?.slug ?? "", title: b?.title ?? "" },
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
    };
  }

  /** The buyer's view of an order; a pending order is checked with the gateway first. */
  async order(memberId: string, id: string): Promise<Order> {
    const [o] = await this.db
      .select()
      .from(bookOrders)
      .where(and(eq(bookOrders.id, id), eq(bookOrders.memberId, memberId)))
      .limit(1);
    if (!o) throw orderNotFound();
    return this.toOrder(o.status === "PENDING" ? await this.verify(o) : o);
  }

  async myOrders(memberId: string) {
    const rows = await this.db
      .select()
      .from(bookOrders)
      .where(eq(bookOrders.memberId, memberId))
      .orderBy(desc(bookOrders.createdAt))
      .limit(100);
    return { items: await Promise.all(rows.map((o) => this.toOrder(o))) };
  }

  /** Gateway callback: the body only tells us WHICH order to check (D-036). */
  async callback(clientReference: string | undefined) {
    if (!clientReference) return;
    const [o] = await this.db
      .select()
      .from(bookOrders)
      .where(eq(bookOrders.clientReference, clientReference))
      .limit(1);
    if (o?.status === "PENDING") await this.verify(o);
  }

  /** Ask the gateway; mark PAID (and add to the library) only on a confirmed, correct amount. */
  async verify(o: OrderRow): Promise<OrderRow> {
    const now = new Date();
    let st;
    try {
      st = await this.gateway.status(o.clientReference);
    } catch (err) {
      if (!(err instanceof GatewayError)) throw err;
      this.logger.warn({ err, order: o.id }, "payment status unavailable");
      return o;
    }
    if (st.state === "PAID") {
      if (st.amountMinor !== null && st.amountMinor !== o.amountMinor) {
        this.logger.error(
          { order: o.id, expected: o.amountMinor, got: st.amountMinor },
          "paid amount mismatch",
        );
        await this.audit.write({
          actorType: "SYSTEM",
          action: "books.payment_amount_mismatch",
          entityType: "book_order",
          entityId: o.id,
          metadata: { expected: o.amountMinor, got: st.amountMinor },
        });
        return o;
      }
      return this.markPaid(o, st.gatewayRef, st.raw);
    }
    if (st.state === "FAILED") return this.move(o, "FAILED");
    if (isOrderExpired(o, now)) return this.move(o, "CANCELLED");
    return o;
  }

  private async move(o: OrderRow, to: OrderStatus) {
    if (!canMoveOrder(o.status, to)) return o;
    const [next] = await this.db
      .update(bookOrders)
      .set({ status: to })
      .where(and(eq(bookOrders.id, o.id), eq(bookOrders.status, o.status)))
      .returning();
    return next ?? o;
  }

  /** Idempotent: the status guard means two callbacks can't both "pay" the order. */
  private async markPaid(o: OrderRow, gatewayRef: string | null, raw: unknown) {
    const next = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(bookOrders)
        .set({
          status: "PAID",
          paidAt: new Date(),
          gatewayRef: gatewayRef ?? o.gatewayRef,
          gatewayPayload: raw as object,
        })
        .where(and(eq(bookOrders.id, o.id), eq(bookOrders.status, "PENDING")))
        .returning();
      if (!row) return null;
      await tx
        .insert(libraryItems)
        .values({ memberId: o.memberId, bookId: o.bookId, orderId: o.id })
        .onConflictDoUpdate({
          target: [libraryItems.memberId, libraryItems.bookId],
          set: { orderId: o.id },
        });
      return row;
    });
    if (!next) {
      const [cur] = await this.db.select().from(bookOrders).where(eq(bookOrders.id, o.id)).limit(1);
      return cur ?? o;
    }
    await this.audit.write({
      actorType: "SYSTEM",
      action: "books.order_paid",
      entityType: "book_order",
      entityId: o.id,
      metadata: { amountMinor: o.amountMinor, gateway: o.gateway },
    });
    return next;
  }

  /** Development only: the test checkout page "pays" (or fails) an order. */
  async testSettle(clientReference: string, fail: boolean) {
    if (!(this.gateway instanceof TestGateway))
      throw new DomainError(404, "NOT_FOUND", "Not found.");
    const [o] = await this.db
      .select()
      .from(bookOrders)
      .where(eq(bookOrders.clientReference, clientReference))
      .limit(1);
    if (!o) throw orderNotFound();
    this.gateway.settle(clientReference, o.amountMinor, fail);
    const v = await this.verify(o);
    return { orderId: v.id, status: v.status };
  }

  /** Test checkout page details (amount, title). */
  async testCheckout(clientReference: string) {
    if (!(this.gateway instanceof TestGateway))
      throw new DomainError(404, "NOT_FOUND", "Not found.");
    const [o] = await this.db
      .select()
      .from(bookOrders)
      .where(eq(bookOrders.clientReference, clientReference))
      .limit(1);
    if (!o) throw orderNotFound();
    return this.toOrder(o);
  }

  // ------------------------------------------------------------------ refunds

  private async refundCheck(o: OrderRow) {
    const [li] = await this.db
      .select({ percent: libraryItems.percent })
      .from(libraryItems)
      .where(and(eq(libraryItems.memberId, o.memberId), eq(libraryItems.bookId, o.bookId)))
      .limit(1);
    const [open] = await this.db
      .select({ id: bookRefunds.id, status: bookRefunds.status })
      .from(bookRefunds)
      .where(eq(bookRefunds.orderId, o.id))
      .orderBy(desc(bookRefunds.createdAt))
      .limit(1);
    const [before] = await this.db
      .select({ id: bookOrders.id })
      .from(bookOrders)
      .where(
        and(
          eq(bookOrders.memberId, o.memberId),
          eq(bookOrders.bookId, o.bookId),
          eq(bookOrders.status, "REFUNDED"),
        ),
      )
      .limit(1);
    const blocker = refundBlocker({
      status: o.status,
      paidAt: o.paidAt,
      percentRead: li?.percent ?? 0,
      now: new Date(),
      refundedBefore: Boolean(before),
      pendingRequest: open?.status === "REQUESTED",
    });
    return {
      allowed: blocker === null,
      reason: blocker ? REFUND_MESSAGES[blocker] : null,
      status: open?.status ?? null,
      percent: li?.percent ?? 0,
    };
  }

  async requestRefund(memberId: string, orderId: string, reason: string, ip: string) {
    const [o] = await this.db
      .select()
      .from(bookOrders)
      .where(and(eq(bookOrders.id, orderId), eq(bookOrders.memberId, memberId)))
      .limit(1);
    if (!o) throw orderNotFound();
    const c = await this.refundCheck(o);
    if (!c.allowed) throw new DomainError(409, "REFUND_NOT_ALLOWED", c.reason!);
    await this.db.insert(bookRefunds).values({ orderId, reason, percentRead: c.percent });
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      action: "books.refund_requested",
      entityType: "book_order",
      entityId: orderId,
      ip,
    });
  }

  /**
   * Refund an order (Super-Admin): REFUNDED, removed from the library, the author's share reversed
   * in their statement. The money itself is returned through Hubtel; `note` records the reference.
   */
  async refundOrder(userId: string, orderId: string, note: string, ip: string, refundId?: string) {
    const [o] = await this.db.select().from(bookOrders).where(eq(bookOrders.id, orderId)).limit(1);
    if (!o) throw orderNotFound();
    if (!canMoveOrder(o.status, "REFUNDED"))
      throw new DomainError(409, "NOT_REFUNDABLE", "Only paid orders can be refunded.");
    await this.db.transaction(async (tx) => {
      await tx
        .update(bookOrders)
        .set({ status: "REFUNDED", refundedAt: new Date() })
        .where(and(eq(bookOrders.id, o.id), eq(bookOrders.status, "PAID")));
      await tx
        .delete(libraryItems)
        .where(
          and(
            eq(libraryItems.memberId, o.memberId),
            eq(libraryItems.bookId, o.bookId),
            eq(libraryItems.orderId, o.id),
          ),
        );
      if (refundId)
        await tx
          .update(bookRefunds)
          .set({ status: "APPROVED", note, decidedByUserId: userId, decidedAt: new Date() })
          .where(eq(bookRefunds.id, refundId));
      else
        await tx.insert(bookRefunds).values({
          orderId,
          reason: "Refunded by Ecclesios",
          status: "APPROVED",
          note,
          decidedByUserId: userId,
          decidedAt: new Date(),
        });
    });
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: "books.order_refunded",
      entityType: "book_order",
      entityId: orderId,
      metadata: { note, amountMinor: o.amountMinor },
      ip,
    });
    await this.notify(o.memberId, "Your book refund was approved", note);
  }

  async declineRefund(userId: string, refundId: string, note: string, ip: string) {
    const [r] = await this.db
      .select()
      .from(bookRefunds)
      .where(eq(bookRefunds.id, refundId))
      .limit(1);
    if (!r || r.status !== "REQUESTED")
      throw new DomainError(404, "REFUND_NOT_FOUND", "That request isn't waiting.");
    await this.db
      .update(bookRefunds)
      .set({ status: "DECLINED", note, decidedByUserId: userId, decidedAt: new Date() })
      .where(eq(bookRefunds.id, refundId));
    const [o] = await this.db
      .select({ memberId: bookOrders.memberId })
      .from(bookOrders)
      .where(eq(bookOrders.id, r.orderId));
    await this.audit.write({
      actorType: "USER",
      actorId: userId,
      action: "books.refund_declined",
      entityType: "book_order",
      entityId: r.orderId,
      metadata: { note },
      ip,
    });
    if (o) await this.notify(o.memberId, "Your book refund request was declined", note);
  }

  async approveRefund(userId: string, refundId: string, note: string, ip: string) {
    const [r] = await this.db
      .select()
      .from(bookRefunds)
      .where(eq(bookRefunds.id, refundId))
      .limit(1);
    if (!r || r.status !== "REQUESTED")
      throw new DomainError(404, "REFUND_NOT_FOUND", "That request isn't waiting.");
    await this.refundOrder(userId, r.orderId, note, ip, refundId);
  }

  private notify(memberId: string, title: string, body: string | null) {
    return this.notifier.people("BOOK_REFUND", { memberIds: [memberId] }, { title, body, link: "/library" });
  }
}
