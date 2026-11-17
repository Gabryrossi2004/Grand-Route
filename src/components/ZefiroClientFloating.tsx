"use client";

import { useEffect, useState } from "react";
import AssistantIcon from "@/components/AssistantIcon";
import Modal from "@/components/Modal";
import Zefiro from "@/components/Zefiro";
import ZefiroClientChat from "@/components/ZefiroClientChat";
import { OPEN_TRIP_CHAT_EVENT } from "@/components/ClientTripChat";
import { ASSISTANT_NAME } from "@/lib/assistant";

const MIN_KEY = "zefiro:client-min";
const HINT_KEY = "zefiro:client-hint";

// Zefiro nell'area clienti, separato dalla chat con l'agenzia: un piccolo
// avatar in un angolo (sopra il tasto SOS, se c'è). Si tocca per fargli una
// domanda; se dà fastidio si riduce a una piccola icona.
export default function ZefiroClientFloating({
  tripId,
  topics,
  sosVisible,
}: {
  tripId: string;
  topics: string[];
  sosVisible: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      setMinimized(localStorage.getItem(MIN_KEY) === "1");
      if (!localStorage.getItem(HINT_KEY)) {
        setShowHint(true);
        localStorage.setItem(HINT_KEY, "1");
        const timer = setTimeout(() => setShowHint(false), 7000);
        return () => clearTimeout(timer);
      }
    } catch {
      /* senza memoria locale: nessun suggerimento */
    }
  }, []);

  function setMin(value: boolean) {
    setMinimized(value);
    try {
      localStorage.setItem(MIN_KEY, value ? "1" : "0");
    } catch {
      /* ok */
    }
  }

  // Sopra il tasto SOS (alto circa 3rem) se presente, altrimenti nell'angolo
  const position = sosVisible ? "bottom-[5.5rem]" : "bottom-4";

  return (
    <>
      <div className={`fixed right-3 z-40 flex flex-col items-end gap-1 print:hidden ${position}`}>
        {showHint && !open && (
          <button
            type="button"
            onClick={() => {
              setShowHint(false);
              setOpen(true);
            }}
            className="max-w-[12rem] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-left text-xs text-[#233c5e] shadow-lg ring-1 ring-[#e6d7bb]"
          >
            Ciao, sono {ASSISTANT_NAME}! Chiedimi del tuo viaggio.
          </button>
        )}
        {minimized ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Chiedi a ${ASSISTANT_NAME}`}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-[#e6d7bb]"
          >
            <AssistantIcon size={34} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Chiedi a ${ASSISTANT_NAME}`}
            className="rounded-full drop-shadow-lg [-webkit-tap-highlight-color:transparent]"
          >
            <Zefiro size={76} state={open ? "happy" : "idle"} />
          </button>
        )}
      </div>

      {open && (
        <Modal title={ASSISTANT_NAME} onClose={() => setOpen(false)}>
          <ZefiroClientChat
            tripId={tripId}
            topics={topics}
            onAskAgency={(draft) => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent(OPEN_TRIP_CHAT_EVENT, { detail: { mode: "message", text: draft } }));
            }}
          />
          <button
            type="button"
            onClick={() => setMin(!minimized)}
            className="mt-3 text-xs text-slate-500 underline underline-offset-2"
          >
            {minimized ? `Mostra ${ASSISTANT_NAME} animato nell'angolo` : `Riduci ${ASSISTANT_NAME} a una piccola icona`}
          </button>
        </Modal>
      )}
    </>
  );
}
