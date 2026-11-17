"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import Modal from "@/components/Modal";
import { ZefiroThinking } from "@/components/Zefiro";
import { TRANSLATION_LANGUAGES } from "@/lib/translation";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { translateTrip } from "@/lib/actions/zefiroAgency";

// "Traduci con Zefiro": crea una copia del viaggio in un'altra lingua.
export default function TranslateTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await translateTrip(tripId, language);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.missing > 0) {
        // Alcuni testi sono rimasti in italiano: lo diciamo prima di aprire la copia
        window.alert(
          `La copia è pronta, ma ${result.missing} ${result.missing === 1 ? "testo non è stato tradotto ed è rimasto" : "testi non sono stati tradotti e sono rimasti"} in italiano. Controllala prima di inviarla.`,
        );
      }
      router.push(`/dashboard/trips/${result.tripId}`);
    } catch {
      setError("Non è stato possibile tradurre il viaggio. Controlla la connessione e riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <Languages size={15} />
        Traduci con {ASSISTANT_NAME}
      </button>
      {open && (
        <Modal title="Traduci il viaggio" onClose={() => !busy && setOpen(false)}>
          {busy ? (
            <ZefiroThinking
              title="Sto traducendo il viaggio…"
              hint="Ci vuole mezzo minuto circa, a seconda della lunghezza. Non chiudere la pagina."
            />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-600">
                {ASSISTANT_NAME} crea una <strong>copia</strong> del viaggio con i testi tradotti: l&apos;originale non viene toccato.
                La copia entra tra le varianti, non è pubblicata e non ha un cliente collegato.
              </p>
              <div>
                <label htmlFor="translate_language" className="mb-1 block text-sm font-medium text-slate-700">
                  Lingua
                </label>
                <select
                  id="translate_language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {TRANSLATION_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-500">
                <li>Si traducono titoli, descrizioni, tariffa e alcune note. Orari, codici, nomi di hotel e luoghi restano uguali.</li>
                <li>Foto e documenti non vengono copiati: aggiungili alla copia se servono.</li>
                <li>L&apos;interfaccia dell&apos;area clienti (pulsanti e titoli fissi) per ora resta in italiano.</li>
                <li>Costa circa 10-20 centesimi e usa il tuo budget giornaliero. Rileggi sempre la traduzione prima di inviarla.</li>
              </ul>
              {error && (
                <p className="text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={run}
                className="min-h-11 rounded-xl bg-[#233c5e] px-4 py-2 text-sm font-medium text-white hover:bg-[#17283f]"
              >
                Crea la copia tradotta
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
