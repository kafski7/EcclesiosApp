/**
 * Podcast seed (D-027). Series and DRAFT episodes only: there are no audio files in dev,
 * and an episode cannot go live without audio. Upload audio in the console to publish.
 */
export const SEED_PODCASTS = [
  {
    slug: "ecclesios-weekly",
    title: "Ecclesios Weekly",
    summary: "A short weekly reflection on the Sunday Gospel.",
    description:
      "Ten minutes with the Sunday Gospel: the reading, a reflection and a question to take into the week.",
    category: "reflection",
    owner: "SUPER" as const,
    episodes: [
      {
        number: 1,
        title: "Welcome to Ecclesios Weekly",
        notes: "What this podcast is for and how to use it.",
      },
      {
        number: 2,
        title: "The vineyard and its tenants",
        notes: "A reflection on Matthew 21:33-43.",
      },
    ],
  },
  {
    slug: "youth-on-fire",
    title: "Youth on Fire",
    summary: "Young Catholics talk faith, life and service.",
    description: "Conversations with young people from parishes across Ghana.",
    category: "youth",
    owner: "CREATOR" as const,
    episodes: [{ number: 1, title: "Why we pray together", notes: "Our first conversation." }],
  },
];
