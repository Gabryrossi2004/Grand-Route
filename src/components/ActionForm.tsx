"use client";

import { useEffect, useRef, useState } from "react";

export type ActionResult = { ok: true } | { error: string } | void;

// Form che chiama un'azione del server e mostra l'esito accanto al pulsante:
// una breve conferma ("Salvato") oppure l'errore. Il pulsante di invio e i
// campi li mette chi lo usa, dentro questo form.
export default function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [result, setResult] = useState<{ kind: "ok" } | { kind: "error"; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function run(formData: FormData) {
    if (timer.current) clearTimeout(timer.current);
    setResult(null);
    try {
      const outcome = await action(formData);
      if (outcome && "error" in outcome && outcome.error) {
        setResult({ kind: "error", message: outcome.error });
      } else {
        setResult({ kind: "ok" });
        timer.current = setTimeout(() => setResult(null), 2500);
      }
    } catch {
      setResult({ kind: "error", message: "Salvataggio non riuscito. Controlla la connessione e riprova." });
    }
  }

  return (
    <form action={run} className={className}>
      {children}
      {result?.kind === "ok" && (
        <p className="text-sm font-medium text-green-700 sm:col-span-2" role="status">
          Salvato
        </p>
      )}
      {result?.kind === "error" && (
        <p className="text-sm font-medium text-red-700 sm:col-span-2" role="alert">
          {result.message}
        </p>
      )}
    </form>
  );
}
