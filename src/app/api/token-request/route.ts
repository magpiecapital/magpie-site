import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID ?? "";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, symbol, mint, reason, telegram } = body as {
      name?: string;
      symbol?: string;
      mint?: string;
      reason?: string;
      telegram?: string;
    };

    if (!name?.trim() || !symbol?.trim() || !mint?.trim()) {
      return NextResponse.json(
        { error: "name, symbol, and mint are required" },
        { status: 400 },
      );
    }

    if (!BOT_TOKEN || !ADMIN_ID) {
      console.error("Missing TELEGRAM_BOT_TOKEN or ADMIN_TELEGRAM_ID env vars");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    const message = [
      "\uD83D\uDD14 *New Token Request*",
      "",
      `*Token:* ${name} (${symbol})`,
      `*Mint:* \`${mint}\``,
      `*Reason:* ${reason || "Not provided"}`,
      `*Telegram:* ${telegram ? `@${telegram.replace("@", "")}` : "Not provided"}`,
      "",
      `_Submitted via magpie.capital/tokens_`,
    ].join("\n");

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_ID,
          text: message,
          parse_mode: "Markdown",
        }),
      },
    );

    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error("Telegram API error:", err);
      return NextResponse.json({ error: "Failed to submit" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Token request error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
