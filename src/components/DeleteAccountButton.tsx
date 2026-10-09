"use client";

import { useTransition } from "react";
import { deleteAccount } from "@/app/actions";

export function DeleteAccountButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete your account and all your picks? This can't be undone.")) {
          startTransition(() => deleteAccount());
        }
      }}
      className="rounded-lg border-2 border-dont px-4 py-2 font-semibold text-dont hover:bg-dont/10 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete account"}
    </button>
  );
}
