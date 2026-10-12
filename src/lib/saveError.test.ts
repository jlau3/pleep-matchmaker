import { describe, expect, it } from "vitest";
import { rethrowIfNavigation } from "./saveError";

describe("rethrowIfNavigation", () => {
  it("rethrows Next.js redirect and not-found signals", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/;307;" });
    expect(() => rethrowIfNavigation(redirect)).toThrow(redirect);
    const notFound = Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(() => rethrowIfNavigation(notFound)).toThrow(notFound);
  });
  it("swallows ordinary failures", () => {
    expect(() => rethrowIfNavigation(new TypeError("Failed to fetch"))).not.toThrow();
    expect(() => rethrowIfNavigation(null)).not.toThrow();
  });
});
