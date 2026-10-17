"use client";

import { usePathname, useRouter } from "next/navigation";
import { pageHelp } from "@/lib/help";

/** One help entry point: replay this page's guide, or visit Guides. */
export function PageHelpButton() {
  const pathname = usePathname();
  const router = useRouter();
  const help = pageHelp(pathname);
  return (
    <button type="button" aria-label={help.title} title={help.title}
      onClick={() => {
        if (help.event && !window.dispatchEvent(new Event(help.event, { cancelable: true }))) return;
        router.push("/guides");
      }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/40 font-bold text-white/80 hover:bg-white/15 hover:text-white">
      ?
    </button>
  );
}
