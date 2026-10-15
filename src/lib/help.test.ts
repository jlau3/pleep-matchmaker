import { describe, expect, it } from "vitest";
import { automaticPopup } from "./help";

describe("automatic onboarding popups", () => {
  it.each([false, true])("prioritizes the welcome over an unread announcement (setup done: %s)", (setupDone) => {
    expect(automaticPopup({ helpSeen: false, setupDone, metaSeen: false })).toBe("help");
  });

  it("leaves the player to finish setup without announcement interruptions", () => {
    expect(automaticPopup({ helpSeen: true, setupDone: false, metaSeen: false })).toBeNull();
  });

  it("allows an unread announcement after setup is finished or skipped", () => {
    expect(automaticPopup({ helpSeen: true, setupDone: true, metaSeen: false })).toBe("meta");
  });

  it.each([false, true])("does not reopen a seen announcement (setup done: %s)", (setupDone) => {
    expect(automaticPopup({ helpSeen: true, setupDone, metaSeen: true })).toBeNull();
  });
});
