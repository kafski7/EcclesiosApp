/**
 * DEV readings (D-022). Lectionary translations used in Ghana are copyrighted, so the seed
 * stores real-looking citations with clearly labelled placeholder text. Real text is loaded
 * through PUT /api/platform/readings/:date once a licensed source is chosen.
 * Dates are relative to the seed run so the Readings page always has data around "today".
 */
import { addDays, liturgicalDay, toIsoDate } from "@ecclesios/shared/domain";

const SAMPLE_WEEKDAYS: { first: string; psalm: string; response: string; gospel: string }[] = [
  {
    first: "Job 38:1, 12-21; 40:3-5",
    psalm: "Psalm 139:1-3, 7-10, 13-14",
    response: "Guide me, Lord, along the everlasting way.",
    gospel: "Luke 10:13-16",
  },
  {
    first: "Job 42:1-3, 5-6, 12-17",
    psalm: "Psalm 119:66, 71, 75, 91, 125, 130",
    response: "Lord, let your face shine on me.",
    gospel: "Luke 10:17-24",
  },
  {
    first: "Galatians 1:6-12",
    psalm: "Psalm 111:1-2, 7-10",
    response: "The Lord will remember his covenant for ever.",
    gospel: "Luke 10:25-37",
  },
  {
    first: "Galatians 1:13-24",
    psalm: "Psalm 139:1-3, 13-15",
    response: "Guide me, Lord, along the everlasting way.",
    gospel: "Luke 10:38-42",
  },
  {
    first: "Galatians 2:1-2, 7-14",
    psalm: "Psalm 117:1-2",
    response: "Go out to all the world and tell the Good News.",
    gospel: "Luke 11:1-4",
  },
  {
    first: "Galatians 3:1-5",
    psalm: "Luke 1:69-75",
    response: "Blessed be the Lord, the God of Israel; he has come to his people.",
    gospel: "Luke 11:5-13",
  },
];

const SAMPLE_SUNDAY = {
  celebration: "Sunday in Ordinary Time",
  first: "Isaiah 5:1-7",
  psalm: "Psalm 80:9, 12-16, 19-20",
  response: "The vineyard of the Lord is the house of Israel.",
  second: "Philippians 4:6-9",
  gospel: "Matthew 21:33-43",
};

const placeholder = (citation: string) => [
  `[Development text] The reading from ${citation} appears here once the licensed lectionary text is loaded.`,
  "This placeholder keeps the page layout, tabs and Bible links testable without reproducing copyrighted translations.",
];

export interface SeedReadingDay {
  date: string;
  celebration: string | null;
  source: string;
  readings: {
    kind: "FIRST" | "PSALM" | "SECOND" | "ALLELUIA" | "GOSPEL";
    citation: string;
    response: string | null;
    text: string[];
  }[];
}

/** 3 days back to 10 days ahead of `today`. */
export function sampleReadingDays(today = toIsoDate(new Date())): SeedReadingDay[] {
  const out: SeedReadingDay[] = [];
  for (let i = -3; i <= 10; i++) {
    const date = addDays(today, i);
    const day = liturgicalDay(date);
    if (day.isSunday) {
      out.push({
        date,
        celebration: SAMPLE_SUNDAY.celebration,
        source: "Sample data — not for publication",
        readings: [
          {
            kind: "FIRST",
            citation: SAMPLE_SUNDAY.first,
            response: null,
            text: placeholder(SAMPLE_SUNDAY.first),
          },
          {
            kind: "PSALM",
            citation: SAMPLE_SUNDAY.psalm,
            response: SAMPLE_SUNDAY.response,
            text: placeholder(SAMPLE_SUNDAY.psalm),
          },
          {
            kind: "SECOND",
            citation: SAMPLE_SUNDAY.second,
            response: null,
            text: placeholder(SAMPLE_SUNDAY.second),
          },
          {
            kind: "GOSPEL",
            citation: SAMPLE_SUNDAY.gospel,
            response: null,
            text: placeholder(SAMPLE_SUNDAY.gospel),
          },
        ],
      });
      continue;
    }
    const s = SAMPLE_WEEKDAYS[(i + 3) % SAMPLE_WEEKDAYS.length]!;
    out.push({
      date,
      celebration: null,
      source: "Sample data — not for publication",
      readings: [
        { kind: "FIRST", citation: s.first, response: null, text: placeholder(s.first) },
        { kind: "PSALM", citation: s.psalm, response: s.response, text: placeholder(s.psalm) },
        { kind: "GOSPEL", citation: s.gospel, response: null, text: placeholder(s.gospel) },
      ],
    });
  }
  return out;
}
