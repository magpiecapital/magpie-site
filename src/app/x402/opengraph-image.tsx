import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Magpie x402 — loans for autonomous AI agents on Solana.";
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
          background: "linear-gradient(135deg, #0a0a0a 0%, #141208 60%, #1c1808 100%)",
          color: "#fbfaf3",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#f7c948" }} />
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "#a8a49a" }}>
            magpie.capital / x402
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            Loans for autonomous agents.
          </div>
          <div style={{ fontSize: 32, color: "#c9c2ae", lineHeight: 1.4 }}>
            Pay-per-call x402 · native MCP tools · on-chain credit scores.
            No accounts. No API keys. No humans required.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["402 → pay → borrow", "official MCP Registry", "credit 300–850"].map((t) => (
            <div
              key={t}
              style={{
                border: "1.5px solid rgba(247,201,72,0.5)",
                borderRadius: 999,
                padding: "12px 26px",
                fontSize: 24,
                color: "#f7c948",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
