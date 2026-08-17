#!/usr/bin/env node
/**
 * Integrity guard for the collectibles catalog (all waves, FULL_CATALOG).
 *
 * The catalog drives real dollar estimates and borrow figures on public
 * surfaces. Two failure modes here are not cosmetic — they are dishonest:
 *
 *   1. The SAME card image reused across two different assets that carry
 *      DIFFERENT comps. A visitor sees one photo priced two ways. This bit
 *      us once (Charizard #4 vs #9 shared art, different values) and was
 *      called out as "deceiving and UNACCEPTABLE". Never again — it fails
 *      the build now.
 *   2. Malformed comps (low > high, empty bands, non-finite figures, bad
 *      asOf) — a silent mis-quote of the market.
 *
 * Plus structural invariants the router and pages assume: unique slugs,
 * no duplicate card, every referenced image actually present on disk.
 *
 * Zero dependencies — Node runs the TypeScript directly, matching the other
 * lightweight guards (check:gate, check:comp-freshness).
 *
 * Usage: node --experimental-strip-types scripts/check-catalog-integrity.mjs
 * Exit:  0 clean · 1 an invariant was violated
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FULL_CATALOG } from "../src/lib/collectibles-catalog.ts";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const problems = [];
const fail = (slug, msg) => problems.push(`  ✗ ${slug}: ${msg}`);

// ── Uniqueness: slugs, cards, and non-placeholder imagery ──
const bySlug = new Map();
const byCard = new Map(); // name+meta → slug
const byImage = new Map(); // real image path → { slug, comps signature }

const compSig = (c) =>
  c ? c.bands.map((b) => `${b.label}:${b.low}-${b.high}`).join("|") : "none";

for (const it of FULL_CATALOG) {
  // slug uniqueness — a collision silently drops a page (Map/route overwrite)
  if (bySlug.has(it.slug)) fail(it.slug, `duplicate slug (also ${bySlug.get(it.slug)})`);
  else bySlug.set(it.slug, it.name);

  // same card listed twice
  const cardKey = `${it.name.toLowerCase().trim()} · ${it.meta.toLowerCase().trim()}`;
  if (byCard.has(cardKey)) fail(it.slug, `duplicate card "${it.name} — ${it.meta}" (also ${byCard.get(cardKey)})`);
  else byCard.set(cardKey, it.slug);

  // tier sanity (TS enforces the type, but a hand-edit can slip a bad value)
  if (it.tier !== "A" && it.tier !== "B") fail(it.slug, `invalid tier ${JSON.stringify(it.tier)}`);

  // referenced imagery must exist on disk, or the tile/page renders broken
  for (const [field, p] of [["thumb", it.thumb], ["image", it.image]]) {
    if (!p || !p.startsWith("/")) { fail(it.slug, `${field} is not a public path: ${JSON.stringify(p)}`); continue; }
    if (!existsSync(join(PUBLIC, p))) fail(it.slug, `${field} missing on disk: ${p}`);
  }

  // THE honesty invariant: a real (non-placeholder) card image may not be
  // shared by two assets whose comps differ. Placeholders are allowed to
  // repeat — they are branded slabs, not a specific card's photo.
  if (!it.placeholderImage) {
    const prev = byImage.get(it.image);
    const sig = compSig(it.comps);
    if (prev) {
      if (prev.sig !== sig)
        fail(it.slug, `shares image ${it.image} with ${prev.slug} but comps differ — same photo, two prices`);
      else
        fail(it.slug, `shares real image ${it.image} with ${prev.slug} (distinct assets need distinct art)`);
    } else {
      byImage.set(it.image, { slug: it.slug, sig });
    }
  }

  // comps well-formedness
  if (it.comps !== null) {
    const c = it.comps;
    if (!Array.isArray(c.bands) || c.bands.length === 0) fail(it.slug, "comps has no bands");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.asOf) || Number.isNaN(Date.parse(c.asOf + "T00:00:00Z")))
      fail(it.slug, `comps.asOf is not a valid date: ${JSON.stringify(c.asOf)}`);
    for (const b of c.bands ?? []) {
      if (!Number.isFinite(b.low) || !Number.isFinite(b.high) || b.low <= 0 || b.high <= 0)
        fail(it.slug, `band "${b.label}" has non-positive/non-finite figures (${b.low}, ${b.high})`);
      else if (b.low > b.high)
        fail(it.slug, `band "${b.label}" has low > high (${b.low} > ${b.high})`);
    }
  }
}

if (problems.length) {
  console.error(`[catalog-integrity] FAIL — ${problems.length} problem(s) across ${FULL_CATALOG.length} assets:`);
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`[catalog-integrity] OK — ${FULL_CATALOG.length} assets, all invariants hold.`);
