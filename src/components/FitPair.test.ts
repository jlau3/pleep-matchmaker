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
    expect(markup).toContain("For them: no sending estimate yet");
    expect(markup).not.toContain("global votes");
  });
});

it("shows only the viewer's rounded shares on suggestions and no hidden direction", () => {
  const full = renderToStaticMarkup(createElement(FitPair, { onlyYou: true, you: 71.428, they: 99,
    context: { you_unwanted_pct: 28.572, you_utility: 57.142, they_unwanted_pct: 88 } }));
  expect(full).toContain("71%");
  expect(full).toContain("29% unwanted");
  expect(full).not.toContain("For them");
  expect(full).not.toContain("99%");
  const compact = renderToStaticMarkup(createElement(FitPair, { onlyYou: true, compact: true, you: 65,
    context: { you_unwanted_pct: 0, you_utility: 65 } }));
  expect(compact).not.toContain(">0% unwanted<");
  expect(compact).toContain("65%");
});

it("uses exact utility for amber, including zero, and always shows zero unwanted on full cards", () => {
  const render = (utility: number) => renderToStaticMarkup(createElement(FitPair, { onlyYou: true, you: 10.1,
    context: { you_unwanted_pct: 20.1, you_utility: utility } }));
  expect(render(0)).toContain("text-amber-600");
  expect(render(0.05)).not.toContain("text-amber-600");
  const neutral = renderToStaticMarkup(createElement(FitPair, { onlyYou: true, you: 0,
    context: { you_unwanted_pct: 0, you_utility: 0 } }));
  expect(neutral).toContain("0% unwanted");
});
