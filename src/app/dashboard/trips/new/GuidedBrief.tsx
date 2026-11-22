"use client";

import { useState } from "react";
import { Ban, ChevronRight, Compass, Landmark, Mountain, Music, Palmtree, ShoppingBag, TreePine, Umbrella, Utensils } from "lucide-react";

// Percorso guidato (a domande, come nelle app di viaggio): ogni schermata una scelta semplice.
// Alla fine compone il testo della richiesta, senza usare l'AI: l'agente lo rilegge, lo corregge
// se vuole e solo allora lo manda a Zefiro.

type Option = { value: string; label: string; icon?: React.ReactNode };

const STYLES: Option[] = [
  { value: "relax", label: "Relax", icon: <Umbrella size={20} /> },
  { value: "cultura", label: "Cultura", icon: <Landmark size={20} /> },
  { value: "avventura", label: "Avventura", icon: <Mountain size={20} /> },
  { value: "fuori dai sentieri battuti", label: "Fuori dai sentieri battuti", icon: <Compass size={20} /> },
  { value: "natura", label: "Natura", icon: <TreePine size={20} /> },
  { value: "mare", label: "Mare e spiagge", icon: <Palmtree size={20} /> },
  { value: "gastronomia", label: "Gastronomia", icon: <Utensils size={20} /> },
  { value: "vita notturna", label: "Vita notturna", icon: <Music size={20} /> },
  { value: "città e shopping", label: "Città e shopping", icon: <ShoppingBag size={20} /> },
];

const WHO: Option[] = [
  { value: "una persona sola", label: "Da solo/a" },
  { value: "una coppia", label: "In coppia" },
  { value: "una famiglia con bambini", label: "Famiglia con bambini" },
  { value: "un gruppo di amici", label: "Gruppo di amici" },
  { value: "un gruppo organizzato", label: "Gruppo numeroso" },
];

const DURATIONS = [3, 5, 7, 10, 14];
const STAYS: Option[] = [
  { value: "hotel", label: "Hotel" },
  { value: "bed & breakfast o appartamenti", label: "B&B / appartamenti" },
  { value: "resort", label: "Resort" },
  { value: "alloggi misti, anche particolari", label: "Misto" },
];
const MOVES: Option[] = [
  { value: "auto a noleggio", label: "Auto a noleggio" },
  { value: "treni e mezzi pubblici", label: "Treni e mezzi pubblici" },
  { value: "con autista o transfer privati", label: "Con autista" },
  { value: "un mix dei mezzi più adatti", label: "Un mix" },
];
const PACE: Option[] = [
  { value: "tranquillo, con tempo libero", label: "Tranquillo" },
  { value: "equilibrato", label: "Equilibrato" },
  { value: "intenso, per vedere il più possibile", label: "Intenso" },
];
const BUDGET: Option[] = [
  { value: "economico", label: "Economico" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" },
  { value: "di lusso", label: "Lusso" },
];

const STEPS = 6;
const rowClass = "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition";

function Choice({ option, active, onClick }: { option: Option; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${rowClass} ${active ? "border-[#233c5e] bg-[#233c5e]/5 text-[#233c5e]" : "border-[#e6d7bb] bg-white text-slate-700 hover:bg-[#faf3e6]"}`}
    >
      <span className="flex items-center gap-3">
        {option.icon && <span className="text-[#cda876]">{option.icon}</span>}
        {option.label}
      </span>
      <ChevronRight size={16} className="text-slate-300" />
    </button>
  );
}

function Chips({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? "" : o.value)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${value === o.value ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#6b5f4a] hover:bg-[#f2e2c4]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function GuidedBrief({ onDone, onSkip }: { onDone: (brief: string) => void; onSkip: () => void }) {
  const [step, setStep] = useState(0);
  const [styles, setStyles] = useState<string[]>([]);
  const [anyStyle, setAnyStyle] = useState(false);
  const [destination, setDestination] = useState("");
  const [who, setWho] = useState("");
  const [people, setPeople] = useState("");
  const [ages, setAges] = useState("");
  const [days, setDays] = useState("");
  const [period, setPeriod] = useState("");
  const [stay, setStay] = useState("");
  const [moves, setMoves] = useState("");
  const [pace, setPace] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));

  function toggleStyle(v: string) {
    setAnyStyle(false);
    setStyles((prev) => (prev.includes(v) ? prev.filter((s) => s !== v) : prev.length >= 3 ? prev : [...prev, v]));
  }

  function finish() {
    const parts: string[] = [];
    const subject = who || "persone";
    parts.push(
      `Viaggio per ${subject}${people ? ` (${people} persone)` : ""}${ages ? `, età: ${ages}` : ""}${destination ? `, destinazione: ${destination}` : ", destinazione da suggerire"}.`,
    );
    if (styles.length) parts.push(`Tipo di viaggio: ${styles.join(", ")}.`);
    if (days || period) parts.push(`${days ? `Durata: ${days} giorni. ` : ""}${period ? `Periodo: ${period}.` : ""}`.trim());
    const prefs = [stay && `alloggio: ${stay}`, moves && `spostamenti: ${moves}`, pace && `ritmo ${pace}`, budget && `budget ${budget}`].filter(Boolean);
    if (prefs.length) parts.push(`Preferenze — ${prefs.join("; ")}.`);
    if (notes.trim()) parts.push(notes.trim());
    onDone(parts.join("\n"));
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#cda876]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5" aria-label={`Passo ${step + 1} di ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#233c5e]" : "bg-[#e6d7bb]"}`} />
        ))}
      </div>

      {step === 0 && (
        <>
          <div>
            <h3 className="text-lg font-semibold text-[#233c5e]">Che tipo di viaggio cerchi?</h3>
            <p className="text-sm text-slate-500">Scegli fino a tre cose: relax totale, cultura o belle avventure.</p>
          </div>
          <div className="flex flex-col gap-2">
            {STYLES.map((o) => (
              <Choice key={o.value} option={o} active={styles.includes(o.value)} onClick={() => toggleStyle(o.value)} />
            ))}
            <Choice
              option={{ value: "", label: "Nessuna preferenza", icon: <Ban size={20} /> }}
              active={anyStyle}
              onClick={() => {
                setStyles([]);
                setAnyStyle(true);
              }}
            />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div>
            <h3 className="text-lg font-semibold text-[#233c5e]">Dove vuoi andare?</h3>
            <p className="text-sm text-slate-500">Un paese, una regione o una città. Se non lo sai, lascia vuoto e ti propongo io qualcosa.</p>
          </div>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Es. Messico, Sicilia, Giappone…" className={inputClass} autoFocus />
        </>
      )}

      {step === 2 && (
        <>
          <div>
            <h3 className="text-lg font-semibold text-[#233c5e]">Chi parte?</h3>
          </div>
          <div className="flex flex-col gap-2">
            {WHO.map((o) => (
              <Choice key={o.value} option={o} active={who === o.value} onClick={() => setWho(o.value)} />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={people} onChange={(e) => setPeople(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} inputMode="numeric" placeholder="Quante persone? (facoltativo)" className={inputClass} />
            <input value={ages} onChange={(e) => setAges(e.target.value.slice(0, 80))} placeholder="Età (es. 25-30 anni)" className={inputClass} />
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div>
            <h3 className="text-lg font-semibold text-[#233c5e]">Quanto dura e quando?</h3>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Giorni</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(days === String(d) ? "" : String(d))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${days === String(d) ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#6b5f4a] hover:bg-[#f2e2c4]"}`}
                >
                  {d}
                </button>
              ))}
              <input value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} inputMode="numeric" placeholder="altro" className="w-20 rounded-full border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#cda876]" />
            </div>
          </div>
          <input value={period} onChange={(e) => setPeriod(e.target.value.slice(0, 80))} placeholder="Periodo (es. agosto, Pasqua, a ottobre)" className={inputClass} />
        </>
      )}

      {step === 4 && (
        <>
          <div>
            <h3 className="text-lg font-semibold text-[#233c5e]">Come ti piace viaggiare?</h3>
            <p className="text-sm text-slate-500">Tutto facoltativo: se salti, Zefiro sceglie la soluzione più adatta.</p>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Alloggio</p>
              <Chips options={STAYS} value={stay} onChange={setStay} />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Spostamenti</p>
              <Chips options={MOVES} value={moves} onChange={setMoves} />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Ritmo</p>
              <Chips options={PACE} value={pace} onChange={setPace} />
            </div>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div>
            <h3 className="text-lg font-semibold text-[#233c5e]">Budget e ultime richieste</h3>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Budget</p>
            <Chips options={BUDGET} value={budget} onChange={setBudget} />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 600))}
            rows={4}
            placeholder="Altro da sapere? Es. massimo 4 ore di guida, un compleanno da festeggiare, intolleranze, cose da evitare… (senza nomi o dati personali dei clienti)"
            className={inputClass}
          />
        </>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button type="button" onClick={step === 0 ? onSkip : () => setStep((s) => s - 1)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50">
          {step === 0 ? "Preferisco scrivere a parole" : "Indietro"}
        </button>
        <div className="flex items-center gap-2">
          {step > 0 && step < STEPS - 1 && (
            <button type="button" onClick={next} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50">
              Salta
            </button>
          )}
          <button
            type="button"
            onClick={step === STEPS - 1 ? finish : next}
            className="rounded-md bg-[#233c5e] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#17283f]"
          >
            {step === STEPS - 1 ? "Prepara la richiesta" : "Avanti"}
          </button>
        </div>
      </div>
    </div>
  );
}
