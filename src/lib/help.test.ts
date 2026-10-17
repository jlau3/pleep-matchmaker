import { describe, expect, it } from "vitest";
import { automaticPopup, pageHelp, MATCH_HELP_EVENT, TIER_TOUR_EVENT, VOTE_HELP_EVENT, PROFILE_HELP_EVENT } from "./help";

describe("automatic onboarding popups", () => {
  it("leaves the player to finish setup without announcement interruptions", () => {
    expect(automaticPopup({ setupDone: false, metaSeen: false })).toBeNull();
  });

  it("allows an unread announcement after setup is finished or skipped", () => {
    expect(automaticPopup({ setupDone: true, metaSeen: false })).toBe("meta");
  });

  it.each([false, true])("does not reopen a seen announcement (setup done: %s)", (setupDone) => {
    expect(automaticPopup({ setupDone, metaSeen: true })).toBeNull();
  });
});

describe("page help destinations", () => {
  it.each([
    ["/", TIER_TOUR_EVENT], ["/tiers", TIER_TOUR_EVENT],
    ["/friends", MATCH_HELP_EVENT], ["/matches", MATCH_HELP_EVENT],
    ["/vote", VOTE_HELP_EVENT], ["/profile", PROFILE_HELP_EVENT],
  ])("opens the page guide on %s", (path, event) => {
    expect(pageHelp(path).event).toBe(event);
  });
  it("offers Guides on pages without a guide", () => {
    expect(pageHelp("/guides")).toEqual({ title: "Guides" });
  });
});
