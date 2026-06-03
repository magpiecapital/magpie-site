import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Just borrowed SOL on Magpie Capital";

export default async function Image({
  params,
}: {
  params: { symbol: string; amount: string };
}) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const amount = decodeURIComponent(params.amount);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          background:
            "radial-gradient(ellipse 1000px 700px at 80% 20%, rgba(247, 201, 72, 0.32), transparent 70%), radial-gradient(ellipse 800px 600px at 10% 90%, rgba(201, 154, 44, 0.20), transparent 70%), #fbfaf3",
          fontFamily: "serif",
          color: "#1a1814",
        }}
      >
        {/* Header — brand + chip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M 28 10 Q 34 10, 34 15 Q 34 18, 32 20 Q 36 22, 35 27 Q 33 34, 23 35 Q 14 35, 10 29 L 2 36 Q 1 37, 2 38 Q 3 39, 4 38 L 13 32 Q 17 28, 20 23 Q 22 18, 24 14 Q 26 10, 28 10 Z M 34 14 L 40 14.5 L 34 17 Z"
                fill="#1a1814"
              />
              <circle cx="30" cy="14" r="1" fill="#ffffff" />
              <circle cx="43" cy="13" r="2.4" fill="#f7c948" />
            </svg>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>
              magpie
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 20px",
              borderRadius: 999,
              background: "#1a1814",
              color: "#fbfaf3",
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Just borrowed
          </div>
        </div>

        {/* Main number */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 180,
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              display: "flex",
              alignItems: "baseline",
              gap: 24,
            }}
          >
            <span style={{ fontFamily: "monospace" }}>{amount}</span>
            <span style={{ fontSize: 96, color: "#5c5a52" }}>SOL</span>
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 400,
              marginTop: 20,
              color: "#5c5a52",
              letterSpacing: "-0.02em",
              display: "flex",
              gap: 16,
            }}
          >
            <span>unlocked from</span>
            <span style={{ fontStyle: "italic", color: "#1a1814" }}>${symbol}</span>
          </div>
        </div>

        {/* Footer — tagline */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            color: "#5c5a52",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontWeight: 600, color: "#1a1814", fontSize: 26 }}>
              Borrow your bags. Don&apos;t sell.
            </div>
            <div>Telegram-native lending on Solana</div>
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              padding: "12px 22px",
              borderRadius: 12,
              background: "#f7c948",
              color: "#1a1814",
              display: "flex",
            }}
          >
            magpie.capital
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
