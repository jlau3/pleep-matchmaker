"use server";

import { cookies } from "next/headers";
import { loadOwnProfile } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";

export interface FeedbackState {
  sent?: boolean;
  error?: string;
}

const KINDS: Record<string, string> = { bug: "🐛 Bug", idea: "💡 Idea", other: "💬 Other" };
const COOLDOWN_COOKIE = "pm_feedback_sent";
const COOLDOWN_SECONDS = 60;

/**
 * Posts feedback to the Discord channel behind DISCORD_FEEDBACK_WEBHOOK_URL
 * (server-only env var). Signed-in players only, so every message carries a
 * Discord name to reply to. Mentions are disabled so nobody can ping @everyone.
 */
export async function sendFeedback(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const webhook = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!webhook) return { error: "Feedback isn't set up yet. Try again later." };

  const { supabase, user } = await requireUser();
  const cookieStore = await cookies();
  if (cookieStore.has(COOLDOWN_COOKIE)) return { error: "Thanks! Give it a minute before sending more." };

  const message = String(form.get("message") ?? "").trim();
  const kind = KINDS[String(form.get("kind"))] ?? KINDS.other;
  const page = String(form.get("page") ?? "").slice(0, 200);
  if (message.length < 5) return { error: "Tell us a little more (at least 5 characters)." };
  if (message.length > 1500) return { error: "That's a lot! Please keep it under 1500 characters." };

  const profile = await loadOwnProfile(supabase, user.id);
  const who = profile.discord_username ? `@${profile.discord_username}` : user.id;
  const header = `**${kind}** from ${who}${profile.ign ? ` (IGN ${profile.ign})` : ""}`;
  const content = [header, page ? `Page: ${page}` : null, "", message]
    .filter((line) => line !== null)
    .join("\n")
    .slice(0, 1990);

  let ok = false;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }
  if (!ok) return { error: "Couldn't send right now. Try again in a bit." };

  cookieStore.set(COOLDOWN_COOKIE, "1", { maxAge: COOLDOWN_SECONDS, httpOnly: true, sameSite: "lax", path: "/" });
  return { sent: true };
}
