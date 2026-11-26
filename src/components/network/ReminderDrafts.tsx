"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { markReconfirmReceived, sendReminderDraft, type ReminderPrefs } from "@/lib/actions/agenda";
import { buildReminder, type ReminderService } from "@/lib/reminders/template";
import { kindLabel } from "@/lib/network/kinds";

export type ReminderDraft = { buyer_id: string; buyer_name: string; buyer_kind: string; services: ReminderService[]; n: number; sent_at: string | null; can_email: boolean };

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#cda876]";
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const dayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// Le email di riconferma da chiedere alle agenzie: già scritte, in blocco, da rivedere, modificare e inviare
export default function ReminderDrafts({ drafts, prefs, sellerName, today }: { drafts: ReminderDraft[]; prefs: ReminderPrefs; sellerName: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [texts, setTexts] = useState<Record<string, { subject: string; body: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (drafts.length === 0) return null;

  const fresh = (d: ReminderDraft) => buildReminder({ seller: sellerName || "Il tuo nome", buyer: d.buyer_name, today }, d.services, { subject: prefs.subject, intro: prefs.intro, outro: prefs.outro });
  const edit = (d: ReminderDraft) => {
    setError(null);
    setDone(null);
    if (open === d.buyer_id) return setOpen(null);
    setTexts((t) => (t[d.buyer_id] ? t : { ...t, [d.buyer_id]: { subject: fresh(d).subject, body: fresh(d).body } }));
    setOpen(d.buyer_id);
  };
  const send = (d: ReminderDraft) =>
    start(async () => {
      setBusy(d.buyer_id);
      setError(null);
      const t = texts[d.buyer_id] ?? { subject: fresh(d).subject, body: fresh(d).body };
      const r = await sendReminderDraft({ buyerId: d.buyer_id, subject: t.subject, body: t.body });
      setBusy(null);
      if (!r.ok) return setError(r.error);
      setDone(`Email inviata a ${d.buyer_name}.`);
      setOpen(null);
      router.refresh();
    });
  const received = (d: ReminderDraft) =>
    start(async () => {
      setBusy(`r-${d.buyer_id}`);
      setError(null);
      const r = await markReconfirmReceived(d.services.map((s) => s.id), true);
      setBusy(null);
      if (!r.ok) return setError(r.error);
      setDone(`Segnata la riconferma di ${d.buyer_name}.`);
      router.refresh();
    });

  const toSend = drafts.filter((d) => !d.sent_at).length;
  return (
    <section id="riconferme" className="mt-4 scroll-mt-24 rounded-2xl border border-[#c58f2d] bg-[#fff8ea] p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[#233c5e]"><Mail size={19} /> Riconferme da chiedere</h2>
      <p className="mt-1 text-sm text-slate-700">
        {toSend > 0
          ? `${toSend === 1 ? "Questa agenzia non ti ha" : `Queste ${toSend} agenzie non ti hanno`} ancora riconfermato i servizi dei prossimi giorni.`
          : "Hai già inviato le email di oggi."}{" "}
        {prefs.mode === "auto" ? "In modalità automatica partono da sole dopo le 16:00: qui puoi anticiparle o cambiarle." : prefs.mode === "manual" ? "L'email è già scritta: la rivedi, la modifichi se serve e la invii." : "Il promemoria automatico è spento: le invii tu quando vuoi."}
      </p>
      {done && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{done}</p>}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3 space-y-3">
        {drafts.map((d) => {
          const t = texts[d.buyer_id];
          return (
            <article key={d.buyer_id} className="rounded-xl border border-[#e6d7bb] bg-white p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{d.buyer_name}</p>
                  <p className="text-xs text-slate-500">{kindLabel(d.buyer_kind)} · {d.n} {d.n === 1 ? "servizio" : "servizi"}</p>
                </div>
                {d.sent_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"><CheckCircle2 size={13} /> Email inviata alle {timeOf(d.sent_at)}</span>
                )}
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                {d.services.map((s) => (
                  <li key={s.id} className="flex gap-2"><span className="w-24 shrink-0 capitalize text-slate-500">{dayOf(s.date)}{s.time ? ` ${s.time}` : ""}</span><span className="min-w-0 truncate">{s.title}</span></li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={pending || !d.can_email} onClick={() => edit(d)} aria-expanded={open === d.buyer_id} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#233c5e] px-4 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-50">
                  <Send size={15} /> {open === d.buyer_id ? "Chiudi" : d.sent_at ? "Scrivi di nuovo" : "Rivedi e invia l'email"}
                </button>
                <button type="button" disabled={pending} onClick={() => received(d)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-600 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                  {busy === `r-${d.buyer_id}` ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />} Riconferma già ricevuta
                </button>
              </div>
              {!d.can_email && <p className="mt-2 text-xs text-slate-500">Profilo di prova: non ha un indirizzo email vero.</p>}
              {open === d.buyer_id && t && (
                <div className="mt-3 space-y-2 rounded-xl bg-[#faf7ee] p-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Oggetto
                    <input value={t.subject} onChange={(e) => setTexts((x) => ({ ...x, [d.buyer_id]: { ...t, subject: e.target.value } }))} maxLength={200} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Testo (puoi modificarlo)
                    <textarea value={t.body} onChange={(e) => setTexts((x) => ({ ...x, [d.buyer_id]: { ...t, body: e.target.value } }))} rows={16} maxLength={20000} className={`${field} mt-1 min-h-64`} />
                  </label>
                  <p className="text-xs text-slate-500">Parte a nome tuo, con le risposte che arrivano a te, e riga di cronologia in ogni ordine.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={pending} onClick={() => send(d)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                      {busy === d.buyer_id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Invia ora
                    </button>
                    <button type="button" onClick={() => setTexts((x) => ({ ...x, [d.buyer_id]: { subject: fresh(d).subject, body: fresh(d).body } }))} className="inline-flex min-h-11 items-center px-3 text-sm text-slate-600 underline">Ripristina il testo</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
