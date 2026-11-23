import Link from "next/link";
import { Cake, Gift, MessageCircleHeart, Plane, Tag, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { decryptField } from "@/lib/encryption";
import { levelFor, parseLevels, pointsFrom } from "@/lib/benefits";
import { romeToday } from "@/lib/destinationInfo";

type Trip = { id: string; title: string; client_id: string | null; start_date: string | null; end_date: string | null };
type Item = { key: string; icon: "cake" | "anniv" | "level" | "lead" | "offer" | "back"; text: string; href: string; rank: number };

const ICONS = { cake: Cake, anniv: MessageCircleHeart, level: Gift, lead: UserPlus, offer: Tag, back: Plane };
const dayNum = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
// giorni da oggi alla prossima ricorrenza di una data (stesso giorno e mese)
const daysToNext = (iso: string, today: string) => {
  const [ty] = today.split("-").map(Number);
  const md = iso.slice(5, 10);
  let next = dayNum(`${ty}-${md}`) - dayNum(today);
  if (next < 0) next = dayNum(`${ty + 1}-${md}`) - dayNum(today);
  return next;
};
const when = (n: number) => (n === 0 ? "oggi" : n === 1 ? "domani" : `tra ${n} giorni`);

// «Chi contattare oggi»: compleanni, anniversari, clienti vicini a un livello, amici presentati,
// offerte in scadenza e clienti appena rientrati. Tutto calcolato dai dati, senza AI.
export default async function ContactTodayCard({ ownerId, trips }: { ownerId: string; trips: Trip[] }) {
  const supabase = await createClient();
  const today = romeToday();
  const tripIds = trips.map((t) => t.id);
  const [{ data: clientRows }, loyaltyRes, adjRes, leadsRes, offersRes, paidRes] = await Promise.all([
    supabase.from("clients").select("id, full_name, date_of_birth").eq("owner_id", ownerId),
    supabase.from("agency_loyalty").select("enabled, euros_per_point, levels").eq("owner_id", ownerId).maybeSingle(),
    supabase.from("loyalty_adjustments").select("client_id, points").eq("owner_id", ownerId).limit(5000),
    supabase.from("agency_leads").select("id, name").eq("owner_id", ownerId).eq("status", "nuova").limit(20),
    supabase.from("agency_offers").select("id, title, valid_until").eq("owner_id", ownerId).eq("active", true).not("valid_until", "is", null).limit(50),
    tripIds.length
      ? supabase.from("trip_payments").select("trip_id, amount").in("trip_id", tripIds).eq("direction", "incasso").not("paid_date", "is", null)
      : Promise.resolve({ data: [] as { trip_id: string; amount: number }[] }),
  ]);
  const clients = (clientRows as { id: string; full_name: string; date_of_birth: string | null }[] | null) ?? [];
  const name = new Map(clients.map((c) => [c.id, c.full_name]));
  const items: Item[] = [];

  // Compleanni (oggi e nei prossimi 3 giorni)
  for (const c of clients) {
    let dob: string | null = null;
    try {
      dob = decryptField(c.date_of_birth);
    } catch {
      dob = null;
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) continue;
    const n = daysToNext(dob, today);
    if (n <= 3) items.push({ key: `b-${c.id}`, icon: "cake", text: `Compleanno di ${c.full_name} ${when(n)}: un messaggio di auguri fa sempre piacere.`, href: `/dashboard/clients/${c.id}`, rank: 10 - n });
  }

  for (const t of trips) {
    if (!t.end_date || !t.client_id) continue;
    const ago = dayNum(today) - dayNum(t.end_date);
    // Appena rientrati: chiedere com'è andata e una recensione
    if (ago >= 1 && ago <= 3) {
      items.push({ key: `r-${t.id}`, icon: "back", text: `${name.get(t.client_id) ?? "Il cliente"} è rientrato da «${t.title}»: chiedi com'è andata e invitalo a lasciare una recensione.`, href: `/dashboard/trips/${t.id}`, rank: 8 });
    }
    // Anniversario del viaggio (dal secondo anno)
    if (ago > 300) {
      const n = daysToNext(t.end_date, today);
      if (n <= 3) items.push({ key: `a-${t.id}`, icon: "anniv", text: `${when(n).charAt(0).toUpperCase()}${when(n).slice(1)} è l'anniversario di «${t.title}» per ${name.get(t.client_id) ?? "il cliente"}: buon momento per proporre il prossimo viaggio.`, href: `/dashboard/clients/${t.client_id}`, rank: 6 });
    }
  }

  // Clienti vicini al livello successivo del programma fedeltà
  const loyalty = loyaltyRes.error ? null : loyaltyRes.data;
  if (loyalty?.enabled) {
    const levels = parseLevels(loyalty.levels);
    const clientOfTrip = new Map(trips.map((t) => [t.id, t.client_id]));
    const paid = new Map<string, number>();
    for (const p of (paidRes.data as { trip_id: string; amount: number }[] | null) ?? []) {
      const c = clientOfTrip.get(p.trip_id);
      if (c) paid.set(c, (paid.get(c) ?? 0) + Number(p.amount || 0));
    }
    const bonus = new Map<string, number>();
    for (const a of (adjRes.data as { client_id: string; points: number }[] | null) ?? []) bonus.set(a.client_id, (bonus.get(a.client_id) ?? 0) + a.points);
    for (const c of clients) {
      const pts = pointsFrom(paid.get(c.id) ?? 0, Number(loyalty.euros_per_point), bonus.get(c.id) ?? 0);
      if (pts <= 0) continue;
      const { next } = levelFor(pts, levels);
      if (next && next.min - pts <= Math.max(30, Math.round(next.min * 0.15))) {
        items.push({ key: `l-${c.id}`, icon: "level", text: `${c.full_name} è a ${next.min - pts} punti dal livello «${next.name}»: proponigli un'offerta per arrivarci.`, href: `/dashboard/clients/${c.id}`, rank: 5 });
      }
    }
  }

  // Amici presentati ancora da chiamare
  const leads = leadsRes.error ? [] : ((leadsRes.data as { id: string; name: string }[] | null) ?? []);
  if (leads.length) {
    items.push({ key: "leads", icon: "lead", text: leads.length === 1 ? `${leads[0].name} aspetta una tua risposta (nuova richiesta in Clienti).` : `${leads.length} nuove richieste (amici presentati e preventivi dei clienti) aspettano una risposta.`, href: "/dashboard/clients", rank: 9 });
  }

  // Offerte che scadono entro 5 giorni
  for (const o of offersRes.error ? [] : ((offersRes.data as { id: string; title: string; valid_until: string }[] | null) ?? [])) {
    const n = dayNum(o.valid_until) - dayNum(today);
    if (n >= 0 && n <= 5) items.push({ key: `o-${o.id}`, icon: "offer", text: `L'offerta «${o.title}» scade ${when(n)}: ricordala ai clienti interessati o prolungala.`, href: "/dashboard/settings/vantaggi", rank: 4 });
  }

  if (items.length === 0) return null;
  items.sort((a, b) => b.rank - a.rank);

  return (
    <section className="rounded-2xl border border-[#e6d7bb] bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-xl font-medium text-[#233c5e]">Chi contattare oggi</h2>
      <p className="mb-3 text-xs text-slate-500">I consigli di Zefiro per tenere vivi i rapporti con i clienti (calcolati dai tuoi dati, senza costi).</p>
      <ul className="flex flex-col divide-y divide-[#f0e6d2]">
        {items.slice(0, 8).map((it) => {
          const Icon = ICONS[it.icon];
          return (
            <li key={it.key}>
              <Link href={it.href} className="flex items-start gap-3 py-2.5 text-sm text-slate-700 hover:text-[#233c5e]">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#faf3e6] text-[#c58f2d]">
                  <Icon size={15} />
                </span>
                <span>{it.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
