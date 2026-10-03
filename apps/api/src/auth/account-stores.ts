import { Inject, Injectable } from "@nestjs/common";
import { members, users } from "@ecclesios/db";
import { eq, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";
import type { AccountRecord, AccountStore, AuthState } from "./core/types";

const isEmail = (s: string) => s.includes("@");

/** members table → /api/auth/login (functionality §2.2). Church memberships are not needed to sign in (D-015). */
@Injectable()
export class MemberAccountStore implements AccountStore {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findByIdentifier(identifier: string) {
    const where = isEmail(identifier)
      ? sql`lower(${members.email}) = lower(${identifier})`
      : eq(members.telephone, identifier);
    const [m] = await this.db.select().from(members).where(where).limit(1);
    return m ? memberRecord(m) : null;
  }

  async findById(id: string) {
    const [m] = await this.db.select().from(members).where(eq(members.id, id)).limit(1);
    return m ? memberRecord(m) : null;
  }

  async update(id: string, patch: Partial<AuthState>) {
    await this.db.update(members).set(patch).where(eq(members.id, id));
  }
}

function memberRecord(m: typeof members.$inferSelect): AccountRecord {
  return {
    ...pickAuth(m),
    id: m.id,
    kind: "member",
    active: m.isActive && !m.isDeceased,
    email: m.email,
    telephone: m.telephone,
    claims: { kind: "member" },
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
