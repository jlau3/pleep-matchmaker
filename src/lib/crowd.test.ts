import { describe, expect, it } from "vitest";
import { crowdChoice, crowdVotes } from "./crowd";
import { LINES } from "./lines";

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

describe("crowdVotes", () => {
  it("covers every line and counts the buckets", () => {
    const first = LINES[0].id;
    const { choices, counts } = crowdVotes({ [first]: { wants: 9, dontWants: 0 } }, 10);
    expect(Object.keys(choices)).toHaveLength(LINES.length);
    expect(choices[first]).toBe("want");
    expect(counts).toEqual({ want: 1, dont_want: 0, undecided: LINES.length - 1 });
  });
});
