import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/team";
import { DEFAULT_LEVELS, levelFor, parseLevels, pointsFrom } from "@/lib/benefits";
import { romeToday } from "@/lib/destinationInfo";
import { Bars, Columns } from "@/components/StatsCharts";

export const metadata = { title: "Statistiche sui vantaggi" };

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

type Client = { id: string; full_name: string; referred_by_client_id?: string | null };
type Trip = { id: string; client_id: string | null };
type Adjustment = { client_id: string; points: number; reason: string; created_at: string };
type Lead = { id: string; referrer_client_id: string | null; source: string; status: string; created_at: string };
type Offer = { id: string; kind?: string; active: boolean; valid_until: string | null };

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#233c5e]">{title}</h2>
      {note ? <p className="mb-3 text-xs text-slate-500">{note}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[#e6d7bb] bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-[#233c5e]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// Che cosa fanno i vantaggi per l'agenzia: clienti nel programma, livelli, punti, amici presentati,
// richieste di preventivo e offerte. Si calcola tutto dai dati che ci sono già.
export default async function BenefitsStatsPage() {
  const supabase = await createClient();
  // Dati dell'agenzia (per un collaboratore: quelli dell'agenzia in cui lavora)
  const companyId = (await getTeamContext())?.companyId ?? "";
  const uid = companyId;

  const [{ data: loyalty, error: loyaltyError }, clientsRes, { data: tripRows }, adjRes, leadsRes, offersRes] = await Promise.all([
    supabase.from("agency_loyalty").select("*").eq("owner_id", uid).maybeSingle(),
    supabase.from("clients").select("id, full_name, referred_by_client_id").eq("owner_id", uid),
    supabase.from("trips").select("id, client_id").eq("owner_id", uid).not("client_id", "is", null),
    supabase.from("loyalty_adjustments").select("client_id, points, reason, created_at").eq("owner_id", uid).limit(5000),
    supabase.from("agency_leads").select("id, referrer_client_id, source, status, created_at").eq("owner_id", uid).limit(5000),
    supabase.from("agency_offers").select("id, kind, active, valid_until").eq("owner_id", uid),
  ]);

  // Senza la migrazione 0057 la colonna «presentato da» non c'è: si rilegge l'elenco senza
  let clients = ((clientsRes.data as Client[] | null) ?? []) as Client[];
  const attributionReady = !clientsRes.error;
  if (clientsRes.error) {
    const { data } = await supabase.from("clients").select("id, full_name").eq("owner_id", uid);
    clients = (data as Client[] | null) ?? [];
  }
  const trips = (tripRows as Trip[] | null) ?? [];
  const adjustments = adjRes.error ? [] : ((adjRes.data as Adjustment[] | null) ?? []);
  const leads = leadsRes.error ? [] : ((leadsRes.data as Lead[] | null) ?? []);
  const offers = offersRes.error ? [] : ((offersRes.data as Offer[] | null) ?? []);
  const loyaltyReady = !loyaltyError;
  const enabled = Boolean(loyalty?.enabled);
  const rate = Number(loyalty?.euros_per_point ?? 10) || 10;
  const levels = loyalty ? parseLevels(loyalty.levels) : DEFAULT_LEVELS;

  // incassi per viaggio (pagamenti dei clienti registrati come pagati)
  const tripIds = trips.map((t) => t.id);
  const { data: paidRows } = tripIds.length
    ? await supabase.from("trip_payments").select("trip_id, amount").in("trip_id", tripIds).eq("direction", "incasso").not("paid_date", "is", null)
    : { data: [] };
  const paidByTrip = new Map<string, number>();
  for (const p of (paidRows as { trip_id: string; amount: number }[] | null) ?? []) paidByTrip.set(p.trip_id, (paidByTrip.get(p.trip_id) ?? 0) + Number(p.amount || 0));

  const nameOf = new Map(clients.map((c) => [c.id, c.full_name]));
  const stat = new Map<string, { trips: number; paid: number; bonus: number }>();
  for (const c of clients) stat.set(c.id, { trips: 0, paid: 0, bonus: 0 });
  for (const t of trips) {
    const e = t.client_id ? stat.get(t.client_id) : null;
    if (!e) continue;
    e.trips++;
    e.paid += paidByTrip.get(t.id) ?? 0;
  }
  for (const a of adjustments) {
    const e = stat.get(a.client_id);
    if (e) e.bonus += a.points;
  }

  const withTrips = [...stat.values()].filter((e) => e.trips > 0);
  const returning = withTrips.filter((e) => e.trips >= 2);
  const totalPaid = [...stat.values()].reduce((s, e) => s + e.paid, 0);

  // livelli
  const perLevel = levels.map((l) => ({ name: l.name, min: l.min, clients: 0, paid: 0 }));
  const near: { id: string; name: string; missing: number; next: string }[] = [];
  for (const [id, e] of stat) {
    const points = pointsFrom(e.paid, rate, e.bonus);
    const { current, next } = levelFor(points, levels);
    const row = perLevel.find((l) => l.name === current?.name);
    if (row && e.trips > 0) {
      row.clients++;
      row.paid += e.paid;
    }
    if (e.trips > 0 && next && next.min - points <= Math.max(50, Math.round(next.min * 0.2))) near.push({ id, name: nameOf.get(id) ?? "Cliente", missing: next.min - points, next: next.name });
  }
  near.sort((a, b) => a.missing - b.missing);

  // punti: guadagnati con i viaggi, bonus dati dall'agenzia, punti usati
  const earnedTrips = Math.floor(totalPaid / rate);
  const bonusGiven = adjustments.filter((a) => a.points > 0).reduce((s, a) => s + a.points, 0);
  const pointsUsed = adjustments.filter((a) => a.points < 0).reduce((s, a) => s + Math.abs(a.points), 0);
  const redemptions = adjustments.filter((a) => a.points < 0).length;
  const referralBonus = adjustments.filter((a) => a.points > 0 && a.reason.startsWith("Hai presentato un amico")).reduce((s, a) => s + a.points, 0);
  const birthdayBonus = adjustments.filter((a) => a.points > 0 && a.reason.startsWith("Buon compleanno")).reduce((s, a) => s + a.points, 0);
  const otherBonus = Math.max(0, bonusGiven - referralBonus - birthdayBonus);

  // amici presentati e richieste dei clienti
  const friends = leads.filter((l) => l.source === "amico");
  const friendsWon = friends.filter((l) => l.status === "cliente");
  const quotes = leads.filter((l) => l.source === "cliente");
  const quotesWon = quotes.filter((l) => l.status === "cliente");
  const referredIds = new Set(clients.filter((c) => c.referred_by_client_id).map((c) => c.id));
  const referredPaid = [...referredIds].reduce((s, id) => s + (stat.get(id)?.paid ?? 0), 0);
  const referrers = new Map<string, { leads: number; won: number }>();
  for (const l of friends) {
    if (!l.referrer_client_id) continue;
    const e = referrers.get(l.referrer_client_id) ?? { leads: 0, won: 0 };
    e.leads++;
    if (l.status === "cliente") e.won++;
    referrers.set(l.referrer_client_id, e);
  }
  const topReferrers = [...referrers.entries()]
    .sort((a, b) => b[1].won - a[1].won || b[1].leads - a[1].leads)
    .slice(0, 8)
    .map(([id, e]) => ({ label: nameOf.get(id) ?? "Cliente", value: e.leads, sub: `${e.won} ${e.won === 1 ? "è diventato cliente" : "sono diventati clienti"}` }));

  // richieste ricevute negli ultimi 12 mesi
  const today = romeToday();
  const [ty, tm] = today.split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 1 - (11 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()], hint: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  });
  const requestsByMonth = months.map((m) => ({ ...m, value: leads.filter((l) => l.source !== "privato" && l.created_at.startsWith(m.key)).length }));
  const requestsYear = requestsByMonth.reduce((s, m) => s + m.value, 0);

  // offerte
  const activeOffers = offers.filter((o) => o.active && (!o.valid_until || o.valid_until >= today));
  const expiredOffers = offers.filter((o) => o.valid_until && o.valid_until < today);
  const conventions = activeOffers.filter((o) => o.kind === "convenzione").length;

  const nothingYet = clients.length === 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <Link href="/dashboard/statistiche" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#233c5e]">
          <ArrowLeft size={14} /> Statistiche
        </Link>
        <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Statistiche sui vantaggi</h1>
        <p className="mt-1 text-sm text-slate-600">
          Quanto funziona il programma fedeltà, gli amici presentati e le offerte riservate. I numeri si calcolano dai pagamenti registrati come incassati e dai viaggi collegati ai clienti.{" "}
          <Link href="/dashboard/settings/vantaggi" className="font-medium text-[#233c5e] underline decoration-dotted">
            Imposta i vantaggi
          </Link>
        </p>
      </div>

      {!loyaltyReady && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per attivare i vantaggi serve l&apos;aggiornamento del database 0053 (Supabase → SQL Editor).</p>
      )}
      {loyaltyReady && !enabled && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Il programma fedeltà non è ancora attivo: i punti e i livelli qui sotto sono quelli che avrebbero i tuoi clienti.{" "}
          <Link href="/dashboard/settings/vantaggi" className="font-medium underline">
            Attivalo
          </Link>
        </p>
      )}

      {nothingYet ? (
        <p className="rounded-2xl border border-[#e6d7bb] bg-white p-5 text-sm text-slate-600">Le statistiche compariranno quando avrai i primi clienti con viaggi.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Clienti con viaggi" value={String(withTrips.length)} sub={`su ${clients.length} in anagrafica`} />
            <Kpi label="Clienti che tornano" value={pct(returning.length, withTrips.length)} sub={`${returning.length} con 2 o più viaggi`} />
            <Kpi
              label="Incassato per cliente"
              value={withTrips.length ? euro(totalPaid / withTrips.length) : "—"}
              sub={returning.length ? `chi torna: ${euro(returning.reduce((s, e) => s + e.paid, 0) / returning.length)}` : undefined}
            />
            <Kpi label="Amici diventati clienti" value={`${friendsWon.length}`} sub={`su ${friends.length} presentati (${pct(friendsWon.length, friends.length)})`} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Clienti per livello" note="Quanti clienti con viaggi sono in ogni livello, in base ai punti.">
              <Bars
                rows={perLevel.map((l) => ({ label: `${l.name}${l.min ? ` (da ${l.min} punti)` : ""}`, value: l.clients, sub: l.clients ? `${euro(l.paid / l.clients)} a testa` : undefined }))}
                format={(n) => `${n} ${n === 1 ? "cliente" : "clienti"}`}
              />
              {near.length > 0 && (
                <div className="mt-4 border-t border-[#f0e6d2] pt-3">
                  <p className="mb-1.5 text-xs font-medium text-slate-600">Vicini al livello successivo: un buon momento per scrivere</p>
                  <ul className="flex flex-col divide-y divide-[#f0e6d2] text-sm">
                    {near.slice(0, 6).map((n) => (
                      <li key={n.id} className="flex justify-between gap-2 py-1.5">
                        <Link href={`/dashboard/clients/${n.id}`} className="truncate text-[#233c5e] hover:underline">
                          {n.name}
                        </Link>
                        <span className="shrink-0 text-slate-500">
                          {n.missing} punti a «{n.next}»
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Card title="Punti" note={`Un punto ogni ${rate} € incassati, più i bonus che assegni tu.`}>
              <Bars
                rows={[
                  { label: "Guadagnati con i viaggi", value: earnedTrips },
                  { label: "Bonus «presenta un amico»", value: referralBonus },
                  { label: "Bonus di compleanno", value: birthdayBonus },
                  { label: "Altri bonus dati a mano", value: otherBonus },
                  { label: "Usati dai clienti", value: pointsUsed, sub: redemptions ? `${redemptions} ${redemptions === 1 ? "premio" : "premi"}` : undefined },
                ]}
                format={(n) => `${n.toLocaleString("it-IT")} punti`}
              />
              <p className="mt-3 text-xs text-slate-500">
                In circolazione: <strong>{Math.max(0, earnedTrips + bonusGiven - pointsUsed).toLocaleString("it-IT")}</strong> punti. Se i punti usati restano pochi, i clienti forse non sanno
                come spenderli: ricordalo nei messaggi e nei livelli.
              </p>
            </Card>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Amici presentati" note="Richieste arrivate dal link «presenta un amico» dei tuoi clienti.">
              <Bars
                rows={[
                  { label: "Richieste ricevute", value: friends.length },
                  { label: "Contattati", value: friends.filter((l) => l.status === "contattata" || l.status === "cliente").length },
                  { label: "Diventati clienti", value: friendsWon.length },
                ]}
                format={(n) => String(n)}
              />
              <p className="mt-3 text-sm text-slate-700">
                {attributionReady ? (
                  referredIds.size ? (
                    <>
                      I clienti presentati hanno incassato finora <strong>{euro(referredPaid)}</strong> ({referredIds.size} {referredIds.size === 1 ? "cliente" : "clienti"}
                      {referralBonus ? `, a fronte di ${referralBonus.toLocaleString("it-IT")} punti di bonus` : ""}).
                    </>
                  ) : (
                    <span className="text-slate-500">Quando un amico diventa cliente qui compare quanto incassa.</span>
                  )
                ) : (
                  <span className="text-slate-500">Per vedere quanto incassano i clienti presentati serve l&apos;aggiornamento del database 0057 (Supabase → SQL Editor).</span>
                )}
              </p>
            </Card>
            <Card title="Chi presenta più amici" note="I clienti che portano più persone.">
              {topReferrers.length ? <Bars rows={topReferrers} format={(n) => `${n} ${n === 1 ? "amico" : "amici"}`} /> : <p className="text-sm text-slate-500">Nessun amico ancora presentato. Ricorda ai clienti il loro link nella sezione «Vantaggi».</p>}
            </Card>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Richieste dai clienti e dagli amici" note="Ultimi 12 mesi: amici presentati e preventivi chiesti dai clienti nel loro prossimo viaggio.">
              <Columns data={requestsByMonth} format={(n) => String(n)} />
              <p className="mt-3 text-sm text-slate-700">
                Preventivi chiesti dai clienti: <strong>{quotes.length}</strong>, diventati viaggi: <strong>{quotesWon.length}</strong> ({pct(quotesWon.length, quotes.length)}). In 12 mesi: {requestsYear} richieste.
              </p>
            </Card>
            <Card title="Offerte e convenzioni">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#faf3e6] px-2 py-3">
                  <p className="text-2xl font-semibold text-[#233c5e]">{activeOffers.length - conventions}</p>
                  <p className="text-xs text-slate-600">offerte attive</p>
                </div>
                <div className="rounded-xl bg-[#faf3e6] px-2 py-3">
                  <p className="text-2xl font-semibold text-[#233c5e]">{conventions}</p>
                  <p className="text-xs text-slate-600">convenzioni attive</p>
                </div>
                <div className="rounded-xl bg-[#faf3e6] px-2 py-3">
                  <p className="text-2xl font-semibold text-[#233c5e]">{expiredOffers.length}</p>
                  <p className="text-xs text-slate-600">scadute</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Per ora non si conta quante volte i clienti aprono ogni offerta. Un modo per misurarla: chiedi sempre ai clienti, quando prenotano, se arrivano da un&apos;offerta.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
