import { beforeEach, describe, expect, it, vi } from "vitest";
import { HELP_VERSION } from "@/lib/help";

const auth = vi.hoisted(() => ({
  profile: { help_seen_version: 0, setup_done: false },
  profileError: null as null | { message: string },
  next: undefined as string | undefined,
  linking: undefined as string | undefined,
}));
vi.mock("@/components/HowItWorks", () => ({ HowItWorks: () => null }));
vi.mock("@/components/SignInOptions", () => ({ SignInOptions: () => null }));
vi.mock("../tiers/page", () => ({ default: () => null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: vi.fn(), delete: vi.fn(),
    get: (name: string) => {
      const value = name === "pm_next" ? auth.next : name === "pm_linking" ? auth.linking : undefined;
      return value ? { value } : undefined;
    },
  }),
  headers: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/lib/supabase/server", () => {
  const response = () => ({ data: { user: { id: "player" } }, error: null });
  const supabase = {
    auth: { exchangeCodeForSession: async () => response(), verifyOtp: async () => response(), signInWithIdToken: async () => response() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: auth.profile, error: auth.profileError }) }) }) }),
    rpc: vi.fn(),
  };
  return { createClient: async () => supabase, getAuth: async () => ({ supabase, userId: "player" }), requireUser: vi.fn() };
});
import { GET as callback } from "./callback/route";
import { GET as confirm } from "./confirm/route";
import { signInWithGoogleToken } from "../actions";
import Home from "../page";

beforeEach(() => {
  auth.profile = { help_seen_version: 0, setup_done: false };
  auth.profileError = null;
  auth.next = undefined;
  auth.linking = undefined;
});

const origin = "https://example.com";

describe("sign-in landing pages", () => {
  it.each([
    ["OAuth", () => callback(new Request(`${origin}/auth/callback?code=test`))],
    ["email", () => confirm(new Request(`${origin}/auth/confirm?token_hash=test&type=email`))],
  ])("starts first-time %s sign-ins at guided Profile, even from a shared link", async (_name, route) => {
    auth.next = "/friends?q=Sleepy";
    const response = await route();
    expect(response.headers.get("location")).toBe(`${origin}/profile?setup=profile&next=${encodeURIComponent(auth.next)}`);
    expect(response.headers.get("set-cookie")).toContain("pm_next=");
    expect(response.cookies.get("pm_setup_next")?.value).toBe(auth.next);
  });

  it.each([
    ["OAuth", () => callback(new Request(`${origin}/auth/callback?code=test`))],
    ["email", () => confirm(new Request(`${origin}/auth/confirm?token_hash=test&type=email`))],
  ])("sends returning %s players to the Tier List by default", async (_name, route) => {
    auth.profile.help_seen_version = HELP_VERSION;
    expect((await route()).headers.get("location")).toBe(`${origin}/tiers`);
  });

  it("preserves a returning player's explicit destination", async () => {
    auth.profile.help_seen_version = HELP_VERSION;
    auth.next = "/friends?q=Sleepy";
    expect((await callback(new Request(`${origin}/auth/callback?code=test`))).headers.get("location")).toBe(`${origin}${auth.next}`);
  });

  it("uses the same rule for Google's sign-in button", async () => {
    await expect(signInWithGoogleToken("test-token", "test-nonce", "/friends")).rejects.toThrow("redirect:/profile?setup=profile&next=%2Ffriends");
    auth.profile.help_seen_version = HELP_VERSION;
    await expect(signInWithGoogleToken("test-token", "test-nonce", null)).rejects.toThrow("redirect:/tiers");
  });

  it("uses the same rule when Supabase redirects to the home page", async () => {
    await expect(Home({ searchParams: Promise.resolve({ next: "/friends" }) })).rejects.toThrow("redirect:/profile?setup=profile&next=%2Ffriends");
    auth.profile.help_seen_version = HELP_VERSION;
    await expect(Home({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/tiers");
  });

  it("keeps linking another sign-in method on Settings", async () => {
    auth.linking = "discord";
    expect((await callback(new Request(`${origin}/auth/callback?code=test`))).headers.get("location")).toBe(
      `${origin}/profile?linked=discord`,
    );
  });

  it("treats players who skipped setup as returning players", async () => {
    auth.profile.setup_done = true;
    expect((await callback(new Request(`${origin}/auth/callback?code=test`))).headers.get("location")).toBe(`${origin}/tiers`);
  });

  it("replays the release's setup for an existing player whose tutorial progress was reset", async () => {
    auth.profile = { help_seen_version: HELP_VERSION - 1, setup_done: false };
    auth.next = "/matches?sort=active";
    expect((await callback(new Request(`${origin}/auth/callback?code=test`))).headers.get("location")).toBe(
      `${origin}/profile?setup=profile&next=${encodeURIComponent(auth.next)}`,
    );
  });

  it("rejects unsafe return destinations", async () => {
    auth.profile.help_seen_version = HELP_VERSION;
    auth.next = "//another-site.example";
    expect((await callback(new Request(`${origin}/auth/callback?code=test`))).headers.get("location")).toBe(`${origin}/tiers`);
  });
});
