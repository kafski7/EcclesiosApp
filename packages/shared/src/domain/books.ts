/**
 * Books (functionality §3.10, D-036): e-books sold or given free on Ecclesios.
 * Pure rules: listing workflow, prices and the commission split, orders, refunds, payouts.
 * Money is always in MINOR units (pesewas for GHS) — integers, never floats.
 */
import type { PlatformPrivilege, PlatformRole } from "./levels.js";

export const BOOK_FORMATS = ["EPUB", "PDF"] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];
export const BOOK_FILE_TYPES: Record<BookFormat, string> = { EPUB: "application/epub+zip", PDF: "application/pdf" };
export const BOOK_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BOOK_BYTES = 100 * 1024 * 1024;
export const MAX_BOOK_COVER_BYTES = 5 * 1024 * 1024;

export const BOOK_CATEGORIES = [
  "SPIRITUALITY",
  "PRAYER",
  "THEOLOGY",
  "SCRIPTURE",
  "CATECHESIS",
  "SAINTS",
  "CHURCH_HISTORY",
  "FAMILY",
  "YOUTH",
  "CHILDREN",
  "FICTION",
  "CLASSICS",
] as const;
export type BookCategory = (typeof BOOK_CATEGORIES)[number];
export const BOOK_CATEGORY_LABEL: Record<BookCategory, string> = {
  SPIRITUALITY: "Spirituality",
  PRAYER: "Prayer & devotion",
  THEOLOGY: "Theology",
  SCRIPTURE: "Scripture",
  CATECHESIS: "Catechesis",
  SAINTS: "Lives of the saints",
  CHURCH_HISTORY: "Church history",
  FAMILY: "Marriage & family",
  YOUTH: "Youth",
  CHILDREN: "Children",
  FICTION: "Fiction",
  CLASSICS: "Catholic classics",
};

// ------------------------------------------------------------------ listing workflow

/**
 * DRAFT → submit → PENDING → approve → PUBLISHED | reject → REJECTED.
 * PUBLISHED → unlist → UNLISTED (seller or Super-Admin; owners keep reading).
 * REJECTED / UNLISTED → submit → PENDING. Content can change only in DRAFT, REJECTED or UNLISTED;
 * on a PUBLISHED book only the price and the preview can change (D-036).
 */
export const BOOK_STATUSES = ["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "UNLISTED"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];
export const BOOK_ACTIONS = ["submit", "approve", "reject", "unlist"] as const;
export type BookAction = (typeof BOOK_ACTIONS)[number];

const BOOK_TRANSITIONS: Record<BookStatus, Partial<Record<BookAction, BookStatus>>> = {
  DRAFT: { submit: "PENDING" },
  PENDING: { approve: "PUBLISHED", reject: "REJECTED" },
  PUBLISHED: { unlist: "UNLISTED" },
  REJECTED: { submit: "PENDING" },
  UNLISTED: { submit: "PENDING" },
};

export function nextBookStatus(from: BookStatus, action: BookAction): BookStatus | null {
  return BOOK_TRANSITIONS[from][action] ?? null;
}

export const canEditBookContent = (s: BookStatus) => s === "DRAFT" || s === "REJECTED" || s === "UNLISTED";

/** Lowest price for a paid book: GHS 1.00. 0 = free. */
export const MIN_PAID_PRICE_MINOR = 100;
export const MAX_PRICE_MINOR = 1_000_000;

export interface BookForSubmit {
  title: string;
  description: string;
  fileKey: string | null;
  priceMinor: number;
  rightsConfirmed: boolean;
}

/** What blocks submitting a book for review. */
export function bookProblems(b: BookForSubmit): string[] {
  const p: string[] = [];
  if (b.title.trim().length < 2) p.push("Add a title.");
  if (b.description.trim().length < 30) p.push("Write a description of at least 30 characters.");
  if (!b.fileKey) p.push("Upload the book file (EPUB or PDF).");
  if (b.priceMinor !== 0 && b.priceMinor < MIN_PAID_PRICE_MINOR) p.push("Paid books cost at least GHS 1.00.");
  if (!b.rightsConfirmed) p.push("Confirm that you hold the rights to publish this book.");
  return p;
}

// ------------------------------------------------------------------ who may sell

export type BookActor =
  | { kind: "user"; id: string; role: PlatformRole; privileges: readonly PlatformPrivilege[] }
  | { kind: "member"; id: string; privileges: readonly PlatformPrivilege[] };

export interface BookOwner {
  sellerUserId: string | null;
  sellerMemberId: string | null;
}

export const isBookAdmin = (a: BookActor) => a.kind === "user" && a.role === "SUPER_ADMIN";
export const canSellBooks = (a: BookActor) => isBookAdmin(a) || a.privileges.includes("SELL_BOOKS");

/** Sellers manage their own books while they hold SELL_BOOKS; Super-Admins manage all. */
export function canManageBook(a: BookActor, b: BookOwner): boolean {
  if (isBookAdmin(a)) return true;
  if (!a.privileges.includes("SELL_BOOKS")) return false;
  return a.kind === "user" ? b.sellerUserId === a.id : b.sellerMemberId === a.id;
}

// ------------------------------------------------------------------ money

/** Commission in basis points (2000 = 20 %). Configurable platform-wide, optionally per seller. */
export const MAX_COMMISSION_BPS = 5000;
export const DEFAULT_COMMISSION_BPS = 2000;

/**
 * Split a sale. The platform's share is rounded to the nearest pesewa; the author gets the rest,
 * so the two always add up to the price. Payment-gateway fees come out of the platform's share.
 */
export function splitSale(priceMinor: number, commissionBps: number) {
  if (!Number.isInteger(priceMinor) || priceMinor < 0) throw new Error("price must be whole pesewas");
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > MAX_COMMISSION_BPS)
    throw new Error("commission out of range");
  const platformMinor = Math.round((priceMinor * commissionBps) / 10_000);
  return { platformMinor, authorMinor: priceMinor - platformMinor };
}

/** "GH₵ 25.00", "Free". */
export function formatPrice(minor: number, currency = "GHS"): string {
  if (minor === 0) return "Free";
  const symbol = currency === "GHS" ? "GH₵" : `${currency} `;
  return `${symbol} ${(minor / 100).toFixed(2)}`;
}

/** "25", "25.5", "25.50" → pesewas; null if not a valid amount. */
export function parsePrice(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  const [cedis, pes = ""] = s.split(".");
  return Number(cedis) * 100 + Number(pes.padEnd(2, "0"));
}

// ------------------------------------------------------------------ orders

/** PENDING → PAID | FAILED | CANCELLED (abandoned after ORDER_TTL_MINUTES); PAID → REFUNDED. */
export const ORDER_STATUSES = ["PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_TTL_MINUTES = 60;

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PAID", "FAILED", "CANCELLED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};
export const canMoveOrder = (from: OrderStatus, to: OrderStatus) => ORDER_TRANSITIONS[from].includes(to);

/** A pending order older than the TTL is treated as abandoned. */
export const isOrderExpired = (o: { status: OrderStatus; createdAt: Date }, now: Date) =>
  o.status === "PENDING" && now.getTime() - o.createdAt.getTime() > ORDER_TTL_MINUTES * 60_000;

// ------------------------------------------------------------------ refunds

/**
 * Self-service refunds (D-036): within REFUND_WINDOW_DAYS of payment, if less than
 * REFUND_MAX_PERCENT_READ of the book has been read, and only once per book per person.
 * A Super-Admin approves each request; they may also refund any order (e.g. a broken file).
 */
export const REFUND_WINDOW_DAYS = 7;
export const REFUND_MAX_PERCENT_READ = 10;
export const REFUND_STATUSES = ["REQUESTED", "APPROVED", "DECLINED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export type RefundBlocker = "NOT_PAID" | "WINDOW_CLOSED" | "READ_TOO_MUCH" | "ALREADY_REFUNDED" | "ALREADY_REQUESTED";

export function refundBlocker(o: {
  status: OrderStatus;
  paidAt: Date | null;
  percentRead: number;
  now: Date;
  /** This person was refunded for this book before. */
  refundedBefore: boolean;
  /** A request for this order is waiting. */
  pendingRequest: boolean;
}): RefundBlocker | null {
  if (o.status !== "PAID" || !o.paidAt) return "NOT_PAID";
  if (o.pendingRequest) return "ALREADY_REQUESTED";
  if (o.refundedBefore) return "ALREADY_REFUNDED";
  if (o.now.getTime() - o.paidAt.getTime() > REFUND_WINDOW_DAYS * 86_400_000) return "WINDOW_CLOSED";
  if (o.percentRead >= REFUND_MAX_PERCENT_READ) return "READ_TOO_MUCH";
  return null;
}

export const REFUND_MESSAGES: Record<RefundBlocker, string> = {
  NOT_PAID: "Only paid orders can be refunded.",
  WINDOW_CLOSED: `Refunds are available for ${REFUND_WINDOW_DAYS} days after purchase.`,
  READ_TOO_MUCH: `Refunds are available until you have read ${REFUND_MAX_PERCENT_READ}% of the book.`,
  ALREADY_REFUNDED: "You've already been refunded for this book once.",
  ALREADY_REQUESTED: "Your refund request is being reviewed.",
};

// ------------------------------------------------------------------ seller balance

export interface LedgerTotals {
  /** Author share of PAID and REFUNDED orders (gross earned). */
  earnedMinor: number;
  /** Author share of REFUNDED orders. */
  refundedMinor: number;
  /** Payouts recorded. */
  paidOutMinor: number;
}

/** What the platform still owes the seller. Never negative in the UI; a negative value is a debt. */
export const sellerBalance = (t: LedgerTotals) => t.earnedMinor - t.refundedMinor - t.paidOutMinor;
