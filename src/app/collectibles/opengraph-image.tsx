import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Magpie Collectibles — borrow against liquid graded cards, priced on real sold comps. In design.";
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
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(ellipse 900px 600px at 15% 10%, rgba(247, 201, 72, 0.25), transparent 70%), radial-gradient(ellipse 800px 600px at 85% 70%, rgba(201, 154, 44, 0.18), transparent 70%), #fbfaf3",
          fontFamily: "serif",
          color: "#0a0a0a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#c99a2c",
              border: "1px solid rgba(201, 154, 44, 0.4)",
              borderRadius: 999,
              padding: "8px 18px",
            }}
          >
            In design
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#c99a2c",
            }}
          >
            Collectibles collateral
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 500,
              letterSpacing: "-0.045em",
              lineHeight: 0.98,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div>Borrow against</div>
            <div>
              <span style={{ fontStyle: "italic", color: "#c99a2c" }}>liquid</span> graded cards.
            </div>
          </div>
          <div style={{ fontSize: 26, color: "#5c5a52", letterSpacing: "-0.01em" }}>
            Priced on real sold comps — never listings. Fixed-term, so illiquid collateral is never
            force-liquidated. Only the proven-liquid ones.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#5c5a52" }}>
            <span style={{ fontWeight: 700, color: "#0a0a0a" }}>Memecoins</span>
            <span>·</span>
            <span style={{ fontWeight: 700, color: "#0a0a0a" }}>Tokenized Stocks</span>
            <span>·</span>
            <span style={{ fontWeight: 700, color: "#0a0a0a" }}>Collectibles</span>
          </div>
          <div style={{ fontWeight: 600, color: "#0a0a0a" }}>magpie.capital/collectibles</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
