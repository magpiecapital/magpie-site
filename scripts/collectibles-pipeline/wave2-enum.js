/**
 * Wave-2 set-driven expansion pipeline.
 * Phase 1: enumerate ~55 liquid sets from PriceCharting console pages
 *          (sorted highest-price, top rows per set).
 * Phase 2: filter to band-plausible candidates (ungraded price window),
 *          dedupe against existing catalog slugs.
 * Phase 3: verify each candidate's product page — graded bands present +
 *          ≥1 accepted-grade value in $50–$3,000.
 * Output: wave2-verified.json
 */
const fs = require("fs");
const puppeteer = require("puppeteer");

const SETS = [
  // Pokémon vintage WOTC
  ["pokemon-base-set", "pokemon", "Vintage WOTC", "Base Set · 1999"],
  ["pokemon-jungle", "pokemon", "Vintage WOTC", "Jungle · 1999"],
  ["pokemon-fossil", "pokemon", "Vintage WOTC", "Fossil · 1999"],
  ["pokemon-base-set-2", "pokemon", "Vintage WOTC", "Base Set 2 · 2000"],
  ["pokemon-team-rocket", "pokemon", "Vintage WOTC", "Team Rocket · 2000"],
  ["pokemon-gym-heroes", "pokemon", "Vintage WOTC", "Gym Heroes · 2000"],
  ["pokemon-gym-challenge", "pokemon", "Vintage WOTC", "Gym Challenge · 2000"],
  ["pokemon-neo-genesis", "pokemon", "Vintage WOTC", "Neo Genesis · 2000"],
  ["pokemon-neo-discovery", "pokemon", "Vintage WOTC", "Neo Discovery · 2001"],
  ["pokemon-neo-revelation", "pokemon", "Vintage WOTC", "Neo Revelation · 2001"],
  ["pokemon-neo-destiny", "pokemon", "Vintage WOTC", "Neo Destiny · 2002"],
  ["pokemon-legendary-collection", "pokemon", "Vintage WOTC", "Legendary Collection · 2002"],
  ["pokemon-expedition", "pokemon", "Vintage WOTC", "Expedition · 2002"],
  ["pokemon-aquapolis", "pokemon", "Vintage WOTC", "Aquapolis · 2003"],
  ["pokemon-skyridge", "pokemon", "Vintage WOTC", "Skyridge · 2003"],
  // Pokémon modern chase
  ["pokemon-hidden-fates", "pokemon", "Modern chase", "Hidden Fates · 2019"],
  ["pokemon-champions-path", "pokemon", "Modern chase", "Champion's Path · 2020"],
  ["pokemon-shining-fates", "pokemon", "Modern chase", "Shining Fates · 2021"],
  ["pokemon-evolving-skies", "pokemon", "Modern chase", "Evolving Skies · 2021"],
  ["pokemon-fusion-strike", "pokemon", "Modern chase", "Fusion Strike · 2021"],
  ["pokemon-brilliant-stars", "pokemon", "Modern chase", "Brilliant Stars · 2022"],
  ["pokemon-astral-radiance", "pokemon", "Modern chase", "Astral Radiance · 2022"],
  ["pokemon-lost-origin", "pokemon", "Modern chase", "Lost Origin · 2022"],
  ["pokemon-silver-tempest", "pokemon", "Modern chase", "Silver Tempest · 2022"],
  ["pokemon-crown-zenith", "pokemon", "Modern chase", "Crown Zenith · 2023"],
  ["pokemon-151", "pokemon", "Modern chase", "151 · 2023"],
  ["pokemon-obsidian-flames", "pokemon", "Modern chase", "Obsidian Flames · 2023"],
  ["pokemon-paldea-evolved", "pokemon", "Modern chase", "Paldea Evolved · 2023"],
  ["pokemon-paradox-rift", "pokemon", "Modern chase", "Paradox Rift · 2023"],
  ["pokemon-temporal-forces", "pokemon", "Modern chase", "Temporal Forces · 2024"],
  ["pokemon-twilight-masquerade", "pokemon", "Modern chase", "Twilight Masquerade · 2024"],
  ["pokemon-surging-sparks", "pokemon", "Modern chase", "Surging Sparks · 2024"],
  ["pokemon-prismatic-evolutions", "pokemon", "Modern chase", "Prismatic Evolutions · 2025"],
  ["pokemon-celebrations", "pokemon", "Modern chase", "Celebrations · 2021"],
  // Basketball
  ["basketball-cards-2012-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2012-13", "Basketball"],
  ["basketball-cards-2013-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2013-14", "Basketball"],
  ["basketball-cards-2016-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2016-17", "Basketball"],
  ["basketball-cards-2017-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2017-18", "Basketball"],
  ["basketball-cards-2018-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2018-19", "Basketball"],
  ["basketball-cards-2019-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2019-20", "Basketball"],
  ["basketball-cards-2020-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2020-21", "Basketball"],
  ["basketball-cards-1996-topps", "sports", "Topps Chrome", "Topps · 1996-97", "Basketball"],
  ["basketball-cards-2003-topps-chrome", "sports", "Topps Chrome", "Topps Chrome · 2003-04", "Basketball"],
  ["basketball-cards-1986-fleer", "sports", "Fleer vintage", "Fleer · 1986-87", "Basketball"],
  // Football
  ["football-cards-2017-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2017", "Football"],
  ["football-cards-2018-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2018", "Football"],
  ["football-cards-2019-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2019", "Football"],
  ["football-cards-2020-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2020", "Football"],
  ["football-cards-2021-panini-prizm", "sports", "Panini Prizm", "Panini Prizm · 2021", "Football"],
  // Baseball
  ["baseball-cards-1989-upper-deck", "sports", "Upper Deck", "Upper Deck · 1989", "Baseball"],
  ["baseball-cards-2011-topps-update", "sports", "Topps Chrome", "Topps Update · 2011", "Baseball"],
  ["baseball-cards-2018-topps-update", "sports", "Topps Chrome", "Topps Update · 2018", "Baseball"],
  ["baseball-cards-1993-sp", "sports", "Upper Deck", "SP · 1993", "Baseball"],
  ["baseball-cards-2023-topps-chrome-update", "sports", "Topps Chrome", "Topps Chrome Update · 2023", "Baseball"],
  // Hockey
  ["hockey-cards-2005-upper-deck", "sports", "Upper Deck", "UD Young Guns · 2005-06", "Hockey"],
  ["hockey-cards-2015-upper-deck", "sports", "Upper Deck", "UD Young Guns · 2015-16", "Hockey"],
  ["hockey-cards-2016-upper-deck", "sports", "Upper Deck", "UD Young Guns · 2016-17", "Hockey"],
  // Soccer
  ["soccer-cards-2018-panini-prizm-world-cup", "sports", "Panini Prizm", "Prizm World Cup · 2018", "Soccer"],
  ["soccer-cards-2022-panini-prizm-world-cup", "sports", "Panini Prizm", "Prizm World Cup · 2022", "Soccer"],
  // Yu-Gi-Oh / One Piece
  ["yugioh-legend-of-blue-eyes-white-dragon", "yugioh", "Vintage LOB", "Legend of Blue Eyes · 2002"],
  ["yugioh-metal-raiders", "yugioh", "Vintage LOB", "Metal Raiders · 2002"],
  ["yugioh-pharaohs-servant", "yugioh", "Vintage LOB", "Pharaoh's Servant · 2002"],
  ["one-piece-romance-dawn", "onepiece", "Manga rares & alts", "Romance Dawn · 2022"],
  ["one-piece-paramount-war", "onepiece", "Manga rares & alts", "Paramount War · 2023"],
  ["one-piece-op05", "onepiece", "Manga rares & alts", "Awakening of the New Era · 2023"],
];

const EXISTING = new Set(JSON.parse(fs.readFileSync("existing-slugs.json", "utf8")));
const UNGRADED_MIN = 12, UNGRADED_MAX = 2200;
const PER_SET_CAP = 14;

(async () => {
  const b = await puppeteer.launch({ headless: "new" });
  const p = await b.newPage();
  await p.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36");
  const candidates = [];
  // Phase 1+2: enumerate set pages
  for (const [setSlug, cat, sub, metaBase, sport] of SETS) {
    try {
      await p.goto(`https://www.pricecharting.com/console/${setSlug}?sort=highest-price`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await new Promise(r => setTimeout(r, 900));
      const rows = await p.evaluate(() => {
        return [...document.querySelectorAll("tr[id^='product-']")].map(tr => {
          const a = tr.querySelector("td.title a");
          const priceEl = tr.querySelector("td.price");
          const m = priceEl && priceEl.textContent.match(/\$([0-9,.]+)/);
          return a ? { name: a.textContent.trim(), href: a.href, ungraded: m ? parseFloat(m[1].replace(/,/g, "")) : null } : null;
        }).filter(Boolean);
      });
      let kept = 0;
      for (const r of rows) {
        if (r.ungraded == null || r.ungraded < UNGRADED_MIN || r.ungraded > UNGRADED_MAX) continue;
        // Skip parallels/serial variants and sealed — doc 26 S-4 rule.
        if (/\b(silver|gold|black|green|red|blue|purple|orange|mojo|hyper|shimmer|camo|tie-dye|1\/1|auto|box|pack|case|bundle|collection|tin|deck|elite trainer|booster)\b/i.test(r.name) && cat === "sports") continue;
        if (/\b(box|pack|case|bundle|tin|collection|deck|elite trainer|booster|blister)\b/i.test(r.name)) continue;
        if (kept >= PER_SET_CAP) break;
        candidates.push({ name: r.name, url: r.href.split("?")[0], set: setSlug, cat, sub, metaBase, sport: sport || null, ungraded: r.ungraded });
        kept++;
      }
      console.log(`[enum] ${setSlug}: ${rows.length} rows, kept ${kept}`);
    } catch (e) { console.log(`[enum] ${setSlug} FAIL ${String(e).slice(0, 40)}`); }
    await new Promise(r => setTimeout(r, 1000));
  }
  // Dedupe by product URL + against existing catalog (by name similarity to slugs)
  const seen = new Set();
  const unique = candidates.filter(c => {
    const key = c.url;
    if (seen.has(key)) return false;
    seen.add(key);
    const slugish = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    for (const ex of EXISTING) if (slugish.includes(ex) || ex.includes(slugish.slice(0, 20))) return false;
    return true;
  });
  console.log(`[filter] ${candidates.length} candidates → ${unique.length} to verify`);
  fs.writeFileSync("wave2-candidates.json", JSON.stringify(unique, null, 1));

  console.log('ENUM DONE');
  await b.close();
})();
