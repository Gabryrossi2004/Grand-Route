"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, ImagePlus, MessageCircle, Star } from "lucide-react";
import RichTextEditor from "@/components/LazyRichTextEditor";
import { countryOptions } from "@/lib/geo/countryCodes";
import type { CommunityPostKind } from "@/lib/types";

const KINDS: { value: CommunityPostKind; label: string; hint: string; icon: typeof Star }[] = [
  { value: "recensione", label: "Recensione", hint: "Racconta com'è andata con un prodotto o un fornitore", icon: Star },
  { value: "domanda", label: "Domanda", hint: "Chiedi un consiglio agli altri professionisti", icon: HelpCircle },
  { value: "chat", label: "Chat", hint: "Un messaggio veloce per il gruppo", icon: MessageCircle },
];

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#cda876] focus:ring-2 focus:ring-[#f2e2c4]";

export default function PostComposer({
  action,
  placeholder,
  defaultKind = "chat",
}: {
  action: (prevState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string }>;
  placeholder?: string;
  defaultKind?: CommunityPostKind;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [kind, setKind] = useState<CommunityPostKind>(defaultKind);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const prevStateRef = useRef(state);
  const countries = useMemo(() => countryOptions(), []);

  useEffect(() => {
    if (state !== prevStateRef.current && !state?.error) {
      setBody("");
      setRating(0);
      setPhotoCount(0);
      formRef.current?.reset();
    }
    prevStateRef.current = state;
  }, [state]);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formData.set("body", body);
        formData.set("kind", kind);
        formData.set("rating", String(rating));
        formAction(formData);
      }}
      className="flex flex-col gap-3 rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm shadow-[#e6d7bb]/30"
    >
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const active = kind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#6b5f4a] hover:bg-[#f2e2c4]"
              }`}
            >
              <Icon size={14} />
              {k.label}
            </button>
          );
        })}
      </div>
      <p className="-mt-1 text-xs text-slate-500">{KINDS.find((k) => k.value === kind)?.hint}</p>

      {kind === "recensione" && (
        <>
          <input type="text" name="subject" required placeholder="Cosa recensisci? (es. Hotel Sole, Tour del Marocco, Agenzia locale X)" className={inputClass} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Voto">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stelle`} className="p-0.5">
                  <Star size={22} className={n <= rating ? "fill-[#cda876] text-[#cda876]" : "text-slate-300"} />
                </button>
              ))}
            </div>
            <select name="country_code" defaultValue="" className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">Paese (facoltativo)</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <select name="would_resell" defaultValue="" className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">Lo rivenderesti?</option>
              <option value="si">Sì, lo rivenderei</option>
              <option value="no">No, non lo rivenderei</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="text" name="pros" placeholder="Punti di forza" className={inputClass} />
            <input type="text" name="cons" placeholder="Punti deboli" className={inputClass} />
          </div>
        </>
      )}

      {kind === "domanda" && <input type="text" name="title" required placeholder="La tua domanda in poche parole" className={inputClass} />}

      <RichTextEditor
        value={body}
        onChange={setBody}
        placeholder={
          placeholder ??
          (kind === "recensione" ? "Com'è andata? Racconta in modo utile ai colleghi…" : kind === "domanda" ? "Dettagli della domanda…" : "Scrivi qualcosa…")
        }
      />

      <p className="text-xs text-slate-500">
        Niente dati personali dei clienti (nomi, documenti, contatti): parla dei prodotti e dei fornitori, con rispetto.{" "}
        <a href="/termini#community" className="underline">
          Regole della community
        </a>
      </p>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#6b5f4a] hover:text-[#233c5e]">
          <ImagePlus size={16} />
          {photoCount > 0 ? `${photoCount} foto selezionate` : "Allega foto"}
          <input
            type="file"
            name="photos"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => setPhotoCount(e.target.files?.length ?? 0)}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#233c5e] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#e6d7bb] transition hover:bg-[#17283f] disabled:opacity-60"
        >
          {pending ? "Pubblicazione…" : "Pubblica"}
        </button>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
