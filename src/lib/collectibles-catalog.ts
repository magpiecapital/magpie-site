/**
 * The collectibles catalog — one entry per approved asset (or tightly-defined
 * asset group), the single source for the /collectibles browser grid and the
 * per-asset pages at /collectibles/[slug].
 *
 * Honesty rules baked in:
 *  - NO dollar valuations anywhere. "Sale comps" on asset pages are LIVE
 *    deep-links into sold-listing searches (eBay sold, PriceCharting), so the
 *    numbers a visitor sees are always today's, never a stale hardcode.
 *  - Tokenization is stated at the CATEGORY level ("vaulted & tokenized on…"),
 *    because we can verify a platform supports the category — not that any
 *    specific cert is currently vaulted there.
 *  - Card imagery: official card-database art (pokemontcg.io, ygoprodeck,
 *    Bandai's official card list), mirrored locally. Items with no clean
 *    official image source carry a branded slab placeholder — never scraped
 *    marketplace product photos.
 */

export type CatalogCategoryKey =
  | "pokemon"
  | "sports"
  | "onepiece"
  | "yugioh";

export interface CatalogItem {
  slug: string;
  name: string;
  /** Set / year / variant line shown under the name. */
  meta: string;
  category: CatalogCategoryKey;
  tier: "A" | "B";
  /** Grid thumbnail (public path). */
  thumb: string;
  /** Detail-page image (public path). */
  image: string;
  /** True when the image is a branded placeholder, not the actual card. */
  placeholderImage?: boolean;
  /** 2–3 collector-literate paragraphs. Factual; no prices. */
  description: string[];
  /** Search query used to build live sold-comp links. */
  compQuery: string;
  /** Extra notes rendered under the comp links (velocity, market caveats). */
  compNote: string;
}

export const CATEGORY_LABELS: Record<CatalogCategoryKey, string> = {
  pokemon: "Pokémon",
  sports: "Sports Cards",
  onepiece: "One Piece TCG",
  yugioh: "Yu-Gi-Oh!",
};

/** Which vaulting platforms support each category (design repo doc 46). */
export const CATEGORY_PLATFORMS: Record<
  CatalogCategoryKey,
  { name: string; href: string }[]
> = {
  pokemon: [
    { name: "Collector Crypt", href: "https://collectorcrypt.com" },
    { name: "Phygitals", href: "https://www.phygitals.com" },
    { name: "Courtyard", href: "https://courtyard.io" },
  ],
  sports: [
    { name: "Collector Crypt", href: "https://collectorcrypt.com" },
    { name: "Phygitals", href: "https://www.phygitals.com" },
    { name: "Courtyard", href: "https://courtyard.io" },
  ],
  onepiece: [
    { name: "Collector Crypt", href: "https://collectorcrypt.com" },
    { name: "Phygitals", href: "https://www.phygitals.com" },
  ],
  yugioh: [{ name: "Collector Crypt", href: "https://collectorcrypt.com" }],
};

export function ebaySoldUrl(query: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
}
export function priceChartingUrl(query: string): string {
  return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;
}

const C = "/collectibles/cards";

export const CATALOG: CatalogItem[] = [
  // ── Pokémon · Tier A ──
  {
    slug: "charizard-base-set",
    name: "Charizard #4",
    meta: "Base Set · 1999 · Holo",
    category: "pokemon",
    tier: "A",
    thumb: `${C}/thumb-charizard-base.webp`,
    image: `${C}/full-charizard-base.webp`,
    description: [
      "The flagship card of the entire hobby. The 1999 Base Set Charizard is the most-recognized trading card in the world, with an unbroken, decades-deep sales record across every grade and printing (shadowless, unlimited, 1st Edition).",
      "Its population is large enough that graded copies trade essentially every day, which is exactly what makes it lendable: comps are dense, spreads are known, and an exit never waits on a rare buyer.",
    ],
    compQuery: "Charizard Base Set 4/102 PSA",
    compNote:
      "Grade and printing (shadowless / unlimited / 1st Ed) are separate markets — comps are always keyed to the exact variant on the slab.",
  },
  {
    slug: "blastoise-base-set",
    name: "Blastoise #2",
    meta: "Base Set · 1999 · Holo",
    category: "pokemon",
    tier: "A",
    thumb: `${C}/thumb-blastoise-base.webp`,
    image: `${C}/full-blastoise-base.webp`,
    description: [
      "One of the Base Set's big three starters and a permanent staple of vintage collecting. Blastoise trades constantly in grades 8–10 across every major venue.",
      "Deep population, steady velocity, and a comp history that goes back twenty-five years make it a textbook Tier A asset.",
    ],
    compQuery: "Blastoise Base Set 2/102 PSA",
    compNote: "Shadowless and unlimited printings are comped separately.",
  },
  {
    slug: "venusaur-base-set",
    name: "Venusaur #15",
    meta: "Base Set · 1999 · Holo",
    category: "pokemon",
    tier: "A",
    thumb: `${C}/thumb-venusaur-base.webp`,
    image: `${C}/full-venusaur-base.webp`,
    description: [
      "The third of the Base Set starters. Venusaur's market is slightly thinner than Charizard's but still deep by any normal standard — repeat sales weekly in the popular grade bands.",
      "It anchors the same vintage segment as its two counterparts and is comped the same way: exact variant, exact grade, sold prices only.",
    ],
    compQuery: "Venusaur Base Set 15/102 PSA",
    compNote: "Shadowless and unlimited printings are comped separately.",
  },
  {
    slug: "lugia-neo-genesis",
    name: "Lugia #9",
    meta: "Neo Genesis · 2000 · Holo",
    category: "pokemon",
    tier: "A",
    thumb: `${C}/thumb-lugia-neo.webp`,
    image: `${C}/full-lugia-neo.webp`,
    description: [
      "The chase card of the Neo era and one of the most notoriously hard vintage holos to grade well, which keeps high-grade demand permanent.",
      "Sales are consistent across grades 8–10 with a comp record dense enough to price precisely — the exact profile Tier A requires.",
    ],
    compQuery: "Lugia Neo Genesis 9/111 PSA",
    compNote: "1st Edition and unlimited are separate markets.",
  },
  {
    slug: "umbreon-vmax-alt",
    name: "Umbreon VMAX #215",
    meta: "Evolving Skies · 2021 · Alt art",
    category: "pokemon",
    tier: "A",
    thumb: `${C}/thumb-umbreon-vmax-215.webp`,
    image: `${C}/full-umbreon-vmax-215.webp`,
    description: [
      "\"Moonbreon\" — the most-traded modern Pokémon card, full stop. The Evolving Skies alt-art Umbreon VMAX moves in volume that vintage cards can't match, with hundreds of graded sales a month at peak.",
      "That velocity is why a modern card sits in Tier A: the comp corpus refreshes weekly, and exits clear fast at tight spreads.",
    ],
    compQuery: "Umbreon VMAX 215/203 Evolving Skies PSA 10",
    compNote:
      "The alt art (#215) is its own market — never comped against the regular VMAX printing.",
  },

  // ── Pokémon · Tier B ──
  {
    slug: "base-set-holo-rares",
    name: "Base Set holo rares",
    meta: "Zapdos · Chansey · Mewtwo · Alakazam · 1999",
    category: "pokemon",
    tier: "B",
    thumb: `${C}/thumb-zapdos-base.webp`,
    image: `${C}/full-zapdos-base.webp`,
    description: [
      "The rest of the 1999 Base Set holo lineup. Individually cheaper than the big three but sold constantly — these are the cards every returning collector re-buys first.",
      "Each card is comped on its own exact sold record; the group shares Tier B terms because markets a notch thinner than the starters get a wider safety margin.",
    ],
    compQuery: "Base Set holo PSA 9 1999",
    compNote:
      "Comps are per-card, per-grade — the group label just sets the terms tier.",
  },
  {
    slug: "jungle-fossil-holos",
    name: "Jungle & Fossil holos",
    meta: "1st Edition · 1999",
    category: "pokemon",
    tier: "B",
    thumb: `${C}/thumb-flareon-jungle.webp`,
    image: `${C}/full-flareon-jungle.webp`,
    description: [
      "The two 1999 follow-up sets to Base. First Edition holos from Jungle and Fossil are the affordable vintage entry point, and they sell with the regularity that comes with that role.",
      "Population is plentiful and grade-sensitive, so pricing keys hard on the slab's exact grade.",
    ],
    compQuery: "Jungle 1st Edition holo PSA 1999",
    compNote: "1st Edition and unlimited are separate markets, per card.",
  },
  {
    slug: "evolving-skies-alt-vmax",
    name: "Evolving Skies alt-art VMAX",
    meta: "Sylveon · Glaceon · Rayquaza · 2021",
    category: "pokemon",
    tier: "B",
    thumb: `${C}/thumb-rayquaza-vmax-218.webp`,
    image: `${C}/full-rayquaza-vmax-218.webp`,
    description: [
      "The rest of Evolving Skies' famous alt-art VMAX lineup — the set that defined modern chase collecting. Each of these trades weekly in graded form.",
      "They sit one tier below Moonbreon on volume, not on quality of market: comps are just as clean, there are simply fewer of them per week.",
    ],
    compQuery: "Rayquaza VMAX 218/203 Evolving Skies PSA 10",
    compNote: "Each alt art is its own market; comped per card, per grade.",
  },
  {
    slug: "modern-chase-staples",
    name: "Modern chase staples",
    meta: "151 Charizard ex SIR · Crown Zenith GG",
    category: "pokemon",
    tier: "B",
    thumb: `${C}/thumb-charizard-ex-151.webp`,
    image: `${C}/full-charizard-ex-151.webp`,
    description: [
      "The headline pulls of the current era — Scarlet & Violet's 151 Charizard ex special illustration rare and the Crown Zenith Galarian Gallery chase cards.",
      "Modern print runs are large, so populations grow — which the comp process prices in continuously: the corpus is re-pulled at loan time, never assumed from history.",
    ],
    compQuery: "Charizard ex 199/165 151 PSA 10",
    compNote:
      "Modern populations still grow; comps use a recent window, not lifetime averages.",
  },

  // ── Sports ──
  {
    slug: "jordan-fleer-86",
    name: "Michael Jordan #57",
    meta: "Fleer · 1986 · Rookie",
    category: "sports",
    tier: "A",
    thumb: `${C}/slab-jordan-fleer-86.svg`,
    image: `${C}/slab-jordan-fleer-86.svg`,
    placeholderImage: true,
    description: [
      "The most important basketball card ever printed. The 1986 Fleer Jordan rookie is the sports-card market's reserve currency — graded copies trade daily at every grade level.",
      "Its comp record is the deepest in the entire sports category, which is why it anchors Tier A alongside the vintage Pokémon big three.",
    ],
    compQuery: "1986 Fleer Michael Jordan 57 PSA",
    compNote: "Grade is everything here — comps are strictly per-grade.",
  },
  {
    slug: "lebron-topps-chrome",
    name: "LeBron James #111",
    meta: "Topps Chrome · 2003-04 · Rookie",
    category: "sports",
    tier: "B",
    thumb: `${C}/slab-lebron-topps-chrome.svg`,
    image: `${C}/slab-lebron-topps-chrome.svg`,
    placeholderImage: true,
    description: [
      "The definitive modern-vintage basketball rookie. The 2003-04 Topps Chrome LeBron is the benchmark card of its generation with constant graded sales.",
      "Base version only — refractors and numbered parallels are each their own thinner market and are not covered by this listing.",
    ],
    compQuery: "2003 Topps Chrome LeBron James 111 PSA",
    compNote: "Base only. Parallels are separate, thinner markets.",
  },
  {
    slug: "prizm-rookie-benchmarks",
    name: "Modern rookie benchmarks",
    meta: "Wembanyama · Luka · Mahomes · Prizm base PSA 10",
    category: "sports",
    tier: "B",
    thumb: `${C}/slab-prizm-rookie-benchmarks.svg`,
    image: `${C}/slab-prizm-rookie-benchmarks.svg`,
    placeholderImage: true,
    description: [
      "The Prizm base rookies of era-defining players — the most liquid segment of the modern sports market. PSA 10 base Prizm rookies of this tier of player sell many times a day across venues.",
      "Base Prizm only: every colored or serial-numbered parallel is its own thin market and is deliberately excluded (doc 26 S-4 rule).",
    ],
    compQuery: "Wembanyama Prizm base rookie PSA 10",
    compNote: "Base Prizm only — parallels excluded by rule.",
  },
  {
    slug: "autographed-rookies",
    name: "Autographed rookies",
    meta: "PSA/DNA · auto grade 9–10 · iconic players",
    category: "sports",
    tier: "B",
    thumb: "/collectibles/curry-2009-topps-rc-auto.jpg",
    image: "/collectibles/curry-2009-topps-rc-auto.jpg",
    description: [
      "Authenticated autographs of densely-comped, era-defining players (Jordan, LeBron, Curry, Brady, Trout, Kobe) with the signature graded 9–10.",
      "A signed slab is its own market and is never priced off unsigned sales. Autos of players outside the iconic list go to candidate review — a signature doesn't create a market on its own.",
    ],
    compQuery: "Stephen Curry rookie auto PSA/DNA",
    compNote:
      "Signed and unsigned are separate markets; comps use the signed record only.",
  },

  // ── One Piece ──
  {
    slug: "one-piece-manga-rares",
    name: "Manga rares & alt arts",
    meta: "OP01 Shanks · Gear 5 Luffy · PSA 9–10",
    category: "onepiece",
    tier: "B",
    thumb: `${C}/thumb-op01-120-shanks.webp`,
    image: `${C}/full-op01-120-shanks.webp`,
    description: [
      "The chase tier of the fastest-growing TCG of the decade. One Piece manga rares and alt arts — OP01 Shanks, Gear 5 Luffy and peers — sell in dense, continuous volume in graded form.",
      "The band is exactly our sweet spot: most of these trade between the low hundreds and low thousands, with fresh comps weekly.",
    ],
    compQuery: "OP01-120 Shanks manga rare PSA 10",
    compNote: "English and Japanese printings are comped separately.",
  },
  {
    slug: "one-piece-event-promos",
    name: "Event & crossover promos",
    meta: "US Voyage college basketball · Bandai official",
    category: "onepiece",
    tier: "B",
    thumb: `${C}/thumb-op-p055-promo.webp`,
    image: `${C}/full-op-p055-promo.webp`,
    description: [
      "Official Bandai event promos — headlined by the One Piece US Voyage college-basketball crossover cards. Tightly-defined print events with per-promo tracked sold histories.",
      "Supply is fixed per event, demand is cross-hobby (TCG collectors plus sports fans), and the realized-sale record per promo is precise enough to comp cleanly.",
    ],
    compQuery: "One Piece US Voyage promo PSA",
    compNote:
      "Comped per promo card; fixed event supply keeps populations stable.",
  },

  // ── Yu-Gi-Oh ──
  {
    slug: "blue-eyes-lob",
    name: "Blue-Eyes White Dragon",
    meta: "LOB-001 · 1st Edition · 2002",
    category: "yugioh",
    tier: "B",
    thumb: `${C}/thumb-blue-eyes-lob.webp`,
    image: `${C}/full-blue-eyes-lob.webp`,
    description: [
      "The most iconic Yu-Gi-Oh! card in existence — LOB-001 from the game's first English set. High-grade copies sell regularly and have for two decades.",
      "Only the Legend of Blue Eyes printing qualifies here; the card has been reprinted endlessly, and every printing is its own market.",
    ],
    compQuery: "Blue-Eyes White Dragon LOB-001 1st Edition PSA",
    compNote:
      "LOB-001 only — reprints are separate (and far cheaper) markets.",
  },
];

export function getCatalogItem(slug: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.slug === slug);
}
