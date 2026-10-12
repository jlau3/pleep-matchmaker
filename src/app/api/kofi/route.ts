import { NextResponse } from "next/server";
import { kofiDiscordMessage, parseKofiForm, tokenMatches } from "@/lib/kofi";

/**
 * Ko-fi webhook (Ko-fi → Settings → API → Webhook URL: <site>/api/kofi).
 * Checks Ko-fi's verification token, then pings the #donations channel
 * through DISCORD_DONATIONS_WEBHOOK_URL. Mentions are disabled.
 */
export async function POST(request: Request) {
  const token = process.env.KOFI_VERIFICATION_TOKEN ?? "";
  const webhook = process.env.DISCORD_DONATIONS_WEBHOOK_URL;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const payload = parseKofiForm(form);
  if (!payload) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (!tokenMatches(payload.verification_token, token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!webhook) return NextResponse.json({ ok: true, forwarded: false });

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: kofiDiscordMessage(payload), allowed_mentions: { parse: [] } }),
  }).catch(() => null);
  // A non-200 makes Ko-fi retry, which is what we want if Discord was down.
  if (!res?.ok) return NextResponse.json({ error: "discord unavailable" }, { status: 502 });
  return NextResponse.json({ ok: true, forwarded: true });
}
