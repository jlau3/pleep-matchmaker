import { CollectionGrid } from "@/components/CollectionGrid";
import { loadOwnChoices } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";

export default async function CollectionPage() {
  const { supabase, user } = await requireUser();
  const choices = await loadOwnChoices(supabase, user.id);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">My list</h1>
      <CollectionGrid initial={choices} />
    </div>
  );
}
