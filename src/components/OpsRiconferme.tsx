"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Send, X } from "lucide-react";
import { getRiconferme, setOpsStatus } from "@/lib/actions/opsSheet";
import { opsStatusInfo, opsTimeMinutes, parseIsoDate, riconfermaDays, whatsappNumber, type OpsRow, type OpsStatus } from "@/lib/opsSheet";

type Supplier = { name: string; phone: string; email: string };
type Group = { key: string; name: string; rows: OpsRow[] };

const norm = (s: string) => s.trim().toLocaleLowerCase("it");
const dayShort = (iso: string) => parseIsoDate(iso).toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function daysLabel(days: string[]) {
  const names = days.map((d) => parseIsoDate(d).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }));
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

function buildMessage(name: string, rows: OpsRow[], agencyName: string) {
  const lines = rows.map((r) => {
    const head = [cap(dayShort(r.service_date)), r.meeting_time ? `ore ${r.meeting_time}` : "", r.client, r.pax ? `${r.pax} pax` : ""].filter(Boolean).join(" · ");
    const more = [r.service, r.meeting_point ? `Ritrovo: ${r.meeting_point}` : "", r.trip_code ? `Rif. ${r.trip_code}` : ""].filter(Boolean);
    return `• ${head}\n${more.map((m) => `   ${m}`).join("\n")}`;
  });
  return `Buongiorno ${name},\nvi chiediamo cortesemente la riconferma dei seguenti servizi:\n\n${lines.join("\n\n")}\n\nGrazie e buon lavoro${agencyName ? `,\n${agencyName}` : ""}`;
}

// Riconferme ai fornitori: i servizi del giorno dopo (il venerdì fino a lunedì), divisi per fornitore,
// con il messaggio già pronto da mandare su WhatsApp o per email.
export default function OpsRiconferme({
  today,
  agencyName,
  suppliers,
  onClose,
  onStatusChange,
}: {
  today: string;
  agencyName: string;
  suppliers: Supplier[];
  onClose: () => void;
  onStatusChange: (ids: string[], status: OpsStatus) => void;
}) {
  const defaultDays = useMemo(() => riconfermaDays(today), [today]);
  const [days, setDays] = useState<string[]>(defaultDays);
  const [rows, setRows] = useState<OpsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getRiconferme(days).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setRows(res.rows);
        setError(null);
      } else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [days]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const r of rows ?? []) {
      const key = norm(r.supplier);
      const g = map.get(key) ?? { key, name: r.supplier.trim() || "Senza fornitore", rows: [] };
      g.rows.push(r);
      map.set(key, g);
    }
    const sortRow = (a: OpsRow, b: OpsRow) =>
      a.service_date.localeCompare(b.service_date) || (opsTimeMinutes(a.meeting_time) ?? 9999) - (opsTimeMinutes(b.meeting_time) ?? 9999);
    return [...map.values()]
      .map((g) => ({ ...g, rows: g.rows.sort(sortRow) }))
      .sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : a.name.localeCompare(b.name, "it")));
  }, [rows]);

  async function mark(ids: string[], status: OpsStatus) {
    setRows((prev) => prev?.map((r) => (ids.includes(r.id) ? { ...r, status } : r)) ?? prev);
    onStatusChange(ids, status);
    const res = await setOpsStatus(ids, status);
    if (!res.ok) setError(res.error);
  }

  const done = groups.filter((g) => g.key && g.rows.every((r) => r.status === "riconfermato")).length;
  const toDo = groups.filter((g) => g.key).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-[#fbf7ee] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[#e6d7bb] px-5 py-4">
          <div>
            <h2 className="text-2xl font-medium text-[#233c5e]">Riconferme</h2>
            <p className="text-sm text-slate-600">
              Servizi di <strong>{daysLabel(days)}</strong>
              {days.join() === defaultDays.join() && defaultDays.length > 1 && " (il venerdì si riconferma fino a lunedì)"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <label className="text-slate-500">Altro giorno:</label>
              <input
                type="date"
                value={days.length === 1 ? days[0] : ""}
                onChange={(e) => e.target.value && setDays([e.target.value])}
                className="h-8 rounded-lg border border-[#e6d7bb] bg-white px-2 text-sm"
              />
              {days.join() !== defaultDays.join() && (
                <button type="button" onClick={() => setDays(defaultDays)} className="text-[#a08a5e] hover:text-[#233c5e]">
                  torna a {defaultDays.length > 1 ? "venerdì → lunedì" : "domani"}
                </button>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="rounded-lg p-1.5 text-slate-500 hover:bg-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          {rows === null && !error && <p className="text-sm text-slate-500">Cerco i servizi…</p>}
          {rows !== null && groups.length === 0 && <p className="text-sm text-slate-500">Nessun servizio da riconfermare in questi giorni.</p>}
          {toDo > 0 && (
            <p className="text-sm text-[#233c5e]">
              Fornitori riconfermati: <strong>{done}</strong> su {toDo}
            </p>
          )}
          {groups.map((g) => (
            <SupplierCard key={g.key || "_none"} group={g} supplier={suppliers.find((s) => norm(s.name) === g.key)} agencyName={agencyName} onMark={mark} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SupplierCard({
  group,
  supplier,
  agencyName,
  onMark,
}: {
  group: Group;
  supplier: Supplier | undefined;
  agencyName: string;
  onMark: (ids: string[], status: OpsStatus) => void;
}) {
  const ids = group.rows.map((r) => r.id);
  const contactPhone = group.rows.map((r) => r.supplier_contact).find((c) => whatsappNumber(c));
  const [phone, setPhone] = useState(supplier?.phone || contactPhone || "");
  const [email, setEmail] = useState(supplier?.email || "");
  const [text, setText] = useState(() => buildMessage(group.name, group.rows, agencyName));
  const [copied, setCopied] = useState(false);
  const allDone = group.rows.every((r) => r.status === "riconfermato");
  const sent = group.rows.some((r) => r.status === "riconferma_inviata" || r.status === "riconfermato");
  const wa = whatsappNumber(phone);
  const subject = `Riconferma servizi ${[...new Set(group.rows.map((r) => dayShort(r.service_date)))].join(", ")}`;

  const markSent = () => {
    const pending = group.rows.filter((r) => r.status !== "riconfermato").map((r) => r.id);
    if (pending.length) onMark(pending, "riconferma_inviata");
  };

  if (!group.key)
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">
          {group.rows.length} {group.rows.length === 1 ? "servizio" : "servizi"} senza fornitore
        </p>
        <ul className="mt-1 list-disc pl-5">
          {group.rows.map((r) => (
            <li key={r.id}>
              {cap(dayShort(r.service_date))} {r.meeting_time} · {r.client} · {r.service || "—"}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs">Scrivi il fornitore nella scheda per poterli riconfermare.</p>
      </section>
    );

  return (
    <section className={`rounded-xl border bg-white p-4 ${allDone ? "border-green-300" : "border-[#e6d7bb]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium text-[#233c5e]">{group.name}</h3>
        <span className="flex flex-wrap gap-1.5 text-xs">
          {Object.entries(
            group.rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status || ""]: (acc[r.status || ""] ?? 0) + 1 }), {}),
          ).map(([st, n]) => {
            const info = opsStatusInfo(st);
            return (
              <span key={st} className="rounded-full px-2 py-0.5 font-medium" style={{ background: info?.bg ?? "#f1f5f9", color: info?.fg ?? "#475569" }}>
                {n} {info ? info.label.toLowerCase() : "senza stato"}
              </span>
            );
          })}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-500">
          WhatsApp / telefono
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="es. +39 333 1234567" className="mt-0.5 h-9 w-full rounded-lg border border-[#e6d7bb] px-2 text-sm text-slate-800" />
        </label>
        <label className="text-xs text-slate-500">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="es. prenotazioni@fornitore.it" className="mt-0.5 h-9 w-full rounded-lg border border-[#e6d7bb] px-2 text-sm text-slate-800" />
        </label>
      </div>
      {!supplier && <p className="mt-1 text-xs text-slate-400">Fornitore non presente in rubrica: il numero è preso dalla colonna «Contatto», se c&apos;è.</p>}

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(14, text.split("\n").length + 1)} className="mt-3 w-full rounded-lg border border-[#e6d7bb] p-2.5 text-[13px] leading-relaxed text-slate-800" />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : undefined}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => (wa ? markSent() : e.preventDefault())}
          aria-disabled={!wa}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white ${wa ? "bg-[#1f9d55] hover:bg-[#178246]" : "cursor-not-allowed bg-slate-300"}`}
          title={wa ? "Apre WhatsApp con il messaggio pronto" : "Manca un numero di telefono valido"}
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a
          href={email ? `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` : undefined}
          onClick={(e) => (email ? markSent() : e.preventDefault())}
          aria-disabled={!email}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${email ? "bg-[#233c5e] text-white hover:bg-[#1b3050]" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}
        >
          <Mail className="h-4 w-4" /> Email
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e6d7bb] px-3 text-sm text-[#233c5e] hover:bg-[#faf3e6]"
        >
          <Copy className="h-4 w-4" /> {copied ? "Copiato" : "Copia testo"}
        </button>
        {!sent && (
          <button type="button" onClick={markSent} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-500 hover:text-[#233c5e]">
            <Send className="h-4 w-4" /> Segna come inviata
          </button>
        )}
        <button
          type="button"
          onClick={() => onMark(ids, "riconfermato")}
          disabled={allDone}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-green-600 px-3 text-sm font-medium text-green-700 hover:bg-green-50 disabled:border-green-300 disabled:bg-green-50 disabled:text-green-600"
        >
          <Check className="h-4 w-4" /> {allDone ? "Riconfermato" : "Ha riconfermato"}
        </button>
      </div>
    </section>
  );
}

