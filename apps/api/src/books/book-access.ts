import { Inject, Injectable } from "@nestjs/common";
import {
  bookSellers,
  memberPrivileges,
  members,
  platformSettings,
  userPrivileges,
  users,
} from "@ecclesios/db";
import type { Principal } from "@ecclesios/shared";
import { DEFAULT_COMMISSION_BPS, type BookActor, type BookOwner } from "@ecclesios/shared/domain";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";

export const COMMISSION_KEY = "books.commissionBps";

/** Who is acting, seller names, commission lookups (D-036). */
@Injectable()
export class BookAccess {
  constructor(@Inject(DB) private readonly db: Database) {}

  async actor(p: Principal): Promise<BookActor> {
    if (p.kind === "user") {
      const rows = await this.db
        .select({ privilege: userPrivileges.privilege })
        .from(userPrivileges)
        .where(eq(userPrivileges.userId, p.id));
      return { kind: "user", id: p.id, role: p.role, privileges: rows.map((r) => r.privilege) };
    }
    const rows = await this.db
      .select({ privilege: memberPrivileges.privilege })
      .from(memberPrivileges)
      .where(eq(memberPrivileges.memberId, p.id));
    return { kind: "member", id: p.id, privileges: rows.map((r) => r.privilege) };
  }

  async defaultCommission(): Promise<number> {
    const [row] = await this.db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, COMMISSION_KEY))
      .limit(1);
    return typeof row?.value === "number" ? row.value : DEFAULT_COMMISSION_BPS;
  }

  /** Seller's own rate if set, else the platform default. */
  async commissionFor(owner: BookOwner): Promise<number> {
    const terms = await this.terms(owner);
    return terms?.commissionBps ?? (await this.defaultCommission());
  }

  async terms(owner: BookOwner) {
    const [row] = await this.db
      .select()
      .from(bookSellers)
      .where(
        owner.sellerUserId
          ? eq(bookSellers.sellerUserId, owner.sellerUserId)
          : eq(bookSellers.sellerMemberId, owner.sellerMemberId!),
      )
      .limit(1);
    return row ?? null;
  }

  async sellerName(owner: BookOwner): Promise<string> {
    if (owner.sellerUserId) {
      const [u] = await this.db
        .select({ n: users.fullName })
        .from(users)
        .where(eq(users.id, owner.sellerUserId))
        .limit(1);
      return u?.n ?? "Seller";
    }
    const [m] = await this.db
      .select({ f: members.firstName, l: members.lastName })
      .from(members)
      .where(eq(members.id, owner.sellerMemberId!))
      .limit(1);
    return m ? `${m.f} ${m.l}` : "Seller";
  }
}

/** "user:<id>" / "member:<id>" ⇄ owner. */
export const sellerKey = (o: BookOwner) =>
  o.sellerUserId ? `user:${o.sellerUserId}` : `member:${o.sellerMemberId}`;
export function parseSellerKey(k: string): BookOwner | null {
  const m = /^(user|member):([0-9a-f-]{36})$/i.exec(k);
  if (!m) return null;
  return m[1] === "user"
    ? { sellerUserId: m[2]!, sellerMemberId: null }
    : { sellerUserId: null, sellerMemberId: m[2]! };
}
