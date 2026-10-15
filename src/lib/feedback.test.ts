import { describe, expect, it } from "vitest";
import { feedbackPost } from "./feedback";

const base = {
  kind: "🐛 Bug",
  page: "/matches",
  message: "Page 2 repeats someone.",
  userId: "u-1",
  email: "ann@example.com",
  providers: ["discord", "google"],
  discordId: "1234",
  profile: { discord_username: "ann", discord_display_name: "Ann", ign: "AnnIGN", friend_code: "123412341234", reddit_username: "ann_r" },
};

describe("feedbackPost", () => {
  it("carries every way to reach the sender", () => {
    expect(feedbackPost(base)).toBe(
      [
        "**🐛 Bug** from <@1234> (@ann · Ann)",
        "IGN: AnnIGN · FC: 1234 1234 1234 · Reddit: u/ann_r",
        "Email: ann@example.com · Signs in with: discord, google",
        "User id: u-1 · Page: /matches",
        "",
        "Page 2 repeats someone.",
      ].join("\n"),
    );
  });

  it("falls back to the IGN without Discord, and skips what's missing", () => {
    const post = feedbackPost({
      ...base,
      discordId: null,
      email: null,
      providers: [],
      page: "",
      profile: { discord_username: null, discord_display_name: null, ign: "AnnIGN", friend_code: null, reddit_username: null },
    });
    expect(post).toBe(["**🐛 Bug** from AnnIGN", "IGN: AnnIGN", "User id: u-1", "", "Page 2 repeats someone."].join("\n"));
  });
});
