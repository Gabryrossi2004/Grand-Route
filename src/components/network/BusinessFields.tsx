"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { countryOptions } from "@/lib/geo/countryCodes";
import { KIND_DOCS, KIND_FIELDS, KIND_INFO, KIND_SPECIALTIES, LANGUAGES, LEGAL_FORMS, type BusinessKind, type FieldDef } from "@/lib/network/kinds";

// I dati dell'attività: parte comune (sede, partita IVA, contatti, descrizione, paesi e lingue)
// e parte propria di ogni tipo (licenze, assicurazioni, mezzi...). Si usa nella registrazione e nel profilo.

export type Values = Record<string, string | string[] | undefined>;

const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

function Field({ label, error, help, required, children }: { label: string; error?: string; help?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-[#c0392b]"> *</span>}
      </label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-slate-500">{help}</p>}
      {error && <p className="mt-1 text-xs font-medium text-[#c0392b]">{error}</p>}
    </div>
  );
}

function Chips({ name, options, value, max, allowCustom }: { name: string; options: string[]; value: string[]; max?: number; allowCustom?: boolean }) {
  const [sel, setSel] = useState<string[]>(value);
  const [draft, setDraft] = useState("");
  const toggle = (o: string) => setSel((s) => (s.includes(o) ? s.filter((x) => x !== o) : max && s.length >= max ? s : [...s, o]));
  const all = [...options, ...sel.filter((s) => !options.includes(s))];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            aria-pressed={sel.includes(o)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${sel.includes(o) ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e] hover:border-[#c58f2d]"}`}
          >
            {o}
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="mt-2 flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Aggiungi un'altra voce" className={input} maxLength={40} />
          <button
            type="button"
            onClick={() => {
              const v = draft.trim();
              if (v && !sel.includes(v)) setSel((s) => [...s, v]);
              setDraft("");
            }}
            className="shrink-0 rounded-lg border border-[#e6d7bb] bg-white px-3 text-sm font-medium text-[#233c5e] hover:border-[#c58f2d]"
          >
            Aggiungi
          </button>
        </div>
      )}
      {sel.map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}
    </div>
  );
}

function CountryPicker({ name, value }: { name: string; value: string[] }) {
  const options = useMemo(() => countryOptions(), []);
  const [sel, setSel] = useState<string[]>(value);
  const nameOf = (c: string) => options.find((o) => o.code === c)?.name ?? c;
  return (
    <div>
      <select
        className={input}
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v && !sel.includes(v) && sel.length < 20) setSel([...sel, v]);
        }}
        aria-label="Aggiungi un paese"
      >
        <option value="">Aggiungi un paese…</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
      <div className="mt-2 flex flex-wrap gap-2">
        {sel.map((c) => (
          <span key={c} className="flex items-center gap-1 rounded-full bg-[#233c5e] py-1 pl-3 pr-1 text-xs font-medium text-white">
            {nameOf(c)}
            <button type="button" aria-label={`Togli ${nameOf(c)}`} onClick={() => setSel(sel.filter((x) => x !== c))} className="rounded-full p-1 hover:bg-white/20">
              <X size={12} />
            </button>
          </span>
        ))}
        {sel.map((c) => (
          <input key={c} type="hidden" name={name} value={c} />
        ))}
      </div>
    </div>
  );
}

function KindField({ f, values, errors }: { f: FieldDef; values: Values; errors: Record<string, string> }) {
  const name = `kd_${f.key}`;
  const err = errors[name];
  if (f.type === "chips")
    return (
      <Field label={f.label} required={f.required} error={err} help={f.help}>
        <Chips name={name} options={f.options ?? []} value={many(values[name])} />
      </Field>
    );
  return (
    <Field label={f.label} required={f.required} error={err} help={f.help}>
      {f.type === "select" ? (
        <select name={name} defaultValue={one(values[name])} className={input}>
          <option value="">Scegli…</option>
          {f.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.type === "textarea" ? (
        <textarea name={name} defaultValue={one(values[name])} rows={3} maxLength={600} className={input} />
      ) : (
        <input
          name={name}
          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
          min={f.type === "number" ? 0 : undefined}
          defaultValue={one(values[name])}
          placeholder={f.placeholder}
          className={input}
        />
      )}
    </Field>
  );
}

export default function BusinessFields({ kind, values = {}, errors = {} }: { kind: BusinessKind; values?: Values; errors?: Record<string, string> }) {
  const [country, setCountry] = useState(one(values.country) || "IT");
  const countries = useMemo(() => countryOptions(), []);
  const isIT = country === "IT";
  const specialties = KIND_SPECIALTIES[kind];

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-[#faf3e6] p-4 text-sm text-slate-700">
        <p className="font-semibold text-[#233c5e]">Per la verifica potremmo chiederti copia di:</p>
        <ul className="mt-1 list-disc pl-5">
          {KIND_DOCS[kind].map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>

      <h3 className="text-lg font-semibold text-slate-900">L&apos;attività</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nome dell'attività (come compare nell'elenco)" required error={errors.business_name}>
            <input name="business_name" defaultValue={one(values.business_name)} maxLength={120} className={input} />
          </Field>
        </div>
        <Field label="Forma giuridica" error={errors.legal_form}>
          <select name="legal_form" defaultValue={one(values.legal_form)} className={input}>
            <option value="">Scegli…</option>
            {LEGAL_FORMS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Paese della sede" required error={errors.country}>
          <select name="country" value={country} onChange={(e) => setCountry(e.target.value)} className={input}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={isIT ? "Partita IVA" : "Partita IVA / numero di registrazione fiscale"}
          required
          error={errors.vat_number}
          help={isIT ? "11 cifre." : "Con le due lettere iniziali per i paesi europei (es. FR12345678901)."}
        >
          <input name="vat_number" defaultValue={one(values.vat_number)} className={input} inputMode="text" />
        </Field>
        {isIT && (
          <>
            <Field label="Codice fiscale" error={errors.tax_code} help="Se uguale alla partita IVA, scrivilo uguale.">
              <input name="tax_code" defaultValue={one(values.tax_code)} className={input} maxLength={16} />
            </Field>
            <Field label="Codice destinatario (SDI)" error={errors.sdi_code} help="7 caratteri. Se non lo hai, scrivi la PEC qui accanto.">
              <input name="sdi_code" defaultValue={one(values.sdi_code)} className={input} maxLength={7} />
            </Field>
            <Field label="PEC" error={errors.pec}>
              <input name="pec" type="email" defaultValue={one(values.pec)} className={input} />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label="Indirizzo della sede" required error={errors.address}>
            <input name="address" defaultValue={one(values.address)} maxLength={160} className={input} />
          </Field>
        </div>
        <Field label="Città" required error={errors.city}>
          <input name="city" defaultValue={one(values.city)} maxLength={80} className={input} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={isIT ? "CAP" : "Codice postale"} required={isIT} error={errors.postal_code}>
            <input name="postal_code" defaultValue={one(values.postal_code)} className={input} maxLength={12} />
          </Field>
          {isIT && (
            <Field label="Provincia" required error={errors.province}>
              <input name="province" defaultValue={one(values.province)} className={input} maxLength={2} placeholder="RM" />
            </Field>
          )}
        </div>
        <Field label="Telefono (anche WhatsApp)" required error={errors.phone}>
          <input name="phone" type="tel" defaultValue={one(values.phone)} className={input} placeholder="+39 …" />
        </Field>
        <Field label="Sito web" error={errors.website}>
          <input name="website" defaultValue={one(values.website)} className={input} placeholder="www.…" />
        </Field>
      </div>

      <h3 className="text-lg font-semibold text-slate-900">Dove e come lavori</h3>
      <Field label="Paesi in cui operi" required error={errors.countries_served} help="Fino a 20. Chi cerca per paese ti trova da qui.">
        <CountryPicker name="countries_served" value={many(values.countries_served)} />
      </Field>
      <Field label="Lingue che parli" required error={errors.languages}>
        <Chips name="languages" options={LANGUAGES} value={many(values.languages)} max={12} allowCustom />
      </Field>
      {specialties.length > 0 && (
        <Field label="In cosa sei specializzato/a" error={errors.specialties} help="Fino a 8 etichette.">
          <Chips name="specialties" options={specialties} value={many(values.specialties)} max={8} allowCustom />
        </Field>
      )}
      <Field label="Presentazione" required error={errors.description} help="Cosa fai e cosa ti distingue (40–700 caratteri). Compare nell'elenco.">
        <textarea name="description" defaultValue={one(values.description)} rows={5} maxLength={700} className={input} />
      </Field>

      <h3 className="text-lg font-semibold text-slate-900">Licenze, assicurazioni e dati specifici ({KIND_INFO[kind].label})</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {KIND_FIELDS[kind].map((f) => (
          <div key={f.key} className={f.type === "textarea" || f.type === "chips" ? "sm:col-span-2" : ""}>
            <KindField f={f} values={values} errors={errors} />
          </div>
        ))}
      </div>
    </div>
  );
}
