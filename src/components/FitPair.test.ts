import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FitPair } from "./FitPair";

describe("match score provenance", () => {
  it("labels both directions independently in card and grid views", () => {
    for (const compact of [false, true]) {
      const markup = renderToStaticMarkup(createElement(FitPair, {
        you: 0, they: 80, compact,
        context: { you_source: "Everyone estimate", they_source: "Friends + Everyone" },
      }));
      expect(markup).toContain("Everyone estimate");
      expect(markup).toContain("Friends + Everyone");
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
    expect(markup).not.toContain("Everyone estimate");
  });
});
