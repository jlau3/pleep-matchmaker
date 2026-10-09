import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

// Daily Vercel cron. Supabase free projects pause after a week without
// database traffic; one cheap query keeps it awake.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { url, key } = supabaseEnv();
  const { error } = await createClient(url, key).from("profiles").select("id", { head: true }).limit(1);
  return NextResponse.json({ ok: !error });
}
