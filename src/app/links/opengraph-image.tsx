import { ImageResponse } from "next/og";

/**
 * Dedicated OG card for /links — the canonical "linktree" page.
 *
 * Why this is separate from the root /opengraph-image: when someone
 * shares magpie.capital/links on X or Telegram, the card should
 * explicitly visualize "here are the FOUR official surfaces" so a
 * scrolling user can verify against it WITHOUT clicking. The card
 * is the trust signal as much as the destination is.
 *
 * Design: same brand palette as the root OG card, but the content
 * surfaces the four handles directly + the "anyone else is
 * impersonation" trust line. 1200×630 (standard).
 */

export const runtime = "edge";
export const alt = "Magpie · Official Links · X @MagpieLoans · TG @magpie_capital_bot · TG @magpietalk · magpie.capital";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          background:
            "radial-gradient(ellipse 900px 600px at 15% 10%, rgba(247, 201, 72, 0.25), transparent 70%), radial-gradient(ellipse 800px 600px at 85% 70%, rgba(201, 154, 44, 0.18), transparent 70%), #fbfaf3",
          fontFamily: "serif",
          color: "#0a0a0a",
        }}
      >
        {/* Header — wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <svg width="56" height="56" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 28 10 Q 34 10, 34 15 Q 34 18, 32 20 Q 36 22, 35 27 Q 33 34, 23 35 Q 14 35, 10 29 L 2 36 Q 1 37, 2 38 Q 3 39, 4 38 L 13 32 Q 17 28, 20 23 Q 22 18, 24 14 Q 26 10, 28 10 Z M 34 14 L 40 14.5 L 34 17 Z"
              fill="#0a0a0a"
            />
            <circle cx="30" cy="14" r="1" fill="#ffffff" />
            <circle cx="43" cy="13" r="2.4" fill="#f7c948" />
          </svg>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em" }}>magpie</div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 36 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
            }}
          >
            Official <span style={{ fontStyle: "italic", color: "#c99a2c" }}>links.</span>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#5c5a52",
              marginTop: 12,
              letterSpacing: "-0.01em",
            }}
          >
            The four — and only four — surfaces that are us.
          </div>
        </div>

        {/* The four canonical handles, large + scannable */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "X / Twitter", handle: "@MagpieLoans" },
            { label: "Telegram · wallet bot", handle: "@magpie_capital_bot" },
            { label: "Telegram · community", handle: "@magpietalk" },
            { label: "Website", handle: "magpie.capital" },
          ].map((row) => (
            <div
              key={row.handle}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 24px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(10,10,10,0.08)",
              }}
            >
              <div style={{ fontSize: 22, color: "#5c5a52", letterSpacing: "-0.01em" }}>
                {row.label}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#0a0a0a",
                  letterSpacing: "-0.01em",
                }}
              >
                {row.handle}
              </div>
            </div>
          ))}
        </div>

        {/* Trust line */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 18,
            color: "#5c5a52",
            paddingTop: 28,
          }}
        >
          <div style={{ letterSpacing: "-0.01em" }}>
            Anything else claiming to be Magpie is impersonation.
          </div>
          <div style={{ fontWeight: 600, color: "#0a0a0a" }}>magpie.capital/links</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
