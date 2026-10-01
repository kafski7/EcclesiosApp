/**
 * DEV-ONLY wipe-and-reload seed (todo Phase 1, blueprint §7).
 * Production data changes go through migrations — never through this script.
 *
 *   pnpm db:seed               wipe + seed
 *   pnpm --filter @ecclesios/db reset   wipe only
 */
import { hash } from "@node-rs/argon2";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { createDb } from "../client";
import { loadEnv } from "../env";
import * as s from "../schema";
import * as d from "./data";

loadEnv();

function assertSafeTarget(url: string) {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed: NODE_ENV=production");
  const host = new URL(url).hostname;
  const local = ["localhost", "127.0.0.1", "::1", "postgres"].includes(host);
  if (!local && process.env.SEED_ALLOW_REMOTE !== "1")
    throw new Error(`Refusing to wipe non-local database host "${host}". Set SEED_ALLOW_REMOTE=1 to override.`);
}

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (copy packages/db/.env.example to .env)");
  assertSafeTarget(url);
  const wipeOnly = process.argv.includes("--wipe-only");

  const { db, close } = createDb(url, { max: 1 });
  // `s` also re-exports pg enums, so a type predicate can't narrow here — cast instead.
  const tables = Object.values(s).filter((t) => is(t, PgTable)) as PgTable[];
  const names = tables.map((t) => `"${getTableName(t)}"`).join(", ");

  console.info(`Wiping ${tables.length} tables…`);
  await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
  if (wipeOnly) return close();

  const password = process.env.SEED_DEV_PASSWORD || "Ecclesios#2026";
  const passwordHash = await hash(password); // @node-rs/argon2 defaults to argon2id
  const groups = d.resolveGroups();
  const gid = (key: string) => groups.get(key)!.id;

  await db.transaction(async (tx) => {
    // reference
    await tx.insert(s.currencies).values(d.CURRENCIES);
    await tx.insert(s.languages).values(d.LANGUAGES);
    const themeRows = await tx.insert(s.themes).values(d.THEMES).returning();
    const iconRows = await tx.insert(s.icons).values(d.ICONS).returning();
    const iconId = (code: string) => iconRows.find((i) => i.code === code)?.id;
    const ntRows = await tx
      .insert(s.notificationTypes)
      .values(d.NOTIFICATION_TYPES.map(({ icon, ...t }) => ({ ...t, iconId: iconId(icon) })))
      .returning();
    const planRows = await tx
      .insert(s.subscriptionTypes)
      .values(d.SUBSCRIPTION_TYPES.map((p) => ({ ...p, currencyCode: "GHS" })))
      .returning();
    const plan = (code: string) => planRows.find((p) => p.code === code)!.id;

    // RBAC
    const roleRows = await tx.insert(s.roles).values(d.ROLES).returning();
    const permRows = await tx
      .insert(s.permissions)
      .values(d.PERMISSIONS.map(([code, module]) => ({ code, module })))
      .returning();
    const roleId = (code: string) => roleRows.find((r) => r.code === code)!.id;
    await tx.insert(s.rolePermissions).values(
      Object.entries(d.ROLE_PERMISSIONS).flatMap(([role, codes]) =>
        codes.map((c) => ({ roleId: roleId(role), permissionId: permRows.find((p) => p.code === c)!.id })),
      ),
    );

    // hierarchy (parents first — resolveGroups preserves order)
    for (const g of groups.values()) {
      await tx.insert(s.groups).values({
        id: g.id,
        parentGroupId: g.parentId,
        level: g.level,
        name: g.name,
        code: g.code,
        path: g.path,
        themeId: themeRows[0]!.id,
        currencyCode: "GHS",
        languageCode: "en",
      });
    }
    await tx.insert(s.groupSettings).values(
      [...groups.values()].map((g) => ({
        groupId: g.id,
        metropolitanVisibility: g.metropolitanVisibility ?? "aggregates",
      })),
    );

    // platform users
    for (const u of d.PLATFORM_USERS) {
      const { privileges, ...row } = u;
      await tx.insert(s.users).values({ ...row, passwordHash, firstLogin: new Date() });
      if (privileges.length)
        await tx.insert(s.userPrivileges).values(
          privileges.map((p) => ({ userId: u.id, privilege: p, grantedByUserId: d.PLATFORM_USERS[0]!.id })),
        );
    }

    // members — Kofi Asante is left with first_login = NULL to exercise the Set-Password path
    await tx.insert(s.members).values(
      d.MEMBERS.map((m) => ({
        id: m.id,
        groupId: gid(m.groupKey),
        roleId: roleId(m.role),
        firstName: m.firstName,
        lastName: m.lastName,
        gender: m.gender,
        dateOfBirth: m.dateOfBirth,
        email: m.email,
        telephone: m.telephone,
        isBaptised: true,
        isCommunicant: true,
        isConfirmed: m.role !== "PARISHIONER",
        passwordHash: m.canLogin ? passwordHash : null,
        firstLogin: m.canLogin && m.firstName !== "Kofi" ? new Date() : null,
      })),
    );

    // societies & committees
    for (const soc of d.SOCIETIES) {
      await tx.insert(s.societies).values({
        id: soc.id,
        groupId: gid(soc.groupKey),
        name: soc.name,
        isCommittee: soc.isCommittee,
        leaderMemberId: d.leaderOf(soc.leader)?.id ?? null,
      });
      const ids = new Set(
        soc.members
          .map((first) => d.MEMBERS.find((x) => x.firstName === first)!.id)
          .concat(d.leaderOf(soc.leader)?.id ?? []),
      );
      await tx.insert(s.societyMembers).values([...ids].map((memberId) => ({ societyId: soc.id, memberId })));
    }

    // subscriptions: one of each state for gate testing
    await tx.insert(s.subscriptions).values([
      { groupId: gid("parA1"), subscriptionTypeId: plan("PREMIUM"), status: "ACTIVE", startsAt: daysFromNow(-60), expiresAt: daysFromNow(305), smsBalance: 1850 },
      { groupId: gid("parA2"), subscriptionTypeId: plan("BASIC"), status: "TRIAL", startsAt: daysFromNow(-5), expiresAt: daysFromNow(25), smsBalance: 100 },
      { groupId: gid("parB1"), subscriptionTypeId: plan("BASIC"), status: "EXPIRED", startsAt: daysFromNow(-400), expiresAt: daysFromNow(-35), smsBalance: 0 },
      { groupId: gid("archPar"), subscriptionTypeId: plan("ULTIMATE"), status: "ACTIVE", startsAt: daysFromNow(-10), expiresAt: daysFromNow(355), smsBalance: 10000 },
    ]);

    // accounting linkage
    const categories = ["SUNDAY_OFFERTORY", "HARVEST_PLEDGE", "SECOND_COLLECTION"];
    await tx.insert(s.externalAccountingRefs).values(
      categories.map((c, i) => ({
        groupId: gid("parA1"),
        entityType: "CATEGORY" as const,
        localRef: c,
        externalId: `EXT-CAT-${i + 1}`,
        provider: "dev-stub",
        label: c.replace(/_/g, " ").toLowerCase(),
      })),
    );

    // pending collections — one in each status
    const reviewer = d.memberBy("parA1", "ADMINISTRATOR").id;
    await tx.insert(s.pendingCollections).values(
      d.PENDING_COLLECTIONS.map((c) => {
        const reviewed = c.status !== "PENDING";
        return {
          id: c.id,
          groupId: gid(c.outstation),
          parishGroupId: groups.get(c.outstation)!.parentId!,
          amount: c.amount,
          currencyCode: "GHS",
          categoryRef: c.categoryRef,
          collectedOn: c.collectedOn,
          status: c.status,
          recordedByMemberId: d.memberBy(c.outstation, "ADMINISTRATOR").id,
          reviewedByMemberId: reviewed ? reviewer : null,
          reviewedAt: reviewed ? daysFromNow(-1) : null,
          reviewNote: "reviewNote" in c ? c.reviewNote : null,
          externalTxnId: "externalTxnId" in c ? c.externalTxnId : null,
          syncedAt: c.status === "SYNCED" ? daysFromNow(-1) : null,
          syncAttempts: c.status === "SYNC_FAILED" ? 3 : c.status === "SYNCED" ? 1 : 0,
          lastSyncError: "lastSyncError" in c ? c.lastSyncError : null,
        };
      }),
    );

    // a notification + audit entry so those screens aren't empty
    await tx.insert(s.notifications).values({
      typeId: ntRows.find((t) => t.code === "COLLECTION_REVIEW")!.id,
      groupId: gid("parA1"),
      recipientMemberId: reviewer,
      title: "1 outstation collection awaiting approval",
      link: "/admin/collections?status=PENDING",
    });
    await tx.insert(s.auditLogs).values({
      actorType: "SYSTEM",
      action: "seed.run",
      metadata: { groups: groups.size, members: d.MEMBERS.length },
    });
  });

  console.info(
    `Seeded ${groups.size} groups, ${d.MEMBERS.length} members, ${d.PLATFORM_USERS.length} platform users, ${d.SOCIETIES.length} societies.`,
  );
  console.info(`Dev password for all login accounts: ${password}`);
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
