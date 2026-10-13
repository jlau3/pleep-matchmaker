import { describe, expect, it } from "vitest";
import { crowdChoice, crowdHint } from "./crowd";

describe("crowdChoice", () => {
  it("wants a line most players want and few turn down", () => {
    expect(crowdChoice({ wants: 50, dontWants: 10 }, 100)).toBe("want");
    expect(crowdChoice({ wants: 40, dontWants: 20 }, 100)).toBe("want");
  });

  it("turns down a line most players turn down", () => {
    expect(crowdChoice({ wants: 5, dontWants: 60 }, 100)).toBe("dont_want");
  });

  it("stays Neutral on divisive lines", () => {
    expect(crowdChoice({ wants: 45, dontWants: 40 }, 100)).toBe("undecided");
    expect(crowdChoice({ wants: 41, dontWants: 21 }, 100)).toBe("undecided");
  });

  it("stays Neutral when too few care either way", () => {
    expect(crowdChoice({ wants: 30, dontWants: 0 }, 100)).toBe("undecided");
    expect(crowdChoice(undefined, 100)).toBe("undecided");
    expect(crowdChoice({ wants: 3, dontWants: 0 }, 0)).toBe("undecided");
  });
});

describe("crowdHint", () => {
  it("gives the lean and rounded shares", () => {
    expect(crowdHint({ wants: 62, dontWants: 7 }, 100)).toEqual({ lean: "want", wantPct: 62, dontPct: 7 });
    expect(crowdHint({ wants: 2, dontWants: 1 }, 3)).toEqual({ lean: "want", wantPct: 67, dontPct: 33 });
    expect(crowdHint(undefined, 10)).toEqual({ lean: "undecided", wantPct: 0, dontPct: 0 });
  });
});
