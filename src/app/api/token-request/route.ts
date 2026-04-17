import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID ?? "";

const MAX_FIELD = 200;

function sanitize(s: string): string {
  return s.replace(/[_*`\[\]()~>#+\-=|{}.!\\]/g, "\\$&").slice(0, MAX_FIELD);
}

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

    if (name.length > MAX_FIELD || symbol.length > MAX_FIELD || mint.length > MAX_FIELD) {
      return NextResponse.json(
        { error: "Field too long" },
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

    const sName = sanitize(name);
    const sSymbol = sanitize(symbol);
    const sMint = sanitize(mint);
    const sReason = sanitize(reason || "Not provided");
    const sTelegram = telegram
      ? `@${sanitize(telegram.replace("@", ""))}`
      : "Not provided";

    const message = [
      "\uD83D\uDD14 *New Token Request*",
      "",
      `*Token:* ${sName} \\(${sSymbol}\\)`,
      `*Mint:* \`${sMint}\``,
      `*Reason:* ${sReason}`,
      `*Telegram:* ${sTelegram}`,
      "",
      `_Submitted via magpie\\.capital/tokens_`,
    ].join("\n");

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_ID,
          text: message,
          parse_mode: "MarkdownV2",
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
