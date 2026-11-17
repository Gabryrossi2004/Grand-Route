import Link from "next/link";
import Image from "next/image";
import { Calendar, MapPin, Plane } from "lucide-react";
import type { Trip } from "@/lib/types";
import { darkenForWhiteText, sanitizeHex } from "@/lib/brandColor";

export type TripWithAgency = Trip & {
  profiles: { agency_name: string | null; logo_url: string | null; brand_color: string | null } | null;
};

export default function ClientTripsGrid({
  trips,
  tripHref,
  emptyMessage,
  emptyHint,
  locale = "it-IT",
  labels = {
    confirmed: "Confermato",
    inPreparation: "In preparazione",
    organizedBy: (agency: string) => `Organizzato da ${agency}`,
  },
}: {
  trips: TripWithAgency[];
  tripHref: (tripId: string) => string;
  emptyMessage: string;
  emptyHint?: string;
  locale?: string;
  labels?: { confirmed: string; inPreparation: string; organizedBy: (agency: string) => string };
}) {
  if (trips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Plane size={24} className="mx-auto mb-2 text-slate-300" />
        <p className="text-slate-500">{emptyMessage}</p>
        {emptyHint && <p className="mt-1 text-sm text-slate-500">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {trips.map((trip) => {
        const dateRange =
          trip.start_date && trip.end_date
            ? `${new Date(trip.start_date).toLocaleDateString(locale)} – ${new Date(trip.end_date).toLocaleDateString(locale)}`
            : trip.start_date
              ? new Date(trip.start_date).toLocaleDateString(locale)
              : null;

        return (
          <Link
            key={trip.id}
            href={tripHref(trip.id)}
            className="group overflow-hidden rounded-3xl border border-[#e6d7bb] bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#233c5e]/10"
          >
            <div
              className="relative h-44 w-full bg-[#233c5e]"
              style={sanitizeHex(trip.profiles?.brand_color) ? { backgroundColor: darkenForWhiteText(sanitizeHex(trip.profiles?.brand_color)!) } : undefined}
            >
              {trip.cover_image_url && (
                <>
                  <Image src={trip.cover_image_url} alt="" fill sizes="50vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                </>
              )}
              <span
                className={
                  trip.is_published
                    ? "absolute right-2 top-2 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-white"
                    : "absolute right-2 top-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
                }
              >
                {trip.is_published ? labels.confirmed : labels.inPreparation}
              </span>
              <p className="absolute bottom-3 left-4 right-4 truncate font-[family-name:var(--font-display)] text-lg font-medium text-white">{trip.title}</p>
            </div>
            <div className="p-4">
              {trip.destination && (
                <p className="flex items-center gap-1 text-sm text-slate-600">
                  <MapPin size={13} className="shrink-0 text-slate-500" /> {trip.destination}
                </p>
              )}
              {dateRange && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Calendar size={12} className="shrink-0" /> {dateRange}
                </p>
              )}
              {trip.profiles?.agency_name && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  {trip.profiles.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={trip.profiles.logo_url} alt="" className="h-4 w-4 rounded object-contain" />
                  )}
                  {labels.organizedBy(trip.profiles.agency_name)}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
