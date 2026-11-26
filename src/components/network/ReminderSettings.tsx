"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff, Check, Eye, Pencil } from "lucide-react";
import { setReminderPrefs, type ReminderPrefs } from "@/lib/actions/agenda";
import { DEFAULT_INTRO, DEFAULT_OUTRO, DEFAULT_SUBJECT, PLACEHOLDERS, buildReminder, type ReminderService } from "@/lib/reminders/template";

const MODES = [
  { id: "auto", title: "Automatico", text: "Dopo le 16:00 parte da solo una sola email per agenzia, con tutti i suoi servizi, se non ti ha ancora riconfermato." },
  { id: "manual", title: "Lo rivedo io", text: "Dopo le 16:00 ti avvisiamo. L'email è già scritta qui sotto: la modifichi e la invii tu." },
  { id: "off", title: "Spento", text: "Nessuna email e nessun avviso." },
] as const;

const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#cda876]";

// Promemoria della sera prima: come funziona (automatico / lo rivedo io / spento) e il testo dell'email
export default function ReminderSettings({ initial, sellerName, today }: { initial: ReminderPrefs; sellerName: string; today: string }) {
  const [mode, setMode] = useState(initial.mode);
  const [subject, setSubject] = useState(initial.subject);
  const [intro, setIntro] = useState(initial.intro);
  const [outro, setOutro] = useState(initial.outro);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const d1 = tomorrow.toISOString().slice(0, 10);
  const sample: ReminderService[] = [
    { id: "x1", date: d1, time: "09:00", title: "Transfer aeroporto → hotel", place: "Aeroporto di Fiumicino", pax: 4, lead_name: "Sig.ri Deluca", reference: null, quantity: 1, unit: "servizio", amount: 100, currency: "EUR" },
    { id: "x2", date: d1, time: "17:30", title: "Transfer hotel → stazione", place: "Hotel Palazzo Navona", pax: 2, lead_name: "Rossi", reference: null, quantity: 1, unit: "servizio", amount: 60, currency: "EUR" },
  ];
  const preview = buildReminder({ seller: sellerName || "Il tuo nome", buyer: "Essence of Italy", today }, sample, { subject, intro, outro });

  const save = (next: Partial<ReminderPrefs>, message: string) => {
    setError(null);
    setSaved(null);
    const all: ReminderPrefs = { mode, subject, intro, outro, ...next };
    start(async () => {
      const r = await setReminderPrefs(all);
      if (!r.ok) setError(r.error);
      else setSaved(message);
    });
  };

  const pick = (m: ReminderPrefs["mode"]) => {
    setMode(m);
    save({ mode: m }, m === "off" ? "Promemoria spento." : m === "manual" ? "Perfetto: ti avvisiamo e le email le invii tu." : "Promemoria automatico acceso.");
  };

  return (
    <section className="mt-4 rounded-2xl border border-[#e6d7bb] bg-white p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${mode === "off" ? "bg-slate-100 text-slate-500" : "bg-[#233c5e] text-white"}`}>
          {mode === "off" ? <BellOff size={18} /> : <Bell size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#233c5e]">Riconferma ai tuoi clienti la sera prima</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Ogni giorno, dopo le 16:00, per le agenzie e i tour operator che non ti hanno ancora riconfermato i servizi di domani (il venerdì e il sabato fino a lunedì) prepariamo{" "}
            <strong>una sola email in blocco</strong> con tutti i loro servizi. Non serve se l&apos;agenzia ti ha già scritto oggi o se segni tu «Riconferma ricevuta».
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">Ora: <span className="rounded-full bg-[#233c5e]/10 px-2.5 py-0.5 text-[#233c5e]">{MODES.find((m) => m.id === mode)?.title}</span></p>
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e6d7bb] px-4 text-sm font-semibold text-[#233c5e] hover:bg-[#faf3e6]">
          {expanded ? "Chiudi" : "Modifica"}
        </button>
      </div>
      {saved && !expanded && <p className="mt-2 text-sm font-medium text-emerald-700">{saved}</p>}

      {expanded && (
        <>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Come vuoi gestire il promemoria">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            disabled={pending}
            onClick={() => pick(m.id)}
            data-nofx
            className={`rounded-xl border p-3 text-left transition ${mode === m.id ? "border-[#233c5e] bg-[#233c5e]/5 ring-1 ring-[#233c5e]" : "border-[#e6d7bb] hover:border-[#c58f2d]"}`}
          >
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${mode === m.id ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-slate-300"}`}>{mode === m.id && <Check size={11} />}</span>
              {m.title}
            </span>
            <span className="mt-1 block text-sm text-slate-600">{m.text}</span>
          </button>
        ))}
      </div>

      {saved && <p className="mt-2 text-sm font-medium text-emerald-700">{saved}</p>}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e6d7bb] px-4 text-sm font-semibold text-[#233c5e] hover:bg-[#faf3e6]">
        <Pencil size={15} /> {editing ? "Chiudi" : "Personalizza il testo dell'email"}
      </button>

      {editing && (
        <div className="mt-3 space-y-3 rounded-xl bg-[#faf7ee] p-3 sm:p-4">
          <p className="text-sm text-slate-600">
            L&apos;elenco dei servizi si aggiunge da solo tra apertura e chiusura. Nei testi puoi usare:{" "}
            {PLACEHOLDERS.map((p) => (
              <code key={p} className="mr-1 rounded bg-white px-1.5 py-0.5 text-xs text-[#233c5e]">{p}</code>
            ))}
            (agenzia, il tuo nome, i giorni). Se lasci vuoto si usa il testo standard.
          </p>
          <label className="block text-sm font-medium text-slate-700">
            Oggetto
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder={DEFAULT_SUBJECT} className={`${field} mt-1`} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Apertura
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={4} maxLength={1500} placeholder={DEFAULT_INTRO} className={`${field} mt-1`} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Chiusura
            <textarea value={outro} onChange={(e) => setOutro(e.target.value)} rows={4} maxLength={1500} placeholder={DEFAULT_OUTRO} className={`${field} mt-1`} />
          </label>
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700"><Eye size={15} /> Così arriva all&apos;agenzia (esempio)</p>
            <div className="rounded-lg border border-[#e6d7bb] bg-white p-3">
              <p className="mb-2 text-xs text-slate-500">Oggetto: <span className="text-slate-800">{preview.subject}</span></p>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">{preview.body}</pre>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => save({}, "Testo salvato.")} className="inline-flex min-h-11 items-center rounded-xl bg-[#233c5e] px-5 text-sm font-semibold text-white hover:bg-[#17283f] disabled:opacity-60">Salva il testo</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setSubject("");
                setIntro("");
                setOutro("");
                save({ subject: "", intro: "", outro: "" }, "Ripristinato il testo standard.");
              }}
              className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium text-slate-600 underline"
            >
              Ripristina il testo standard
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </section>
  );
}
