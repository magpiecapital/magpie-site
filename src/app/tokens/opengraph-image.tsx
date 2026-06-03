import { ImageResponse } from "next/og";
import { getTokenStats } from "@/lib/db";

export const runtime = "nodejs";
export const alt = "Magpie — approved collateral tokens for borrowing SOL.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const { count, memeCount, stockCount } = await getTokenStats();
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
          backgroundColor: "#fbfaf3",
          backgroundImage:
            "radial-gradient(ellipse 900px 600px at 15% 10%, rgba(247, 201, 72, 0.28), transparent 70%), radial-gradient(ellipse 800px 600px at 85% 70%, rgba(201, 154, 44, 0.18), transparent 70%)",
          fontFamily: "serif",
          color: "#0a0a0a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 28 10 Q 34 10, 34 15 Q 34 18, 32 20 Q 36 22, 35 27 Q 33 34, 23 35 Q 14 35, 10 29 L 2 36 Q 1 37, 2 38 Q 3 39, 4 38 L 13 32 Q 17 28, 20 23 Q 22 18, 24 14 Q 26 10, 28 10 Z M 34 14 L 40 14.5 L 34 17 Z"
              fill="#0a0a0a"
            />
            <circle cx="30" cy="14" r="1" fill="#ffffff" />
            <circle cx="43" cy="13" r="2.4" fill="#f7c948" />
          </svg>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em" }}>
            magpie · approved tokens
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: 108,
              fontWeight: 500,
              letterSpacing: "-0.045em",
              lineHeight: 0.95,
            }}
          >
            <span style={{ color: "#c99a2c", fontStyle: "italic" }}>{`${count}+ tokens`}</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#5c5a52", letterSpacing: "-0.01em" }}>
            Borrow SOL against memecoins + tokenized stocks. Permissionless approval, Token-2022 supported.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#5c5a52",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 32, fontSize: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", fontWeight: 700, color: "#0a0a0a", fontSize: 24 }}>{`${memeCount}`}</div>
              <div style={{ display: "flex" }}>memecoins</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", fontWeight: 700, color: "#0a0a0a", fontSize: 24 }}>{`${stockCount}`}</div>
              <div style={{ display: "flex" }}>stocks</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", fontWeight: 700, color: "#0a0a0a", fontSize: 24 }}>6-layer</div>
              <div style={{ display: "flex" }}>scam audit</div>
            </div>
          </div>
          <div style={{ display: "flex", fontWeight: 600, color: "#0a0a0a" }}>magpie.capital/tokens</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
