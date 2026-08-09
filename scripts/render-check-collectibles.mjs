#!/usr/bin/env node
/**
 * Render-check the collectibles submission verdict — the real component, in a
 * real browser, at both breakpoints.
 *
 * WHY THIS IS COMMITTED RATHER THAN improvised each time: the verdict panel is
 * the most important moment on the page, and it shipped having never been
 * looked at in a browser — the API was tested and the component compiled,
 * which is not the same thing. Twice while checking it, "verified by
 * rendering" turned out to be a stale build (see the traps below).
 *
 * Usage:
 *   1. npm run build && npx next start -p 3100
 *   2. Chrome --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/cdp-profile
 *   3. node scripts/render-check-collectibles.mjs [--desktop]
 *
 * TRAPS THIS SCRIPT EXISTS TO AVOID:
 *   - `pkill` + immediate `next start` can leave the OLD server alive; the new
 *     one fails to bind and the STALE build keeps serving. Check
 *     `ps aux | grep -c "[n]ext start"` is 1 before trusting any render.
 *   - Chrome's persistent profile caches the JS chunk. Network.setCacheDisabled
 *     is NOT enough — kill Chrome and rm -rf the --user-data-dir.
 *   - Controlled React inputs ignore `el.value = x`. Use the native setter and
 *     dispatch input+change, as below.
 */
import WebSocket from "ws";
import { writeFileSync } from "node:fs";

const OUT = "/private/tmp/claude-501/-Users-bradleylubetkin/3495abd1-c689-4af3-9237-7e738406537d/scratchpad";

const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
let page = targets.find((t) => t.type === "page");
if (!page) page = await (await fetch("http://127.0.0.1:9222/json/new?about:blank")).json();
const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
await new Promise((r) => ws.once("open", r));

let id = 0;
const pending = new Map();
ws.on("message", (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const myId = ++id;
    pending.set(myId, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
const evalJs = async (e) =>
  (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.value;

await send("Page.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Runtime.enable");
// iPhone-class viewport.
const DESKTOP = process.argv.includes("--desktop");
await send("Emulation.setDeviceMetricsOverride",
  DESKTOP
    ? { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false }
    : { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

async function run(label, fields, file) {
  await send("Page.navigate", { url: "http://localhost:3100/collectibles#submit" });
  await new Promise((r) => setTimeout(r, 3500));
  const filled = await evalJs(`(() => {
    const set = (el, v) => {
      const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const form = document.querySelector("#submit form");
    if (!form) return "no form";
    const inputs = [...form.querySelectorAll("input, select")];
    const byLabel = (t) => inputs.find((el) => {
      const lab = el.closest("label");
      return lab && lab.textContent.toLowerCase().includes(t);
    });
    for (const [k, v] of Object.entries(${JSON.stringify(fields)})) {
      const el = byLabel(k); if (!el) return "missing: " + k; set(el, v);
    }
    return "ok";
  })()`);
  if (filled !== "ok") { console.log(label, "fill failed:", filled); return; }

  await evalJs(`document.querySelector("#submit form button[type=submit]").click(); true`);
  await new Promise((r) => setTimeout(r, 4000));

  // Look for horizontal overflow — the classic mobile defect.
  const overflow = await evalJs(`(() => {
    const el = document.querySelector('[role="status"]');
    if (!el) return "no panel";
    const wide = [...el.querySelectorAll("*")].filter(n => n.scrollWidth > n.clientWidth + 2)
      .map(n => n.tagName + "." + (n.className||"").toString().slice(0,40));
    return JSON.stringify({
      docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      panelWidth: Math.round(el.getBoundingClientRect().width),
      viewport: window.innerWidth,
      clipped: wide.slice(0,3),
    });
  })()`);
  console.log(label, "->", overflow);

  await evalJs(`document.querySelector('[role="status"]')?.scrollIntoView({block:"start"}); true`);
  await new Promise((r) => setTimeout(r, 700));
  const clip = await evalJs(`(() => {
    const el = document.querySelector('[role="status"]');
    const r = el.getBoundingClientRect();
    return { x: 0, y: window.scrollY + r.top - 12, width: DESKTOP ? 1400 : 390, height: Math.min(r.height + 24, 3000), scale: 1 };
  })()`);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
  writeFileSync(`${OUT}/${file}`, Buffer.from(shot.data, "base64"));
  console.log("captured", file);
}

const MODE = DESKTOP ? "desktop" : "mobile";
await run(`${MODE} · eligible Tier A`,
  { "which card": "Base Set Charizard #4 Shadowless", "cert number": "26573583", "card grade": "10", "vaulted": "Collector Crypt" },
  DESKTOP ? "d_form_ok.png" : "m_form_ok.png");
await run(`${MODE} · declined`,
  { "which card": "Base Set Charizard #4", "cert number": "26573583", "card grade": "5", "vaulted": "Collector Crypt" },
  DESKTOP ? "d_form_declined.png" : "m_form_declined.png");

ws.close();
