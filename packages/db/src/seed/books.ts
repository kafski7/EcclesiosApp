/**
 * Books seed (D-036). Catalogue entries only — there are no book files in the seed, so books
 * start as DRAFT. Upload an EPUB/PDF in the console (Platform → Books, or the Creator studio)
 * and submit it; a Super-Admin approves it to put it on the shelf.
 */
export const SEED_BOOK_COMMISSION_BPS = 2000;

export const SEED_BOOKS = [
  {
    slug: "the-imitation-of-christ",
    title: "The Imitation of Christ",
    subtitle: null,
    authorName: "Thomas à Kempis",
    category: "CLASSICS" as const,
    description:
      "A fifteenth-century guide to the interior life, read by Christians for six hundred years: short chapters on humility, prayer and following Christ. Public-domain translation.",
    aboutAuthor: "Thomas à Kempis (c. 1380–1471) was a canon regular of the Congregation of Windesheim.",
    priceMinor: 0,
    owner: "SUPER" as const,
  },
  {
    slug: "walking-with-the-saints-of-africa",
    title: "Walking with the Saints of Africa",
    subtitle: "Short lives for young readers",
    authorName: "Sample PYC Creator",
    category: "SAINTS" as const,
    description:
      "Sample listing for development: short lives of African saints with a reflection and prayer after each chapter. Upload a file in the Creator studio to try the review flow.",
    aboutAuthor: "A sample creator account used in development.",
    priceMinor: 2500,
    owner: "CREATOR" as const,
  },
];
