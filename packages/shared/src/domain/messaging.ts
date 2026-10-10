/**
 * Messages, broadcasts and notification preferences (functionality §4.7, blueprint §3.3; D-050 – D-052).
 * Pure rules only — the API loads rows, these decide.
 */
import type { GroupLookup, GroupNode } from "./access.js";
import type { HierarchyLevel, MemberRole } from "./levels.js";
import { isStrictDescendant, pathIds } from "./path.js";

// ------------------------------------------------------------------ channels & statuses

export const MESSAGE_CHANNELS = ["SMS", "EMAIL", "IN_APP"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

/** QUEUED → SENDING → SENT / PARTIAL / FAILED. Final states never move again. */
export const MESSAGE_STATUSES = ["QUEUED", "SENDING", "SENT", "PARTIAL", "FAILED"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export const isMessageFinal = (s: MessageStatus) => s === "SENT" || s === "PARTIAL" || s === "FAILED";

export const RECIPIENT_STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

/** Final status of a message from its recipient counts (no PENDING left). */
export function finalMessageStatus(sent: number, failed: number): MessageStatus {
  if (sent === 0) return "FAILED";
  return failed > 0 ? "PARTIAL" : "SENT";
}

/** Why a recipient was not sent anything (stored in message_recipients.error). */
export const SKIP_REASONS = {
  NO_PHONE: "No phone number",
  NO_EMAIL: "No email address",
  NO_APP: "Doesn't use the app",
  TURNED_OFF: "Turned these notifications off",
} as const;

// ------------------------------------------------------------------ SMS segments

/** GSM 03.38 basic set (one septet each). */
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/** GSM extension table (escape + char = two septets). */
const GSM_EXTENDED = "^{}\\[~]|€\f";

export type SmsEncoding = "GSM7" | "UCS2";

export function smsEncoding(text: string): SmsEncoding {
  for (const ch of text) if (!GSM_BASIC.includes(ch) && !GSM_EXTENDED.includes(ch)) return "UCS2";
  return "GSM7";
}

/** Length in the units the network counts: septets for GSM-7, UTF-16 code units for UCS-2. */
export function smsLength(text: string): number {
  if (smsEncoding(text) === "UCS2") return text.length;
  let n = 0;
  for (const ch of text) n += GSM_EXTENDED.includes(ch) ? 2 : 1;
  return n;
}

/** Billable SMS parts: 160/153 per part for GSM-7, 70/67 for UCS-2 (emoji, most accented letters). */
export function smsSegments(text: string): number {
  if (!text) return 0;
  const len = smsLength(text);
  const ucs = smsEncoding(text) === "UCS2";
  const single = ucs ? 70 : 160;
  const part = ucs ? 67 : 153;
  return len <= single ? 1 : Math.ceil(len / part);
}

/** Longest SMS a church may send: 6 parts. */
export const SMS_MAX_SEGMENTS = 6;

export const MESSAGE_LIMITS = {
  /** Characters, checked against the template; parts are checked after personalising. */
  body: { SMS: 900, EMAIL: 5000, IN_APP: 1000 },
  subject: 150,
} as const satisfies { body: Record<MessageChannel, number>; subject: number };

// ------------------------------------------------------------------ personalising

/** Placeholders a sender may use. Unknown `{…}` text is left as typed. */
export const MESSAGE_PLACEHOLDERS = ["{firstName}", "{church}"] as const;

export interface PersonalizeVars {
  firstName: string;
  church: string;
}

export function personalize(template: string, v: PersonalizeVars): string {
  return template.replaceAll("{firstName}", v.firstName).replaceAll("{church}", v.church);
}

/**
 * Parts for an estimate before recipients are known: placeholders filled with long stand-ins,
 * so the estimate errs high. The real charge is computed per recipient.
 */
export function estimateSegments(template: string, churchName: string): number {
  return smsSegments(personalize(template, { firstName: "Bartholomew", church: churchName }));
}

// ------------------------------------------------------------------ audiences

export const BROADCAST_PEOPLE = ["STAFF", "MEMBERS"] as const;
/** STAFF = Administrators and Managers of each church reached; MEMBERS = everyone active there. */
export type BroadcastPeople = (typeof BROADCAST_PEOPLE)[number];

/** Roles counted as STAFF in a broadcast. */
export const BROADCAST_STAFF_ROLES = [
  "ADMINISTRATOR",
  "MANAGER",
] as const satisfies readonly MemberRole[];

/**
 * Levels a sender's broadcast can reach below it (blueprint §3.3 "Cross-level messaging"):
 * a parish its outstations; a deanery its parishes (and their outstations); a diocese or
 * archdiocese everything under it; the province the nation. Outstations reach nobody below.
 */
export const BROADCAST_LEVELS: Record<HierarchyLevel, readonly HierarchyLevel[]> = {
  VATICAN: [],
  NUNCIATURE: [],
  PROVINCE: ["ARCHDIOCESE", "DIOCESE", "DEANERY", "PARISH", "OUTSTATION"],
  ARCHDIOCESE: ["DEANERY", "PARISH", "OUTSTATION"],
  DIOCESE: ["DEANERY", "PARISH", "OUTSTATION"],
  DEANERY: ["PARISH", "OUTSTATION"],
  PARISH: ["OUTSTATION"],
  OUTSTATION: [],
};

export const canBroadcast = (level: HierarchyLevel) => BROADCAST_LEVELS[level].length > 0;

/**
 * Is `target` reached by a broadcast from `sender` to `levels`?
 * Strictly below the sender, on an allowed level, and — for a metropolitan archdiocese — not
 * inside a suffragan diocese: the archbishop has vigilance, not governance, over suffragans
 * (blueprint §3.4), so his broadcasts stop at his own archdiocese whatever their visibility.
 * Fails closed on a path it can't resolve.
 */
export function inBroadcastReach(
  sender: GroupNode,
  target: GroupNode,
  levels: readonly HierarchyLevel[],
  lookup: GroupLookup,
): boolean {
  if (!isStrictDescendant(target.path, sender.path)) return false;
  const allowed = BROADCAST_LEVELS[sender.level];
  if (!allowed.includes(target.level) || !levels.includes(target.level)) return false;
  if (sender.level === "ARCHDIOCESE") {
    const below = pathIds(target.path).slice(pathIds(sender.path).length);
    for (const id of below) {
      const node = id === target.id ? target : lookup(id);
      if (!node) return false;
      if (node.level === "DIOCESE") return false;
    }
  }
  return true;
}

/** Levels the sender may pick, narrowed to those that actually exist below it. */
export function broadcastLevelsFor(
  level: HierarchyLevel,
  present: readonly HierarchyLevel[],
): HierarchyLevel[] {
  return BROADCAST_LEVELS[level].filter((l) => present.includes(l));
}

// ------------------------------------------------------------------ SMS billing

/** SMS credit to give back after delivery: what was charged for recipients that failed. */
export const smsRefund = (failedSegments: readonly number[]) =>
  failedSegments.reduce((a, b) => a + b, 0);

// ------------------------------------------------------------------ notification preferences

export const NOTIFICATION_CHANNELS = ["IN_APP", "SMS", "EMAIL", "PUSH"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPE_CODES = [
  "SYSTEM",
  "BIRTHDAY",
  "MESSAGE",
  "COLLECTION_REVIEW",
  "SUBSCRIPTION",
  "MEMBER_REGISTRATION",
  "PODCAST_EPISODE",
  "EXPLORE_REVIEW",
  "CHURCH_POST",
  "COMMENT_MENTION",
  "BOOK_REVIEW",
  "BOOK_REFUND",
] as const;
export type NotificationTypeCode = (typeof NOTIFICATION_TYPE_CODES)[number];

export interface PreferenceType {
  code: NotificationTypeCode;
  label: string;
  hint: string;
  /** false = always on: the person must hear it (account, money, decisions about them). */
  mutable: boolean;
  /** Only shown to people with a CMS role somewhere. */
  staffOnly: boolean;
}

/** What the settings page lists, in order (D-052). */
export const PREFERENCE_TYPES: readonly PreferenceType[] = [
  {
    code: "MESSAGE",
    label: "Messages from your churches",
    hint: "In-app copies of messages your church sends.",
    mutable: true,
    staffOnly: false,
  },
  {
    code: "CHURCH_POST",
    label: "New posts from churches you follow",
    hint: "When a church you follow posts on Explore.",
    mutable: true,
    staffOnly: false,
  },
  {
    code: "PODCAST_EPISODE",
    label: "New podcast episodes",
    hint: "When a podcast you follow publishes an episode.",
    mutable: true,
    staffOnly: false,
  },
  {
    code: "COMMENT_MENTION",
    label: "Mentions",
    hint: "When someone mentions you in a comment.",
    mutable: true,
    staffOnly: false,
  },
  {
    code: "BIRTHDAY",
    label: "Birthday digest",
    hint: "Each morning, who is celebrating in the churches you help run.",
    mutable: true,
    staffOnly: true,
  },
  {
    code: "MEMBER_REGISTRATION",
    label: "Membership requests",
    hint: "When someone asks to join a church you run.",
    mutable: true,
    staffOnly: true,
  },
  {
    code: "COLLECTION_REVIEW",
    label: "Collections",
    hint: "Collections recorded, approved or not approved.",
    mutable: true,
    staffOnly: true,
  },
  {
    code: "SYSTEM",
    label: "Your memberships",
    hint: "Decisions about your requests and your home church. Always on.",
    mutable: false,
    staffOnly: false,
  },
  {
    code: "SUBSCRIPTION",
    label: "Subscription",
    hint: "Your church's plan and renewals. Always on.",
    mutable: false,
    staffOnly: true,
  },
  {
    code: "EXPLORE_REVIEW",
    label: "Your Explore posts",
    hint: "Reviews of posts you wrote. Always on.",
    mutable: false,
    staffOnly: false,
  },
  {
    code: "BOOK_REVIEW",
    label: "Your books",
    hint: "Reviews of books you sell. Always on.",
    mutable: false,
    staffOnly: false,
  },
  {
    code: "BOOK_REFUND",
    label: "Refunds",
    hint: "Updates on refunds you asked for. Always on.",
    mutable: false,
    staffOnly: false,
  },
];

export const isMutableType = (code: string) =>
  PREFERENCE_TYPES.some((t) => t.code === code && t.mutable);

/**
 * Is the type delivered on `channel` for someone with these saved rows?
 * No row = on (opt-out model). Always-on types ignore saved rows.
 */
export function isDelivered(
  code: string,
  channel: NotificationChannel,
  saved: readonly { code: string; channel: NotificationChannel; enabled: boolean }[],
): boolean {
  if (!isMutableType(code)) return true;
  const row = saved.find((s) => s.code === code && s.channel === channel);
  return row ? row.enabled : true;
}

// ------------------------------------------------------------------ birthday digest

/** Today's date (YYYY-MM-DD) in a time zone — the digest runs on the church's calendar day. */
export function localIsoDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "Ama Mensah (30), Kofi Asante and 3 others" — at most `shown` names. */
export function birthdayDigestLine(
  people: readonly { name: string; turning: number | null }[],
  shown = 3,
): string {
  const names = people
    .slice(0, shown)
    .map((p) => (p.turning != null && p.turning > 0 ? `${p.name} (${p.turning})` : p.name));
  const rest = people.length - names.length;
  if (rest > 0) return `${names.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
