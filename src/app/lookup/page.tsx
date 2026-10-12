import { redirect } from "next/navigation";

export default async function OldLookup({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(q ? `/friends?q=${encodeURIComponent(q)}` : "/friends");
}
