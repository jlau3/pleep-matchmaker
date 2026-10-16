import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FitPair } from "./FitPair";

describe("match score provenance", () => {
  it("names each direction's source in its tooltip only, in card and grid views", () => {
    for (const compact of [false, true]) {
      const markup = renderToStaticMarkup(createElement(FitPair, {
        you: 0, they: 80, compact,
        context: { you_source: "Everyone estimate", they_source: "Friends + Everyone" },
      }));
      expect(markup).toContain("(from global votes)");
      expect(markup).toContain("(from friends&#x27;");
      expect(markup).not.toContain(">Everyone estimate<");
      expect(markup).toContain("0%");
    }
  });
  it("explains whose votes are missing without claiming private activity is known", () => {
    const markup = renderToStaticMarkup(createElement(FitPair, {
      you: null, they: null,
      context: { you_voted: false, they_voted: null, you_source: "Everyone estimate" },
    }));
    expect(markup).toContain("For you: vote on candy to calculate this score");
    expect(markup).toContain("For them: not enough voting data");
    expect(markup).not.toContain("global votes");
  });
});
