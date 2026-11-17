"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Download, FileText, Loader2, Trash2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import {
  listOfflineDocs,
  offlineSupported,
  openOfflineDoc,
  removeOfflineDoc,
  saveOfflineDoc,
} from "@/lib/offlineDocs";

export type ClientDoc = { id: string; name: string; url: string | null; where: string | null };

// Documenti del viaggio per il cliente. Ogni documento si può salvare sul
// telefono per averlo anche senza rete (in viaggio, all'estero, in aereo).
export default function ClientDocuments({ documents }: { documents: ClientDoc[] }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState<Record<string, true>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(offlineSupported());
    setSaved(Object.fromEntries(Object.keys(listOfflineDocs()).map((id) => [id, true as const])));
  }, []);

  async function save(doc: ClientDoc) {
    if (!doc.url) return;
    setBusy(doc.id);
    setMessage(null);
    try {
      await saveOfflineDoc(doc.id, doc.name, doc.url);
      setSaved((s) => ({ ...s, [doc.id]: true }));
    } catch {
      setMessage(t("docs.saveError"));
    } finally {
      setBusy(null);
    }
  }

  async function remove(doc: ClientDoc) {
    await removeOfflineDoc(doc.id).catch(() => {});
    setSaved((s) => {
      const next = { ...s };
      delete next[doc.id];
      return next;
    });
  }

  async function open(doc: ClientDoc, event: React.MouseEvent) {
    // Senza rete (o con il link scaduto) si apre la copia salvata
    if (saved[doc.id] && (!navigator.onLine || !doc.url)) {
      event.preventDefault();
      if (!(await openOfflineDoc(doc.id))) setMessage(t("docs.copyMissing"));
    }
  }

  if (documents.length === 0) return null;

  return (
    <section className="theme-card mb-8 p-5">
      <h2 className="theme-heading-font mb-1 text-lg font-semibold">{t("docs.title")}</h2>
      <p className="theme-muted mb-3 text-sm">
        {t("docs.intro")}
      </p>
      <ul className="flex flex-col gap-2">
        {documents.map((doc) => (
          <li key={doc.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2.5">
            <FileText size={18} className="shrink-0 opacity-60" />
            <div className="min-w-0 basis-[calc(100%-2rem)] flex-1 sm:basis-0">
              <a
                href={doc.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => open(doc, e)}
                className="block break-words font-medium hover:underline sm:truncate"
              >
                {doc.name}
              </a>
              {doc.where && <p className="theme-muted truncate text-xs">{doc.where}</p>}
            </div>
            {supported && (
              <div className="flex w-full shrink-0 items-center gap-1 pl-7 sm:w-auto sm:pl-0">
                {saved[doc.id] ? (
                  <>
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                      <CheckCircle2 size={14} /> {t("docs.saved")}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(doc)}
                      aria-label={t("docs.remove")}
                      title={t("docs.remove")}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-black/5"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => save(doc)}
                    disabled={busy === doc.id || !doc.url}
                    className="flex min-h-9 items-center gap-1.5 rounded-full border border-current/25 bg-white/70 px-3 py-1 text-xs font-medium hover:bg-white disabled:opacity-60"
                  >
                    {busy === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {t("docs.saveOffline")}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {message && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-red-700" role="alert">
          <CloudOff size={14} /> {message}
        </p>
      )}
    </section>
  );
}
