import type { Metadata } from "next";
import { HowItWorks } from "@/components/HowItWorks";

export const metadata: Metadata = { title: "How it works · Pleep Matchmaker" };

export default function AboutPage() {
  return (
    <div className="card mx-auto max-w-xl p-6">
      <h1 className="mb-1 text-2xl font-extrabold">How Pleep Matchmaker works</h1>
      <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
        A candy wishlist for Pokémon Sleep players and their friends.
      </p>
      <HowItWorks />
    </div>
  );
}
