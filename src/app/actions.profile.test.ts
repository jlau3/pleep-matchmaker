import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  results: [] as { error: null | { code: string; message: string } }[],
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  requireUser: async () => ({
    user: { id: "review-user" },
    supabase: {
      from: () => ({
        update: (payload: Record<string, unknown>) => ({
          eq: async () => {
            db.calls.push(payload);
            return db.results.shift() ?? { error: null };
          },
        }),
      }),
    },
  }),
  createClient: vi.fn(),
}));
import { updateProfile } from "./actions";

function profileForm() {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    ign: "Sleeper",
    friend_code: "123456789012",
    visibility: "friends",
    has_extras: "1",
    game_avatar: "",
    reddit_username: "napper",
    has_show_discord: "1",
    has_show_reddit: "1",
  }))
    form.set(name, value);
  return form;
}

beforeEach(() => {
  db.calls = [];
  db.results = [];
});

describe("profile saves", () => {
  it("saves the guide's name step without submitting an unfinished code or changing privacy", async () => {
    const form = profileForm();
    form.set("profile_step", "ign");
    form.set("friend_code", "123");
    expect(await updateProfile({}, form)).toEqual({ saved: true });
    expect(db.calls).toEqual([{ ign: "Sleeper" }]);
  });

  it("saves only the selected discovery options in the privacy step", async () => {
    const form = profileForm();
    form.set("profile_step", "visibility");
    form.set("reddit_username", "unfinished name");
    expect(await updateProfile({}, form)).toEqual({ saved: true });
    expect(db.calls).toEqual([{ open_to_friends: false, allow_lookup: false }]);
  });

  it("validates the active guide step on the server as well as in the browser", async () => {
    const form = profileForm();
    form.set("profile_step", "friend_code");
    form.set("friend_code", "123");
    expect((await updateProfile({}, form)).error).toContain("12-digit");
    expect(db.calls).toHaveLength(0);
  });

  it("reports failure rather than silently discarding Reddit privacy and icon changes", async () => {
    db.results = [{ error: { code: "42501", message: "permission denied" } }, { error: null }];
    expect((await updateProfile({}, profileForm())).error).toBeTruthy();
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].show_reddit).toBe(false);
  });

  it("only confirms success after saving every submitted field", async () => {
    expect(await updateProfile({}, profileForm())).toEqual({ saved: true });
    expect(db.calls).toEqual([
      {
        ign: "Sleeper",
        friend_code: "123456789012",
        open_to_friends: false,
        allow_lookup: false,
        show_discord: false,
        reddit_username: "napper",
        game_avatar: null,
        show_reddit: false,
      },
    ]);
  });

  it("rejects an invalid code without attempting a save", async () => {
    const form = profileForm();
    form.set("friend_code", "123");
    expect((await updateProfile({}, form)).error).toContain("12 digits");
    expect(db.calls).toHaveLength(0);
  });
});
