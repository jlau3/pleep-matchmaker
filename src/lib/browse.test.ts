import { describe, expect, it } from "vitest";
import { browseQuery, parseBrowse } from "./browse";

describe("Find New Friends options", () => {
  it("defaults and validates", () => {
    expect(parseBrowse({})).toEqual({ sort: "fit", everyone: false, page: 1 });
    expect(parseBrowse({ sort: "nope", show: "x", page: "-3" })).toEqual({ sort: "fit", everyone: false, page: 1 });
    expect(parseBrowse({ sort: "active", show: "all", page: "4" })).toEqual({ sort: "active", everyone: true, page: 4 });
  });

  it("builds query strings without defaults, keeping the search", () => {
    expect(browseQuery({ sort: "fit", everyone: false, page: 1 })).toBe("");
    expect(browseQuery({ sort: "shared", everyone: true, page: 2 }, "bob")).toBe("?q=bob&sort=shared&show=all&page=2");
  });
});
