import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const auth = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: auth.id } } }) }, rpc: vi.fn() }) }));
vi.mock("@/lib/supabase/env", () => ({ supabaseEnv: () => ({ url: "https://dev.example", key: "public" }) }));
import { middleware } from "./middleware";
beforeEach(() => { auth.id = null; });
describe("public and locked routes", () => {
  it.each(["/", "/tiers", "/tiers?island=cyan-beach"])("allows signed-out visitors at %s", async (path) => {
    const response = await middleware(new NextRequest(`https://example.com${path}`));
    expect(response.headers.get("location")).toBeNull();expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
  it.each(["/friends?q=Sleepy%20Head", "/matches?sort=match", "/profile", "/vote", "/guides"])("retains the original shared address while presenting sign-in at %s", async (path) => {
    const response = await middleware(new NextRequest(`https://example.com${path}`));
    const rewrite = new URL(response.headers.get("x-middleware-rewrite")!);
    expect(rewrite.pathname).toBe("/auth/required");expect(rewrite.searchParams.get("next")).toBe(path);
    expect(response.headers.get("location")).toBeNull();
  });
  it("opens personal pages normally after sign-in", async () => {
    auth.id = "player";
    expect((await middleware(new NextRequest("https://example.com/friends?q=Sleepy"))).headers.get("x-middleware-rewrite")).toBeNull();
  });
});
