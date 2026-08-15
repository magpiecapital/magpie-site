#!/usr/bin/env python3
"""Pre-ship audit: slug uniqueness, cat<->sub validity, sport/player presence
for sports, comps sanity (band ordering), image files exist."""
import re, os, sys
SITE = "/Users/bradleylubetkin/magpie-site"
VALID = {
  "pokemon": {"Vintage WOTC", "Modern chase"},
  "sports": {"Fleer vintage", "Topps Chrome", "Panini Prizm", "Upper Deck", "Autographs"},
  "onepiece": {"Manga rares & alts", "Event promos"},
  "yugioh": {"Vintage LOB"},
}
SPORTS = {"Basketball","Football","Baseball","Hockey","Soccer","Multi-sport"}
slugs, bad = {}, 0
for f in ["src/lib/collectibles-catalog.ts","src/lib/collectibles-catalog-expansion.ts","src/lib/collectibles-catalog-wave2.ts"]:
    s = open(os.path.join(SITE,f)).read()
    for m in re.finditer(r'\{\s*\n\s*slug: "([^"]+)",[\s\S]*?comps: (null|\{ asOf[\s\S]*?\}),\n  \},', s):
        block = m.group(0); slug = m.group(1)
        if slug in slugs: print("DUP SLUG:", slug, f, "also in", slugs[slug]); bad += 1
        slugs[slug] = f
        cat = re.search(r'category: "([^"]+)"', block).group(1)
        sub = re.search(r'sub: "([^"]+)"', block).group(1)
        if sub not in VALID[cat]: print("BAD SUB:", slug, cat, sub); bad += 1
        if cat == "sports":
            sp = re.search(r'sport: "([^"]+)"', block)
            if not sp or sp.group(1) not in SPORTS: print("BAD SPORT:", slug); bad += 1
        for img_m in re.finditer(r'(?:thumb|image): [`"]([^`"$]+)[`"]', block):
            p = img_m.group(1)
            if p.startswith("/collectibles") and not os.path.exists(SITE + "/public" + p):
                print("MISSING IMG:", slug, p); bad += 1
        for bm in re.finditer(r'low: (\d+), high: (\d+)', block):
            if int(bm.group(1)) > int(bm.group(2)): print("BAND ORDER:", slug); bad += 1
print(f"audit: {len(slugs)} items, {bad} problems")
sys.exit(1 if bad else 0)
