/**
 * Church register (functionality §4.2–4.3, D-037): birthdays, the last-administrator rule,
 * sacramental-record consistency and CSV export. Pure functions only.
 */
import type { MemberRole } from "./levels.js";

// ------------------------------------------------------------------ birthdays

/** Days from `today` (YYYY-MM-DD) to the next occurrence of a birthday (0 = today). 29 Feb → 28 Feb in common years. */
export function daysUntilBirthday(dateOfBirth: string, today: string): number {
  const [, bm, bd] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const start = Date.UTC(ty, tm - 1, td);
  const on = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const day = bm === 2 && bd === 29 && !leap ? 28 : bd;
    return Date.UTC(y, bm - 1, day);
  };
  let next = on(ty);
  if (next < start) next = on(ty + 1);
  return Math.round((next - start) / 86_400_000);
}

/** The age they turn on their next birthday (today counts). */
export function turningAge(dateOfBirth: string, today: string): number {
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const next = new Date(
    Date.UTC(ty, tm - 1, td) + daysUntilBirthday(dateOfBirth, today) * 86_400_000,
  );
  return next.getUTCFullYear() - Number(dateOfBirth.slice(0, 4));
}

export interface BirthdayRow {
  dateOfBirth: string | null;
  isDeceased: boolean;
}

/** Living people with a birthday in the next `days` days (0 = today only), soonest first. */
export function upcomingBirthdays<T extends BirthdayRow & { lastName: string; firstName: string }>(
  rows: readonly T[],
  today: string,
  days: number,
): (Omit<T, "dateOfBirth"> & { dateOfBirth: string; inDays: number; turning: number })[] {
  return rows
    .filter((r): r is T & { dateOfBirth: string } => !!r.dateOfBirth && !r.isDeceased)
    .map((r) => ({
      ...r,
      inDays: daysUntilBirthday(r.dateOfBirth, today),
      turning: turningAge(r.dateOfBirth, today),
    }))
    .filter((r) => r.inDays <= days)
    .sort(
      (a, b) =>
        a.inDays - b.inDays ||
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );
}

// ------------------------------------------------------------------ roles

/** A church must keep at least one active Administrator (D-037). */
export function leavesNoAdministrator(
  activeRoles: readonly { membershipId: string; role: MemberRole }[],
  change: { membershipId: string; to: MemberRole | null },
): boolean {
  const after = activeRoles.map((r) =>
    r.membershipId === change.membershipId ? { ...r, role: change.to } : r,
  );
  return !after.some((r) => r.role === "ADMINISTRATOR");
}

// ------------------------------------------------------------------ sacraments

export interface SacramentalRecord {
  dateOfBirth: string | null;
  isBaptised: boolean;
  baptismDate: string | null;
  isCommunicant: boolean;
  firstCommunionDate: string | null;
  isConfirmed: boolean;
  confirmationDate: string | null;
  isDeceased: boolean;
  deceasedOn: string | null;
}

/** Problems with a record, in plain words. Dates are YYYY-MM-DD; `today` too. */
export function recordProblems(r: SacramentalRecord, today: string): string[] {
  const p: string[] = [];
  const future = (d: string | null, what: string) =>
    d && d > today && p.push(`${what} can't be in the future.`);
  future(r.dateOfBirth, "Date of birth");
  future(r.baptismDate, "Baptism date");
  future(r.firstCommunionDate, "First Communion date");
  future(r.confirmationDate, "Confirmation date");
  future(r.deceasedOn, "Date of death");
  const before = (a: string | null, b: string | null, msg: string) =>
    a && b && a < b && p.push(msg);
  before(r.baptismDate, r.dateOfBirth, "Baptism can't be before birth.");
  before(r.firstCommunionDate, r.baptismDate, "First Communion can't be before Baptism.");
  before(r.confirmationDate, r.baptismDate, "Confirmation can't be before Baptism.");
  before(r.deceasedOn, r.dateOfBirth, "Date of death can't be before birth.");
  if (r.baptismDate && !r.isBaptised) p.push("Tick Baptised, or remove the Baptism date.");
  if (r.firstCommunionDate && !r.isCommunicant) p.push("Tick First Communion, or remove its date.");
  if (r.confirmationDate && !r.isConfirmed) p.push("Tick Confirmed, or remove its date.");
  if (r.deceasedOn && !r.isDeceased) p.push("Tick Deceased, or remove the date of death.");
  if ((r.isCommunicant || r.isConfirmed) && !r.isBaptised)
    p.push("First Communion and Confirmation need Baptism first.");
  return p;
}

// ------------------------------------------------------------------ CSV

/** RFC 4180 field, with spreadsheet formula injection neutralised. */
export function csvField(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvRow = (cells: readonly unknown[]) => cells.map(csvField).join(",");
