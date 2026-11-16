"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

export type UploadResult = { ok: true } | { error: string } | void;

export type UploadStatus =
  | { state: "idle" }
  | { state: "uploading"; fileName: string }
  | { state: "done" }
  | { state: "error"; message: string };

type UploadContextValue = {
  status: UploadStatus;
  // Per segnalare un errore rilevato nel browser, prima ancora dell'invio
  // (file troppo grande, tipo non adatto...).
  reportError: (message: string) => void;
};

const UploadStatusContext = createContext<UploadContextValue | null>(null);

// Usato da DropzoneUpload per mostrare "Caricamento…", "Caricata" o l'errore.
// Fuori da un UploadForm restituisce null e la zona di caricamento si
// comporta come prima (serve a quelle che non caricano subito il file).
export function useUploadStatus() {
  return useContext(UploadStatusContext);
}

// Form di caricamento file che invia subito il file all'azione del server e
// ne segue l'esito: l'azione restituisce { ok: true } oppure { error: "…" }
// con la causa, che la zona di caricamento mostra all'utente.
export default function UploadForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<UploadResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [status, setStatus] = useState<UploadStatus>({ state: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function settleLater(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus({ state: "idle" }), ms);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.state === "uploading") return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = Array.from(formData.values()).find((value): value is File => value instanceof File);
    if (!file || file.size === 0) {
      setStatus({ state: "error", message: "Nessun file selezionato." });
      settleLater(10000);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    setStatus({ state: "uploading", fileName: file.name });

    try {
      const result = await action(formData);
      form.reset();
      if (result && "error" in result && result.error) {
        setStatus({ state: "error", message: result.error });
        settleLater(10000);
      } else {
        // Nessuna conferma da mostrare: l'utente vede subito il risultato
        // (la foto, il documento) nella pagina aggiornata.
        setStatus({ state: "idle" });
      }
    } catch {
      form.reset();
      setStatus({
        state: "error",
        message: "Caricamento non riuscito. Controlla la connessione e riprova.",
      });
      settleLater(10000);
    }
  }

  function reportError(message: string) {
    setStatus({ state: "error", message });
    settleLater(10000);
  }

  return (
    <UploadStatusContext.Provider value={{ status, reportError }}>
      <form onSubmit={handleSubmit} className={className}>
        {children}
      </form>
    </UploadStatusContext.Provider>
  );
}
