import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = { title: "Feedback · Pleep Matchmaker" };

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requireUser();
  const from = (await searchParams).from ?? "";
  return (
    <div className="card mx-auto max-w-xl p-6">
      <h1 className="mb-1 text-2xl font-extrabold">Send feedback</h1>
      <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
        Found a bug or have an idea? It goes straight to the developer with your in-game name. If you&apos;d like a reply, add how to reach you.
      </p>
      <FeedbackForm page={from.startsWith("/") ? from.slice(0, 200) : ""} />
    </div>
  );
}
