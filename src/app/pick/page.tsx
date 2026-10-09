import Link from "next/link";
import { PickFlow } from "@/components/PickFlow";
import { loadOwnChoices } from "@/lib/data";
import { LINES } from "@/lib/lines";
import { requireUser } from "@/lib/supabase/server";

export default async function PickPage() {
  const { supabase, user } = await requireUser();
  const choices = await loadOwnChoices(supabase, user.id);
  const remaining = LINES.filter((line) => !(line.id in choices));
  const sorted = LINES.length - remaining.length;

  if (remaining.length === 0) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="mb-2 text-2xl font-bold">All {LINES.length} lines sorted</h1>
        <p className="mb-6 text-slate-600 dark:text-slate-300">New Pokémon will show up here when the game adds them.</p>
        <div className="flex justify-center gap-3">
          <Link href="/friends" className="rounded-xl bg-want px-5 py-3 font-semibold text-white">
            Friends
          </Link>
          <Link href="/collection" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold dark:border-slate-700">
            Edit my list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {sorted > 0 && (
        <p className="mb-2 text-center text-sm text-slate-500">
          {remaining.length} new or unsorted {remaining.length === 1 ? "line" : "lines"}. Change earlier picks in{" "}
          <Link href="/collection" className="underline">
            My list
          </Link>
          .
        </p>
      )}
      <PickFlow lines={remaining} total={LINES.length} alreadySorted={sorted} />
    </div>
  );
}
