/**
 * Hymnal seed (D-026). Books: the New Catholic Hymnal (NCH, 2021) and the older Ghana Catholic
 * Hymnal (CH), both of the Catholic Bishops' Conference of Ghana. The hymns below are PUBLIC-DOMAIN
 * texts only (authors died over a century ago); hymnal arrangements, sol-fa/staff scores and any
 * copyrighted texts are added by a Super-Admin once permission is in place.
 * NCH numbers follow the published NCH index — check them against your printed copy.
 */
export const HYMN_BOOKS = [
  {
    code: "NCH",
    name: "New Catholic Hymnal",
    country: "GH",
    publisher: "Catholic Bishops' Conference of Ghana",
    sortOrder: 1,
  },
  {
    code: "CH",
    name: "Catholic Hymnal (Ghana)",
    country: "GH",
    publisher: "Catholic Bishops' Conference of Ghana",
    sortOrder: 2,
  },
] as const;

export interface SeedHymn {
  slug: string;
  title: string | null;
  firstLine: string;
  author: string;
  verses: { label: string; lines: string[] }[];
  numbers: { book: "NCH" | "CH"; number: string }[];
  tags: string[];
  tunes: { name: string; composer: string | null; meter: string | null; isDefault: boolean }[];
}

export const SEED_HYMNS: SeedHymn[] = [
  {
    slug: "o-come-o-come-emmanuel",
    title: null,
    firstLine: "O come, O come, Emmanuel",
    author: "Latin, 12th c.; tr. John Mason Neale (1818–1866)",
    numbers: [{ book: "NCH", number: "13" }],
    tags: ["advent"],
    verses: [
      {
        label: "1",
        lines: [
          "O come, O come, Emmanuel,",
          "and ransom captive Israel,",
          "that mourns in lonely exile here",
          "until the Son of God appear.",
        ],
      },
      { label: "R", lines: ["Rejoice! Rejoice! Emmanuel", "shall come to thee, O Israel."] },
      {
        label: "2",
        lines: [
          "O come, thou Dayspring, come and cheer",
          "our spirits by thine advent here;",
          "disperse the gloomy clouds of night,",
          "and death's dark shadows put to flight.",
        ],
      },
    ],
    tunes: [
      {
        name: "VENI EMMANUEL",
        composer: "15th-century French processional",
        meter: "LM with refrain",
        isDefault: true,
      },
    ],
  },
  {
    slug: "away-in-a-manger",
    title: null,
    firstLine: "Away in a manger, no crib for a bed",
    author: "Anonymous, 19th c.",
    numbers: [{ book: "NCH", number: "35" }],
    tags: ["christmas"],
    verses: [
      {
        label: "1",
        lines: [
          "Away in a manger, no crib for a bed,",
          "the little Lord Jesus laid down his sweet head;",
          "the stars in the bright sky looked down where he lay,",
          "the little Lord Jesus asleep on the hay.",
        ],
      },
      {
        label: "2",
        lines: [
          "The cattle are lowing, the baby awakes,",
          "but little Lord Jesus no crying he makes.",
          "I love thee, Lord Jesus! look down from the sky,",
          "and stay by my side until morning is nigh.",
        ],
      },
    ],
    // Two tunes for one text (D-026).
    tunes: [
      {
        name: "CRADLE SONG",
        composer: "William J. Kirkpatrick (1838–1921)",
        meter: "11 11 11 11",
        isDefault: true,
      },
      {
        name: "MUELLER",
        composer: "James R. Murray (1841–1905)",
        meter: "11 11 11 11",
        isDefault: false,
      },
    ],
  },
  {
    slug: "joy-to-the-world",
    title: null,
    firstLine: "Joy to the world! The Lord is come!",
    author: "Isaac Watts (1674–1748)",
    numbers: [{ book: "NCH", number: "54" }],
    tags: ["christmas"],
    verses: [
      {
        label: "1",
        lines: [
          "Joy to the world! The Lord is come!",
          "Let earth receive her King;",
          "let every heart prepare him room,",
          "and heaven and nature sing.",
        ],
      },
      {
        label: "2",
        lines: [
          "Joy to the earth! The Saviour reigns!",
          "Let men their songs employ;",
          "while fields and floods, rocks, hills and plains",
          "repeat the sounding joy.",
        ],
      },
    ],
    tunes: [
      {
        name: "ANTIOCH",
        composer: "arr. Lowell Mason (1792–1872)",
        meter: "CM with repeats",
        isDefault: true,
      },
    ],
  },
  {
    slug: "o-come-all-ye-faithful",
    title: "Adeste Fideles",
    firstLine: "O come, all ye faithful",
    author: "Latin, 18th c.; tr. Frederick Oakeley (1802–1880)",
    numbers: [{ book: "NCH", number: "56" }],
    tags: ["christmas", "entrance"],
    verses: [
      {
        label: "1",
        lines: [
          "O come, all ye faithful, joyful and triumphant,",
          "O come ye, O come ye to Bethlehem;",
          "come and behold him, born the King of angels:",
        ],
      },
      {
        label: "R",
        lines: [
          "O come, let us adore him,",
          "O come, let us adore him,",
          "O come, let us adore him, Christ the Lord.",
        ],
      },
    ],
    tunes: [
      {
        name: "ADESTE FIDELES",
        composer: "John Francis Wade (1711–1786)",
        meter: "Irregular",
        isDefault: true,
      },
    ],
  },
  {
    slug: "silent-night",
    title: null,
    firstLine: "Silent night! Holy night!",
    author: "Joseph Mohr (1792–1848); tr. John F. Young (1820–1885)",
    numbers: [{ book: "NCH", number: "63" }],
    tags: ["christmas"],
    verses: [
      {
        label: "1",
        lines: [
          "Silent night! Holy night!",
          "All is calm, all is bright",
          "round yon virgin mother and child.",
          "Holy infant, so tender and mild,",
          "sleep in heavenly peace.",
        ],
      },
      {
        label: "2",
        lines: [
          "Silent night! Holy night!",
          "Shepherds quake at the sight;",
          "glories stream from heaven afar,",
          "heavenly hosts sing Alleluia!",
          "Christ, the Saviour, is born!",
        ],
      },
    ],
    tunes: [
      {
        name: "STILLE NACHT",
        composer: "Franz X. Gruber (1787–1863)",
        meter: "Irregular",
        isDefault: true,
      },
    ],
  },
  // Non-seasonal hymns, so the hymn of the day has choices in Ordinary Time (D-033). No book numbers seeded.
  {
    slug: "holy-god-we-praise-thy-name",
    title: null,
    firstLine: "Holy God, we praise thy name",
    author: "Ignaz Franz (1719–1790); tr. Clarence A. Walworth (1820–1900)",
    numbers: [],
    tags: ["entrance", "praise"],
    verses: [
      {
        label: "1",
        lines: [
          "Holy God, we praise thy name;",
          "Lord of all, we bow before thee;",
          "all on earth thy sceptre claim,",
          "all in heaven above adore thee.",
          "Infinite thy vast domain,",
          "everlasting is thy reign.",
        ],
      },
    ],
    tunes: [
      {
        name: "GROSSER GOTT",
        composer: "Katholisches Gesangbuch, Vienna (c. 1774)",
        meter: "7 8 7 8 7 7",
        isDefault: true,
      },
    ],
  },
  {
    slug: "faith-of-our-fathers",
    title: null,
    firstLine: "Faith of our fathers, living still",
    author: "Frederick W. Faber (1814–1863)",
    numbers: [],
    tags: ["recessional"],
    verses: [
      {
        label: "1",
        lines: [
          "Faith of our fathers, living still",
          "in spite of dungeon, fire and sword;",
          "O how our hearts beat high with joy",
          "whene'er we hear that glorious word!",
        ],
      },
      {
        label: "R",
        lines: ["Faith of our fathers, holy faith!", "We will be true to thee till death."],
      },
    ],
    tunes: [
      {
        name: "ST CATHERINE",
        composer: "Henri F. Hemy (1818–1888)",
        meter: "8 8 8 8 8 8",
        isDefault: true,
      },
    ],
  },
  {
    slug: "immaculate-mary",
    title: null,
    firstLine: "Immaculate Mary, your praises we sing",
    author: "Jeremiah Cummings (1814–1866)",
    numbers: [],
    tags: ["marian"],
    verses: [
      {
        label: "1",
        lines: [
          "Immaculate Mary, your praises we sing;",
          "you reign now in splendour with Jesus our King.",
        ],
      },
      { label: "R", lines: ["Ave, ave, ave, Maria!", "Ave, ave, Maria!"] },
    ],
    tunes: [
      {
        name: "LOURDES HYMN",
        composer: "Traditional French melody",
        meter: "11 11 with refrain",
        isDefault: true,
      },
    ],
  },
];
