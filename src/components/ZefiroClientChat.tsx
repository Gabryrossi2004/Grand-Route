"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, MessageCircle, Send } from "lucide-react";
import Zefiro from "@/components/Zefiro";
import { useI18n } from "@/components/I18nProvider";
import type { TKey } from "@/lib/i18n";
import { askZefiroAboutTrip, type ZefiroLocation, type ZefiroReply, type ZefiroTurn } from "@/lib/actions/zefiroClient";

type Bubble = { role: "user" | "assistant"; content: string; needsAgency?: boolean; question?: string };

// Le domande suggerite dipendono dagli argomenti che l'agenzia ha attivato
function startersFor(topics: string[]): TKey[] {
  const list: TKey[] = ["zefiro.s.today", "zefiro.s.sleep"];
  if (topics.includes("consigli")) list.push("zefiro.s.eat", "zefiro.s.free");
  if (topics.includes("servizi")) list.push("zefiro.s.pharmacy");
  if (topics.includes("paese")) list.push("zefiro.s.pack");
  if (list.length < 4) list.push("zefiro.s.payments");
  return list.slice(0, 6);
}

function readPosition(): Promise<ZefiroLocation | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );
  });
}

// La conversazione con Zefiro resta solo in questa scheda del browser (non viene salvata).
const storeKey = (tripId: string) => `zefiro-chat:${tripId}`;

// Chat con Zefiro per il cliente: risponde solo con i dati del viaggio.
// `ask` si può sostituire per le prove; di norma è l'azione del server.
export default function ZefiroClientChat({
  tripId,
  onAskAgency,
  topics = ["viaggio"],
  ask = askZefiroAboutTrip,
}: {
  tripId: string;
  onAskAgency: (draft: string) => void;
  // Gli argomenti attivati dall'agenzia (decidono domande suggerite e posizione)
  topics?: string[];
  ask?: (tripId: string, question: string, history?: ZefiroTurn[], location?: ZefiroLocation) => Promise<ZefiroReply>;
}) {
  const { t } = useI18n();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; suggestAgency?: boolean; question: string } | null>(null);
  const [mood, setMood] = useState<"idle" | "happy">("idle");
  const [shareLocation, setShareLocation] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const canShareLocation = topics.includes("servizi");
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
    setLocationNote(null);
    try {
      // La posizione (solo se il cliente l'ha chiesto) serve per questa domanda e non viene salvata
      let location: ZefiroLocation | undefined;
      if (shareLocation && canShareLocation) {
        const position = await readPosition();
        if (position) location = position;
        else setLocationNote(t("zefiro.locationFail"));
      }
      const reply = await ask(tripId, question, history, location);
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
      setError({ message: t("zefiro.contactError"), question });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[#faf3e6]/80 px-3 py-2">
        <Zefiro size={88} state={busy ? "thinking" : mood} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#233c5e]">{t("zefiro.hello")}</p>
          <p className="text-xs text-slate-600">
            {topics.includes("consigli") || topics.includes("servizi") || topics.includes("paese")
              ? t("zefiro.introMore")
              : t("zefiro.introBasic")}
          </p>
        </div>
      </div>

      <div className="flex max-h-[38vh] min-h-24 flex-col gap-2 overflow-y-auto rounded-xl bg-[#faf3e6]/60 p-3" aria-live="polite">
        {bubbles.length === 0 && !busy && (
          <div className="flex flex-wrap gap-2">
            {startersFor(topics).map((starterKey) => (
              <button
                key={starterKey}
                type="button"
                onClick={() => send(t(starterKey))}
                className="min-h-10 rounded-full border border-[#e6d7bb] bg-white px-3.5 py-1.5 text-left text-sm text-[#233c5e] transition hover:bg-[#faf3e6]"
              >
                {t(starterKey)}
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
                <MessageCircle size={13} /> {t("zefiro.askAgency")}
              </button>
            )}
          </div>
        ))}
        {busy && (
          <p className="self-start rounded-2xl bg-white px-3.5 py-2 text-sm text-slate-500 shadow-sm">
            {t("zefiro.looking")}
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
              <MessageCircle size={13} /> {t("zefiro.writeAgency")}
            </button>
          )}
        </div>
      )}

      {canShareLocation && (
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={shareLocation}
            onChange={(e) => setShareLocation(e.target.checked)}
            className="mt-0.5"
          />
          <span className="flex items-center gap-1">
            <MapPin size={12} className="shrink-0" /> {t("zefiro.location")}
          </span>
        </label>
      )}
      {locationNote && <p className="text-xs text-amber-700">{locationNote}</p>}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={t("zefiro.placeholder")}
          className="min-h-12 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cda876]"
        />
        <button
          type="button"
          onClick={() => send(text)}
          disabled={busy || !text.trim()}
          aria-label={t("zefiro.sendAria")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#233c5e] text-white hover:bg-[#17283f] disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        {t("zefiro.disclaimer")}
      </p>
    </div>
  );
}
