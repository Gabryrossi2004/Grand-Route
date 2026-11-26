import Link from "next/link";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { getTravelerAllowance } from "@/lib/travelerAi";
import GettingStarted from "@/components/GettingStarted";
import { progressOf, travelerSteps, type OnboardingStatus } from "@/lib/onboarding";

type TripRow = { id: string; title: string; destination: string | null; start_date: string | null; end_date: string | null };

const dateIt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });

export default async function TravelerHomePage({ searchParams }: { searchParams: Promise<{ iniziare?: string }> }) {
  const user = await getCachedUser();
  const supabase = await createClient();
  if ((await searchParams).iniziare) await supabase.rpc("set_onboarding_hidden", { p_hidden: false });
  const [{ data }, allowance, { data: profile }, { data: onboarding }] = await Promise.all([
    supabase.from("trips").select("id, title, destination, start_date, end_date").eq("owner_id", user?.id ?? "").order("created_at", { ascending: false }),
    getTravelerAllowance(),
    supabase.from("profiles").select("full_name").eq("id", user?.id ?? "").maybeSingle(),
    supabase.rpc("onboarding_status"),
  ]);
  const ob = (onboarding as OnboardingStatus | null) ?? null;
  const trips = (data as TripRow[] | null) ?? [];
  const first = String(profile?.full_name ?? "").split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">{first ? `Ciao ${first}!` : "I tuoi viaggi"}</h1>
          <p className="mt-1 text-sm text-slate-600">Dove andiamo?</p>
        </div>
        <Link href="/viaggiatore/nuovo" className="flex items-center gap-1.5 rounded-full bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#17283f]">
          <Plus size={16} /> Nuovo viaggio
        </Link>
      </div>

      {ob && !ob.hidden && <GettingStarted steps={travelerSteps(ob)} name={first} />}
      {ob?.hidden && !progressOf(travelerSteps(ob)).complete && (
        <Link href="/viaggiatore?iniziare=1" className="text-xs font-medium text-[#756548] hover:text-[#233c5e] hover:underline">Riapri la lista «Per iniziare»</Link>
      )}

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-8 text-center">
          <p className="text-lg font-semibold text-[#233c5e]">Il tuo primo viaggio</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Scegli un itinerario pronto per il paese che ti piace, oppure racconta a Zefiro cosa vuoi fare: poi lo modifichi come vuoi.
          </p>
          <Link href="/viaggiatore/nuovo" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f]">
            <Plus size={16} /> Crea il primo viaggio
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {trips.map((t) => (
            <li key={t.id}>
              <Link href={`/viaggiatore/viaggi/${t.id}`} className="block rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm transition hover:border-[#cda876] hover:shadow-md">
                <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">{t.title}</p>
                {t.destination && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin size={14} className="text-[#c58f2d]" /> {t.destination}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <CalendarDays size={14} className="text-[#c58f2d]" />
                  {t.start_date ? `${dateIt(t.start_date)}${t.end_date ? ` – ${dateIt(t.end_date)}` : ""}` : "Date da decidere"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {allowance.traveler && allowance.available && (
        <p className="rounded-2xl border border-[#e6d7bb] bg-white/70 px-4 py-3 text-xs text-slate-600">
          Zefiro, questo mese: <strong>{allowance.left}</strong> itinerari con l&apos;AI su {allowance.total}. Le proposte pronte sono sempre gratis. Con un&apos;agenzia non ci sono limiti.
        </p>
      )}
    </div>
  );
}
