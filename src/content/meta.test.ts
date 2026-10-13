import { describe, expect, it } from "vitest";
import { activeMetaPost, type MetaPost, publishedMetaPosts } from "./meta";

const post = (id: string, startsAt: string, endsAt: string): MetaPost => ({ id, title: id, startsAt, endsAt, body: null });
const posts = [post("new", "2026-11-10", "2026-11-20"), post("old", "2026-11-01", "2026-11-12")];

describe("meta posts", () => {
  it("pops up the newest note whose dates include today, end day included", () => {
    expect(activeMetaPost(new Date("2026-11-05T12:00:00Z"), posts)?.id).toBe("old");
    expect(activeMetaPost(new Date("2026-11-11T00:00:00Z"), posts)?.id).toBe("new");
    expect(activeMetaPost(new Date("2026-11-20T23:59:00Z"), posts)?.id).toBe("new");
    expect(activeMetaPost(new Date("2026-11-21T00:00:00Z"), posts)).toBeNull();
    expect(activeMetaPost(new Date("2026-10-31T23:59:00Z"), posts)).toBeNull();
  });

  it("lists notes once they start, including ended ones", () => {
    expect(publishedMetaPosts(new Date("2026-11-05T00:00:00Z"), posts).map((p) => p.id)).toEqual(["old"]);
    expect(publishedMetaPosts(new Date("2026-12-01T00:00:00Z"), posts).map((p) => p.id)).toEqual(["new", "old"]);
  });
});
