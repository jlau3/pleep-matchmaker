"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Also restarts onboarding for players whose existing session survived release. */
export function StartProfileSetup() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    const current = new URL(window.location.href);
    if (pathname === "/profile") {
      if (current.searchParams.get("setup") === "profile") return;
      current.searchParams.set("setup", "profile");
      router.replace(current.pathname + current.search, { scroll: false });
      return;
    }
    const next = current.pathname + current.search;
    router.replace(`/profile?setup=profile&next=${encodeURIComponent(next)}`);
  }, [pathname, router]);
  return null;
}
