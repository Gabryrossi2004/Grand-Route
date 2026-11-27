"use client";

import { useState, useTransition } from "react";
import { revokeInvite } from "@/app/dashboard/squadra/actions";

export default function RevokeInviteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await revokeInvite(id);
            if ("error" in res) setError(res.error);
          })
        }
        className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-xs font-medium text-[#756548] transition hover:bg-[#faf3e6] disabled:opacity-60"
      >
        {pending ? "…" : "Annulla invito"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </>
  );
}
