import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { pendingCollections } from "@ecclesios/db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { ENV, type Env } from "../config/env";
import { DB, type Database } from "../db/db.module";

/**
 * The external accounting service (blueprint §8, D-041). Ecclesios never keeps a ledger: approved
 * collections are posted here, and the finance figures shown in the CMS come back from here.
 */
export interface PostedCollection {
  id: string;
  groupId: string;
  parishGroupId: string;
  amount: string;
  currencyCode: string;
  categoryRef: string;
  collectedOn: string;
  note: string | null;
}

export interface AccountingTotals {
  total: string;
  byCategory: { categoryRef: string; total: string }[];
}

export interface AccountingGateway {
  readonly name: string | null;
  readonly connected: boolean;
  /** Returns the accounting service's transaction id. Throws on failure. */
  post(c: PostedCollection): Promise<string>;
  /** Totals since `from` (YYYY-MM-DD) for the given churches. */
  totals(groupIds: string[], from: string): Promise<AccountingTotals>;
}

export const ACCOUNTING = Symbol("ACCOUNTING_GATEWAY");

/** Marker in a collection's note that makes the dev stand-in fail, so the retry path can be tried. */
export const DEV_FAIL_MARKER = "[fail-sync]";

/**
 * Development / e2e stand-in. It plays the external service: posting returns an id, and the totals
 * it reports are those it has "received" (synced collections). Refused in production (env check).
 */
@Injectable()
export class DevAccountingGateway implements AccountingGateway {
  readonly name = "Development stand-in";
  readonly connected = true;
  constructor(@Inject(DB) private readonly db: Database) {}

  async post(c: PostedCollection): Promise<string> {
    if (c.note?.includes(DEV_FAIL_MARKER))
      throw new Error("Accounting service unavailable (dev stand-in, simulated)");
    return `DEV-${randomBytes(6).toString("hex").toUpperCase()}`;
  }

  async totals(groupIds: string[], from: string): Promise<AccountingTotals> {
    if (!groupIds.length) return { total: "0.00", byCategory: [] };
    const where = and(
      inArray(pendingCollections.groupId, groupIds),
      eq(pendingCollections.status, "SYNCED"),
      gte(pendingCollections.collectedOn, from),
    );
    const [rows, [all]] = await Promise.all([
      this.db
        .select({
          categoryRef: pendingCollections.categoryRef,
          total: sql<string>`sum(${pendingCollections.amount})::numeric(14,2)::text`,
        })
        .from(pendingCollections)
        .where(where)
        .groupBy(pendingCollections.categoryRef),
      this.db
        .select({
          total: sql<string>`coalesce(sum(${pendingCollections.amount}), 0)::numeric(14,2)::text`,
        })
        .from(pendingCollections)
        .where(where),
    ]);
    return {
      total: all?.total ?? "0.00",
      byCategory: rows.sort((a, b) => Number(b.total) - Number(a.total)),
    };
  }
}

/** No accounting service connected: approvals wait in APPROVED until one is. */
export class NoAccountingGateway implements AccountingGateway {
  readonly name = null;
  readonly connected = false;
  async post(): Promise<string> {
    throw new Error("No accounting service is connected.");
  }
  async totals(): Promise<AccountingTotals> {
    return { total: "0.00", byCategory: [] };
  }
}

export const accountingProvider = {
  provide: ACCOUNTING,
  inject: [ENV, DB],
  useFactory: (env: Env, db: Database): AccountingGateway =>
    env.ACCOUNTING_PROVIDER === "dev" ? new DevAccountingGateway(db) : new NoAccountingGateway(),
};
