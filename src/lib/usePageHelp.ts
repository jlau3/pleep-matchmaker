"use client";

import { useEffect } from "react";

/** Cancel the navbar event only while this page's guide is mounted. */
export function usePageHelp(eventName: string, open: () => void) {
  useEffect(() => {
    const replay = (event: Event) => { open(); event.preventDefault(); };
    window.addEventListener(eventName, replay);
    return () => window.removeEventListener(eventName, replay);
  }, [eventName, open]);
}
