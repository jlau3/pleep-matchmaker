import { describe, expect, it } from "vitest";
import { linkErrorText } from "./SignInMethods";

describe("linkErrorText", () => {
  it("explains an account already used elsewhere", () => {
    expect(linkErrorText("Identity is already linked to another user")).toMatch(/different Pleep Matchmaker account/);
  });
  it("explains manual linking being off", () => {
    expect(linkErrorText("Manual linking is disabled")).toMatch(/isn't switched on/);
  });
  it("explains removing the last method", () => {
    expect(linkErrorText("unlink-last")).toMatch(/at least one way/);
  });
  it("leaves the delete-account error to its own message", () => {
    expect(linkErrorText("delete")).toBeNull();
  });
});
