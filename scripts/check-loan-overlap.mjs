#!/usr/bin/env node
/**
 * check-loan-overlap — fails if any two pieces of text on the loan-card QA
 * gallery overlap, or anything overflows, at any breakpoint.
 *
 * WHY (operator mandate 2026-09-01): a live loan card shipped with fonts
 * overlapping ("things were all out of whack"). Nothing in CI rendered the
 * card, so nothing could have caught it. This script renders the REAL
 * ActiveLoanCard (via /qa/loan-cards) in a real browser at 8 widths and
 * asserts, for every pair of visible text rectangles from different
 * elements: they do not intersect. Plus: no horizontal document scroll, no
 * clipped text containers.
 *
 * Usage:
 *   npm run build && npx next start -p 3100 &
 *   node scripts/check-loan-overlap.mjs
 * Env:
 *   QA_URL     (default http://localhost:3100/qa/loan-cards)
 *   CHROME_BIN (default: mac Chrome path, then google-chrome, chromium)
 *   RENDER_CHECK_OUT (screenshot dir, default os tmpdir)
 */
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const QA_URL = process.env.QA_URL || "http://localhost:3100/qa/loan-cards";
const OUT = process.env.RENDER_CHECK_OUT || tmpdir();
const WIDTHS = [320, 360, 390, 430, 520, 640, 768, 1024, 1280];
const PORT = 9223;

function chromeBin() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  try { execSync(`test -x "${mac}"`); return mac; } catch {}
  for (const c of ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium"]) {
    try { execSync(`command -v ${c}`, { stdio: "ignore" }); return c; } catch {}
  }
  throw new Error("No Chrome found — set CHROME_BIN");
}

const profile = mkdtempSync(join(tmpdir(), "overlap-chrome-"));
const chrome = spawn(chromeBin(), [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-sandbox", "--disable-gpu", "about:blank",
], { stdio: "ignore" });
process.on("exit", () => { try { chrome.kill(); } catch {} });

// Wait for CDP.
let targets = null;
for (let i = 0; i < 40 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!targets) { console.error("Chrome CDP never came up"); process.exit(1); }
let page = targets.find((t) => t.type === "page") ||
  await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`)).json();
const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
await new Promise((r) => ws.once("open", r));
let id = 0; const pending = new Map();
ws.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res, rej) => {
  const myId = ++id; pending.set(myId, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id: myId, method, params }));
});
const evalJs = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.value;

await send("Page.enable"); await send("Runtime.enable");
await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });

const DETECTOR = `(() => {
  const root = document.getElementById("gallery");
  if (!root) return JSON.stringify({ fatal: "no #gallery — page failed to render" });
  const docOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  // Text containers that clip their own text (skip deliberate scrollers).
  const clipped = [...root.querySelectorAll("*")].filter((n) => {
    const cs = getComputedStyle(n);
    if (/(auto|scroll)/.test(cs.overflowX)) return false;
    // Ellipsis truncation is a DESIGNED graceful degradation (e.g. the
    // .truncate ticker in ExitStatusBanner) — not a defect. Raw hidden
    // clipping without ellipsis still fails.
    if (cs.textOverflow === "ellipsis") return false;
    if (!(n.scrollWidth > n.clientWidth + 2)) return false;
    return [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
  }).map((n) => (n.tagName + "." + String(n.className).slice(0, 50) + " «" + n.textContent.trim().slice(0, 40) + "»"));
  // Every visible text rect.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const items = [];
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const range = document.createRange(); range.selectNodeContents(t);
    for (const rect of range.getClientRects()) {
      if (rect.width < 2 || rect.height < 4) continue;
      items.push({ el, rect: { l: rect.left, r: rect.right, t: rect.top, b: rect.bottom }, text: t.textContent.trim().slice(0, 34) });
    }
  }
  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.rect.r, b.rect.r) - Math.max(a.rect.l, b.rect.l);
      const oy = Math.min(a.rect.b, b.rect.b) - Math.max(a.rect.t, b.rect.t);
      if (ox > 3 && oy > 3) overlaps.push("«" + a.text + "» ⇄ «" + b.text + "» (" + Math.round(ox) + "×" + Math.round(oy) + "px)");
    }
  }
  return JSON.stringify({ docOverflow, clipped: [...new Set(clipped)].slice(0, 10), overlaps: [...new Set(overlaps)].slice(0, 25), textRects: items.length });
})()`;

let failed = false;
for (const width of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 700 });
  await send("Page.navigate", { url: QA_URL });
  await new Promise((r) => setTimeout(r, 3000));
  const raw = await evalJs(DETECTOR);
  let res; try { res = JSON.parse(raw); } catch { res = { fatal: "detector eval failed: " + String(raw).slice(0, 200) }; }
  const bad = res.fatal || res.docOverflow || (res.clipped && res.clipped.length) || (res.overlaps && res.overlaps.length);
  console.log(`\n── ${width}px ${bad ? "✗ FAIL" : "✓ ok"} (${res.textRects ?? 0} text rects)`);
  if (res.fatal) { console.log("  FATAL:", res.fatal); failed = true; continue; }
  if (res.docOverflow) { console.log("  ✗ document scrolls horizontally"); failed = true; }
  for (const c of res.clipped ?? []) { console.log("  ✗ clipped text:", c); failed = true; }
  for (const o of res.overlaps ?? []) { console.log("  ✗ TEXT OVERLAP:", o); failed = true; }
  if (bad || process.env.SHOT_ALL) {
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    const file = join(OUT, `loan-overlap-${width}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log("  screenshot:", file);
  }
}
ws.close(); try { chrome.kill(); } catch {}
if (failed) { console.error("\ncheck-loan-overlap: FAILED — the loan card ships with visual defects."); process.exit(1); }
console.log("\ncheck-loan-overlap: all widths clean.");
