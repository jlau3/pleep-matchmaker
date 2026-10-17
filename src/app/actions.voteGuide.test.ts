import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ error: null as object | null, update: vi.fn(), eq: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: db.revalidate }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  requireUser: async () => ({ user: { id: "voter" }, supabase: { from: () => ({ update: db.update }) } }),
}));
import { markMatchGuideSeen, markVoteGuideSeen } from "./actions";
beforeEach(() => {
  vi.clearAllMocks();db.error = null;
  db.eq.mockImplementation(async () => ({ error: db.error }));db.update.mockReturnValue({ eq: db.eq });
});
describe("voting guide first visit", () => {
  it("records that this player saw the guide and invalidates cached My Votes so it won't reopen on return", async () => {
    await markVoteGuideSeen();
    expect(db.update).toHaveBeenCalledExactlyOnceWith({ vote_guide_seen: true });
    expect(db.eq).toHaveBeenCalledExactlyOnceWith("id", "voter");
    expect(db.revalidate).toHaveBeenCalledExactlyOnceWith("/vote");
  });
  it("leaves the page's seen state alone when the save fails", async () => {
    db.error = {};
    await markVoteGuideSeen();
    expect(db.revalidate).not.toHaveBeenCalled();
  });
});

it("remembers the shared match guide across both friend tabs", async () => {
  await markMatchGuideSeen();
  expect(db.update).toHaveBeenCalledExactlyOnceWith({ match_guide_seen: true });
  expect(db.eq).toHaveBeenCalledExactlyOnceWith("id", "voter");
  expect(db.revalidate.mock.calls).toEqual([["/friends"], ["/matches"]]);
});
