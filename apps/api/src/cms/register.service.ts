import { Inject, Injectable } from "@nestjs/common";
import { groups, members, memberships, roles, societies, societyMembers } from "@ecclesios/db";
import type {
  AddMemberSchema,
  BirthdayList,
  MemberProfile,
  PersonDetailsSchema,
  RegisterQuerySchema,
} from "@ecclesios/shared";
import {
  csvRow,
  hasCapability,
  isPhone,
  normalisePhone,
  leavesNoAdministrator,
  recordProblems,
  toIsoDate,
  upcomingBirthdays,
  type MemberRole,
} from "@ecclesios/shared/domain";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { DomainError } from "../auth/core/errors";
import { DB, type Database } from "../db/db.module";
import { MediaService } from "../media/media.service";
import { ScopeService } from "../rbac/scope.service";

type Query = z.output<typeof RegisterQuerySchema>;
type Details = z.output<typeof PersonDetailsSchema>;
type Add = z.output<typeof AddMemberSchema>;

const PAGE = 50;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const notFound = () =>
  new DomainError(404, "MEMBER_NOT_FOUND", "This person isn't in this church's register.");
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Church register (functionality §4.2–4.3, D-037). Routes are already scope-checked for the
 * church in the URL; rules that depend on the PERSON (home church edits, last administrator)
 * are checked here.
 */
@Injectable()
export class RegisterService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly scopes: ScopeService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ which churches

  /** The church, plus — for a parish asking for them — its outstations. */
  private async churchIds(groupId: string, withOutstations: boolean) {
    if (!withOutstations) return [groupId];
    const [g] = await this.db
      .select({ level: groups.level })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    if (g?.level !== "PARISH") return [groupId];
    const kids = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.parentGroupId, groupId), eq(groups.level, "OUTSTATION")));
    return [groupId, ...kids.map((k) => k.id)];
  }

  // ------------------------------------------------------------------ list

  private filters(ids: string[], q: Query): SQL[] {
    const w: SQL[] = [inArray(memberships.groupId, ids)];
    w.push(q.status === "LEFT" ? eq(memberships.status, "LEFT") : eq(memberships.status, "ACTIVE"));
    if (q.role) w.push(eq(roles.code, q.role));
    if (q.missing === "baptism") w.push(eq(members.isBaptised, false));
    if (q.missing === "communion") w.push(eq(members.isCommunicant, false));
    if (q.missing === "confirmation") w.push(eq(members.isConfirmed, false));
    if (q.deceased === "only") w.push(eq(members.isDeceased, true));
    else if (q.deceased !== "include") w.push(eq(members.isDeceased, false));
    const term = q.q.trim();
    if (term) {
      const like = `%${escapeLike(term)}%`;
      w.push(
        or(
          ilike(members.firstName, like),
          ilike(members.lastName, like),
          ilike(members.otherNames, like),
          ilike(members.email, like),
          ilike(members.telephone, like),
          // "024 123 4567" finds +233241234567 (D-040)
          isPhone(term) ? eq(members.telephone, normalisePhone(term)) : undefined,
          sql`(${members.firstName} || ' ' || ${members.lastName}) ilike ${like}`,
        )!,
      );
    }
    return w;
  }

  private base() {
    return this.db
      .select({
        m: memberships,
        p: members,
        role: roles.code,
        church: { id: groups.id, name: groups.name },
      })
      .from(memberships)
      .innerJoin(members, eq(members.id, memberships.memberId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .innerJoin(groups, eq(groups.id, memberships.groupId));
  }

  async list(groupId: string, q: Query) {
    const ids = await this.churchIds(groupId, q.outstations === "1");
    const where = and(...this.filters(ids, q));
    const rows = await this.base()
      .where(where)
      .orderBy(asc(members.lastName), asc(members.firstName))
      .limit(PAGE + 1)
      .offset((q.page - 1) * PAGE);
    const counted = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(memberships)
      .innerJoin(members, eq(members.id, memberships.memberId))
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(where);
    const total = counted[0]?.total ?? 0;
    const items = await Promise.all(rows.slice(0, PAGE).map((r) => this.row(r)));
    return { items, page: q.page, hasMore: rows.length > PAGE, total };
  }

  private async row(r: {
    m: typeof memberships.$inferSelect;
    p: typeof members.$inferSelect;
    role: MemberRole;
    church: { id: string; name: string };
  }) {
    return {
      personId: r.p.id,
      membershipId: r.m.id,
      firstName: r.p.firstName,
      otherNames: r.p.otherNames,
      lastName: r.p.lastName,
      gender: r.p.gender,
      telephone: r.p.telephone,
      email: r.p.email,
      photoUrl: r.p.photoKey ? await this.media.presignGet(r.p.photoKey) : null,
      role: r.role,
      status: r.m.status,
      isHome: r.m.isHome,
      church: r.church,
      isBaptised: r.p.isBaptised,
      isCommunicant: r.p.isCommunicant,
      isConfirmed: r.p.isConfirmed,
      isDeceased: r.p.isDeceased,
      hasAccount: Boolean(r.p.passwordHash),
      joinedAt: (r.m.decidedAt ?? r.m.requestedAt).toISOString(),
    };
  }

  /** CSV of the current filter (no paging). Opened in a spreadsheet. */
  async csv(groupId: string, q: Query, actorId: string, ip: string) {
    const ids = await this.churchIds(groupId, q.outstations === "1");
    const rows = await this.base()
      .where(and(...this.filters(ids, q)))
      .orderBy(asc(members.lastName), asc(members.firstName))
      .limit(20_000);
    const head = [
      "Last name",
      "First name",
      "Other names",
      "Gender",
      "Date of birth",
      "Telephone",
      "Email",
      "Address",
      "Occupation",
      "Church",
      "Role",
      "Baptised",
      "Baptism date",
      "Baptism place",
      "First Communion",
      "First Communion date",
      "Confirmed",
      "Confirmation date",
      "Deceased",
      "Date of death",
    ];
    const yes = (b: boolean) => (b ? "Yes" : "No");
    const lines = [
      csvRow(head),
      ...rows.map(({ p, role, church }) =>
        csvRow([
          p.lastName,
          p.firstName,
          p.otherNames,
          p.gender,
          p.dateOfBirth,
          p.telephone,
          p.email,
          p.address,
          p.occupation,
          church.name,
          role,
          yes(p.isBaptised),
          p.baptismDate,
          p.baptismPlace,
          yes(p.isCommunicant),
          p.firstCommunionDate,
          yes(p.isConfirmed),
          p.confirmationDate,
          yes(p.isDeceased),
          p.deceasedOn,
        ]),
      ),
    ];
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "register.exported",
      entityType: "group",
      entityId: groupId,
      metadata: { rows: rows.length },
      ip,
    });
    return "\uFEFF" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8
  }

  // ------------------------------------------------------------------ profile

  /** The membership that ties this person to the church in the URL — that church only. */
  private async here(groupId: string, personId: string) {
    const [row] = await this.db
      .select({ m: memberships, role: roles.code })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.memberId, personId),
          eq(memberships.groupId, groupId),
          inArray(memberships.status, ["ACTIVE", "LEFT"]),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** D-016: details and sacramental record are edited by the home church's staff, or its parish. */
  private async canEditPerson(actorId: string, personId: string) {
    const [home] = await this.db
      .select({ groupId: memberships.groupId })
      .from(memberships)
      .where(and(eq(memberships.memberId, personId), eq(memberships.isHome, true)))
      .limit(1);
    if (!home) return false;
    const access = await this.scopes.resolve(actorId, home.groupId);
    return hasCapability(access, "write") || hasCapability(access, "approve");
  }

  /** Administrator of this exact church (roles and removals). */
  private async isAdministratorOf(actorId: string, groupId: string) {
    const [r] = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(
        and(
          eq(memberships.memberId, actorId),
          eq(memberships.groupId, groupId),
          eq(memberships.status, "ACTIVE"),
          eq(roles.code, "ADMINISTRATOR"),
        ),
      )
      .limit(1);
    return Boolean(r);
  }

  async profile(actorId: string, groupId: string, personId: string): Promise<MemberProfile> {
    const here = await this.here(groupId, personId);
    if (!here) throw notFound();
    const [p] = await this.db.select().from(members).where(eq(members.id, personId)).limit(1);
    if (!p) throw notFound();
    const all = await this.db
      .select({
        m: memberships,
        role: roles.code,
        church: { id: groups.id, name: groups.name, level: groups.level },
      })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .where(
        and(
          eq(memberships.memberId, personId),
          inArray(memberships.status, ["ACTIVE", "PENDING", "LEFT"]),
        ),
      )
      .orderBy(desc(memberships.isHome), asc(groups.name));
    const soc = await this.db
      .select({
        id: societies.id,
        name: societies.name,
        isCommittee: societies.isCommittee,
        position: societyMembers.position,
      })
      .from(societyMembers)
      .innerJoin(societies, eq(societies.id, societyMembers.societyId))
      .where(and(eq(societyMembers.memberId, personId), eq(societies.groupId, here.m.groupId)))
      .orderBy(asc(societies.name));
    const [edit, admin] = await Promise.all([
      this.canEditPerson(actorId, personId),
      this.isAdministratorOf(actorId, here.m.groupId),
    ]);
    const live = here.m.status === "ACTIVE";
    return {
      person: {
        id: p.id,
        firstName: p.firstName,
        otherNames: p.otherNames,
        lastName: p.lastName,
        gender: p.gender === "MALE" || p.gender === "FEMALE" ? p.gender : null,
        dateOfBirth: p.dateOfBirth,
        email: p.email,
        telephone: p.telephone,
        address: p.address,
        occupation: p.occupation,
        isBaptised: p.isBaptised,
        baptismDate: p.baptismDate,
        baptismPlace: p.baptismPlace,
        isCommunicant: p.isCommunicant,
        firstCommunionDate: p.firstCommunionDate,
        isConfirmed: p.isConfirmed,
        confirmationDate: p.confirmationDate,
        isDeceased: p.isDeceased,
        deceasedOn: p.deceasedOn,
        photoUrl: p.photoKey ? await this.media.presignGet(p.photoKey) : null,
        hasAccount: Boolean(p.passwordHash),
      },
      memberships: all.map((x) => ({
        id: x.m.id,
        church: x.church,
        role: x.role,
        status: x.m.status,
        isHome: x.m.isHome,
        joinedAt: (x.m.decidedAt ?? x.m.requestedAt).toISOString(),
      })),
      societies: soc,
      here: {
        membershipId: here.m.id,
        role: here.role,
        status: here.m.status,
        isHome: here.m.isHome,
      },
      can: {
        edit,
        manageRole: admin && live && personId !== actorId,
        remove: admin && live && personId !== actorId,
      },
    };
  }

  // ------------------------------------------------------------------ add / edit

  private checkRecord(d: Details) {
    const problems = recordProblems(d, toIsoDate(new Date()));
    if (problems.length) throw new DomainError(400, "INVALID_RECORD", problems[0]!, { problems });
  }

  private values(d: Details) {
    return {
      firstName: d.firstName,
      otherNames: d.otherNames,
      lastName: d.lastName,
      gender: d.gender,
      dateOfBirth: d.dateOfBirth,
      email: d.email,
      telephone: d.telephone,
      address: d.address,
      occupation: d.occupation,
      isBaptised: d.isBaptised,
      baptismDate: d.baptismDate,
      baptismPlace: d.baptismPlace,
      isCommunicant: d.isCommunicant,
      firstCommunionDate: d.firstCommunionDate,
      isConfirmed: d.isConfirmed,
      confirmationDate: d.confirmationDate,
      isDeceased: d.isDeceased,
      deceasedOn: d.deceasedOn,
    };
  }

  private async contactTaken(d: Details, exceptId?: string) {
    if (!d.email && !d.telephone) return false;
    const [hit] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          or(
            d.email ? sql`lower(${members.email}) = ${d.email}` : undefined,
            d.telephone ? eq(members.telephone, d.telephone) : undefined,
          ),
          exceptId ? sql`${members.id} <> ${exceptId}` : undefined,
        ),
      )
      .limit(1);
    return Boolean(hit);
  }

  /**
   * Add someone who doesn't use the app (D-037): a person with no password and an ACTIVE home
   * membership here. If they sign up later with the same email/phone, staff merge by hand (todo).
   */
  async add(actorId: string, groupId: string, d: Add, ip: string) {
    this.checkRecord(d);
    const [g] = await this.db
      .select({ level: groups.level })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    if (g?.level !== "PARISH" && g?.level !== "OUTSTATION")
      throw new DomainError(400, "NOT_A_CHURCH", "People belong to parishes and outstations.");
    if (d.role !== "PARISHIONER" && !(await this.isAdministratorOf(actorId, groupId)))
      throw new DomainError(
        403,
        "NOT_ALLOWED",
        "Only Administrators can give someone a staff role.",
      );
    if (await this.contactTaken(d))
      throw new DomainError(
        409,
        "PERSON_EXISTS",
        "Someone with this email or phone is already on Ecclesios. Ask them to join your church from the app, then approve the request.",
      );
    const [role] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, d.role))
      .limit(1);
    const now = new Date();
    const personId = await this.db.transaction(async (tx) => {
      const [p] = await tx.insert(members).values(this.values(d)).returning({ id: members.id });
      await tx.insert(memberships).values({
        memberId: p!.id,
        groupId,
        roleId: role!.id,
        status: "ACTIVE",
        isHome: true,
        decidedAt: now,
        decidedByMemberId: actorId,
        requestedAt: now,
      });
      return p!.id;
    });
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "register.added",
      entityType: "member",
      entityId: personId,
      ip,
    });
    return this.profile(actorId, groupId, personId);
  }

  async update(actorId: string, groupId: string, personId: string, d: Details, ip: string) {
    if (!(await this.here(groupId, personId))) throw notFound();
    if (!(await this.canEditPerson(actorId, personId)))
      throw new DomainError(
        403,
        "NOT_HOME_CHURCH",
        "Only this person's home church (or its parish) can change their record.",
      );
    this.checkRecord(d);
    if (await this.contactTaken(d, personId))
      throw new DomainError(
        409,
        "PERSON_EXISTS",
        "That email or phone belongs to someone else on Ecclesios.",
      );
    const [before] = await this.db.select().from(members).where(eq(members.id, personId)).limit(1);
    await this.db.update(members).set(this.values(d)).where(eq(members.id, personId));
    const changed = Object.entries(this.values(d))
      .filter(([k, v]) => (before as Record<string, unknown>)[k] !== v)
      .map(([k]) => k);
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "register.updated",
      entityType: "member",
      entityId: personId,
      metadata: { changed },
      ip,
    });
    return this.profile(actorId, groupId, personId);
  }

  // ------------------------------------------------------------------ photo

  async presignPhoto(
    actorId: string,
    groupId: string,
    personId: string,
    contentType: string,
    bytes: number,
  ) {
    if (!(await this.here(groupId, personId))) throw notFound();
    if (!(await this.canEditPerson(actorId, personId)))
      throw new DomainError(
        403,
        "NOT_HOME_CHURCH",
        "Only this person's home church can change their photo.",
      );
    if (!PHOTO_TYPES.includes(contentType))
      throw new DomainError(400, "UPLOAD_REJECTED", "Use a JPEG, PNG or WebP image.");
    return this.media.presignPut(
      this.media.newKey(`members/${personId}/photo`, contentType),
      contentType,
      bytes,
    );
  }

  async setPhoto(
    actorId: string,
    groupId: string,
    personId: string,
    key: string | null,
    ip: string,
  ) {
    if (!(await this.here(groupId, personId))) throw notFound();
    if (!(await this.canEditPerson(actorId, personId)))
      throw new DomainError(
        403,
        "NOT_HOME_CHURCH",
        "Only this person's home church can change their photo.",
      );
    if (key) {
      if (!key.startsWith(`members/${personId}/photo/`))
        throw new DomainError(400, "UPLOAD_REJECTED", "That upload doesn't belong here.");
      const head = await this.media.head(key);
      if (!head?.contentType || !PHOTO_TYPES.includes(head.contentType))
        throw new DomainError(400, "UPLOAD_REJECTED", "The photo hasn't finished uploading.");
    }
    const [before] = await this.db
      .select({ k: members.photoKey })
      .from(members)
      .where(eq(members.id, personId))
      .limit(1);
    await this.db.update(members).set({ photoKey: key }).where(eq(members.id, personId));
    if (before?.k && before.k !== key) await this.media.remove(before.k);
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: key ? "register.photo_set" : "register.photo_removed",
      entityType: "member",
      entityId: personId,
      ip,
    });
    return this.profile(actorId, groupId, personId);
  }

  // ------------------------------------------------------------------ roles / removal

  private async activeRoles(groupId: string) {
    return this.db
      .select({ membershipId: memberships.id, role: roles.code })
      .from(memberships)
      .innerJoin(roles, eq(roles.id, memberships.roleId))
      .where(and(eq(memberships.groupId, groupId), eq(memberships.status, "ACTIVE")));
  }

  /** Administrators of THIS church change roles here only (roles are per membership, D-014). */
  async changeRole(
    actorId: string,
    groupId: string,
    personId: string,
    role: MemberRole,
    ip: string,
  ) {
    if (!(await this.isAdministratorOf(actorId, groupId)))
      throw new DomainError(
        403,
        "NOT_ALLOWED",
        "Only this church's Administrators can change roles.",
      );
    if (personId === actorId)
      throw new DomainError(409, "OWN_ROLE", "Ask another Administrator to change your own role.");
    const [m] = await this.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.memberId, personId),
          eq(memberships.groupId, groupId),
          eq(memberships.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!m) throw notFound();
    if (leavesNoAdministrator(await this.activeRoles(groupId), { membershipId: m.id, to: role }))
      throw new DomainError(
        409,
        "LAST_ADMINISTRATOR",
        "A church must keep at least one Administrator.",
      );
    const [r] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, role))
      .limit(1);
    await this.db.update(memberships).set({ roleId: r!.id }).where(eq(memberships.id, m.id));
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "register.role_changed",
      entityType: "membership",
      entityId: m.id,
      metadata: { to: role },
      ip,
    });
    return this.profile(actorId, groupId, personId);
  }

  /** Take someone off this church's register (membership → LEFT). Their account and other churches are untouched. */
  async remove(actorId: string, groupId: string, personId: string, reason: string, ip: string) {
    if (!(await this.isAdministratorOf(actorId, groupId)))
      throw new DomainError(
        403,
        "NOT_ALLOWED",
        "Only this church's Administrators can remove members.",
      );
    if (personId === actorId)
      throw new DomainError(
        409,
        "OWN_ROLE",
        "You can leave the church from your own profile in the app.",
      );
    const [m] = await this.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.memberId, personId),
          eq(memberships.groupId, groupId),
          eq(memberships.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!m) throw notFound();
    if (leavesNoAdministrator(await this.activeRoles(groupId), { membershipId: m.id, to: null }))
      throw new DomainError(
        409,
        "LAST_ADMINISTRATOR",
        "A church must keep at least one Administrator.",
      );
    await this.db.transaction(async (tx) => {
      await tx
        .update(memberships)
        .set({
          status: "LEFT",
          isHome: false,
          decisionNote: reason,
          decidedAt: new Date(),
          decidedByMemberId: actorId,
        })
        .where(eq(memberships.id, m.id));
      const mine = await tx
        .select({ id: societies.id })
        .from(societies)
        .where(eq(societies.groupId, groupId));
      if (mine.length)
        await tx.delete(societyMembers).where(
          and(
            eq(societyMembers.memberId, personId),
            inArray(
              societyMembers.societyId,
              mine.map((s) => s.id),
            ),
          ),
        );
      // …and stops leading them (D-038).
      await tx
        .update(societies)
        .set({ leaderMemberId: null })
        .where(and(eq(societies.groupId, groupId), eq(societies.leaderMemberId, personId)));
    });
    await this.audit.write({
      actorType: "MEMBER",
      actorId,
      groupId,
      action: "register.removed",
      entityType: "membership",
      entityId: m.id,
      metadata: { reason, wasHome: m.isHome },
      ip,
    });
  }

  // ------------------------------------------------------------------ birthdays

  async birthdays(
    groupId: string,
    days: number,
    today: string,
    withOutstations: boolean,
  ): Promise<BirthdayList> {
    const ids = await this.churchIds(groupId, withOutstations);
    const rows = await this.db
      .selectDistinctOn([members.id], {
        personId: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        telephone: members.telephone,
        photoKey: members.photoKey,
        dateOfBirth: members.dateOfBirth,
        isDeceased: members.isDeceased,
        church: groups.name,
      })
      .from(memberships)
      .innerJoin(members, eq(members.id, memberships.memberId))
      .innerJoin(groups, eq(groups.id, memberships.groupId))
      .where(
        and(
          inArray(memberships.groupId, ids),
          eq(memberships.status, "ACTIVE"),
          eq(members.isDeceased, false),
          sql`${members.dateOfBirth} IS NOT NULL`,
        ),
      )
      .orderBy(members.id);
    const list = upcomingBirthdays(rows, today, days);
    return {
      today,
      items: await Promise.all(
        list.map(async (r) => ({
          personId: r.personId,
          firstName: r.firstName,
          lastName: r.lastName,
          telephone: r.telephone,
          photoUrl: r.photoKey ? await this.media.presignGet(r.photoKey) : null,
          dateOfBirth: r.dateOfBirth,
          inDays: r.inDays,
          turning: r.turning,
          church: r.church,
        })),
      ),
    };
  }
}
