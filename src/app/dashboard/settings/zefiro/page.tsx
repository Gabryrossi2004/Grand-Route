import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AskMappamondo from "@/components/AskMappamondo";
import { loadArchive } from "@/lib/actions/zefiroArchive";
import ZefiroArchiveEditor from "./ZefiroArchiveEditor";

export const metadata = { title: "Archivio di Zefiro" };

const SOURCE_LABEL: Record<string, string> = {
  viaggio: "dal viaggio",
  paese: "dalle schede paese",
  faq: "dalle domande frequenti",
  memoria: "dalle risposte salvate",
  mappamondo: "«Chiedi al Mappamondo»",
};

export default async function ZefiroArchivePage() {
  const data = await loadArchive();
  const total = data.month.free + data.month.ai;
  const pct = total ? Math.round((data.month.free / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#233c5e]">
        <ArrowLeft size={14} /> Impostazioni
      </Link>
      <h1 className="text-3xl font-medium tracking-tight text-[#233c5e]">Archivio di Zefiro</h1>
      <p className="mt-1 text-sm text-slate-600">
        Prima di usare l&apos;intelligenza artificiale, Zefiro cerca la risposta qui: nel viaggio del cliente, nelle schede del
        Mappamondo, nelle tue domande frequenti e nelle risposte già date. Queste risposte sono immediate e non costano nulla.
      </p>

      {!data.ready && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Per le domande frequenti, la memoria delle risposte e il contatore serve l&apos;aggiornamento del database 0049. Le
          risposte gratuite dal viaggio e dalle schede paese funzionano già.
        </p>
      )}

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-[#a87a1e]">Questo mese, gratis</p>
          <p className="text-3xl font-semibold text-[#2f8a4f]">{data.month.free}</p>
        </div>
        <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-[#a87a1e]">Con l&apos;AI (clienti)</p>
          <p className="text-3xl font-semibold text-[#233c5e]">{data.month.ai}</p>
        </div>
        <div className="rounded-2xl border border-[#e6d7bb] bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-[#a87a1e]">Risposte gratis</p>
          <p className="text-3xl font-semibold text-[#233c5e]">{pct}%</p>
        </div>
      </section>
      {Object.keys(data.month.bySource).length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Gratis:{" "}
          {Object.entries(data.month.bySource)
            .map(([k, v]) => `${v} ${SOURCE_LABEL[k] ?? k}`)
            .join(" · ")}
        </p>
      )}

      <div className="mt-6">
        <AskMappamondo />
      </div>

      <ZefiroArchiveEditor ready={data.ready} faqs={data.faqs} memory={data.memory} />
    </div>
  );
}
