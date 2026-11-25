import { NATURE, REGIMES, computeTotals, type InvoiceDoc, type Party } from "@/lib/invoicing/engine";
import { fmtDate, fmtMoney } from "@/lib/orders/shared";

function PartyBlock({ title, p }: { title: string; p: Party }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-1 font-semibold text-slate-900">{p.name}</p>
      <p className="text-sm text-slate-700">{p.address}</p>
      <p className="text-sm text-slate-700">
        {[p.postal_code, p.city, p.province ? `(${p.province})` : null].filter(Boolean).join(" ")}
        {p.country !== "IT" ? ` – ${p.country}` : ""}
      </p>
      {p.vat && <p className="text-sm text-slate-700">P. IVA {p.vat}</p>}
      {p.tax_code && p.tax_code !== p.vat && <p className="text-sm text-slate-700">C.F. {p.tax_code}</p>}
      {p.sdi_code && <p className="text-sm text-slate-700">Codice SDI {p.sdi_code}</p>}
      {p.pec && <p className="text-sm text-slate-700">PEC {p.pec}</p>}
    </div>
  );
}

// Fattura leggibile (per lo schermo e per la stampa / PDF). La fattura valida è quella elettronica inviata allo SDI.
export default function InvoiceView({
  doc,
  number,
  issueDate,
  dueDate,
  currency,
  status,
  docType = "TD01",
  linked = null,
}: {
  doc: InvoiceDoc;
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  status: string;
  docType?: string;
  linked?: { number: string | null; date: string | null } | null;
}) {
  const credit = docType === "TD04";
  const t = computeTotals(doc);
  return (
    <div className="relative rounded-2xl border border-[#e6d7bb] bg-white p-5 text-slate-800 sm:p-8 print:border-0 print:p-0">
      {status === "bozza" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-amber-800">Bozza – non valida {credit ? "come nota di credito" : "come fattura"}</p>
      )}
      {status === "stornata" && (
        <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Fattura stornata</p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold text-[#233c5e]">{credit ? "Nota di credito" : "Fattura"} {number ?? "—"}</p>
          <p className="text-sm text-slate-600">del {fmtDate(issueDate) || "—"}{!credit && dueDate ? ` · scadenza ${fmtDate(dueDate)}` : ""}</p>
          {credit && linked && <p className="text-sm font-medium text-slate-700">Rettifica la fattura n. {linked.number} del {fmtDate(linked.date)}</p>}
        </div>
        <p className="text-xs text-slate-500">Regime fiscale: {REGIMES[doc.regime]}</p>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <PartyBlock title="Fornitore" p={doc.seller} />
        <PartyBlock title="Cliente" p={doc.buyer} />
      </div>

      {/* Telefono: righe una sotto l'altra */}
      <ul className="mt-6 divide-y divide-[#f2e2c4] border-y border-[#e6d7bb] sm:hidden print:hidden">
        {doc.lines.map((l) => (
          <li key={l.id} className="py-2.5 text-sm">
            <p className="text-slate-800">{l.description}</p>
            <p className="mt-1 flex justify-between gap-2 text-slate-600">
              <span>
                {l.quantity}{l.unit ? ` ${l.unit}` : ""} × {fmtMoney(l.unit_price, currency)} · {l.vat_rate > 0 ? `IVA ${l.vat_rate}%` : l.natura}
              </span>
              <span className="font-semibold text-slate-900">{fmtMoney(t.lineTotals[l.id] ?? 0, currency)}</span>
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-6 hidden overflow-x-auto sm:block print:block">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-[#e6d7bb] text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-2 font-semibold">Descrizione</th>
              <th className="py-2 pr-2 text-right font-semibold">Q.tà</th>
              <th className="py-2 pr-2 text-right font-semibold">Prezzo</th>
              <th className="py-2 pr-2 text-right font-semibold">IVA</th>
              <th className="py-2 text-right font-semibold">Importo</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l.id} className="border-b border-[#f2e2c4] align-top">
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 pr-2 text-right">{l.quantity}{l.unit ? ` ${l.unit}` : ""}</td>
                <td className="py-2 pr-2 text-right">{fmtMoney(l.unit_price, currency)}</td>
                <td className="py-2 pr-2 text-right">{l.vat_rate > 0 ? `${l.vat_rate}%` : l.natura ?? "—"}</td>
                <td className="py-2 text-right">{fmtMoney(t.lineTotals[l.id] ?? 0, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_18rem]">
        <div className="space-y-2 text-xs text-slate-600">
          {t.riepilogo.map((r) => (
            <p key={`${r.vat_rate}${r.natura}`}>
              {r.vat_rate > 0 ? `IVA ${r.vat_rate}%` : `${r.natura} – ${r.natura ? NATURE[r.natura].norma : ""}`}: imponibile {fmtMoney(r.imponibile, currency)}
              {r.vat_rate > 0 ? `, imposta ${fmtMoney(r.imposta, currency)}` : ""}
            </p>
          ))}
          {doc.bollo && <p>Imposta di bollo assolta in modo virtuale (2,00 €).</p>}
          {doc.notes && <p className="whitespace-pre-line text-slate-700">{doc.notes}</p>}
          {!credit && doc.payment.iban && (
            <p className="text-slate-700">
              Pagamento con bonifico: IBAN <strong>{doc.payment.iban}</strong>{doc.payment.bank ? ` (${doc.payment.bank})` : ""}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-[#faf3e6] p-4 text-sm">
          <p className="flex justify-between"><span>Imponibile</span><span>{fmtMoney(t.imponibile, currency)}</span></p>
          <p className="flex justify-between"><span>IVA</span><span>{fmtMoney(t.iva, currency)}</span></p>
          <p className="mt-1 flex justify-between border-t border-[#e6d7bb] pt-1 font-semibold"><span>{credit ? "Totale nota" : "Totale fattura"}</span><span>{fmtMoney(t.totale, currency)}</span></p>
          {t.ritenuta > 0 && (
            <p className="flex justify-between gap-3 text-slate-600"><span>Ritenuta d&apos;acconto {doc.ritenuta.rate}%</span><span>− {fmtMoney(t.ritenuta, currency)}</span></p>
          )}
          <p className="mt-1 flex justify-between border-t border-[#e6d7bb] pt-1 text-base font-semibold text-[#233c5e]"><span>{credit ? "Importo a credito del cliente" : "Da pagare"}</span><span>{fmtMoney(t.netto, currency)}</span></p>
        </div>
      </div>
      <p className="mt-6 text-[11px] text-slate-400 print:mt-10">
        Copia di cortesia preparata con Grand Route. La fattura valida ai fini fiscali è quella elettronica trasmessa al Sistema di Interscambio.
      </p>
    </div>
  );
}
