"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { setAccountMode } from "@/app/dashboard/team/actions";

// Account individuale → aziendale (per invitare i colleghi). Con l'account aziendale porta alla pagina Team.
export default function AccountModeCard({ mode, compact = false }: { mode: "individuale" | "azienda"; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (mode === "azienda") {
    return (
      <Link
        href="/dashboard/team"
        className="mb-6 flex items-center gap-3 rounded-xl border border-[#e6d7bb] bg-white px-5 py-4 transition hover:shadow-sm"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-white">
          <Users size={16} aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-semibold text-slate-900">Team</span>
          <span className="block text-xs text-slate-500">Account aziendale: invita i colleghi, cambia i ruoli, togli chi non lavora più con te.</span>
        </span>
      </Link>
    );
  }

  return (
    <section className={`${compact ? "" : "mb-6"} rounded-2xl border border-[#e6d7bb] bg-white p-5 shadow-sm`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#faf3e6] text-[#c58f2d]">
          <Users size={16} aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Lavori con dei colleghi?</h2>
          <p className="mt-1 text-xs text-slate-600">
            Il tuo account è <strong>individuale</strong>. Trasformalo in account aziendale per invitare i colleghi: ognuno entra con la sua
            email e lavora sugli stessi viaggi, clienti e fornitori.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await setAccountMode("azienda");
                if ("error" in res) setError(res.error);
                else router.push("/dashboard/team");
              })
            }
            className="mt-3 rounded-full bg-[#233c5e] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1b2f4a] disabled:opacity-60"
          >
            {pending ? "Un attimo…" : "Trasforma in account aziendale"}
          </button>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
