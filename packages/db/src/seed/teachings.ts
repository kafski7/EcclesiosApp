/**
 * Teachings seed (D-030). Short lessons written for Ecclesios (original text). Bible quotations
 * are from the World English Bible (public domain). The Catechism is cited by paragraph number
 * only — its text is not reproduced. Have a priest review these before launch.
 */
export const TEACHING_TOPICS = [
  { slug: "creed", name: "The Creed", description: "What Catholics believe about God, Christ and the Church.", position: 1 },
  { slug: "sacraments", name: "Sacraments", description: "The seven signs through which Christ gives his grace.", position: 2 },
  { slug: "liturgy", name: "Liturgy", description: "The Mass, the liturgical year and the Church's public prayer.", position: 3 },
  { slug: "prayer", name: "Prayer", description: "How to pray, and the prayers of the Church.", position: 4 },
  { slug: "morality", name: "Moral life", description: "Living as a disciple: conscience, virtue and the commandments.", position: 5 },
  { slug: "social-teaching", name: "Social teaching", description: "Human dignity, justice, the poor and the common good.", position: 6 },
  { slug: "church-history", name: "Church history", description: "The story of the Church from the apostles to today.", position: 7 },
] as const;

export interface SeedTeaching {
  slug: string;
  title: string;
  summary: string;
  topics: string[];
  related: string[];
  body: string;
}

export const SEED_TEACHINGS: SeedTeaching[] = [
  {
    slug: "what-is-a-sacrament",
    title: "What is a sacrament?",
    summary: "Seven signs, given by Christ, through which he truly gives the grace they signify.",
    topics: ["sacraments"],
    related: ["baptism", "the-eucharist"],
    body: `A **sacrament** is a sign instituted by Christ and entrusted to the Church, through which divine life is given to us [[CCC 1131]]. The sign is visible — water, bread and wine, oil, words and gestures — and what it signifies is real: Christ himself acts in it.

## The seven sacraments

The Church celebrates seven sacraments [[CCC 1210]]:

- **Initiation:** Baptism, Confirmation and the Eucharist
- **Healing:** Penance and the Anointing of the Sick
- **Service of communion:** Holy Orders and Matrimony

## Why signs?

We are body and soul, and God meets us as we are. Jesus healed with touch and spoke with words people could hear. In the sacraments he continues to do the same through his Church.

Start with [[teaching:baptism|Baptism]], the doorway to the others, and [[teaching:the-eucharist|the Eucharist]], their summit.`,
  },
  {
    slug: "baptism",
    title: "Baptism: new life in Christ",
    summary: "The first sacrament: washed from sin, reborn as children of God and members of the Church.",
    topics: ["sacraments"],
    related: ["what-is-a-sacrament"],
    body: `Baptism is the foundation of the whole Christian life and the gateway to the other sacraments [[CCC 1213]]. Through it we are freed from sin, reborn as children of God and made members of the Church.

## Commanded by Christ

Before ascending to the Father, Jesus sent the apostles to make disciples of all nations, baptising them in the name of the Father and of the Son and of the Holy Spirit [[Matthew 28:19]]. He also told Nicodemus that no one can enter the Kingdom of God without being born of water and the Spirit [[John 3:5]].

## The signs

- **Water**, poured three times: dying to sin and rising with Christ
- **The white garment**: putting on Christ
- **The lighted candle**: Christ, the light of the world

## For life

Baptism is given once and marks us for ever as belonging to Christ. Each Easter, when we renew our baptismal promises, we choose again the life it began.`,
  },
  {
    slug: "the-eucharist",
    title: "The Eucharist: source and summit",
    summary: "Christ truly present, offered for us and received in Holy Communion.",
    topics: ["sacraments", "liturgy"],
    related: ["what-is-a-sacrament"],
    body: `The Church calls the Eucharist the **source and summit** of the Christian life [[CCC 1324]]. All the other sacraments, and every work of the Church, are directed towards it.

## Instituted at the Last Supper

> This is my body which is given for you. Do this in memory of me.
> — Luke 22:19

On the night before he died, Jesus gave his apostles his Body and Blood under the signs of bread and wine, and commanded them to do the same [[1 Corinthians 11:23-26]].

## Truly present

In the Eucharist Christ is present **truly, really and substantially** — Body and Blood, soul and divinity [[CCC 1374]]. This is why we genuflect before the tabernacle and receive Communion with reverence.

> I am the living bread which came down out of heaven.
> — John 6:51

## Living the Eucharist

1. Take part in Mass every Sunday and holy day of obligation.
2. Prepare to receive Communion in a state of grace, going to Confession when needed.
3. Let Communion with Christ become love for your neighbour.`,
  },
  {
    slug: "what-is-prayer",
    title: "What is prayer?",
    summary: "Lifting the mind and heart to God — and a few simple ways to begin.",
    topics: ["prayer"],
    related: [],
    body: `Prayer is the raising of one's mind and heart to God [[CCC 2559]]. It is a conversation with the One who first loves us and who waits for us to speak and to listen.

## Jesus teaches us to pray

When the disciples asked Jesus to teach them, he gave them the Our Father [[Matthew 6:9-13]]. Every Christian prayer can learn from it: praise of God, desire for his Kingdom, trust for today's needs, forgiveness and protection.

## Ways to pray

- **Vocal prayer**: the Our Father, the Hail Mary, the Rosary
- **Meditation**: reading a Gospel passage slowly and letting it speak
- **Contemplation**: simply being with God in silence

> Pray without ceasing.
> — 1 Thessalonians 5:17

## Begin small

Give God a few minutes at the start and end of each day. Faithfulness matters more than length.`,
  },
  {
    slug: "dignity-of-the-human-person",
    title: "The dignity of the human person",
    summary: "Every person is made in God's image — the foundation of the Church's social teaching.",
    topics: ["social-teaching", "morality"],
    related: [],
    body: `The dignity of the human person is rooted in creation in the image and likeness of God [[CCC 1700]].

> God created man in his own image.
> — Genesis 1:27

## What follows from it

Because every person bears God's image, every life is to be respected from conception to natural death. No one may be treated merely as a means, and justice in society depends on respecting this dignity [[CCC 1929]].

## In daily life

- Speak to and about others with respect
- Care for the poor, the sick and the stranger — Christ identifies himself with them [[Matthew 25:40]]
- Work for fairness at home, at work and in the community`,
  },
];
