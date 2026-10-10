/**
 * Explore seed (D-031). Times are relative to the seed run so the events stay "upcoming".
 * Author keys refer to people in data.ts (first names) or the seeded church keys.
 */
export interface SeedPost {
  kind: "ARTICLE" | "EVENT";
  status: "DRAFT" | "PENDING" | "APPROVED";
  church?: string; // group key — posted in the church's name
  /** Member first name for personal posts; church posts are written by that church's Administrator. */
  author?: string;
  title: string;
  summary: string;
  body: string;
  /** Days from now (events) */
  startsInDays?: number;
  durationHours?: number;
  place?: string;
}

export const SEED_POSTS: SeedPost[] = [
  {
    kind: "EVENT",
    status: "APPROVED",
    church: "parA1",
    title: "Parish Harvest Thanksgiving",
    summary: "Join us to give thanks for the year's blessings.",
    body: "Holy Mass followed by the parish harvest. All societies are invited to present their offerings.\n\n## Programme\n- 8:00 Holy Mass\n- 10:30 Harvest and bazaar\n- 13:00 Fellowship lunch",
    startsInDays: 9,
    durationHours: 6,
    place: "St Theresa Parish church grounds",
  },
  {
    kind: "ARTICLE",
    status: "APPROVED",
    church: "parA1",
    title: "Preparing well for Sunday Mass",
    summary: "Three simple habits that help us pray the Mass.",
    body: "The Mass is the source and summit of the Christian life [[CCC 1324]].\n\n## Three habits\n1. Read the Sunday readings beforehand.\n2. Arrive early and keep a moment of silence.\n3. Take one line of the Gospel home with you.\n\n> Do this in memory of me.\n> — Luke 22:19",
  },
  {
    kind: "EVENT",
    status: "APPROVED",
    church: "archPar",
    title: "Diocesan Youth Rally",
    summary: "A day of prayer, music and fellowship for young Catholics.",
    body: "Young people from every parish are welcome. Bring a friend and your parish youth banner.",
    startsInDays: 23,
    durationHours: 8,
    place: "Holy Spirit Cathedral",
  },
  {
    kind: "ARTICLE",
    status: "PENDING",
    author: "Akosua",
    title: "Why the rosary still matters for young people",
    summary: "A reflection from a member of the Catholic Youth Organisation.",
    body: "Many of my friends think the rosary is only for our grandmothers. Here is why I pray it every day.\n\nThe rosary walks with Christ through the mysteries of his life [[CCC 2708]].",
  },
  {
    kind: "ARTICLE",
    status: "DRAFT",
    author: "Akosua",
    title: "Notes on serving at the altar",
    summary: "",
    body: "",
  },
];

export const SEED_CHURCH_PROFILES = [
  {
    church: "parA1",
    about: "St Theresa Parish is a lively community of families and societies. All are welcome.",
    address: "Parish Road, Accra",
    massTimes: "Sunday: 6:30, 8:30, 10:30\nWeekdays: 6:15\nSaturday vigil: 18:00",
    phone: "+233200000107",
    website: null,
  },
];

export const SEED_COMMENTS = [
  {
    post: "Preparing well for Sunday Mass",
    author: "Kofi",
    body: "Thank you, Father. Reading ahead really helps.",
  },
];
