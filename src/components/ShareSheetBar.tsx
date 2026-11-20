"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { createSheetShare, getSheetShare, revokeSheetShare } from "@/lib/actions/sheetShare";

// Link pubblico della scheda paese da mandare al cliente (senza i consigli per l'agente e senza i fornitori)
export default function ShareSheetBar({ code, onClose }: { code: string; onClose: () => void }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    getSheetShare(code).then((res) => {
      if (!alive) return;
      if (res.ok) setToken(res.token);
      else {
        setError(res.error);
        setToken(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [code]);

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/scheda/${token}` : "";

  async function create() {
    setBusy(true);
    setError(null);
    const res = await createSheetShare(code);
    setBusy(false);
    if (res.ok) setToken(res.token);
    else setError(res.error);
  }

  async function revoke() {
    if (!window.confirm("Il link già inviato smetterà di funzionare. Vuoi smettere di condividere questa scheda?")) return;
    setBusy(true);
    setError(null);
    const res = await revokeSheetShare(code);
    setBusy(false);
    if (res.ok) setToken(null);
    else setError(res.error);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia il link:", url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e6d7bb] bg-[#eef2f8] px-5 py-3 text-sm print:hidden sm:px-6">
      <Link2 size={16} className="shrink-0 text-[#233c5e]" />
      {token === undefined ? (
        <span className="flex items-center gap-2 text-slate-600">
          <Loader2 size={14} className="animate-spin" /> Controllo…
        </span>
      ) : token ? (
        <>
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-[#c9d4e6] bg-white px-3 py-1.5 text-xs text-slate-700" />
          <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-full bg-[#233c5e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1b3050]">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiato" : "Copia link"}
          </button>
          <button type="button" onClick={revoke} disabled={busy} className="rounded-full px-3 py-1.5 text-xs text-red-700 hover:bg-white disabled:opacity-60">
            Smetti di condividere
          </button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-slate-700">Crea un link da mandare al cliente: vede la scheda con il nome e il logo della tua agenzia, senza i tuoi consigli riservati e senza i fornitori.</span>
          <button type="button" onClick={create} disabled={busy || !!error?.includes("0050")} className="flex items-center gap-1.5 rounded-full bg-[#233c5e] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1b3050] disabled:opacity-60">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Crea il link
          </button>
        </>
      )}
      {error && <span className="basis-full text-xs text-red-700">{error}</span>}
      <button type="button" onClick={onClose} className="ml-auto rounded-full px-2 py-1 text-xs text-slate-500 hover:bg-white">
        Chiudi
      </button>
    </div>
  );
}
