/**
 * Collectible submission vetting — the same gate the launch allowlist was
 * built from (design repo doc 26 V-1..V-7, doc 21 proof-of-sale).
 *
 * The point of this file is the downside, not the upside. Every stage FAILS
 * CLOSED: anything we cannot positively establish is a decline or a review,
 * never an approval. Nothing in here can return "approved for a loan" —
 * the liquidity proof (V-2) requires realized multi-venue sold data that a
 * submission form cannot supply, so the best outcome available here is
 * "provisionally eligible, pending sold-comp verification".
 *
 * Deliberately dependency-free and synchronous so it can be unit-tested and
 * reasoned about. No network calls, no model calls, no invented prices.
 */

/**
 * Bumped whenever a gate rule changes. Stored alongside every verdict so an
 * old decision stays interpretable after the rules move on.
 */
export const GATE_VERSION = "v3";

export const GRADERS = ["PSA", "CGC", "BGS", "SGC"] as const;
export const SUPPORTED_PLATFORMS = [
  "Collector Crypt",
  "Courtyard",
  "Phygitals",
  "Beezie",
] as const;

export type Verdict =
  | "DECLINED"
  | "NEEDS_VAULTING"
  | "CANDIDATE_REVIEW"
  | "PROVISIONAL_TIER_A"
  | "PROVISIONAL_TIER_B";

export interface Submission {
  grader: string;
  cert: string;
  /** Free text as the collector typed it, e.g. "Base Set Charizard #4 Shadowless". */
  card: string;
  set?: string;
  year?: string;
  /** Numeric card grade 1-10, or empty when the slab is an authenticated auto. */
  grade?: string;
  /** Autograph grade 1-10 for PSA/DNA-style "Authentic" slabs. */
  autoGrade?: string;
  platform?: string;
  contact?: string;
}

export interface VettingResult {
  /** Mutable: the route can downgrade this when on-chain ownership fails. */
  verdict: Verdict;
  /** Plain-English reason a collector can act on. */
  headline: string;
  /** Every check we ran, in order, with its outcome. */
  checks: { name: string; pass: boolean | null; detail: string }[];
  /** What has to happen next before this could ever back a loan. */
  next: string[];
  tier: "A" | "B" | null;
}

/* ── The launch allowlist, keyed for matching (mirrors doc 26) ────────── */

/**
 * Modern-set markers. The vintage Tier A patterns are guarded by this so a
 * "151 Charizard ex" or a Charizard VMAX cannot ride the vintage Charizard
 * pattern into Tier A — the modern printing is its own (Tier B) market.
 */
const MODERN_MARKERS = /\b(151|ex|gx|vmax|vstar|sir|crown\s*zenith|paldea|obsidian|paradox|temporal)\b/i;

const TIER_A_PATTERNS: { re: RegExp; label: string; notIf?: RegExp }[] = [
  { re: /\bcharizard\b/i, label: "Base Set Charizard #4", notIf: MODERN_MARKERS },
  { re: /\bblastoise\b/i, label: "Base Set Blastoise #2", notIf: MODERN_MARKERS },
  { re: /\bvenusaur\b/i, label: "Base Set Venusaur #15", notIf: MODERN_MARKERS },
  { re: /\blugia\b/i, label: "Neo Genesis Lugia #9", notIf: MODERN_MARKERS },
  { re: /\bumbreon\s*vmax\b|\bmoonbreon\b/i, label: "Evolving Skies Umbreon VMAX #215 alt art" },
  { re: /\b(michael\s+)?jordan\b/i, label: "1986 Fleer Jordan #57" },
];

const TIER_B_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bzapdos\b|\bchansey\b|\bmewtwo\b|\balakazam\b|\bninetales\b|\bgyarados\b|\braichu\b|\bclefairy\b|\bhitmonchan\b|\bmagneton\b|\bpoliwrath\b|\bnidoking\b/i, label: "Base Set holo rare" },
  { re: /\bjungle\b|\bfossil\b|\bsnorlax\b|\bvaporeon\b|\bjolteon\b|\bscyther\b|\bgengar\b|\barticuno\b|\baerodactyl\b|\blapras\b/i, label: "Jungle / Fossil holo" },
  { re: /\bdark\s+charizard\b|\btyphlosion\b/i, label: "WOTC-era vintage holo (Team Rocket / Neo)" },
  { re: /\b(umbreon|lugia|giratina|charizard)\s*v\b(?![a-z])/i, label: "modern alt-art V" },
  { re: /\b(blastoise|venusaur)\s*ex\b/i, label: "151 special illustration rare" },
  { re: /\b(kobe|kevin\s+durant|giannis|jayson\s+tatum|jokic|lamelo|anthony\s+edwards|damian\s+lillard|devin\s+booker|barkley|patrick\s+ewing|dwyane\s+wade|carmelo|justin\s+herbert|joe\s+burrow|josh\s+allen|lamar\s+jackson|justin\s+jefferson|aaron\s+rodgers|peyton\s+manning|drew\s+brees|joe\s+montana|griffey|mike\s+trout|ohtani|mariano\s+rivera|rickey\s+henderson|mattingly|mcgwire|frank\s+thomas|chipper|tony\s+gwynn|wade\s+boggs|kirby\s+puckett|sidney\s+crosby|connor\s+mcdavid|auston\s+matthews|patrick\s+roy|mbappe|lionel\s+messi)\b/i, label: "verified sports benchmark (catalog)" },
  { re: /\bdark\s+magician(\s+girl)?\b|\bexodia\b/i, label: "vintage Yu-Gi-Oh first-print icon" },
  { re: /\bnami\b|\b(roronoa\s+)?zoro\b|\bluffy\b[\s\S]*\b(alt|op01)\b/i, label: "One Piece alt art" },
  { re: /\b(sylveon|glaceon|rayquaza)\s*vmax\b/i, label: "Evolving Skies alt-art VMAX" },
  { re: /\b151\b[\s\S]*\bcharizard\b|\bcharizard\s*ex\b|\bcrown\s*zenith\b/i, label: "modern chase staple (151 Charizard ex · Crown Zenith)" },
  { re: /\bshanks\b|\bgear\s*5\b|\b(one\s*piece|op-?\d{2})\b[\s\S]*\b(manga|alt)\b/i, label: "One Piece manga rare / alt art" },
  { re: /\bblue[- ]?eyes\b[\s\S]*\b(lob|legend|sdk)\b|\blob-?001\b|\bsdk-?001\b/i, label: "Blue-Eyes White Dragon (LOB / SDK first prints)" },
  { re: /\bvoyage\b[\s\S]*\b(college|basketball)\b|\bone\s*piece\b[\s\S]*\bpromo\b/i, label: "One Piece event / crossover promo" },
  { re: /\b(wembanyama|wemby|doncic|luka|mahomes)\b[\s\S]*\bprizm\b|\bprizm\b[\s\S]*\b(wembanyama|wemby|doncic|luka|mahomes)\b/i, label: "modern rookie benchmark (Prizm base)" },
  { re: /\blebron\b/i, label: "LeBron James #111 Topps Chrome" },
];

/**
 * Iconic, densely-comped rookies (doc 26 S-3). These carry the depth of sales
 * record an autograph needs, so an authenticated auto of one of them lands at
 * Tier B. An auto of anyone NOT on this list goes to candidate review — a
 * signature does not create a market on its own, and blanket-accepting
 * "autographed rookies" would be exactly the illiquid lending we refuse.
 */
const ICONIC_ROOKIES: RegExp =
  /\b(michael\s+)?jordan\b|\blebron\b|\b(stephen|steph)\s+curry\b|\bcurry\b|\b(tom\s+)?brady\b|\b(mike\s+)?trout\b|\bkobe\b/i;

/**
 * Hard exclusions (doc 26.3). Value is not liquidity — a card with no
 * population has no comps and cannot be reliably exited, however famous it is.
 */
const EXCLUSIONS: { re: RegExp; why: string }[] = [
  {
    re: /\billustrator\b|\btrophy\b|\bno\.?\s*[123]\s*trainer\b|\b1\s*(of|\/)\s*1\b|\bone[- ]of[- ]a[- ]kind\b|\bprize\b/i,
    why: "One-of-a-kind and trophy cards have no population, so there are no repeat sales to price or exit against. Priceless isn't the same as sellable.",
  },
  {
    re: /\bsealed\b|\bbooster\b|\bbox\b|\bpack\b|\bdisplay\b|\bcase\b|\btin\b/i,
    why: "Sealed product is exposed to reprints and hype cycles. It's staged for later, not launch.",
  },
  {
    re: /\braw\b|\bungraded\b/i,
    why: "Ungraded cards have no authentication anchor we can verify against a grader's records.",
  },
];

/* ── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Canonicalise a grader string. EXPORTED because the submission route must use
 * the SAME normalisation when it stores a row and when it looks for a cert that
 * has been claimed before — otherwise "PSA" and "psa" are different graders and
 * the duplicate-cert fraud signal is evadable by changing capitalisation.
 */
export function normGrader(g: string): string {
  const s = (g || "").trim().toUpperCase();
  if (s.startsWith("PSA")) return "PSA"; // covers "PSA/DNA"
  if (s.startsWith("CGC")) return "CGC";
  if (s.startsWith("BGS") || s.startsWith("BECKETT")) return "BGS";
  if (s.startsWith("SGC")) return "SGC";
  return s;
}

function num(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/* ── The gate ─────────────────────────────────────────────────────────── */

export function vetSubmission(sub: Submission): VettingResult {
  const checks: VettingResult["checks"] = [];
  const haystack = [sub.card, sub.set].filter(Boolean).join(" ");

  const decline = (headline: string, next: string[] = []): VettingResult => ({
    verdict: "DECLINED",
    headline,
    checks,
    next,
    tier: null,
  });

  // V-1 — authentication anchor.
  const grader = normGrader(sub.grader);
  const graderOk = (GRADERS as readonly string[]).includes(grader);
  checks.push({
    name: "Authenticated",
    pass: graderOk,
    detail: graderOk
      ? `Graded by ${grader}.`
      : "We only lend against cards graded by PSA, CGC, BGS or SGC.",
  });
  if (!graderOk) {
    return decline(
      "We can only accept cards graded by PSA, CGC, BGS or SGC.",
      ["Have the card graded by one of those four, then submit it again."],
    );
  }

  const certOk = /^[0-9]{6,12}$/.test((sub.cert || "").replace(/\D/g, ""));
  checks.push({
    name: "Cert supplied",
    pass: certOk,
    detail: certOk
      ? "Cert number is in a usable format. This is a FORMAT check only — see below."
      : "We need the cert number from the slab so we can verify it against the grader's records.",
  });
  if (!certOk) {
    return decline("We need a valid cert number from the slab label.", [
      "Enter the certification number printed on the slab and resubmit.",
    ]);
  }

  // Doc 26.3 — hard exclusions, checked before anything else can pass.
  for (const ex of EXCLUSIONS) {
    if (ex.re.test(haystack)) {
      checks.push({ name: "Not an excluded type", pass: false, detail: ex.why });
      return decline("This isn't a type we can lend against.", [
        "We'd rather decline than lend on something we can't value or exit.",
      ]);
    }
  }
  checks.push({
    name: "Not an excluded type",
    pass: true,
    detail: "Not a one-of-a-kind, trophy, sealed or raw item.",
  });

  // V-1 cont. — condition. Numeric 8-10, OR an authenticated autograph 9-10.
  const grade = num(sub.grade);
  const autoGrade = num(sub.autoGrade);
  const numericOk = grade !== null && grade >= 8 && grade <= 10;
  const autoOk = autoGrade !== null && autoGrade >= 9 && autoGrade <= 10;

  if (!numericOk && !autoOk) {
    checks.push({
      name: "Grade",
      pass: false,
      detail:
        grade !== null
          ? `Grade ${grade} is below our floor of 8 — sales get sparse and the spread gets wide.`
          : "We need either a numeric grade of 8-10, or an authenticated autograph graded 9-10.",
    });
    return decline("This grade is below what we can underwrite.", [
      "We accept numeric grades 8-10, or authenticated autographs graded 9-10.",
    ]);
  }
  checks.push({
    name: "Grade",
    pass: true,
    detail: numericOk
      ? `Numeric grade ${grade}.`
      : `Authenticated autograph graded ${autoGrade}.`,
  });

  // A signed slab is its own market. Never comped against unsigned sales.
  const isAuto = autoOk && !numericOk;

  // V-5/V-6 — allowlist match sets the provisional tier. A vintage Tier A
  // pattern is skipped when its modern-marker guard fires (the modern
  // printing is a different, Tier B market).
  const aHit = TIER_A_PATTERNS.find(
    (p) => p.re.test(haystack) && !(p.notIf && p.notIf.test(haystack)),
  );
  const bHit = TIER_B_PATTERNS.find((p) => p.re.test(haystack));

  let tier: "A" | "B" | null = null;
  let matched = aHit?.label ?? bHit?.label ?? null;
  if (aHit) tier = "A";
  else if (bHit) tier = "B";

  // Authenticated autographs. A signature does not create a market on its
  // own, so an auto only reaches Tier B when the underlying rookie is one of
  // the densely-comped names; anything else goes to candidate review.
  if (isAuto) {
    if (ICONIC_ROOKIES.test(haystack)) {
      tier = "B";
      matched = "authenticated autograph of an iconic rookie";
    } else {
      tier = null;
      matched = null;
    }
  }

  checks.push({
    name: "On the launch list",
    pass: tier !== null,
    detail: tier
      ? `Matches ${matched}${isAuto ? " — autos are held at Tier B, the slab has no numeric condition grade" : ""}.`
      : isAuto
        ? "Autographed slabs only join the list for rookies with a deep, densely-comped sales record. A signature doesn't create a market on its own."
        : "Not on the current launch list. That isn't a no — it means the sold record has to be proven before it can be added.",
  });

  // Nothing typed into a form is evidence. Stated plainly so nobody — user
  // or future maintainer — mistakes a provisional pass for a verified card.
  checks.push({
    name: "Cert verified with the grader",
    pass: null,
    detail:
      "Pending. Everything on this form is self-reported. Before any loan we check the cert against the grader's own records and confirm the card, set, year and grade match what was entered.",
  });

  // V-2 — proven liquidity. This is the one a form can never answer.
  checks.push({
    name: "Proven to sell",
    pass: null,
    detail:
      "Pending. We confirm the exact card — same set, variant, grade — has actually sold, recently and repeatedly, across multiple independent marketplaces. No real sales record, no loan.",
  });

  // Custody.
  const platform = (sub.platform || "").trim();
  const platformOk = (SUPPORTED_PLATFORMS as readonly string[]).some(
    (p) => p.toLowerCase() === platform.toLowerCase(),
  );
  checks.push({
    name: "Vaulted & tokenized",
    pass: platformOk,
    detail: platformOk
      ? `Held on ${platform}.`
      : "Not yet on a platform we support. The card has to be vaulted and tokenized before it can back a loan.",
  });

  const soldCompStep = isAuto
    ? "Verify the sold record for the SIGNED version specifically — a signed card is its own market and is never priced off unsigned sales."
    : "Verify the sold record for this exact set, variant and grade across independent marketplaces.";

  if (!platformOk) {
    return {
      verdict: "NEEDS_VAULTING",
      headline: "Promising — but it needs to be vaulted and tokenized first.",
      checks,
      next: [
        "Follow the guided path at magpie.capital/collectibles/tokenize — pick a vaulting platform (Collector Crypt, Phygitals, …), ship the slab, receive the token.",
        "Then come back: once the token is in your wallet, the loan is waiting.",
        soldCompStep,
      ],
      tier,
    };
  }

  if (tier) {
    return {
      verdict: tier === "A" ? "PROVISIONAL_TIER_A" : "PROVISIONAL_TIER_B",
      headline: `Clears every check we can run from a submission — provisionally Tier ${tier}.`,
      checks,
      next: [
        soldCompStep,
        "Cross-check the value against independent sold data so no single market can inflate it.",
        "Final approval and sizing happen at loan time, against live sold data — not from this form.",
      ],
      tier,
    };
  }

  return {
    verdict: "CANDIDATE_REVIEW",
    headline: "Accepted for review as a candidate to add to the list.",
    checks,
    next: [
      soldCompStep,
      "It needs a real, repeat, multi-venue sales record to be added — this is how the list grows.",
      "If it doesn't reliably sell, we won't lend on it. That's the point.",
    ],
    tier: null,
  };
}
