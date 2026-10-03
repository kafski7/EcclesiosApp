/**
 * Saints (functionality §3.3, D-025). Pure rules: feast dates, rank order, saint of the day.
 * Feasts are fixed month/day dates (General Roman Calendar). Movable celebrations are not saints'
 * days and are carried by the Readings calendar instead.
 */
import { parseIsoDate } from "./liturgy.js";

/** Highest first. */
export const CELEBRATION_RANKS = ["SOLEMNITY", "FEAST", "MEMORIAL", "OPTIONAL_MEMORIAL", "COMMEMORATION"] as const;
export type CelebrationRank = (typeof CELEBRATION_RANKS)[number];

export const RANK_LABEL: Record<CelebrationRank, string> = {
  SOLEMNITY: "Solemnity",
  FEAST: "Feast",
  MEMORIAL: "Memorial",
  OPTIONAL_MEMORIAL: "Optional memorial",
  COMMEMORATION: "Commemoration",
};

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** 29 February is a valid feast day (it only occurs in leap years). */
export const isValidFeast = (month: number, day: number) =>
  Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1]!;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: number) => MONTHS[month - 1] ?? "";
export const feastLabel = (month: number, day: number) => `${day} ${monthName(month)}`;

/** "Thérèse of Lisieux" → "therese-of-lisieux". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface FeastEntry {
  slug: string;
  name: string;
  feastMonth: number;
  feastDay: number;
  rank: CelebrationRank;
}

export const rankIndex = (r: CelebrationRank) => CELEBRATION_RANKS.indexOf(r);

/** Calendar order, then rank, then name — the directory and "today" lists use this. */
export function compareFeasts(a: FeastEntry, b: FeastEntry) {
  return (
    a.feastMonth - b.feastMonth ||
    a.feastDay - b.feastDay ||
    rankIndex(a.rank) - rankIndex(b.rank) ||
    a.name.localeCompare(b.name)
  );
}

export function feastOf(iso: string) {
  const d = parseIsoDate(iso);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Everyone commemorated on `iso`, highest rank first; the first is the saint of the day. */
export function saintsOn<T extends FeastEntry>(all: readonly T[], iso: string): T[] {
  const { month, day } = feastOf(iso);
  return all.filter((s) => s.feastMonth === month && s.feastDay === day).sort(compareFeasts);
}
