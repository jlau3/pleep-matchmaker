import { formatFriendCode } from "./format";
import type { OwnProfile } from "./types";

/**
 * The Discord message for one piece of feedback: what it's about, then
 * everything needed to reach the sender (a clickable Discord mention, names,
 * friend code, email, sign-in methods, user id), then the message. Capped
 * under Discord's 2000 characters.
 */
export function feedbackPost(f: {
  kind: string;
  page: string;
  message: string;
  userId: string;
  email: string | null;
  providers: string[];
  discordId: string | null;
  profile: Pick<OwnProfile, "discord_username" | "discord_display_name" | "ign" | "friend_code" | "reddit_username">;
}): string {
  const { profile: p } = f;
  const discordNames = [p.discord_username ? `@${p.discord_username}` : null, p.discord_display_name].filter(Boolean).join(" · ");
  const who = f.discordId ? `<@${f.discordId}>${discordNames ? ` (${discordNames})` : ""}` : discordNames || p.ign || "a player";
  const line = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ") || null;
  return [
    `**${f.kind}** from ${who}`,
    line([p.ign && `IGN: ${p.ign}`, p.friend_code && `FC: ${formatFriendCode(p.friend_code)}`, p.reddit_username && `Reddit: u/${p.reddit_username}`]),
    line([f.email && `Email: ${f.email}`, f.providers.length > 0 && `Signs in with: ${f.providers.join(", ")}`]),
    line([`User id: ${f.userId}`, f.page && `Page: ${f.page}`]),
    "",
    f.message,
  ]
    .filter((l) => l !== null)
    .join("\n")
    .slice(0, 1990);
}
