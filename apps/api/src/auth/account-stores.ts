import { Inject, Injectable } from "@nestjs/common";
import { groups, members, roles, users } from "@ecclesios/db";
import { eq, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";
import type { AccountRecord, AccountStore, AuthState } from "./core/types";

const isEmail = (s: string) => s.includes("@");

/** members table → /api/auth/login (functionality §2.2). */
@Injectable()
export class MemberAccountStore implements AccountStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  private select() {
    return this.db
      .select({ m: members, role: roles.code, level: groups.level })
      .from(members)
      .innerJoin(roles, eq(members.roleId, roles.id))
      .innerJoin(groups, eq(members.groupId, groups.id));
  }

  async findByIdentifier(identifier: string) {
    const where = isEmail(identifier)
      ? sql`lower(${members.email}) = lower(${identifier})`
      : eq(members.telephone, identifier);
    const [row] = await this.select().where(where).limit(1);
    return row ? toRecord(row) : null;
  }

  async findById(id: string) {
    const [row] = await this.select().where(eq(members.id, id)).limit(1);
    return row ? toRecord(row) : null;
  }

  async update(id: string, patch: Partial<AuthState>) {
    await this.db.update(members).set(patch).where(eq(members.id, id));
  }
}

type MemberRow = { m: typeof members.$inferSelect; role: (typeof roles.$inferSelect)["code"]; level: (typeof groups.$inferSelect)["level"] };

function toRecord({ m, role, level }: MemberRow): AccountRecord {
  return {
    ...pickAuth(m),
    id: m.id,
    kind: "member",
    active: m.status === "ACTIVE" && !m.isDeceased,
    email: m.email,
    telephone: m.telephone,
    claims: { kind: "member", role, groupId: m.groupId, hierarchyLevel: level },
  };
}

/** users table → /api/auth/admin-login (functionality §2.1). */
@Injectable()
export class UserAccountStore implements AccountStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findByIdentifier(identifier: string) {
    const where = isEmail(identifier)
      ? sql`lower(${users.email}) = lower(${identifier})`
      : eq(users.telephone, identifier);
    const [u] = await this.db.select().from(users).where(where).limit(1);
    return u ? userRecord(u) : null;
  }

  async findById(id: string) {
    const [u] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return u ? userRecord(u) : null;
  }

  async update(id: string, patch: Partial<AuthState>) {
    // users.password_hash is NOT NULL — never clear it.
    const { passwordHash, ...rest } = patch;
    await this.db
      .update(users)
      .set({ ...rest, ...(passwordHash ? { passwordHash } : {}) })
      .where(eq(users.id, id));
  }
}

function userRecord(u: typeof users.$inferSelect): AccountRecord {
  return {
    ...pickAuth(u),
    id: u.id,
    kind: "user",
    active: u.isActive,
    email: u.email,
    telephone: u.telephone,
    claims: { kind: "user", role: u.platformRole },
  };
}

function pickAuth(r: AuthState): AuthState {
  return {
    otpHash: r.otpHash,
    otpExpiresAt: r.otpExpiresAt,
    otpAttempts: r.otpAttempts,
    tempTokenHash: r.tempTokenHash,
    tempTokenExpiresAt: r.tempTokenExpiresAt,
    refreshTokenHash: r.refreshTokenHash,
    refreshTokenExpiresAt: r.refreshTokenExpiresAt,
    passwordHash: r.passwordHash,
    firstLogin: r.firstLogin,
    lastLoginAt: r.lastLoginAt,
    failedLoginCount: r.failedLoginCount,
    lockedUntil: r.lockedUntil,
  };
}
