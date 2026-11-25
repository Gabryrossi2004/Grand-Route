import { NextResponse } from "next/server";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { InvoiceDoc } from "@/lib/invoicing/engine";

// Elenco delle fatture in CSV (separatore «;», virgola per i decimali: si apre bene in Excel italiano)
const num = (n: number | string | null) => (n == null ? "" : Number(n).toFixed(2).replace(".", ","));
const cell = (v: string | null | undefined) => {
  const s = (v ?? "").replace(/\r?\n/g, " ");
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const user = await getCachedUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = new URL(req.url).searchParams.get("ruolo") === "buyer" ? "buyer" : "seller";
  const supabase = await createClient();
  let q = supabase.from("network_invoices").select("number, issue_date, due_date, status, currency, imponibile, iva, ritenuta, bollo, totale, netto, paid_at, doc").neq("status", "bozza").order("issue_date", { ascending: true }).limit(5000);
  q = role === "seller" ? q.eq("seller_id", user.id) : q.eq("buyer_id", user.id);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "not_ready" }, { status: 400 });
  const head = ["Numero", "Data", "Scadenza", role === "seller" ? "Cliente" : "Fornitore", "Partita IVA", "Codice fiscale", "Valuta", "Imponibile", "IVA", "Totale documento", "Ritenuta", "Da pagare", "Bollo", "Stato", "Pagata il"];
  const lines = ((data ?? []) as { number: string; issue_date: string; due_date: string | null; status: string; currency: string; imponibile: number; iva: number; ritenuta: number; bollo: number; totale: number; netto: number; paid_at: string | null; doc: InvoiceDoc }[]).map((r) => {
    const other = role === "seller" ? r.doc?.buyer : r.doc?.seller;
    return [
      cell(r.number), r.issue_date ?? "", r.due_date ?? "", cell(other?.name), cell(other?.vat), cell(other?.tax_code), r.currency,
      num(r.imponibile), num(r.iva), num(r.totale), num(r.ritenuta), num(r.netto), num(r.bollo),
      r.status === "pagata" ? "pagata" : r.status === "stornata" ? "stornata" : "da pagare", r.paid_at ?? "",
    ].join(";");
  });
  const csv = "﻿" + [head.join(";"), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fatture-${role === "seller" ? "emesse" : "ricevute"}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
