import { timingSafeEqual } from "node:crypto";

/** The fields of a Ko-fi webhook we use (Ko-fi sends more, e.g. email, which we never forward). */
export interface KofiPayload {
  verification_token?: string;
  type?: string;
  is_public?: boolean;
  from_name?: string;
  message?: string | null;
  amount?: string;
  currency?: string;
  is_subscription_payment?: boolean;
  is_first_subscription_payment?: boolean;
  tier_name?: string | null;
}

/** Ko-fi posts form data with a single `data` field holding JSON. */
export function parseKofiForm(form: FormData): KofiPayload | null {
  const raw = form.get("data");
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as KofiPayload) : null;
  } catch {
    return null;
  }
}

export function tokenMatches(given: unknown, expected: string): boolean {
  if (typeof given !== "string" || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The Discord message for a donation. A supporter who chose to keep it
 * private on Ko-fi shows as "Someone", without their message.
 */
export function kofiDiscordMessage(p: KofiPayload): string {
  const shown = p.is_public !== false;
  const who = shown && p.from_name?.trim() ? p.from_name.trim().slice(0, 80) : "Someone";
  const amount = [p.amount, p.currency].filter(Boolean).join(" ");
  let what = "donated";
  if (p.type === "Subscription") {
    const tier = p.tier_name ? ` (${p.tier_name.slice(0, 60)})` : "";
    what = p.is_first_subscription_payment ? `started a monthly membership${tier}` : `renewed their membership${tier}`;
  } else if (p.type && p.type !== "Donation") {
    what = `paid for a ${p.type.toLowerCase().slice(0, 40)}`;
  }
  const lines = [`☕ **${who}** ${what}${amount ? `: ${amount}` : ""}`];
  const message = shown ? p.message?.trim() : "";
  if (message) lines.push(`> ${message.slice(0, 500).replace(/\n/g, "\n> ")}`);
  return lines.join("\n");
}
