import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import TripTitleEditor from "@/components/TripTitleEditor";

const dateIt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

type Tab = "itinerario" | "valigia" | "spese";

// Intestazione comune alle pagine di un viaggio del viaggiatore: titolo, date e schede
export default function TripHeader({
  trip,
  active,
}: {
  trip: { id: string; title: string; destination: string | null; start_date: string | null; end_date: string | null };
  active: Tab;
}) {
  const tabs: { id: Tab; label: string; href: string }[] = [
    { id: "itinerario", label: "Itinerario", href: `/viaggiatore/viaggi/${trip.id}` },
    { id: "valigia", label: "Valigia", href: `/viaggiatore/viaggi/${trip.id}/valigia` },
    { id: "spese", label: "Spese", href: `/viaggiatore/viaggi/${trip.id}/spese` },
  ];
  return (
    <div>
      <Link href="/viaggiatore" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#233c5e]">
        <ArrowLeft size={14} /> I miei viaggi
      </Link>
      <TripTitleEditor tripId={trip.id} title={trip.title} destination={trip.destination} />
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        {trip.destination && (
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="text-[#c58f2d]" /> {trip.destination}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <CalendarDays size={14} className="text-[#c58f2d]" />
          {trip.start_date ? `${dateIt(trip.start_date)}${trip.end_date ? ` – ${dateIt(trip.end_date)}` : ""}` : "Date da decidere: impostale nella barra dei giorni"}
        </span>
      </p>
      <nav className="mt-4 flex gap-1 border-b border-[#e6d7bb]" aria-label="Sezioni del viaggio">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={t.id === active ? "page" : undefined}
            className={`px-4 py-2 text-sm font-medium transition ${t.id === active ? "border-b-2 border-[#233c5e] text-[#233c5e]" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
