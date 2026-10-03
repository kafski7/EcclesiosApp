/**
 * Dev seed data (todo Phase 1). Pure data + validation — no DB access — so it is unit-testable.
 * IDs are deterministic so tests, docs and API e2e fixtures can refer to them.
 */
import type { HierarchyLevel, MemberRole, MetropolitanVisibility } from "@ecclesios/shared/domain";
import { buildPath, isValidParent } from "@ecclesios/shared/domain";

/** Deterministic dev UUID: seedId(1) → 00000000-0000-4000-8000-000000000001 */
export const seedId = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

// ---------------------------------------------------------------- reference data
export const CURRENCIES = [{ code: "GHS", name: "Ghana Cedi", symbol: "GH₵", minorUnit: 2 }];
export const LANGUAGES = [{ code: "en", name: "English" }];
export const THEMES = [
  {
    code: "liturgical-green",
    name: "Liturgical Green",
    tokens: { primary: "#1f6f43", accent: "#c9a227" },
  },
  { code: "marian-blue", name: "Marian Blue", tokens: { primary: "#1d4e89", accent: "#e8d8a8" } },
  { code: "cardinal-red", name: "Cardinal Red", tokens: { primary: "#8b1e2d", accent: "#d4af37" } },
];
export const ICONS = [
  { code: "bell", name: "Bell", value: "cil-bell" },
  { code: "people", name: "People", value: "cil-people" },
  { code: "calendar", name: "Calendar", value: "cil-calendar" },
  { code: "envelope", name: "Envelope", value: "cil-envelope-closed" },
  { code: "money", name: "Money", value: "cil-money" },
  { code: "birthday", name: "Birthday", value: "cil-birthday-cake" },
];
export const NOTIFICATION_TYPES = [
  { code: "SYSTEM", name: "System", icon: "bell" },
  { code: "BIRTHDAY", name: "Birthday", icon: "birthday" },
  { code: "MESSAGE", name: "Message", icon: "envelope" },
  { code: "COLLECTION_REVIEW", name: "Collection review", icon: "money" },
  { code: "SUBSCRIPTION", name: "Subscription", icon: "calendar" },
  { code: "MEMBER_REGISTRATION", name: "New member request", icon: "people" },
  { code: "PODCAST_EPISODE", name: "New podcast episode", icon: "bell" },
  { code: "EXPLORE_REVIEW", name: "Explore post reviewed", icon: "bell" },
  { code: "CHURCH_POST", name: "New post from a church you follow", icon: "bell" },
  { code: "COMMENT_MENTION", name: "Someone mentioned you in a comment", icon: "bell" },
];

/** Placeholder prices — confirm before launch (Phase 10). */
export const SUBSCRIPTION_TYPES = [
  {
    code: "BASIC",
    name: "Basic",
    price: "0.00",
    durationDays: 365,
    trialDays: 30,
    smsIncluded: 100,
    maxMembers: 500,
    features: ["members", "societies", "birthdays", "notifications"],
  },
  {
    code: "PREMIUM",
    name: "Premium",
    price: "1200.00",
    durationDays: 365,
    trialDays: 30,
    smsIncluded: 2000,
    maxMembers: 3000,
    features: [
      "members",
      "societies",
      "birthdays",
      "notifications",
      "messages",
      "outstations",
      "accounting-link",
    ],
  },
  {
    code: "ULTIMATE",
    name: "Ultimate",
    price: "3000.00",
    durationDays: 365,
    trialDays: 30,
    smsIncluded: 10000,
    maxMembers: null,
    features: [
      "members",
      "societies",
      "birthdays",
      "notifications",
      "messages",
      "outstations",
      "accounting-link",
      "reports",
      "priority-support",
    ],
  },
];

// ---------------------------------------------------------------- RBAC (church roles only — D-003)
export const ROLES: { code: MemberRole; name: string; description: string }[] = [
  {
    code: "ADMINISTRATOR",
    name: "Administrator",
    description:
      "Main administrator of a church group; full CMS access for own group plus level oversight.",
  },
  {
    code: "MANAGER",
    name: "Manager",
    description: "Management permissions within own group, as assigned.",
  },
  {
    code: "SOCIETY_LEADER",
    name: "Society-Leader",
    description: "Leads a society or committee; manages its roster.",
  },
  {
    code: "PARISHIONER",
    name: "Parishioner",
    description: "Regular member; own profile, own societies, notifications.",
  },
];

export const PERMISSIONS = [
  ["dashboard.read", "dashboard"],
  ["members.read", "members"],
  ["members.write", "members"],
  ["birthdays.read", "members"],
  ["societies.read", "societies"],
  ["societies.write", "societies"],
  ["societies.roster", "societies"],
  ["notifications.read", "notifications"],
  ["messages.send", "messages"],
  ["users.manage", "users"],
  ["settings.manage", "settings"],
  ["billing.manage", "billing"],
  ["collections.record", "collections"],
  ["collections.approve", "collections"],
  ["reports.read", "reports"],
  ["profile.self", "profile"],
] as const;
export type PermissionCode = (typeof PERMISSIONS)[number][0];

export const ROLE_PERMISSIONS: Record<MemberRole, readonly PermissionCode[]> = {
  ADMINISTRATOR: PERMISSIONS.map(([c]) => c),
  MANAGER: [
    "dashboard.read",
    "members.read",
    "members.write",
    "birthdays.read",
    "societies.read",
    "societies.write",
    "societies.roster",
    "notifications.read",
    "messages.send",
    "collections.record",
    "reports.read",
    "profile.self",
  ],
  SOCIETY_LEADER: [
    "dashboard.read",
    "members.read",
    "birthdays.read",
    "societies.read",
    "societies.roster",
    "notifications.read",
    "profile.self",
  ],
  PARISHIONER: ["notifications.read", "profile.self"],
};

// ---------------------------------------------------------------- hierarchy
export interface SeedGroup {
  key: string;
  id: string;
  parentKey: string | null;
  level: HierarchyLevel;
  name: string;
  code: string;
  metropolitanVisibility?: MetropolitanVisibility;
}

const RAW_GROUPS: Omit<SeedGroup, "id">[] = [
  {
    key: "prov",
    parentKey: null,
    level: "PROVINCE",
    name: "Sample Ecclesiastical Province",
    code: "PROV",
  },
  {
    key: "arch",
    parentKey: "prov",
    level: "ARCHDIOCESE",
    name: "Sample Metropolitan Archdiocese",
    code: "ARCH",
  },
  {
    key: "archDean",
    parentKey: "arch",
    level: "DEANERY",
    name: "Cathedral Deanery",
    code: "ARCH-DEAN",
  },
  {
    key: "archPar",
    parentKey: "archDean",
    level: "PARISH",
    name: "Holy Spirit Cathedral Parish",
    code: "ARCH-PAR",
  },
  {
    key: "dio",
    parentKey: "arch",
    level: "DIOCESE",
    name: "Sample Suffragan Diocese",
    code: "DIO",
    metropolitanVisibility: "aggregates",
  },
  { key: "deanA", parentKey: "dio", level: "DEANERY", name: "St Joseph Deanery", code: "DEAN-A" },
  { key: "deanB", parentKey: "dio", level: "DEANERY", name: "St Peter Deanery", code: "DEAN-B" },
  { key: "parA1", parentKey: "deanA", level: "PARISH", name: "St Theresa Parish", code: "PAR-A1" },
  {
    key: "parA2",
    parentKey: "deanA",
    level: "PARISH",
    name: "Christ the King Parish",
    code: "PAR-A2",
  },
  { key: "parB1", parentKey: "deanB", level: "PARISH", name: "St Anthony Parish", code: "PAR-B1" },
  {
    key: "outA1a",
    parentKey: "parA1",
    level: "OUTSTATION",
    name: "St Michael Outstation",
    code: "OUT-A1A",
  },
  {
    key: "outA1b",
    parentKey: "parA1",
    level: "OUTSTATION",
    name: "St Monica Outstation",
    code: "OUT-A1B",
  },
  {
    key: "outA2a",
    parentKey: "parA2",
    level: "OUTSTATION",
    name: "St Luke Outstation",
    code: "OUT-A2A",
  },
  {
    key: "outB1a",
    parentKey: "parB1",
    level: "OUTSTATION",
    name: "St Agnes Outstation",
    code: "OUT-B1A",
  },
];

export const GROUPS: SeedGroup[] = RAW_GROUPS.map((g, i) => ({ ...g, id: seedId(100 + i) }));

/** Groups with ids + computed paths, parents first. Throws if the tree is invalid. */
export function resolveGroups(groups: SeedGroup[] = GROUPS) {
  const byKey = new Map<string, SeedGroup & { path: string; parentId: string | null }>();
  for (const g of groups) {
    const parent = g.parentKey ? byKey.get(g.parentKey) : null;
    if (g.parentKey && !parent)
      throw new Error(`Seed group ${g.key}: parent ${g.parentKey} must come first`);
    if (!isValidParent(g.level, parent?.level ?? null))
      throw new Error(
        `Seed group ${g.key}: ${g.level} cannot sit under ${parent?.level ?? "root"}`,
      );
    if (byKey.has(g.key)) throw new Error(`Duplicate seed key ${g.key}`);
    byKey.set(g.key, {
      ...g,
      parentId: parent?.id ?? null,
      path: buildPath(parent?.path ?? null, g.id),
    });
  }
  return byKey;
}

// ---------------------------------------------------------------- people
export interface SeedMember {
  id: string;
  groupKey: string;
  role: MemberRole;
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string;
  canLogin: boolean;
  /** Status of the HOME membership (groupKey + role). PENDING = self-registered, awaiting approval (D-015). */
  status?: "PENDING" | "ACTIVE";
}

let n = 500;
const m = (
  groupKey: string,
  role: MemberRole,
  firstName: string,
  lastName: string,
  gender: "MALE" | "FEMALE",
  dob: string,
  canLogin = true,
): SeedMember => {
  const id = seedId(n++);
  const handle = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, "");
  return {
    id,
    groupKey,
    role,
    firstName,
    lastName,
    gender,
    dateOfBirth: dob,
    canLogin,
    email: `${handle}@dev.ecclesios.local`,
    telephone: `+23320${String(n).padStart(7, "0")}`,
  };
};

/** One Administrator per operational group, plus staff and parishioners at St Theresa (parA1). */
export const MEMBERS: SeedMember[] = [
  m("prov", "ADMINISTRATOR", "Province", "Admin", "MALE", "1960-03-19"),
  m("arch", "ADMINISTRATOR", "Archdiocese", "Admin", "MALE", "1962-08-15"),
  m("archDean", "ADMINISTRATOR", "Cathedral", "Dean", "MALE", "1970-01-06"),
  m("archPar", "ADMINISTRATOR", "Cathedral", "Pastor", "MALE", "1972-06-29"),
  m("dio", "ADMINISTRATOR", "Diocese", "Admin", "MALE", "1965-11-01"),
  m("deanA", "ADMINISTRATOR", "Joseph", "Dean", "MALE", "1971-03-19"),
  m("deanB", "ADMINISTRATOR", "Peter", "Dean", "MALE", "1973-06-29"),
  m("parA1", "ADMINISTRATOR", "Theresa", "Pastor", "MALE", "1975-10-01"),
  m("parA2", "ADMINISTRATOR", "Christ", "Pastor", "MALE", "1976-11-24"),
  m("parB1", "ADMINISTRATOR", "Anthony", "Pastor", "MALE", "1974-06-13"),
  m("outA1a", "ADMINISTRATOR", "Michael", "Catechist", "MALE", "1980-09-29"),
  m("outA1b", "ADMINISTRATOR", "Monica", "Catechist", "FEMALE", "1982-08-27"),
  m("outA2a", "ADMINISTRATOR", "Luke", "Catechist", "MALE", "1981-10-18"),
  m("outB1a", "ADMINISTRATOR", "Agnes", "Catechist", "FEMALE", "1983-01-21"),
  m("parA1", "MANAGER", "Ama", "Mensah", "FEMALE", "1985-04-12"),
  m("parA1", "SOCIETY_LEADER", "Kwame", "Owusu", "MALE", "1979-12-08"),
  m("parA1", "SOCIETY_LEADER", "Akosua", "Boateng", "FEMALE", "1990-05-31"),
  m("parA1", "PARISHIONER", "Kofi", "Asante", "MALE", "1995-09-30"),
  m("parA1", "PARISHIONER", "Efua", "Addo", "FEMALE", "1998-02-14", false),
  m("parA1", "PARISHIONER", "Yaw", "Darko", "MALE", "2001-07-22", false),
  m("outA1a", "PARISHIONER", "Abena", "Osei", "FEMALE", "1993-03-25", false),
  m("outA1a", "PARISHIONER", "Kojo", "Antwi", "MALE", "1988-11-11", false),
  { ...m("parA1", "PARISHIONER", "Esi", "Mensah", "FEMALE", "2000-04-02"), status: "PENDING" },
];

/** Memberships beyond each person's home church (D-014): one person, several churches. */
export const EXTRA_MEMBERSHIPS: {
  first: string;
  groupKey: string;
  role: MemberRole;
  status: "PENDING" | "ACTIVE";
}[] = [
  { first: "Kofi", groupKey: "outA1a", role: "PARISHIONER", status: "ACTIVE" }, //  belongs to his parish and an outstation
  { first: "Yaw", groupKey: "outA1b", role: "PARISHIONER", status: "PENDING" }, //  outstation request (outstation admin or parish approves)
];

/** Follows: public content only, no approval (D-015). */
export const FOLLOWS: { first: string; groupKey: string }[] = [
  { first: "Kofi", groupKey: "parA2" },
  { first: "Esi", groupKey: "archPar" },
];

/** Approved content creators among members (D-017). */
export const MEMBER_PRIVILEGES: {
  first: string;
  privileges: ("AUTHOR_EXPLORE" | "POST_PODCASTS")[];
}[] = [{ first: "Akosua", privileges: ["AUTHOR_EXPLORE"] }];

export const memberByFirst = (first: string) => {
  const found = MEMBERS.find((x) => x.firstName === first);
  if (!found) throw new Error(`No seed member named ${first}`);
  return found;
};

export const memberBy = (groupKey: string, role: MemberRole) => {
  const found = MEMBERS.find((x) => x.groupKey === groupKey && x.role === role);
  if (!found) throw new Error(`No seed member ${role} in ${groupKey}`);
  return found;
};

export const PLATFORM_USERS = [
  {
    id: seedId(900),
    fullName: "Ecclesios Super Admin",
    email: "superadmin@dev.ecclesios.local",
    telephone: "+233200000900",
    platformRole: "SUPER_ADMIN" as const,
    privileges: [] as const,
  },
  {
    id: seedId(901),
    fullName: "Sample PYC Creator",
    email: "creator@dev.ecclesios.local",
    telephone: "+233200000901",
    platformRole: "CREATOR" as const,
    privileges: ["POST_PODCASTS", "AUTHOR_EXPLORE"] as const,
  },
];

// ---------------------------------------------------------------- societies
export const SOCIETIES = [
  {
    id: seedId(700),
    groupKey: "parA1",
    name: "Catholic Youth Organisation",
    isCommittee: false,
    leader: ["parA1", "SOCIETY_LEADER", 0] as const,
    members: ["Kofi", "Yaw"],
  },
  {
    id: seedId(701),
    groupKey: "parA1",
    name: "Christian Mothers Association",
    isCommittee: false,
    leader: ["parA1", "SOCIETY_LEADER", 1] as const,
    members: ["Efua"],
  },
  {
    id: seedId(702),
    groupKey: "parA1",
    name: "Parish Finance Committee",
    isCommittee: true,
    leader: ["parA1", "MANAGER", 0] as const,
    members: ["Kwame"],
  },
  {
    id: seedId(703),
    groupKey: "outA1a",
    name: "St Michael Choir",
    isCommittee: false,
    leader: null,
    members: ["Abena", "Kojo"],
  },
];

export const leaderOf = (spec: readonly [string, MemberRole, number] | null) =>
  spec
    ? (MEMBERS.filter((x) => x.groupKey === spec[0] && x.role === spec[1])[spec[2]] ?? null)
    : null;

// ---------------------------------------------------------------- pending collections (one per status)
export const PENDING_COLLECTIONS = [
  {
    id: seedId(800),
    outstation: "outA1a",
    amount: "450.00",
    categoryRef: "SUNDAY_OFFERTORY",
    collectedOn: "2026-09-20",
    status: "PENDING" as const,
  },
  {
    id: seedId(801),
    outstation: "outA1a",
    amount: "120.50",
    categoryRef: "HARVEST_PLEDGE",
    collectedOn: "2026-09-13",
    status: "APPROVED" as const,
  },
  {
    id: seedId(802),
    outstation: "outA1b",
    amount: "300.00",
    categoryRef: "SUNDAY_OFFERTORY",
    collectedOn: "2026-09-06",
    status: "SYNCED" as const,
    externalTxnId: "EXT-DEV-0001",
  },
  {
    id: seedId(803),
    outstation: "outA1b",
    amount: "75.00",
    categoryRef: "SECOND_COLLECTION",
    collectedOn: "2026-08-30",
    status: "REJECTED" as const,
    reviewNote: "Duplicate of entry for 30 Aug.",
  },
  {
    id: seedId(804),
    outstation: "outA1a",
    amount: "210.00",
    categoryRef: "SUNDAY_OFFERTORY",
    collectedOn: "2026-08-23",
    status: "SYNC_FAILED" as const,
    lastSyncError: "Accounting API timeout (dev sample)",
  },
];
