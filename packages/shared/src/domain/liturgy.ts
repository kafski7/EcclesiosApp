/**
 * Roman liturgical calendar rules (functionality §3.2, D-022). Pure and dependency-free.
 * Dates are civil dates "YYYY-MM-DD", computed in UTC so time zones never shift a day.
 *
 * Simplifications (recorded in D-022): Epiphany on 6 January and Baptism of the Lord on the
 * following Sunday (universal calendar); Ordinary Time week numbers and transferred
 * solemnities are not computed — specific celebrations come from the readings data.
 */
export const LITURGICAL_SEASONS = [
  "ADVENT",
  "CHRISTMAS",
  "LENT",
  "TRIDUUM",
  "EASTER",
  "ORDINARY",
] as const;
export type LiturgicalSeason = (typeof LITURGICAL_SEASONS)[number];

export const LITURGICAL_COLORS = ["GREEN", "VIOLET", "WHITE", "RED", "ROSE", "BLACK"] as const;
export type LiturgicalColor = (typeof LITURGICAL_COLORS)[number];

export type SundayCycle = "A" | "B" | "C";
export type WeekdayCycle = "I" | "II";

const DAY = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse "YYYY-MM-DD" strictly (rejects 2026-02-30). */
export function parseIsoDate(s: string): Date {
  const m = ISO.exec(s);
  if (!m) throw new Error(`Invalid date "${s}" — use YYYY-MM-DD`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (toIsoDate(d) !== s) throw new Error(`Invalid date "${s}"`);
  return d;
}

export const isIsoDate = (s: string) => {
  try {
    parseIsoDate(s);
    return true;
  } catch {
    return false;
  }
};

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) =>
  toIsoDate(new Date(parseIsoDate(iso).getTime() + n * DAY));
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const dow = (d: Date) => d.getUTCDay(); // 0 = Sunday

/** Easter Sunday (Gregorian computus, Anonymous/Meeus algorithm). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** First Sunday of Advent: four Sundays before Christmas (falls 27 Nov – 3 Dec). */
export function firstSundayOfAdvent(year: number): Date {
  const christmas = utc(year, 12, 25);
  const back = dow(christmas) === 0 ? 7 : dow(christmas); // last Sunday strictly before 25 Dec
  return new Date(christmas.getTime() - (back + 21) * DAY);
}

/** Baptism of the Lord: the Sunday after 6 January (universal calendar). */
export function baptismOfTheLord(year: number): Date {
  const epiphany = utc(year, 1, 6);
  return new Date(epiphany.getTime() + (7 - dow(epiphany)) * DAY);
}

export interface LiturgicalDay {
  date: string;
  season: LiturgicalSeason;
  /** Default colour of the season; a celebration in the readings data may override it. */
  color: LiturgicalColor;
  isSunday: boolean;
  sundayCycle: SundayCycle;
  weekdayCycle: WeekdayCycle;
  /** Calendar year in which this liturgical year ends (it starts on the First Sunday of Advent before). */
  liturgicalYear: number;
}

const SEASON_COLOR: Record<LiturgicalSeason, LiturgicalColor> = {
  ADVENT: "VIOLET",
  CHRISTMAS: "WHITE",
  LENT: "VIOLET",
  TRIDUUM: "RED",
  EASTER: "WHITE",
  ORDINARY: "GREEN",
};

export function liturgicalDay(iso: string): LiturgicalDay {
  const d = parseIsoDate(iso);
  const y = d.getUTCFullYear();
  const t = d.getTime();
  const easter = easterSunday(y).getTime();
  const ashWednesday = easter - 46 * DAY;
  const holyThursday = easter - 3 * DAY;
  const pentecost = easter + 49 * DAY;
  const advent = firstSundayOfAdvent(y).getTime();
  const christmas = utc(y, 12, 25).getTime();
  const baptism = baptismOfTheLord(y).getTime();

  let season: LiturgicalSeason;
  if (t >= christmas || t <= baptism) season = "CHRISTMAS";
  else if (t >= advent) season = "ADVENT";
  else if (t >= ashWednesday && t < holyThursday) season = "LENT";
  else if (t >= holyThursday && t < easter) season = "TRIDUUM";
  else if (t >= easter && t <= pentecost) season = "EASTER";
  else season = "ORDINARY";

  const liturgicalYear = t >= advent ? y + 1 : y;
  const sundayCycle = (["C", "A", "B"] as const)[liturgicalYear % 3]!;
  const weekdayCycle: WeekdayCycle = liturgicalYear % 2 === 1 ? "I" : "II";
  return {
    date: iso,
    season,
    color: SEASON_COLOR[season],
    isSunday: dow(d) === 0,
    sundayCycle,
    weekdayCycle,
    liturgicalYear,
  };
}

export const SEASON_LABEL: Record<LiturgicalSeason, string> = {
  ADVENT: "Advent",
  CHRISTMAS: "Christmas Time",
  LENT: "Lent",
  TRIDUUM: "Paschal Triduum",
  EASTER: "Easter Time",
  ORDINARY: "Ordinary Time",
};
