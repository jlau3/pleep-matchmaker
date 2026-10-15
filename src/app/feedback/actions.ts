"use server";

import { cookies } from "next/headers";
import { loadOwnProfile } from "@/lib/data";
import { feedbackPost } from "@/lib/feedback";
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
 * (server-only env var). Signed-in players only, so every message carries who
 * sent it and how to reach them (feedbackPost). Mentions are disabled, so the
 * sender's Discord mention is a clickable name, not a ping, and nobody can ping
 * @everyone. The channel shows emails: keep it private to the site's owner.
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

  // The real limit (1 a minute, 10 a day), kept in the database so a script
  // can't skip it. If the check itself fails (e.g. its migration hasn't run),
  // fall back to the cookie above rather than blocking feedback.
  const slot = await supabase.rpc("claim_feedback_slot");
  if (!slot.error && slot.data === false) return { error: "Thanks! Give it a minute (or until tomorrow if you've sent a lot today)." };

  const [profile, discordId, auth] = await Promise.all([
    loadOwnProfile(supabase, user.id),
    supabase.from("profiles").select("discord_id").eq("id", user.id).maybeSingle().then(({ data }) => (data?.discord_id as string | null) ?? null),
    // Email and sign-in methods live on the auth user.
    supabase.auth.getUser().then(({ data }) => data.user),
  ]);
  const content = feedbackPost({
    kind,
    page,
    message,
    userId: user.id,
    email: auth?.email ?? null,
    providers: (auth?.app_metadata?.providers as string[] | undefined) ?? [],
    discordId,
    profile,
  });

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
