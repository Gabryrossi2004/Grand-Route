import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { romeToday } from "@/lib/destinationInfo";
import { Bars, Columns } from "@/components/StatsCharts";

export const metadata = { title: "Statistiche" };

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const regionName = new Intl.DisplayNames(["it"], { type: "region" });
const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

type TripRow = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  client_id: string | null;
  countries: string[] | null;
  auto_countries: string[] | null;
};

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#233c5e]">{title}</h2>
      {note && <p className="mb-3 text-xs text-slate-500">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  );
}

export default async function StatsPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  const { data: tripsData } = await supabase
    .from("trips")
    .select("id, title, start_date, end_date, client_id, countries, auto_countries")
    .eq("owner_id", user?.id ?? "");
  const trips = (tripsData as TripRow[] | null) ?? [];
  const ids = trips.map((t) => t.id);
  const [{ data: paidData }, { data: clientsData }] = await Promise.all([
    ids.length
      ? supabase.from("trip_payments").select("trip_id, amount, paid_date").in("trip_id", ids).eq("direction", "incasso").not("paid_date", "is", null)
      : Promise.resolve({ data: [] }),
    supabase.from("clients").select("id, full_name").eq("owner_id", user?.id ?? ""),
  ]);
  const paid = (paidData as { trip_id: string; amount: number; paid_date: string }[] | null) ?? [];
  const clientName = new Map(((clientsData as { id: string; full_name: string }[] | null) ?? []).map((c) => [c.id, c.full_name]));

  const today = romeToday();
  const [ty, tm] = today.split("-").map(Number);
  // ultimi 12 mesi, dal più vecchio al mese corrente
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 1 - (11 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()], hint: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  });
  const departures = months.map((m) => ({ ...m, value: trips.filter((t) => t.start_date?.startsWith(m.key)).length }));
  const income = months.map((m) => ({ ...m, value: paid.filter((p) => p.paid_date.startsWith(m.key)).reduce((s, p) => s + Number(p.amount || 0), 0) }));

  // stagionalità: partenze per mese dell'anno, tutti gli anni
  const season = MONTHS.map((label, i) => ({
    label,
    hint: label,
    value: trips.filter((t) => t.start_date && Number(t.start_date.slice(5, 7)) === i + 1).length,
  }));

  // destinazioni
  const byCountry = new Map<string, number>();
  for (const t of trips) for (const c of new Set([...(t.countries ?? []), ...(t.auto_countries ?? [])])) byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
  const topCountries = [...byCountry.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([c, n]) => ({ label: regionName.of(c) ?? c, value: n }));

  // clienti più fedeli
  const paidByTrip = new Map<string, number>();
  for (const p of paid) paidByTrip.set(p.trip_id, (paidByTrip.get(p.trip_id) ?? 0) + Number(p.amount || 0));
  const byClient = new Map<string, { trips: number; value: number; last: string }>();
  for (const t of trips) {
    if (!t.client_id) continue;
    const e = byClient.get(t.client_id) ?? { trips: 0, value: 0, last: "" };
    e.trips++;
    e.value += paidByTrip.get(t.id) ?? 0;
    const when = t.end_date ?? t.start_date ?? "";
    if (when > e.last) e.last = when;
    byClient.set(t.client_id, e);
  }
  const topClients = [...byClient.entries()]
    .sort((a, b) => b[1].trips - a[1].trips || b[1].value - a[1].value)
    .slice(0, 10)
    .map(([id, e]) => ({ label: clientName.get(id) ?? "Cliente", value: e.trips, sub: euro(e.value) }));

  const cutoff = new Date(Date.UTC(ty, tm - 1 - 18, Number(today.slice(8, 10)))).toISOString().slice(0, 10);
  const dormant = [...byClient.entries()]
    .filter(([, e]) => e.last && e.last < cutoff)
    .sort((a, b) => a[1].last.localeCompare(b[1].last))
    .slice(0, 20);

  const totalYear = income.reduce((s, m) => s + m.value, 0);
  const depYear = departures.reduce((s, m) => s + m.value, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#233c5e]">
          <ArrowLeft size={14} /> Home
        </Link>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Statistiche</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ultimi 12 mesi: <strong>{depYear}</strong> partenze e <strong>{euro(totalYear)}</strong> incassati.
        </p>
      </div>

      {trips.length === 0 ? (
        <p className="rounded-2xl border border-[#e6d7bb] bg-white p-5 text-sm text-slate-600">Le statistiche compariranno quando avrai i primi viaggi.</p>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Partenze per mese" note="Viaggi che partono in ciascuno degli ultimi 12 mesi.">
              <Columns data={departures} format={(n) => String(n)} />
            </Card>
            <Card title="Incassi per mese" note="Pagamenti dei clienti registrati come pagati, per data di pagamento.">
              <Columns data={income} format={(n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)))} />
            </Card>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Destinazioni più vendute" note="Numero di viaggi per paese (un viaggio in più paesi conta in ognuno).">
              {topCountries.length ? <Bars rows={topCountries} format={(n) => `${n} ${n === 1 ? "viaggio" : "viaggi"}`} /> : <p className="text-sm text-slate-500">Nessun paese ancora calcolato: apri il Mappamondo.</p>}
            </Card>
            <Card title="Stagionalità" note="In quali mesi dell'anno partono i tuoi clienti (tutti gli anni).">
              <Columns data={season} format={(n) => String(n)} />
            </Card>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Clienti più fedeli" note="Numero di viaggi e totale incassato.">
              {topClients.length ? <Bars rows={topClients} format={(n) => `${n} ${n === 1 ? "viaggio" : "viaggi"}`} /> : <p className="text-sm text-slate-500">Nessun viaggio collegato a un cliente.</p>}
            </Card>
            <Card title="Da ricontattare" note="Clienti che non viaggiano con te da più di un anno e mezzo.">
              {dormant.length ? (
                <ul className="flex flex-col divide-y divide-[#f0e6d2] text-sm">
                  {dormant.map(([id, e]) => (
                    <li key={id} className="flex justify-between gap-2 py-1.5">
                      <Link href={`/dashboard/clients/${id}`} className="truncate text-[#233c5e] hover:underline">
                        {clientName.get(id) ?? "Cliente"}
                      </Link>
                      <span className="shrink-0 text-slate-500">
                        ultimo viaggio {new Date(`${e.last}T12:00:00`).toLocaleDateString("it-IT", { month: "short", year: "numeric" })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nessuno: tutti i clienti hanno viaggiato di recente.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
