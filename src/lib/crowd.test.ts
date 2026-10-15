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

  it("measures a line against the voters who've seen it", () => {
    // A new line: 15 of the 20 who've seen it want it, out of 150 voters in all.
    expect(crowdChoice({ wants: 15, dontWants: 2, seen: 20 }, 150)).toBe("want");
    expect(crowdChoice({ wants: 15, dontWants: 2 }, 150)).toBe("undecided");
    // Too few have seen it to say.
    expect(crowdChoice({ wants: 8, dontWants: 0, seen: 9 }, 150)).toBe("undecided");
  });
});

describe("crowdHint", () => {
  it("gives the lean and rounded shares", () => {
    expect(crowdHint({ wants: 62, dontWants: 7 }, 100)).toEqual({ lean: "want", wantPct: 62, dontPct: 7, seen: 100, early: false });
    expect(crowdHint({ wants: 6, dontWants: 3 }, 12)).toEqual({ lean: "want", wantPct: 50, dontPct: 25, seen: 12, early: false });
    expect(crowdHint(undefined, 10)).toEqual({ lean: "undecided", wantPct: 0, dontPct: 0, seen: 10, early: false });
  });

  it("marks a line most voters haven't seen as early", () => {
    expect(crowdHint({ wants: 15, dontWants: 2, seen: 20 }, 150)).toEqual({ lean: "want", wantPct: 75, dontPct: 10, seen: 20, early: true });
  });
});
