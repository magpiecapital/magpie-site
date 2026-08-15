/**
 * Resumable verification: reads wave2-candidates.json, skips URLs already
 * in wave2-verified.jsonl, verifies up to CHUNK more, appends results
 * per-item (crash/kill-safe). Run repeatedly until "ALL DONE".
 */
const fs = require("fs");
const puppeteer = require("puppeteer");
const CHUNK = Number(process.env.CHUNK || 320);
const candidates = JSON.parse(fs.readFileSync("wave2-candidates.json", "utf8"));
const done = new Set(
  fs.existsSync("wave2-verified.jsonl")
    ? fs.readFileSync("wave2-verified.jsonl", "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l).url)
    : [],
);
const todo = candidates.filter(c => !done.has(c.url)).slice(0, CHUNK);
if (todo.length === 0) { console.log("ALL DONE — nothing left to verify"); process.exit(0); }
(async () => {
  const b = await puppeteer.launch({ headless: "new" });
  const p = await b.newPage();
  await p.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36");
  let ok = 0, checked = 0;
  for (const c of todo) {
    checked++;
    let rec = { ...c, verified: false };
    try {
      await p.goto(c.url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await new Promise(r => setTimeout(r, 650));
      const g = await p.evaluate(() => {
        const gv = (id) => { const el = document.querySelector(`#${id} .price, td#${id}, #${id}`); if (!el) return null; const m = el.textContent.match(/\$([0-9,.]+)/); return m ? parseFloat(m[1].replace(/,/g, "")) : null; };
        const img = (document.documentElement.innerHTML.match(/https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[a-z0-9]+\/1600\.jpg/) || [null])[0];
        return { g8: gv("new_price"), g9: gv("graded_price"), psa10: gv("manual_only_price"), img };
      });
      const bands = [g.g8, g.g9, g.psa10].filter(v => v != null && v > 0);
      const inBand = [g.g8, g.g9, g.psa10].some(v => v != null && v >= 50 && v <= 3000);
      rec = { ...c, ...g, verified: bands.length >= 2 && inBand };
      if (rec.verified) ok++;
    } catch (e) { rec.error = String(e).slice(0, 40); }
    fs.appendFileSync("wave2-verified.jsonl", JSON.stringify(rec) + "\n");
  }
  console.log(`chunk done: ${checked} checked, ${ok} newly verified; total done ${done.size + checked}/${candidates.length}`);
  await b.close();
})();
