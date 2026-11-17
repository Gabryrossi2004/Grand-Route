"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import Zefiro from "@/components/Zefiro";
import { ASSISTANT_NAME } from "@/lib/assistant";
import { askZefiroAboutTrip, type ZefiroReply, type ZefiroTurn } from "@/lib/actions/zefiroClient";

type Bubble = { role: "user" | "assistant"; content: string; needsAgency?: boolean; question?: string };

const STARTERS = ["Cosa faccio oggi?", "Dove dormo?", "Quali pagamenti devo fare?", "A che ora è il prossimo spostamento?"];

// La conversazione con Zefiro resta solo in questa scheda del browser (non viene salvata).
const storeKey = (tripId: string) => `zefiro-chat:${tripId}`;

// Chat con Zefiro per il cliente: risponde solo con i dati del viaggio.
// `ask` si può sostituire per le prove; di norma è l'azione del server.
export default function ZefiroClientChat({
  tripId,
  onAskAgency,
  ask = askZefiroAboutTrip,
}: {
  tripId: string;
  onAskAgency: (draft: string) => void;
  ask?: (tripId: string, question: string, history?: ZefiroTurn[]) => Promise<ZefiroReply>;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; suggestAgency?: boolean; question: string } | null>(null);
  const [mood, setMood] = useState<"idle" | "happy">("idle");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storeKey(tripId));
      if (saved) setBubbles(JSON.parse(saved) as Bubble[]);
    } catch {
      /* conversazione non salvata: si riparte */
    }
  }, [tripId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey(tripId), JSON.stringify(bubbles.slice(-20)));
    } catch {
      /* memoria piena o bloccata */
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [bubbles, tripId, busy]);

  async function send(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    const history: ZefiroTurn[] = bubbles.map((b) => ({ role: b.role, content: b.content }));
    setBubbles((current) => [...current, { role: "user", content: question }]);
    setText("");
    setError(null);
    setBusy(true);
    try {
      const reply = await ask(tripId, question, history);
      if ("error" in reply) {
        setError({ message: reply.error, suggestAgency: reply.suggestAgency, question });
      } else {
        setBubbles((current) => [
          ...current,
          { role: "assistant", content: reply.answer, needsAgency: reply.needsAgency, question },
        ]);
        setMood("happy");
        setTimeout(() => setMood("idle"), 1600);
      }
    } catch {
      setError({ message: "Non è stato possibile contattare Zefiro. Controlla la connessione e riprova.", question });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[#faf3e6]/80 px-3 py-2">
        <Zefiro size={88} state={busy ? "thinking" : mood} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#233c5e]">Ciao, sono {ASSISTANT_NAME}!</p>
          <p className="text-xs text-slate-600">
            Chiedimi del tuo viaggio: programma, orari, alloggi, pagamenti. Rispondo con i dati del tuo itinerario.
          </p>
        </div>
      </div>

      <div className="flex max-h-[38vh] min-h-24 flex-col gap-2 overflow-y-auto rounded-xl bg-[#faf3e6]/60 p-3" aria-live="polite">
        {bubbles.length === 0 && !busy && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => send(starter)}
                className="min-h-10 rounded-full border border-[#e6d7bb] bg-white px-3.5 py-1.5 text-left text-sm text-[#233c5e] transition hover:bg-[#faf3e6]"
              >
                {starter}
              </button>
            ))}
          </div>
        )}
        {bubbles.map((b, i) => (
          <div key={i} className={`flex max-w-[88%] flex-col gap-1 ${b.role === "user" ? "items-end self-end" : "items-start self-start"}`}>
            <div
              className={`whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-sm ${
                b.role === "user" ? "bg-[#233c5e] text-white" : "bg-white text-slate-800 shadow-sm"
              }`}
            >
              {b.content}
            </div>
            {b.role === "assistant" && b.needsAgency && (
              <button
                type="button"
                onClick={() => onAskAgency(b.question ?? "")}
                className="flex min-h-9 items-center gap-1.5 rounded-full border border-[#cda876] bg-white px-3 py-1 text-xs font-medium text-[#233c5e] hover:bg-[#faf3e6]"
              >
                <MessageCircle size={13} /> Chiedilo all&apos;agenzia
              </button>
            )}
          </div>
        ))}
        {busy && (
          <p className="self-start rounded-2xl bg-white px-3.5 py-2 text-sm text-slate-500 shadow-sm">
            Sto guardando il tuo itinerario…
          </p>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error.message}
          {error.suggestAgency && (
            <button
              type="button"
              onClick={() => onAskAgency(error.question)}
              className="mt-1 flex min-h-9 items-center gap-1.5 rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-900"
            >
              <MessageCircle size={13} /> Scrivi all&apos;agenzia
            </button>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Scrivi la tua domanda…"
          className="min-h-12 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
        <button
          type="button"
          onClick={() => send(text)}
          disabled={busy || !text.trim()}
          aria-label="Invia la domanda"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#233c5e] text-white hover:bg-[#17283f] disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        {ASSISTANT_NAME} è un assistente automatico e può sbagliare: per cose importanti conferma con l&apos;agenzia.
      </p>
    </div>
  );
}
