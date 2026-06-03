/**
 * Magpie Embed — drop-in "Borrow against $X" button for token communities.
 *
 * Usage:
 *   <div data-magpie-borrow="WIF" data-magpie-ref="WIFCOMM"></div>
 *   <script src="https://magpie.capital/embed/borrow-button.js" defer></script>
 *
 * Required: data-magpie-borrow (token symbol — case-insensitive)
 * Optional: data-magpie-ref   (referral code — community earns 5% lifetime
 *                              of any user who joins through this widget)
 * Optional: data-magpie-theme ("dark" | "light", default light)
 *
 * The button auto-fetches the token's current max LTV from
 * /api/v1/tokens and shows it in the label. Falls back gracefully if
 * the token is not approved or the API is unreachable.
 */
(function () {
  "use strict";

  if (window.__magpieEmbedLoaded) return;
  window.__magpieEmbedLoaded = true;

  var ORIGIN = "https://magpie.capital";
  var BOT_URL = "https://t.me/magpie_capital_bot";

  /* ────────── styles (scoped, no leaks into host page) ────────── */
  var css =
    ".magpie-embed{display:inline-flex;flex-direction:column;align-items:stretch;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
    "border-radius:14px;padding:14px 18px;min-width:240px;text-decoration:none;" +
    "transition:transform .15s ease,box-shadow .15s ease;cursor:pointer;border:1px solid;" +
    "box-shadow:0 1px 2px rgba(0,0,0,.04)}" +
    ".magpie-embed:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,.08)}" +
    ".magpie-embed-light{background:#fffdf5;color:#1a1814;border-color:#e7e2d2}" +
    ".magpie-embed-dark{background:#1a1814;color:#fffdf5;border-color:#332f26}" +
    ".magpie-embed-row{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
    ".magpie-embed-eyebrow{font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.65}" +
    ".magpie-embed-brand{font-size:11px;font-weight:600;opacity:.55}" +
    ".magpie-embed-title{font-size:18px;font-weight:600;margin-top:4px;letter-spacing:-.01em}" +
    ".magpie-embed-sub{font-size:12px;opacity:.65;margin-top:2px}" +
    ".magpie-embed-cta{margin-top:10px;display:inline-flex;align-items:center;gap:6px;" +
    "font-size:13px;font-weight:600;padding:7px 12px;border-radius:8px;align-self:flex-start;" +
    "background:#ffd644;color:#1a1814;border:1px solid #1a1814;transition:transform .1s ease}" +
    ".magpie-embed:hover .magpie-embed-cta{transform:translateX(2px)}" +
    ".magpie-embed-arrow{font-size:14px;line-height:1}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ────────── helpers ────────── */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildBotUrl(symbol, refCode) {
    // Telegram start parameters can encode the token + referral via the
    // referral system. For now we send the referral as the start param
    // (bot's existing behavior); future enhancement can encode a token.
    if (refCode) {
      return BOT_URL + "?start=" + encodeURIComponent(refCode);
    }
    return BOT_URL;
  }

  function render(el, opts) {
    var theme = opts.theme === "dark" ? "magpie-embed-dark" : "magpie-embed-light";
    var symbol = opts.symbol;
    var ltvText = opts.maxLtv != null ? "Up to " + opts.maxLtv + "% LTV" : "Live rates";
    var refCode = opts.refCode || "";
    var href = buildBotUrl(symbol, refCode);

    var html =
      "<a class='magpie-embed " + theme + "' href='" + escapeHtml(href) + "' target='_blank' rel='noopener noreferrer'>" +
      "<div class='magpie-embed-row'>" +
      "<span class='magpie-embed-eyebrow'>Borrow SOL against</span>" +
      "<span class='magpie-embed-brand'>magpie.capital</span>" +
      "</div>" +
      "<div class='magpie-embed-title'>$" + escapeHtml(symbol) + "</div>" +
      "<div class='magpie-embed-sub'>" + escapeHtml(ltvText) + " · Telegram · No KYC</div>" +
      "<div class='magpie-embed-cta'>Borrow now <span class='magpie-embed-arrow'>→</span></div>" +
      "</a>";
    el.innerHTML = html;
    el.classList.add("magpie-embed-rendered");
  }

  function fetchTokenLtv(symbol) {
    return fetch(ORIGIN + "/api/v1/tokens")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        if (!json) return null;
        var rows = Array.isArray(json) ? json : json.tokens || json.data || [];
        var match = rows.find(function (t) {
          return t && t.symbol && t.symbol.toUpperCase() === symbol.toUpperCase();
        });
        if (!match) return null;
        var ltv = match.max_ltv_pct != null ? match.max_ltv_pct : match.maxLtvPct;
        return typeof ltv === "number" ? ltv : null;
      })
      .catch(function () { return null; });
  }

  /* ────────── main ────────── */

  function mount(el) {
    if (el.classList.contains("magpie-embed-rendered")) return;
    var symbol = (el.getAttribute("data-magpie-borrow") || "").trim().toUpperCase();
    if (!symbol) return;
    var refCode = (el.getAttribute("data-magpie-ref") || "").trim();
    var theme = (el.getAttribute("data-magpie-theme") || "light").trim();

    // Render immediately with placeholder LTV, then upgrade once API resolves
    render(el, { symbol: symbol, refCode: refCode, theme: theme, maxLtv: null });
    fetchTokenLtv(symbol).then(function (ltv) {
      if (ltv != null) {
        el.classList.remove("magpie-embed-rendered");
        render(el, { symbol: symbol, refCode: refCode, theme: theme, maxLtv: ltv });
      }
    });
  }

  function init() {
    var nodes = document.querySelectorAll("[data-magpie-borrow]");
    nodes.forEach(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-scan if the host page dynamically inserts new widgets later
  var observer = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1) {
          if (n.hasAttribute && n.hasAttribute("data-magpie-borrow")) mount(n);
          if (n.querySelectorAll) {
            n.querySelectorAll("[data-magpie-borrow]").forEach(mount);
          }
        }
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
