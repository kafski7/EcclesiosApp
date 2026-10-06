import { Inject, Injectable, Logger } from "@nestjs/common";
import { bookOrders, bookPayouts, bookRefunds, books, bookSellers, members, notifications, notificationTypes, platformSettings } from "@ecclesios/db";
import type { BookDecision, Principal, SellerStatement, StudioBook, UpsertBookSchema } from "@ecclesios/shared";
import {
  BOOK_COVER_TYPES,
  BOOK_FILE_TYPES,
  bookProblems,
  canEditBookContent,
  canManageBook,
  canSellBooks,
  isBookAdmin,
  MAX_BOOK_COVER_BYTES,
  nextBookStatus,
  sellerBalance,
  slugify,
  type BookAction,
  type BookOwner,
  type BookStatus,
} from "@ecclesios/shared/domain";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { deleteReactions } from "../engage/cleanup";
import { MediaService } from "../media/media.service";
import { BookAccess, COMMISSION_KEY, parseSellerKey, sellerKey } from "./book-access";
import { bookNotFound } from "./books.service";

type Row = typeof books.$inferSelect;
type Upsert = z.output<typeof UpsertBookSchema>;
const FILE_TYPES = Object.values(BOOK_FILE_TYPES);
const notAllowed = () => new DomainError(403, "NOT_ALLOWED", "Only the book's seller or an Ecclesios administrator can do that.");

/** Sellers' studio and the Super-Admin side of Books (D-036). */
@Injectable()
export class BookStudioService {
  private readonly logger = new Logger(BookStudioService.name);
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly access: BookAccess,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ mapping

  private async sales(ids: string[]) {
    if (!ids.length) return new Map<string, { sold: number; earned: number }>();
    const rows = await this.db
      .select({
        bookId: bookOrders.bookId,
        sold: sql<number>`count(*) filter (where ${bookOrders.status} = 'PAID')::int`,
        earned: sql<number>`coalesce(sum(${bookOrders.authorMinor}) filter (where ${bookOrders.status} = 'PAID'), 0)::int`,
      })
      .from(bookOrders)
      .where(inArray(bookOrders.bookId, ids))
      .groupBy(bookOrders.bookId);
    return new Map(rows.map((r) => [r.bookId, { sold: r.sold, earned: r.earned }]));
  }

  async view(r: Row): Promise<StudioBook> {
    const [s, seller] = await Promise.all([this.sales([r.id]), this.access.sellerName(r)]);
    return {
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
      description: r.description,
      aboutAuthor: r.aboutAuthor,
      language: r.language,
      pages: r.pages,
      isbn: r.isbn,
      approbation: r.approbation,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      hasPreview: Boolean(r.previewKey),
      status: r.status,
      reviewNote: r.reviewNote,
      rightsConfirmed: r.rightsConfirmed,
      hasFile: Boolean(r.fileKey),
      problems: bookProblems(r),
      sold: s.get(r.id)?.sold ?? 0,
      earnedMinor: s.get(r.id)?.earned ?? 0,
      seller,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private async managed(p: Principal, slug: string) {
    const [actor, [row]] = await Promise.all([this.access.actor(p), this.db.select().from(books).where(eq(books.slug, slug)).limit(1)]);
    if (!row) throw bookNotFound();
    if (!canManageBook(actor, row)) throw notAllowed();
    return { actor, row };
  }

  private ownerOf(p: Principal): BookOwner {
    return p.kind === "user" ? { sellerUserId: p.id, sellerMemberId: null } : { sellerUserId: null, sellerMemberId: p.id };
  }

  // ------------------------------------------------------------------ seller studio

  async mine(p: Principal) {
    const actor = await this.access.actor(p);
    const o = this.ownerOf(p);
    const rows = await this.db
      .select()
      .from(books)
      .where(o.sellerUserId ? eq(books.sellerUserId, o.sellerUserId) : eq(books.sellerMemberId, o.sellerMemberId!))
      .orderBy(desc(books.updatedAt));
    return { items: await Promise.all(rows.map((r) => this.view(r))), canCreate: canSellBooks(actor) };
  }

  async detail(p: Principal, slug: string) {
    return this.view((await this.managed(p, slug)).row);
  }

  private values(b: Upsert) {
    return {
      title: b.title,
      subtitle: b.subtitle,
      authorName: b.authorName,
      description: b.description,
      aboutAuthor: b.aboutAuthor,
      category: b.category,
      language: b.language,
      pages: b.pages,
      isbn: b.isbn,
      approbation: b.approbation,
      priceMinor: b.priceMinor,
      rightsConfirmed: b.rightsConfirmed,
    };
  }

  async create(p: Principal, b: Upsert, ip: string) {
    const actor = await this.access.actor(p);
    if (!canSellBooks(actor)) throw new DomainError(403, "NOT_ALLOWED", "Selling books needs approval as a book seller. Ask Ecclesios.");
    const slug = await this.freeSlug(slugify(b.title));
    const [row] = await this.db.insert(books).values({ ...this.values(b), ...this.ownerOf(p), slug }).returning();
    await this.log(p, "books.created", row!.id, ip);
    return this.view(row!);
  }

  /** Content changes only off the shelf (DRAFT, REJECTED, UNLISTED). */
  async update(p: Principal, slug: string, b: Upsert, ip: string) {
    const { row } = await this.managed(p, slug);
    if (!canEditBookContent(row.status))
      throw new DomainError(409, "BOOK_LOCKED", row.status === "PUBLISHED" ? "Unlist the book to change it; you can still change its price." : "The book is being reviewed.");
    const [next] = await this.db.update(books).set(this.values(b)).where(eq(books.id, row.id)).returning();
    await this.log(p, "books.updated", row.id, ip);
    return this.view(next!);
  }

  /** Price can change any time; buyers pay the price at checkout. */
  async setPrice(p: Principal, slug: string, priceMinor: number, ip: string) {
    const { row } = await this.managed(p, slug);
    if (row.status === "PENDING") throw new DomainError(409, "BOOK_LOCKED", "The book is being reviewed.");
    const [next] = await this.db.update(books).set({ priceMinor }).where(eq(books.id, row.id)).returning();
    await this.log(p, "books.price_changed", row.id, ip, { from: row.priceMinor, to: priceMinor });
    return this.view(next!);
  }

  async presign(p: Principal, slug: string, part: "file" | "preview" | "cover", contentType: string, bytes: number) {
    const { row } = await this.managed(p, slug);
    if (part !== "preview" && part !== "cover" && !canEditBookContent(row.status))
      throw new DomainError(409, "BOOK_LOCKED", "Unlist the book before replacing its file.");
    if (part === "cover") {
      if (!(BOOK_COVER_TYPES as readonly string[]).includes(contentType)) throw new DomainError(400, "UPLOAD_REJECTED", "Use a JPEG, PNG or WebP image.");
      if (bytes > MAX_BOOK_COVER_BYTES) throw new DomainError(400, "UPLOAD_REJECTED", "The image is too large (max 5 MB).");
    } else if (!FILE_TYPES.includes(contentType)) throw new DomainError(400, "UPLOAD_REJECTED", "Upload an EPUB or a PDF.");
    return this.media.presignPut(this.media.newKey(`books/${row.id}/${part}`, contentType), contentType, bytes);
  }

  async attach(p: Principal, slug: string, part: "file" | "preview" | "cover", key: string | null, ip: string) {
    const { row } = await this.managed(p, slug);
    if (part === "file" && !canEditBookContent(row.status)) throw new DomainError(409, "BOOK_LOCKED", "Unlist the book before replacing its file.");
    let set: Partial<Row> = {};
    if (key) {
      if (!key.startsWith(`books/${row.id}/${part}/`)) throw new DomainError(400, "UPLOAD_REJECTED", "That upload doesn't belong here.");
      const head = await this.media.head(key);
      const allowed = part === "cover" ? [...BOOK_COVER_TYPES] : FILE_TYPES;
      if (!head?.contentType || !allowed.includes(head.contentType)) {
        if (head) await this.media.remove(key);
        throw new DomainError(400, "UPLOAD_REJECTED", "The file hasn't finished uploading or isn't a supported type.");
      }
      if (part === "file") set = { fileKey: key, fileBytes: head.bytes, format: head.contentType === "application/pdf" ? "PDF" : "EPUB" };
    } else if (part === "file") set = { fileKey: null, fileBytes: null, format: null };
    if (part === "preview") set = { previewKey: key };
    if (part === "cover") set = { coverKey: key };
    const old = part === "file" ? row.fileKey : part === "preview" ? row.previewKey : row.coverKey;
    const [next] = await this.db.update(books).set(set).where(eq(books.id, row.id)).returning();
    if (old && old !== key) await this.media.remove(old);
    await this.log(p, `books.${part}_set`, row.id, ip);
    return this.view(next!);
  }

  async transition(p: Principal, slug: string, action: Extract<BookAction, "submit" | "unlist">, ip: string) {
    const { actor, row } = await this.managed(p, slug);
    if (action === "submit") {
      const problems = bookProblems(row);
      if (problems.length) throw new DomainError(409, "BOOK_INCOMPLETE", problems[0]!, { problems });
    }
    const to = nextBookStatus(row.status, action);
    if (!to) throw new DomainError(409, "INVALID_TRANSITION", `Can't ${action} a ${row.status.toLowerCase()} book.`);
    // Super-Admins' own books skip the queue, like their Explore posts (D-031).
    const direct = action === "submit" && isBookAdmin(actor) && row.sellerUserId === actor.id;
    const now = new Date();
    const [next] = await this.db
      .update(books)
      .set(direct ? { status: "PUBLISHED", submittedAt: now, publishedAt: row.publishedAt ?? now, reviewNote: null } : { status: to, ...(action === "submit" ? { submittedAt: now, reviewNote: null } : {}) })
      .where(eq(books.id, row.id))
      .returning();
    await this.log(p, `books.${direct ? "published" : action === "submit" ? "submitted" : "unlisted"}`, row.id, ip);
    return this.view(next!);
  }

  /** Books that never sold can be deleted; sold books are kept for their owners (unlist instead). */
  async remove(p: Principal, slug: string, ip: string) {
    const { row } = await this.managed(p, slug);
    const [sold] = await this.db.select({ id: bookOrders.id }).from(bookOrders).where(and(eq(bookOrders.bookId, row.id), inArray(bookOrders.status, ["PAID", "REFUNDED"]))).limit(1);
    if (sold) throw new DomainError(409, "BOOK_HAS_SALES", "This book has buyers. Unlist it instead; owners keep reading it.");
    await this.db.delete(bookOrders).where(eq(bookOrders.bookId, row.id));
    await this.db.delete(books).where(eq(books.id, row.id));
    await deleteReactions(this.db, "BOOK", row.id);
    for (const k of [row.fileKey, row.previewKey, row.coverKey]) if (k) await this.media.remove(k);
    await this.log(p, "books.deleted", row.id, ip, { title: row.title });
  }

  private async freeSlug(base: string) {
    const root = base || "book";
    for (let i = 1; ; i++) {
      const c = i === 1 ? root : `${root}-${i}`;
      const [hit] = await this.db.select({ id: books.id }).from(books).where(eq(books.slug, c)).limit(1);
      if (!hit) return c;
    }
  }

  // ------------------------------------------------------------------ statements

  async statementFor(owner: BookOwner): Promise<SellerStatement> {
    const ownBooks = owner.sellerUserId ? eq(books.sellerUserId, owner.sellerUserId) : eq(books.sellerMemberId, owner.sellerMemberId!);
    const [sales, payouts, bps] = await Promise.all([
      this.db
        .select({ o: bookOrders, title: books.title })
        .from(bookOrders)
        .innerJoin(books, eq(books.id, bookOrders.bookId))
        .where(and(ownBooks, inArray(bookOrders.status, ["PAID", "REFUNDED"])))
        .orderBy(desc(bookOrders.paidAt))
        .limit(500),
      this.db
        .select()
        .from(bookPayouts)
        .where(owner.sellerUserId ? eq(bookPayouts.sellerUserId, owner.sellerUserId) : eq(bookPayouts.sellerMemberId, owner.sellerMemberId!))
        .orderBy(desc(bookPayouts.createdAt)),
      this.access.commissionFor(owner),
    ]);
    const earnedMinor = sales.reduce((a, s) => a + s.o.authorMinor, 0);
    const refundedMinor = sales.filter((s) => s.o.status === "REFUNDED").reduce((a, s) => a + s.o.authorMinor, 0);
    const paidOutMinor = payouts.reduce((a, p) => a + p.amountMinor, 0);
    return {
      commissionBps: bps,
      earnedMinor,
      refundedMinor,
      paidOutMinor,
      balanceMinor: sellerBalance({ earnedMinor, refundedMinor, paidOutMinor }),
      sales: sales.map((s) => ({
        orderId: s.o.id,
        book: s.title,
        at: (s.o.paidAt ?? s.o.createdAt).toISOString(),
        priceMinor: s.o.amountMinor,
        authorMinor: s.o.authorMinor,
        status: s.o.status,
      })),
      payouts: payouts.map((p) => ({ id: p.id, amountMinor: p.amountMinor, reference: p.reference, at: p.createdAt.toISOString() })),
    };
  }

  statement = (p: Principal) => this.statementFor(this.ownerOf(p));

  async statementForKey(key: string) {
    const o = parseSellerKey(key);
    if (!o) throw new DomainError(400, "VALIDATION_FAILED", "Unknown seller.");
    return this.statementFor(o);
  }

  // ------------------------------------------------------------------ Super-Admin

  async adminList(status?: BookStatus) {
    const rows = await this.db
      .select()
      .from(books)
      .where(status ? eq(books.status, status) : undefined)
      .orderBy(status === "PENDING" ? asc(books.submittedAt) : desc(books.updatedAt))
      .limit(300);
    return { items: await Promise.all(rows.map((r) => this.view(r))), canCreate: true };
  }

  async decide(userId: string, slug: string, d: BookDecision, ip: string) {
    const [row] = await this.db.select().from(books).where(eq(books.slug, slug)).limit(1);
    if (!row) throw bookNotFound();
    const to = nextBookStatus(row.status, d.decision);
    if (!to) throw new DomainError(409, "INVALID_TRANSITION", `Can't ${d.decision} a ${row.status.toLowerCase()} book.`);
    if (to === "PUBLISHED" && bookProblems(row).length) throw new DomainError(409, "BOOK_INCOMPLETE", bookProblems(row)[0]!);
    const [next] = await this.db
      .update(books)
      .set({ status: to, reviewNote: d.note ?? null, reviewedByUserId: userId, ...(to === "PUBLISHED" ? { publishedAt: row.publishedAt ?? new Date() } : {}) })
      .where(eq(books.id, row.id))
      .returning();
    await this.audit.write({ actorType: "USER", actorId: userId, action: `books.${d.decision === "approve" ? "approved" : d.decision === "reject" ? "rejected" : "unlisted_by_admin"}`, entityType: "book", entityId: row.id, metadata: { note: d.note ?? null }, ip });
    const verdict = { approve: "is now on the shelf", reject: "was not approved", unlist: "was taken off the shelf" }[d.decision];
    await this.notifySeller(row, `"${row.title}" ${verdict}`, d.note ?? null);
    return this.view(next!);
  }

  private async notifySeller(row: Row, title: string, body: string | null) {
    try {
      const [t] = await this.db.select({ id: notificationTypes.id }).from(notificationTypes).where(eq(notificationTypes.code, "BOOK_REVIEW")).limit(1);
      if (!t) return;
      await this.db.insert(notifications).values({ typeId: t.id, recipientMemberId: row.sellerMemberId, recipientUserId: row.sellerMemberId ? null : row.sellerUserId, title: title.slice(0, 200), body, link: row.sellerMemberId ? `/studio/books/${row.slug}` : `/platform/books/mine/${row.slug}` });
    } catch (err) {
      this.logger.error({ err }, "could not notify the seller");
    }
  }

  async settings() {
    return { commissionBps: await this.access.defaultCommission() };
  }

  async setSettings(userId: string, commissionBps: number, ip: string) {
    const before = await this.access.defaultCommission();
    await this.db
      .insert(platformSettings)
      .values({ key: COMMISSION_KEY, value: commissionBps })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: commissionBps, updatedAt: new Date() } });
    await this.audit.write({ actorType: "USER", actorId: userId, action: "books.commission_changed", entityType: "platform_setting", entityId: COMMISSION_KEY, metadata: { from: before, to: commissionBps }, ip });
    return { commissionBps };
  }

  /** Everyone who has listed a book, with terms and what they're owed. */
  async sellers() {
    const owners = await this.db.selectDistinct({ sellerUserId: books.sellerUserId, sellerMemberId: books.sellerMemberId }).from(books);
    const items = await Promise.all(
      owners.map(async (o) => {
        const [st, terms, name, counts] = await Promise.all([
          this.statementFor(o),
          this.access.terms(o),
          this.access.sellerName(o),
          this.db
            .select({ n: sql<number>`count(*)::int` })
            .from(books)
            .where(o.sellerUserId ? eq(books.sellerUserId, o.sellerUserId) : eq(books.sellerMemberId, o.sellerMemberId!)),
        ]);
        return {
          key: sellerKey(o),
          name,
          books: counts[0]?.n ?? 0,
          commissionBps: terms?.commissionBps ?? null,
          balanceMinor: st.balanceMinor,
          payoutTo: terms?.payoutTo ?? null,
        };
      }),
    );
    return { items: items.sort((a, b) => b.balanceMinor - a.balanceMinor), defaultCommissionBps: await this.access.defaultCommission() };
  }

  async setTerms(userId: string, key: string, commissionBps: number | null, payoutTo: string | null, ip: string) {
    const o = parseSellerKey(key);
    if (!o) throw new DomainError(400, "VALIDATION_FAILED", "Unknown seller.");
    const existing = await this.access.terms(o);
    if (existing) await this.db.update(bookSellers).set({ commissionBps, payoutTo }).where(eq(bookSellers.id, existing.id));
    else await this.db.insert(bookSellers).values({ ...o, commissionBps, payoutTo });
    await this.audit.write({ actorType: "USER", actorId: userId, action: "books.seller_terms_changed", entityType: "book_seller", entityId: key, metadata: { commissionBps, payoutTo }, ip });
    return this.sellers();
  }

  /** Record money sent to a seller (the transfer itself happens in Hubtel / the bank). */
  async recordPayout(userId: string, key: string, amountMinor: number, reference: string, ip: string) {
    const o = parseSellerKey(key);
    if (!o) throw new DomainError(400, "VALIDATION_FAILED", "Unknown seller.");
    const st = await this.statementFor(o);
    if (amountMinor > st.balanceMinor) throw new DomainError(409, "PAYOUT_TOO_LARGE", "That's more than the seller is owed.");
    await this.db.insert(bookPayouts).values({ ...o, amountMinor, reference, recordedByUserId: userId });
    await this.audit.write({ actorType: "USER", actorId: userId, action: "books.payout_recorded", entityType: "book_seller", entityId: key, metadata: { amountMinor, reference }, ip });
    return this.statementFor(o);
  }

  async refunds() {
    const rows = await this.db
      .select({ r: bookRefunds, o: bookOrders, title: books.title, f: members.firstName, l: members.lastName })
      .from(bookRefunds)
      .innerJoin(bookOrders, eq(bookOrders.id, bookRefunds.orderId))
      .innerJoin(books, eq(books.id, bookOrders.bookId))
      .innerJoin(members, eq(members.id, bookOrders.memberId))
      .orderBy(sql`case when ${bookRefunds.status} = 'REQUESTED' then 0 else 1 end`, desc(bookRefunds.createdAt))
      .limit(300);
    return {
      items: rows.map((x) => ({
        id: x.r.id,
        orderId: x.o.id,
        book: x.title,
        buyer: `${x.f} ${x.l}`,
        amountMinor: x.o.amountMinor,
        reason: x.r.reason,
        status: x.r.status,
        percentRead: x.r.percentRead,
        paidAt: x.o.paidAt?.toISOString() ?? null,
        requestedAt: x.r.createdAt.toISOString(),
      })),
    };
  }

  private log(p: Principal, action: string, id: string, ip: string, metadata: Record<string, unknown> = {}) {
    return this.audit.write({ actorType: p.kind === "user" ? "USER" : "MEMBER", actorId: p.id, action, entityType: "book", entityId: id, metadata, ip });
  }
}

