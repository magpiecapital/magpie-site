#!/usr/bin/env python3
"""Wave-2 codegen: verified JSONL -> images + collectibles-catalog-wave2.ts"""
import json, re, ssl, time, urllib.request, pathlib, sys
from PIL import Image

SCRATCH = "SCRATCH_DIR"
CARDS = "/Users/bradleylubetkin/magpie-site/public/collectibles/cards"
ASOF = "2026-08-15"
ctx = ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

PTCGIO_SET = {
 "pokemon-base-set":"base1","pokemon-jungle":"base2","pokemon-fossil":"base3","pokemon-base-set-2":"base4",
 "pokemon-team-rocket":"base5","pokemon-gym-heroes":"gym1","pokemon-gym-challenge":"gym2",
 "pokemon-neo-genesis":"neo1","pokemon-neo-discovery":"neo2","pokemon-neo-revelation":"neo3","pokemon-neo-destiny":"neo4",
 "pokemon-legendary-collection":"base6","pokemon-expedition":"ecard1","pokemon-aquapolis":"ecard2","pokemon-skyridge":"ecard3",
 "pokemon-hidden-fates":"sm115","pokemon-champions-path":"swsh35","pokemon-shining-fates":"swsh45",
 "pokemon-evolving-skies":"swsh7","pokemon-fusion-strike":"swsh8","pokemon-brilliant-stars":"swsh9",
 "pokemon-astral-radiance":"swsh10","pokemon-lost-origin":"swsh11","pokemon-silver-tempest":"swsh12",
 "pokemon-crown-zenith":"swsh12pt5","pokemon-151":"sv3pt5","pokemon-obsidian-flames":"sv3",
 "pokemon-paldea-evolved":"sv2","pokemon-paradox-rift":"sv4","pokemon-temporal-forces":"sv5",
 "pokemon-twilight-masquerade":"sv6","pokemon-surging-sparks":"sv8","pokemon-prismatic-evolutions":"sv8pt5",
 "pokemon-celebrations":"cel25",
}

def get(u, binary=True):
    req = urllib.request.Request(u, headers=UA)
    return urllib.request.urlopen(req, timeout=40, context=ctx).read()

def webp(src_bytes, slug):
    tmp = pathlib.Path(SCRATCH) / f"w2-{slug}.bin"
    tmp.write_bytes(src_bytes)
    im = Image.open(tmp).convert("RGBA")
    for tag, w in [("thumb", 480), ("full", 900)]:
        r = im.copy(); r.thumbnail((w, w*2))
        r.save(f"{CARDS}/{tag}-w2-{slug}.webp", "WEBP", quality=82, method=6)
    tmp.unlink()

def pokemon_official(rec, num):
    setid = PTCGIO_SET.get(rec["set"])
    if not setid or not num: return None
    n = num.lower()
    if n.startswith("tg"): setid += "tg"
    elif n.startswith("gg"): setid = "swsh12pt5gg"
    elif n.startswith("sv") and rec["set"] in ("pokemon-hidden-fates","pokemon-shining-fates"):
        setid = "sma" if rec["set"] == "pokemon-hidden-fates" else "swsh45sv"
    for cand in (n.upper(), n, n.lstrip("0")):
        try:
            d = get(f"https://images.pokemontcg.io/{setid}/{cand}_hires.png")
            if len(d) > 20000: return d
        except Exception: pass
    return None

DESC = {
 ("pokemon","Vintage WOTC"): ("{name} from {setname} — WOTC-era vintage with a fixed population and a sales record that has run continuously since release.",
   "1st Edition, shadowless and unlimited printings are separate markets; every comp keys to the exact variant on the slab."),
 ("pokemon","Modern chase"): ("{name} ({setname}) — a chase card of the modern era with dense graded sales.",
   "Modern populations still grow, so comps use a recent window — never lifetime averages."),
 ("sports","Panini Prizm"): ("{name} — {setname}. Base Prizm cards of this profile trade continuously in graded form across the major venues.",
   "Base version only: colored and serial-numbered parallels are excluded by rule."),
 ("sports","Topps Chrome"): ("{name} ({setname}) — a continuously traded card with a deep graded sales record.",
   "Comps key strictly to the exact grade; base printing only."),
 ("sports","Fleer vintage"): ("{name} from the {setname} set — vintage with decades of realized sales.",
   "Grade drives everything at this age; population is fixed."),
 ("sports","Upper Deck"): ("{name} ({setname}) — a steady graded seller in its sport.",
   "Comped per grade against realized sales; base printing only."),
 ("yugioh","Vintage LOB"): ("{name} ({setname}) — first-print-era Yu-Gi-Oh with two decades of sales behind it.",
   "Only this exact printing qualifies; every reprint is its own market."),
 ("onepiece","Manga rares & alts"): ("{name} ({setname}) — chase-tier One Piece with continuous graded sales in the hobby's fastest-growing category.",
   "English and Japanese printings comp separately; each parallel is its own market."),
}

def esc(x): return x.replace("\\", "\\\\").replace('"', '\\"')

def main():
    recs = [json.loads(l) for l in open(f"{SCRATCH}/wave2-verified.jsonl") if l.strip()]
    recs = [r for r in recs if r.get("verified")]
    existing = set(json.load(open(f"{SCRATCH}/existing-slugs.json")))
    out, used, img_official, img_pc, img_fail = [], set(existing), 0, 0, 0
    for r in recs:
        base = r["url"].rstrip("/").split("/")[-1]
        slug = re.sub(r"[^a-z0-9-]", "", base.lower())[:60]
        if slug in used:
            slug = (slug + "-" + r["set"].split("-")[-1])[:60]
            if slug in used: continue
        used.add(slug)
        rawname = re.sub(r"\s*\[([^\]]+)\]", r" (\1)", r["name"]).strip()
        num_m = re.search(r"-((?:tg|gg|sv|us)?\d+[a-z]?)$", base)
        num = num_m.group(1) if num_m else None
        setname = r["metaBase"].split(" · ")[0]
        variant = re.search(r"\(([^)]+)\)", rawname)
        meta = r["metaBase"] + (" · " + variant.group(1) if variant else "")
        # image (resumable: skip download when the webp already exists)
        import os
        if os.path.exists(f"{CARDS}/thumb-w2-{slug}.webp") and os.path.exists(f"{CARDS}/full-w2-{slug}.webp"):
            data = b"SKIP"
        else:
            data = None
        if r["cat"] == "pokemon":
            data = pokemon_official(r, num)
            if data is not None: img_official += 1
        if data is None and r.get("img"):
            try:
                data = get(r["img"]); img_pc += 1
            except Exception: data = None
        if data is None:
            img_fail += 1
            continue  # meticulous: no image, no listing
        if data != b"SKIP":
            try: webp(data, slug)
            except Exception:
                img_fail += 1; continue
        player = None
        if r["cat"] == "sports":
            player = re.sub(r"\s*#?\w*\d+\w*$", "", re.sub(r"\s*\([^)]*\)", "", rawname)).strip()
        t1, t2 = DESC[(r["cat"], r["sub"])]
        d1 = t1.format(name=rawname, setname=setname)
        bands = []
        for label, key in [("Grade 8","g8"),("Grade 9","g9"),("PSA 10","psa10")]:
            v = r.get(key)
            if v: bands.append(f'{{ label: "{label}", low: {round(v)}, high: {round(v)} }}')
        sport_lines = ""
        if r["cat"] == "sports":
            sport_lines = f'\n    sport: "{r["sport"]}",\n    player: "{esc(player or "Multiple")}",'
        comp_q = f'{rawname.split("(")[0].strip()} {setname} PSA'
        out.append(f'''  {{
    slug: "{slug}",
    name: "{esc(rawname)}",
    meta: "{esc(meta)}",
    category: "{r["cat"]}",
    sub: "{esc(r["sub"])}",{sport_lines}
    tier: "B",
    thumb: "/collectibles/cards/thumb-w2-{slug}.webp",
    image: "/collectibles/cards/full-w2-{slug}.webp",
    description: ["{esc(d1)}", "{esc(t2)}"],
    compQuery: "{esc(comp_q)}",
    compNote: "Comped per exact grade against realized sales.",
    comps: {{ asOf: "{ASOF}", source: "PriceCharting sold data", bands: [{", ".join(bands)}] }},
  }},''')
        time.sleep(0.35)
    hdr = ["/**"," * Catalog expansion wave 2 (2026-08-15): set-driven enumeration across"," * ~65 sets, each asset verified against PriceCharting realized graded-sale"," * data (>=2 graded bands + >=1 accepted-grade value in the $50-$3,000"," * band). Items without a retrievable card image are NOT listed."," */",'import type { CatalogItem } from "./collectibles-catalog.ts";','','export const CATALOG_WAVE2: CatalogItem[] = [']
    body = "\n".join(hdr) + "\n" + "\n".join(out) + "\n];\n"
    open("/Users/bradleylubetkin/magpie-site/src/lib/collectibles-catalog-wave2.ts","w").write(body)
    print(f"codegen: {len(out)} items written (official art {img_official}, PC scans {img_pc}, dropped-no-image {img_fail})")

main()
