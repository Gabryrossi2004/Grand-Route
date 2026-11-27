"use client";

import { useState, useTransition } from "react";
import { UserRound } from "lucide-react";
import { assignTrip } from "@/lib/actions/tripAssign";

// Chi della squadra segue questo viaggio
export default function TripAssignee({
  tripId,
  assignedTo,
  people,
  currentUserId,
}: {
  tripId: string;
  assignedTo: string | null;
  people: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [value, setValue] = useState(assignedTo ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(next: string) {
    const before = value;
    setValue(next);
    setError(null);
    start(async () => {
      const res = await assignTrip(tripId, next || null);
      if ("error" in res) {
        setValue(before);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-[#e6d7bb] bg-white px-4 py-2.5 text-sm shadow-sm">
      <UserRound size={16} className="text-[#c58f2d]" aria-hidden />
      <label htmlFor="trip-assignee" className="font-medium text-[#233c5e]">
        Lo segue
      </label>
      <select
        id="trip-assignee"
        value={value}
        disabled={pending}
        onChange={(e) => save(e.target.value)}
        className="rounded-full border border-[#e6d7bb] bg-[#faf3e6] px-3 py-1 text-sm text-[#233c5e] outline-none focus:border-[#cda876] disabled:opacity-60"
      >
        <option value="">Nessuno</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.id === currentUserId ? " (tu)" : ""}
          </option>
        ))}
      </select>
      {value !== currentUserId && (
        <button type="button" disabled={pending} onClick={() => save(currentUserId)} className="text-xs font-medium text-[#233c5e] hover:underline disabled:opacity-60">
          Lo seguo io
        </button>
      )}
      {error && <span className="w-full text-xs text-red-700">{error}</span>}
    </div>
  );
}
