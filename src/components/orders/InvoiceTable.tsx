import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { INVOICE_STATUS, fmtDate, fmtMoney, todayRome, type InvoiceListRow } from "@/lib/orders/shared";

// Elenco delle fatture (emesse o ricevute), con i totali da pagare / incassare
export default function InvoiceTable({ rows, role, base }: { rows: InvoiceListRow[]; role: "seller" | "buyer"; base: string }) {
  const today = todayRome();
  const isCredit = (r: InvoiceListRow) => r.doc_type === "TD04";
  const due = (r: InvoiceListRow) => Number(r.residuo ?? r.netto);
  const open = rows.filter((r) => r.status === "emessa" && !isCredit(r));
  const openEur = open.filter((r) => r.currency === "EUR").reduce((s, r) => s + due(r), 0);
  const overdue = open.filter((r) => r.due_date && r.due_date < today);
  const drafts = rows.filter((r) => r.status === "bozza");
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-[#e6d7bb] bg-white px-3 py-2">
          <p className="text-lg font-semibold text-[#233c5e]">{fmtMoney(openEur)}</p>
          <p className="text-xs text-slate-500">{role === "seller" ? "Da incassare" : "Da pagare"}</p>
        </div>
        <div className="rounded-xl border border-[#e6d7bb] bg-white px-3 py-2">
          <p className={`text-lg font-semibold ${overdue.length ? "text-[#c0392b]" : "text-[#233c5e]"}`}>{overdue.length}</p>
          <p className="text-xs text-slate-500">Scadute</p>
        </div>
        {role === "seller" && (
          <div className="rounded-xl border border-[#e6d7bb] bg-white px-3 py-2">
            <p className="text-lg font-semibold text-[#233c5e]">{drafts.length}</p>
            <p className="text-xs text-slate-500">Bozze</p>
          </div>
        )}
        <a href={`/api/fatture/export?ruolo=${role}`} className="flex items-center gap-2 rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm font-medium text-[#233c5e] hover:border-[#c58f2d]">
          <FileSpreadsheet size={18} className="text-[#c58f2d]" /> Elenco per il commercialista (CSV)
        </a>
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-8 text-center text-slate-600">
          {role === "seller" ? "Nessuna fattura ancora. Quando un servizio è svolto lo trovi in «Lavori» pronto da fatturare." : "Nessuna fattura ricevuta. Le fatture dei fornitori partner arrivano qui, collegate agli ordini."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#e6d7bb] bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#e6d7bb] text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-semibold">Numero</th>
                <th className="px-3 py-2 font-semibold">Data</th>
                <th className="px-3 py-2 font-semibold">{role === "seller" ? "Cliente" : "Fornitore"}</th>
                <th className="px-3 py-2 text-right font-semibold">Totale</th>
                <th className="px-3 py-2 text-right font-semibold">Da pagare</th>
                <th className="px-3 py-2 font-semibold">Scadenza</th>
                <th className="px-3 py-2 font-semibold">Stato</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const credit = isCredit(r);
                const late = !credit && r.status === "emessa" && r.due_date && r.due_date < today;
                const st = INVOICE_STATUS[r.status];
                return (
                  <tr key={r.id} className="border-b border-[#f2e2c4] last:border-0 hover:bg-[#fffaf0]">
                    <td className="px-3 py-2.5 font-medium">
                      <Link href={`${base}/${r.id}`} className="text-[#233c5e] underline">{r.number ?? "Bozza"}</Link>
                      {credit && <span className="block text-xs font-normal text-violet-700">nota di credito{r.credit_of_number ? ` su fatt. ${r.credit_of_number}` : ""}</span>}
                    </td>
                    <td className="px-3 py-2.5">{fmtDate(r.issue_date) || "—"}</td>
                    <td className="px-3 py-2.5">{r.counterpart_name}</td>
                    <td className="px-3 py-2.5 text-right">{fmtMoney(credit ? -Number(r.totale) : Number(r.totale), r.currency)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {credit ? fmtMoney(-Number(r.netto), r.currency) : fmtMoney(due(r), r.currency)}
                      {!credit && Number(r.credited ?? 0) > 0 && <span className="block text-xs font-normal text-slate-500">dopo note di credito</span>}
                    </td>
                    <td className={`px-3 py-2.5 ${late ? "font-semibold text-[#c0392b]" : ""}`}>{credit ? "—" : fmtDate(r.due_date) || "—"}</td>
                    <td className="px-3 py-2.5">
                      {credit ? (
                        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">{r.status === "bozza" ? "Bozza" : "Emessa"}</span>
                      ) : (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${late ? "bg-red-100 text-red-800" : st.tone}`}>{late ? "Scaduta" : st.label}</span>
                      )}
                      {late && Number(r.reminders_sent ?? 0) > 0 && <span className="ml-1 text-xs text-slate-500">{r.reminders_sent} sollec.</span>}
                      {r.status === "pagata" && r.paid_at && <span className="ml-1 text-xs text-slate-500">{fmtDate(r.paid_at, { day: "numeric", month: "short" })}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
