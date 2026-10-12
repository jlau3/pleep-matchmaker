import { describe, expect, it } from "vitest";
import { kofiDiscordMessage, parseKofiForm, tokenMatches } from "./kofi";

describe("Ko-fi webhook", () => {
  it("parses the data field", () => {
    const form = new FormData();
    form.set("data", JSON.stringify({ verification_token: "t", amount: "3.00" }));
    expect(parseKofiForm(form)).toMatchObject({ amount: "3.00" });
    form.set("data", "not json");
    expect(parseKofiForm(form)).toBeNull();
    expect(parseKofiForm(new FormData())).toBeNull();
  });

  it("checks the verification token", () => {
    expect(tokenMatches("abc", "abc")).toBe(true);
    expect(tokenMatches("abd", "abc")).toBe(false);
    expect(tokenMatches("ab", "abc")).toBe(false);
    expect(tokenMatches(undefined, "abc")).toBe(false);
    expect(tokenMatches("", "")).toBe(false);
  });

  it("formats public and private donations", () => {
    const base = { type: "Donation", from_name: "Jo", message: "love it", amount: "5.00", currency: "USD" };
    expect(kofiDiscordMessage({ ...base, is_public: true })).toBe("☕ **Jo** donated: 5.00 USD\n> love it");
    expect(kofiDiscordMessage({ ...base, is_public: false })).toBe("☕ **Someone** donated: 5.00 USD");
  });

  it("formats memberships", () => {
    const sub = { type: "Subscription", from_name: "Jo", amount: "3.00", currency: "USD", tier_name: "Snorlax" };
    expect(kofiDiscordMessage({ ...sub, is_first_subscription_payment: true })).toBe(
      "☕ **Jo** started a monthly membership (Snorlax): 3.00 USD",
    );
    expect(kofiDiscordMessage(sub)).toBe("☕ **Jo** renewed their membership (Snorlax): 3.00 USD");
  });
});
