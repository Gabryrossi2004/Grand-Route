import { NextResponse } from "next/server";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { buildFatturaXml, xmlFileName } from "@/lib/invoicing/xml";
import type { InvoiceDoc } from "@/lib/invoicing/engine";

// File XML della fattura elettronica, per chi l'ha emessa e per chi la riceve (solo fatture emesse, fornitori italiani)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await getCachedUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("network_invoices").select("*").eq("id", id).maybeSingle();
  const inv = data as { id: string; status: string; number: string | null; issue_date: string | null; due_date: string | null; currency: string; doc: InvoiceDoc; doc_type?: string; credit_of?: string | null } | null;
  if (!inv || !inv.number || !inv.issue_date || inv.status === "bozza") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (inv.doc.seller?.country !== "IT") return NextResponse.json({ error: "not_italian" }, { status: 400 });
  const progressivo = inv.id.replace(/-/g, "").slice(0, 10).toUpperCase();
  // Nota di credito: va indicata la fattura che rettifica
  let linked: { number: string; date: string | null } | null = null;
  if (inv.doc_type === "TD04" && inv.credit_of) {
    const { data: orig } = await supabase.from("network_invoices").select("number, issue_date").eq("id", inv.credit_of).maybeSingle();
    const o = orig as { number: string | null; issue_date: string | null } | null;
    if (o?.number) linked = { number: o.number, date: o.issue_date };
  }
  const xml = buildFatturaXml(inv.doc, {
    number: inv.number,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    currency: inv.currency,
    progressivo,
    docType: inv.doc_type === "TD04" ? "TD04" : "TD01",
    linked,
  });
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${xmlFileName(inv.doc, progressivo)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
