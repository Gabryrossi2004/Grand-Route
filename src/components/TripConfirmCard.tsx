"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Plane } from "lucide-react";
import { confirmTripAction } from "@/app/client/(portal)/actions";

export type PendingConfirm = { trip_id: string; title: string; destination: string | null; end_day: string; agency_name: string };

export type ConfirmLabels = {
  title: string;
  hint: string;
  yes: string;
  no: string;
  thanks: string;
  thanksNo: string;
  error: string;
  ask: string; // con {trip} e {agency}
  askNoAgency: string; // con {trip}
};

// «Com'è andato il viaggio?»: dopo il rientro il cliente conferma con un tocco di aver fatto il viaggio
export default function TripConfirmCard({ trips, labels }: { trips: PendingConfirm[]; labels: ConfirmLabels }) {
  const [items, setItems] = useState(trips);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const answer = (tripId: string, status: "confermato" | "non_partito") =>
    start(async () => {
      setError(false);
      const r = await confirmTripAction(tripId, status);
      if (!r.ok) return setError(true);
      setItems((list) => list.filter((x) => x.trip_id !== tripId));
      setNote(status === "confermato" ? labels.thanks : labels.thanksNo);
    });

  if (items.length === 0 && !note) return null;
  return (
    <section className="mb-8 rounded-3xl border border-[#cda876] bg-gradient-to-b from-[#fdf6e6] to-[#faf3e6] p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-medium text-[#233c5e]">
        <Plane size={20} className="text-[#c58f2d]" aria-hidden /> {labels.title}
      </h2>
      {items.length > 0 && <p className="mt-1 text-sm text-slate-600">{labels.hint}</p>}
      <ul className="mt-3 flex flex-col gap-3">
        {items.map((t) => (
          <li key={t.trip_id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#e6d7bb]">
            <p className="font-medium text-[#233c5e]">{(t.agency_name ? labels.ask : labels.askNoAgency).replace("{trip}", t.title).replace("{agency}", t.agency_name)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => answer(t.trip_id, "confermato")}
                className="rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17283f] disabled:opacity-60"
              >
                {labels.yes}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => answer(t.trip_id, "non_partito")}
                className="rounded-full border border-[#cbbfa6] px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-[#faf3e6] disabled:opacity-60"
              >
                {labels.no}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-red-700">{labels.error}</p>}
      {note && (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-800">
          <CheckCircle2 size={17} aria-hidden /> {note}
        </p>
      )}
    </section>
  );
}
