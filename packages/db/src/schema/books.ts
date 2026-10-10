import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_common";
import {
  bookCategoryEnum,
  bookFormatEnum,
  bookStatusEnum,
  orderStatusEnum,
  refundStatusEnum,
} from "./enums";
import { members, users } from "./identity";

/**
 * Books (functionality §3.10, D-036). E-books listed by sellers holding SELL_BOOKS (or Super-Admins),
 * reviewed before publishing, sold through Hubtel. Money in pesewas (integers).
 */
export const books = pgTable(
  "books",
  {
    id: id(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    subtitle: varchar("subtitle", { length: 200 }),
    authorName: varchar("author_name", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    aboutAuthor: text("about_author").notNull().default(""),
    category: bookCategoryEnum("category").notNull(),
    language: varchar("language", { length: 10 }).notNull().default("en"),
    pages: smallint("pages"),
    isbn: varchar("isbn", { length: 20 }),
    approbation: varchar("approbation", { length: 300 }),
    format: bookFormatEnum("format"),
    fileKey: text("file_key"),
    fileBytes: integer("file_bytes"),
    previewKey: text("preview_key"),
    coverKey: text("cover_key"),
    priceMinor: integer("price_minor").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    rightsConfirmed: boolean("rights_confirmed").notNull().default(false),
    sellerUserId: uuid("seller_user_id").references(() => users.id, { onDelete: "restrict" }),
    sellerMemberId: uuid("seller_member_id").references(() => members.id, { onDelete: "restrict" }),
    status: bookStatusEnum("status").notNull().default("DRAFT"),
    reviewNote: text("review_note"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    check(
      "books_one_seller_chk",
      sql`(${t.sellerUserId} IS NULL) <> (${t.sellerMemberId} IS NULL)`,
    ),
    check("books_price_chk", sql`${t.priceMinor} = 0 OR ${t.priceMinor} >= 100`),
    check(
      "books_live_chk",
      sql`${t.status} <> 'PUBLISHED' OR (${t.fileKey} IS NOT NULL AND ${t.publishedAt} IS NOT NULL)`,
    ),
    index("books_shelf_idx").on(t.status, t.category, t.publishedAt),
    index("books_seller_user_idx").on(t.sellerUserId),
    index("books_seller_member_idx").on(t.sellerMemberId),
    index("books_fts_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.title} || ' ' || coalesce(${t.subtitle}, '') || ' ' || ${t.authorName} || ' ' || ${t.description})`,
    ),
  ],
);

/** A purchase attempt. Commission and split are frozen at checkout. */
export const bookOrders = pgTable(
  "book_orders",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    commissionBps: integer("commission_bps").notNull(),
    platformMinor: integer("platform_minor").notNull(),
    authorMinor: integer("author_minor").notNull(),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    gateway: varchar("gateway", { length: 20 }).notNull(),
    /** Our reference sent to the gateway (unique, ≤ 32 chars). */
    clientReference: varchar("client_reference", { length: 40 }).notNull().unique(),
    gatewayRef: varchar("gateway_ref", { length: 120 }),
    checkoutUrl: text("checkout_url"),
    gatewayPayload: jsonb("gateway_payload"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    check("book_orders_split_chk", sql`${t.platformMinor} + ${t.authorMinor} = ${t.amountMinor}`),
    index("book_orders_member_idx").on(t.memberId, t.bookId),
    index("book_orders_book_idx").on(t.bookId, t.status),
  ],
);

/** What a member can read: free books they added and books they bought. */
export const libraryItems = pgTable(
  "library_items",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => bookOrders.id, { onDelete: "set null" }),
    locator: varchar("locator", { length: 500 }),
    percent: smallint("percent").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.bookId] })],
);

export const bookRefunds = pgTable(
  "book_refunds",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => bookOrders.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: refundStatusEnum("status").notNull().default("REQUESTED"),
    percentRead: smallint("percent_read").notNull().default(0),
    note: text("note"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("book_refunds_status_idx").on(t.status, t.createdAt),
    uniqueIndex("book_refunds_open_uq")
      .on(t.orderId)
      .where(sql`${t.status} = 'REQUESTED'`),
  ],
);

/** Per-seller terms: commission override and where payouts go. */
export const bookSellers = pgTable(
  "book_sellers",
  {
    id: id(),
    sellerUserId: uuid("seller_user_id").references(() => users.id, { onDelete: "cascade" }),
    sellerMemberId: uuid("seller_member_id").references(() => members.id, { onDelete: "cascade" }),
    commissionBps: integer("commission_bps"),
    payoutTo: varchar("payout_to", { length: 200 }),
    ...timestamps(),
  },
  (t) => [
    check(
      "book_sellers_one_chk",
      sql`(${t.sellerUserId} IS NULL) <> (${t.sellerMemberId} IS NULL)`,
    ),
    uniqueIndex("book_sellers_user_uq").on(t.sellerUserId),
    uniqueIndex("book_sellers_member_uq").on(t.sellerMemberId),
  ],
);

/** Money sent to a seller, recorded by a Super-Admin with the transfer reference. */
export const bookPayouts = pgTable("book_payouts", {
  id: id(),
  sellerUserId: uuid("seller_user_id").references(() => users.id, { onDelete: "restrict" }),
  sellerMemberId: uuid("seller_member_id").references(() => members.id, { onDelete: "restrict" }),
  amountMinor: integer("amount_minor").notNull(),
  reference: varchar("reference", { length: 120 }).notNull(),
  recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Platform-wide settings editable in the console (key → JSON). */
export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
