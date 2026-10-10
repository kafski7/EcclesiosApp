import { Inject, Injectable } from "@nestjs/common";
import { follows, members, memberships, roles } from "@ecclesios/db";
import type { ChurchOption, RegisterRequestSchema, RegisterResponse } from "@ecclesios/shared";
import { eq, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { ArgonHasher } from "../auth/argon-hasher";
import { RATE_LIMIT_STORE } from "../auth/auth.service";
import { DomainError } from "../auth/core/errors";
import { RateLimiter, type RateLimitStore } from "../auth/core/rate-limit";
import { DB, type Database } from "../db/db.module";
import { ChurchesService } from "../memberships/churches.service";

type RegisterInput = z.output<typeof RegisterRequestSchema>;

const REGISTER_LIMIT = { limit: 10, windowMs: 60 * 60_000 }; // per IP per hour

/**
 * Self-registration (functionality §2.4, D-014/D-015): creates the PERSON — who can sign in
 * straight away and use the whole social platform — plus a PENDING home membership request to
 * the chosen parish or outstation. Its Administrators (and the parish, for an outstation) approve.
 */
@Injectable()
export class RegistrationService {
  private readonly limiter: RateLimiter;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly hasher: ArgonHasher,
    private readonly audit: AuditService,
    private readonly churches: ChurchesService,
    @Inject(RATE_LIMIT_STORE) store: RateLimitStore,
  ) {
    this.limiter = new RateLimiter(store);
  }

  searchChurches(q: string): Promise<ChurchOption[]> {
    return this.churches.search(q);
  }

  async register(input: RegisterInput, ip: string): Promise<RegisterResponse> {
    await this.limiter.consume([{ key: `register:ip:${ip}`, ...REGISTER_LIMIT }]);

    const church = await this.churches.findJoinable(input.churchId);
    if (!church)
      throw new DomainError(
        400,
        "CHURCH_NOT_FOUND",
        "Choose your parish or outstation from the list.",
      );

    // D-011: say plainly that the email/phone is taken — sign-up is rate-limited per IP.
    const taken = await this.db
      .select({ id: members.id, passwordHash: members.passwordHash })
      .from(members)
      .where(
        or(
          input.email ? sql`lower(${members.email}) = ${input.email.toLowerCase()}` : undefined,
          input.telephone ? eq(members.telephone, input.telephone) : undefined,
        ),
      )
      .limit(1);
    // D-039: their church already added them — they claim that record instead of creating a second one.
    if (taken.length && !taken[0]!.passwordHash)
      throw new DomainError(
        409,
        "CLAIM_ACCOUNT",
        "Your church has already added you to Ecclesios. Use “Claim your account” on the sign-in page to set your password.",
      );
    if (taken.length) throw accountExists();

    const [role] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, "PARISHIONER"))
      .limit(1);
    if (!role) throw new DomainError(500, "SETUP_INCOMPLETE", "Registration is not available yet.");

    const passwordHash = await this.hasher.hash(input.password);
    let memberId: string;
    try {
      memberId = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(members)
          .values({
            firstName: input.firstName,
            lastName: input.lastName,
            otherNames: input.otherNames ?? null,
            email: input.email ?? null,
            telephone: input.telephone ?? null,
            gender: input.gender ?? null,
            dateOfBirth: input.dateOfBirth ?? null,
            passwordHash,
            firstLogin: new Date(), // they chose their own password, so no "set password" step later
          })
          .returning({ id: members.id });
        const id = row!.id;
        await tx.insert(memberships).values({
          memberId: id,
          groupId: church.id,
          roleId: role.id,
          status: "PENDING",
          isHome: true,
        });
        await tx.insert(follows).values({ memberId: id, groupId: church.id }).onConflictDoNothing();
        return id;
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw accountExists(); // lost a race with an identical sign-up
      throw err;
    }

    await this.churches.notifyApprovers(
      church,
      `${input.firstName} ${input.lastName} asked to join ${church.name}`,
      `/admin/members/requests?church=${church.id}&highlight=${memberId}`,
    );
    await this.audit.write({
      actorType: "MEMBER",
      actorId: memberId,
      groupId: church.id,
      action: "member.registered",
      entityType: "member",
      entityId: memberId,
      metadata: { channel: input.email ? "email" : "telephone", level: church.level },
      ip,
    });
    return {
      status: "REGISTERED",
      membership: {
        status: "PENDING",
        church: { id: church.id, name: church.name, level: church.level },
      },
    };
  }
}

const accountExists = () =>
  new DomainError(
    409,
    "ACCOUNT_EXISTS",
    "An account with this email or phone number already exists. Try signing in instead.",
  );

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
