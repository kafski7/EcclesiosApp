/** Platform news seed (D-032): two live items (one pinned) and a draft. */
export const SEED_NEWS = [
  {
    slug: "welcome-to-ecclesios",
    title: "Welcome to Ecclesios",
    summary: "Daily readings, saints, hymns, teachings, podcasts and your church — in one place.",
    category: "ANNOUNCEMENT" as const,
    pinned: true,
    status: "PUBLISHED" as const,
    daysAgo: 3,
    body: `Ecclesios brings the daily life of the Church to your phone: the **Mass readings** for each day, the **saint of the day**, the **hymnal**, **teachings** on the faith, **podcasts** and the **Bible**.

## Join your church

Create an account, choose your parish or outstation, and follow your church to see its events and news on Explore.

> Where two or three are gathered in my name, there am I among them.
> — Matthew 18:20`,
  },
  {
    slug: "hymnal-now-searchable-by-number",
    title: "The hymnal is now searchable by number",
    summary: "Type a number like 56 or NCH 56 to open a hymn straight away.",
    category: "UPDATE" as const,
    pinned: false,
    status: "PUBLISHED" as const,
    daysAgo: 1,
    body: `You can now find any hymn by its number in the **New Catholic Hymnal (NCH)** or the older **Catholic Hymnal (CH)** — type \`56\` or \`NCH 56\` in the hymnal search. You can still search by first line or by any words of the hymn.`,
  },
  {
    slug: "draft-advent-reminder",
    title: "Advent begins soon",
    summary: "A reminder to prepare for the new liturgical year.",
    category: "NOTICE" as const,
    pinned: false,
    status: "DRAFT" as const,
    daysAgo: 0,
    body: "Draft text.",
  },
];
