"use client";

import { useState, useTransition } from "react";
import { changeMemberRole, removeMember } from "@/app/dashboard/team/actions";
import { ROLE_LABELS, TEAM_ROLES, type TeamRole } from "@/lib/teamRoles";

// Ruolo e uscita di un collega (solo per i titolari)
export default function MemberControls({ userId, role, name, isSelf }: { userId: string; role: TeamRole; name: string; isSelf: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<TeamRole>(role);

  function onRole(next: TeamRole) {
    const before = current;
    setCurrent(next);
    setError(null);
    start(async () => {
      const res = await changeMemberRole(userId, next);
      if ("error" in res) {
        setCurrent(before);
        setError(res.error);
      }
    });
  }
  function onRemove() {
    const question = isSelf
      ? "Vuoi uscire dal team? Non vedrai più i dati dell'agenzia."
      : `Rimuovere ${name} dal team? Perde subito l'accesso; i viaggi e i dati restano all'agenzia.`;
    if (!window.confirm(question)) return;
    setError(null);
    start(async () => {
      const res = await removeMember(userId);
      if ("error" in res) setError(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Ruolo di ${name}`}
        value={current}
        disabled={pending}
        onChange={(e) => onRole(e.target.value as TeamRole)}
        className="rounded-full border border-[#e6d7bb] bg-white px-3 py-1.5 text-xs font-medium text-[#233c5e] outline-none focus:border-[#cda876] disabled:opacity-60"
      >
        {TEAM_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
      >
        {isSelf ? "Esci" : "Rimuovi"}
      </button>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
