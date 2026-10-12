import { describe, expect, it } from "vitest";
import { safeNextPath } from "./nextPath";

describe("safeNextPath", () => {
  it.each([
    ["/friends?q=bob", "/friends?q=bob"],
    ["/tiers", "/tiers"],
    ["//evil.com", null],
    ["/\\evil.com", null],
    ["https://evil.com", null],
    ["friends", null],
    [undefined, null],
    ["/" + "a".repeat(400), null],
  ])("%s -> %s", (input, out) => {
    expect(safeNextPath(input)).toBe(out);
  });
});
