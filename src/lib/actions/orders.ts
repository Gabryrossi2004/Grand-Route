"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";
import { sendMail } from "@/lib/email";
import { checkInvoice, computeTotals, isValidIban, type InvoiceDoc, type InvoiceLine, type Natura } from "@/lib/invoicing/engine";
import { buildDraft, DEFAULT_SETTINGS, partyFromProfile, type BillingSettings } from "@/lib/invoicing/draft";
import { addDays, todayRome, type OrderRow } from "@/lib/orders/shared";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_READY = "Per gli ordini serve l'aggiornamento del database (migrazione 0065).";
const message = (m?: string) => (m && !/function|relation|schema cache|does not exist|permission denied/i.test(m) ? m : NOT_READY);

function refresh() {
  revalidatePath("/rete/lavori");
  revalidatePath("/rete/fatture");
  revalidatePath("/dashboard/ordini");
  revalidatePath("/rete", "layout");
  revalidatePath("/dashboard", "layout");
}

// Avvisa l'altra parte (notifica sul telefono e, per le cose importanti, email). Non blocca mai l'azione.
async function notify(ref: { order?: string; invoice?: string }, push: { title: string; body: string; url: string }, mail?: { subject: string; text: string }) {
  try {
    const supabase = await createClient();
    const args = { p_order: ref.order ?? null, p_invoice: ref.invoice ?? null };
    const { data: targets } = await supabase.rpc("network_party_push_targets", args);
    const list = (targets as PushTarget[] | null) ?? [];
    if (list.length) {
      const { expiredEndpoints } = await sendPushToTargets(list, push);
      if (expiredEndpoints.length) await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }
    if (mail) {
      const { data: email } = await supabase.rpc("network_party_email", args);
      if (typeof email === "string" && email.includes("@")) {
        const site = process.env.NEXT_PUBLIC_SITE_URL || "https://grandroute.it";
        const link = `${site}${push.url}`;
        const safe = (t: string) => t.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
        await sendMail({
          to: email,
          subject: mail.subject,
          text: `${mail.text}\n\nApri su Grand Route: ${link}`,
          html: `<p>${safe(mail.text).replace(/\n/g, "<br>")}</p><p><a href="${link}">Apri su Grand Route</a></p>`,
        });
      }
    }
  } catch (e) {
    console.error("[orders notify]", (e as Error).message);
  }
}

// ---------------- Ordini ----------------
export type OrderInput = {
  title: string;
  details?: string;
  service_date: string;
  end_date?: string;
  start_time?: string;
  place?: string;
  pax?: string;
  reference?: string;
  lead_name?: string;
  quantity: string;
  unit: string;
  unit_price: string;
  currency: string;
  free_cancel_days: string;
  penalty_pct: string;
};

function checkOrder(i: OrderInput): string | null {
  if (i.title.trim().length < 2) return "Scrivi che servizio è.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.service_date)) return "Scegli la data del servizio.";
  if (i.end_date && (!/^\d{4}-\d{2}-\d{2}$/.test(i.end_date) || i.end_date < i.service_date)) return "La data di fine non può essere prima dell'inizio.";
  if (i.start_time && !/^\d{2}:\d{2}$/.test(i.start_time)) return "Controlla l'orario.";
  const q = Number(i.quantity.replace(",", "."));
  const p = Number(i.unit_price.replace(",", "."));
  if (!(q > 0) || q > 99999) return "La quantità deve essere maggiore di zero.";
  if (!(p >= 0) || p > 999999) return "Controlla il prezzo.";
  if (i.pax && !(Number(i.pax) >= 1 && Number(i.pax) <= 9999)) return "Controlla il numero di persone.";
  const fc = Number(i.free_cancel_days);
  const pp = Number(i.penalty_pct);
  if (!(fc >= 0 && fc <= 365)) return "Controlla i giorni di cancellazione gratuita.";
  if (!(pp >= 0 && pp <= 100)) return "La penale va da 0 a 100%.";
  return null;
}

function orderPayload(i: OrderInput) {
  return {
    title: i.title.trim().slice(0, 200),
    details: (i.details ?? "").trim().slice(0, 2000),
    service_date: i.service_date,
    end_date: i.end_date && i.end_date !== i.service_date ? i.end_date : "",
    start_time: i.start_time ?? "",
    place: (i.place ?? "").trim().slice(0, 200),
    pax: i.pax ?? "",
    reference: (i.reference ?? "").trim().slice(0, 200),
    lead_name: (i.lead_name ?? "").trim().slice(0, 120),
    quantity: String(Number(i.quantity.replace(",", "."))),
    unit: i.unit.trim().slice(0, 20) || "servizio",
    unit_price: String(Math.round(Number(i.unit_price.replace(",", ".")) * 100) / 100),
    currency: i.currency,
    free_cancel_days: String(Math.round(Number(i.free_cancel_days))),
    penalty_pct: String(Math.round(Number(i.penalty_pct))),
  };
}

export async function createOrder(role: "buyer" | "seller", counterpart: string, input: OrderInput, buyerServiceId?: string | null): Promise<ActionResult<{ id: string }>> {
  if (!UUID.test(counterpart)) return { ok: false, error: "Scegli con chi lavori." };
  const bad = checkOrder(input);
  if (bad) return { ok: false, error: bad };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_order_create", {
    p: { role, counterpart, buyer_service_id: buyerServiceId && UUID.test(buyerServiceId) ? buyerServiceId : "", ...orderPayload(input) },
  });
  if (error || typeof data !== "string") return { ok: false, error: message(error?.message) };
  refresh();
  if (buyerServiceId) revalidatePath("/dashboard/trips", "layout");
  await notify(
    { order: data },
    role === "buyer"
      ? { title: "Nuovo ordine da confermare", body: `${input.title} – ${input.service_date}`, url: "/rete/lavori" }
      : { title: "Un fornitore ha registrato un servizio", body: `${input.title} – ${input.service_date}`, url: "/rete/lavori?vista=ordini" },
    {
      subject: role === "buyer" ? `Nuovo ordine: ${input.title}` : `Servizio registrato: ${input.title}`,
      text: role === "buyer" ? `Hai ricevuto un nuovo ordine su Grand Route: ${input.title} (${input.service_date}). Confermalo o proponi una modifica.` : `Un tuo fornitore ha registrato un servizio su Grand Route: ${input.title} (${input.service_date}). Controllalo e confermalo.`,
    },
  );
  return { ok: true, id: data };
}

export async function updateOrder(id: string, input: OrderInput): Promise<ActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Ordine non trovato." };
  const bad = checkOrder(input);
  if (bad) return { ok: false, error: bad };
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_order_update", { p_id: id, p: orderPayload(input) });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  await notify({ order: id }, { title: "Ordine modificato", body: `${input.title}: controlla e conferma le modifiche`, url: "/rete/lavori" });
  return { ok: true };
}

export async function confirmOrder(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_order_confirm", { p_id: id });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  revalidatePath("/dashboard/trips", "layout");
  await notify({ order: id }, { title: "Ordine confermato", body: "Il servizio è confermato.", url: "/rete/lavori" });
  return { ok: true };
}

export async function declineOrder(id: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_order_decline", { p_id: id, p_reason: reason });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  await notify({ order: id }, { title: "Ordine rifiutato", body: reason || "La proposta non è stata accettata.", url: "/rete/lavori" }, { subject: "Ordine rifiutato", text: `Un ordine su Grand Route è stato rifiutato.${reason ? ` Motivo: ${reason}` : ""}` });
  return { ok: true };
}

export async function cancelOrder(id: string): Promise<ActionResult<{ penalty: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("network_order_cancel", { p_id: id });
  if (error) return { ok: false, error: message(error.message) };
  const penalty = Number(data ?? 0);
  refresh();
  revalidatePath("/dashboard/trips", "layout");
  await notify(
    { order: id },
    { title: "Servizio annullato", body: penalty > 0 ? `Annullato con penale di ${penalty.toFixed(2)}` : "Annullato senza penale.", url: "/rete/lavori" },
    { subject: "Servizio annullato", text: `Un servizio su Grand Route è stato annullato${penalty > 0 ? `, con una penale di ${penalty.toFixed(2)} secondo le condizioni concordate` : " senza penale"}.` },
  );
  return { ok: true, penalty };
}

export async function setPenalty(id: string, amount: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_order_set_penalty", { p_id: id, p_amount: Math.max(0, Math.round(amount * 100) / 100) });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  return { ok: true };
}

// ---------------- Variazioni ----------------
export async function addExtra(orderId: string, kind: "servizio" | "spesa", description: string, quantity: number, unitPrice: number, receiptPath: string | null): Promise<ActionResult> {
  if (description.trim().length < 2) return { ok: false, error: "Scrivi di cosa si tratta." };
  if (!(quantity > 0) || !Number.isFinite(unitPrice) || Math.abs(unitPrice) > 999999) return { ok: false, error: "Controlla quantità e importo." };
  if (kind === "spesa" && unitPrice < 0) return { ok: false, error: "Una spesa anticipata non può essere negativa: per uno sconto scegli «extra / sconto»." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_extra_add", {
    p_order: orderId,
    p_kind: kind,
    p_description: description.trim().slice(0, 300),
    p_quantity: quantity,
    p_unit_price: Math.round(unitPrice * 100) / 100,
    p_receipt: receiptPath && receiptPath.startsWith(`${orderId}/`) ? receiptPath : null,
  });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  if (quantity * unitPrice > 0)
    await notify({ order: orderId }, { title: "Nuova variazione di prezzo", body: `${description.trim()}: hai ${3} giorni per contestarla`, url: "/rete/lavori?vista=ordini" });
  return { ok: true };
}

export async function updateExtra(id: string, kind: "servizio" | "spesa", description: string, quantity: number, unitPrice: number): Promise<ActionResult> {
  if (description.trim().length < 2 || !(quantity > 0) || !Number.isFinite(unitPrice)) return { ok: false, error: "Controlla i dati della variazione." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_extra_update", { p_id: id, p_kind: kind, p_description: description.trim().slice(0, 300), p_quantity: quantity, p_unit_price: Math.round(unitPrice * 100) / 100 });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  return { ok: true };
}

export async function deleteExtra(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_extra_delete", { p_id: id });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  return { ok: true };
}

export async function decideExtra(id: string, orderId: string, accept: boolean, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_extra_decide", { p_id: id, p_accept: accept, p_note: note });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  if (!accept) await notify({ order: orderId }, { title: "Variazione contestata", body: note || "Il cliente ha contestato una variazione.", url: "/rete/lavori" });
  return { ok: true };
}

// Link temporaneo (1 minuto) per aprire una ricevuta
export async function receiptUrl(path: string): Promise<ActionResult<{ url: string }>> {
  if (!/^[0-9a-f-]{36}\/[\w.-]+$/i.test(path)) return { ok: false, error: "File non trovato." };
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("network-orders").createSignedUrl(path, 60);
  if (error || !data) return { ok: false, error: "File non trovato." };
  return { ok: true, url: data.signedUrl };
}

// Copia nel servizio del viaggio il costo fatturato (IVA compresa) per quell'ordine
export async function syncServiceCost(orderId: string): Promise<ActionResult<{ amount: number }>> {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("network_orders_list", { p_role: "buyer" });
  const o = ((rows ?? []) as OrderRow[]).find((r) => r.id === orderId);
  if (!o?.buyer_service_id || !o.invoice_id) return { ok: false, error: "Ordine non collegato a un viaggio o non ancora fatturato." };
  const { data: inv } = await supabase.from("network_invoices").select("doc").eq("id", o.invoice_id).maybeSingle();
  const doc = (inv as { doc?: InvoiceDoc } | null)?.doc;
  if (!doc?.lines) return { ok: false, error: "Fattura non trovata." };
  const t = computeTotals({ ...doc, lines: doc.lines.filter((l) => l.order_id === orderId) });
  const { error } = await supabase.from("trip_services").update({ net_cost: t.totale }).eq("id", o.buyer_service_id);
  if (error) return { ok: false, error: "Non sono riuscito ad aggiornare il viaggio." };
  revalidatePath("/dashboard/trips", "layout");
  refresh();
  return { ok: true, amount: t.totale };
}

// ---------------- Impostazioni di fatturazione ----------------
export async function saveBillingSettings(input: BillingSettings): Promise<ActionResult> {
  const user = await getCachedUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const iban = (input.iban ?? "").replace(/\s+/g, "").toUpperCase() || null;
  if (iban && !isValidIban(iban)) return { ok: false, error: "L'IBAN non è valido: controllalo." };
  if (input.person && (!input.first_name?.trim() || !input.last_name?.trim())) return { ok: false, error: "Per una persona fisica servono nome e cognome." };
  if (!["RF01", "RF02", "RF19"].includes(input.regime)) return { ok: false, error: "Scegli il regime fiscale." };
  if (![0, 4, 5, 10, 22].includes(Number(input.default_vat))) return { ok: false, error: "Scegli l'aliquota IVA." };
  if (!input.number_pattern.includes("{n}")) return { ok: false, error: "Il formato del numero deve contenere {n}." };
  const supabase = await createClient();
  const row = {
    user_id: user.id,
    person: !!input.person,
    first_name: input.person ? input.first_name!.trim().slice(0, 60) : null,
    last_name: input.person ? input.last_name!.trim().slice(0, 60) : null,
    regime: input.regime,
    default_vat: input.regime === "RF01" ? Number(input.default_vat) : 0,
    default_natura: input.regime === "RF01" ? (Number(input.default_vat) === 0 ? (input.default_natura ?? "N2.1") : null) : "N2.2",
    ritenuta: input.regime === "RF01" && !!input.ritenuta,
    ritenuta_rate: Math.min(50, Math.max(1, Number(input.ritenuta_rate) || 20)),
    ritenuta_type: input.ritenuta_type === "RT02" ? "RT02" : "RT01",
    bollo_charge: !!input.bollo_charge,
    iban,
    bank: (input.bank ?? "").trim().slice(0, 80) || null,
    payment_days: Math.min(180, Math.max(0, Math.round(Number(input.payment_days) || 0))),
    next_number: Math.min(999999, Math.max(1, Math.round(Number(input.next_number) || 1))),
    number_pattern: input.number_pattern.trim().slice(0, 30),
    free_cancel_days: Math.min(365, Math.max(0, Math.round(Number(input.free_cancel_days) || 0))),
    penalty_pct: Math.min(100, Math.max(0, Math.round(Number(input.penalty_pct) || 0))),
    invoice_notes: (input.invoice_notes ?? "").trim().slice(0, 400) || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("network_billing_settings").upsert(row, { onConflict: "user_id" });
  if (error) return { ok: false, error: message(error.message) };
  revalidatePath("/rete/fatture", "layout");
  return { ok: true };
}

// ---------------- Fatture ----------------
type Parties = {
  seller: (Record<string, string | null> & { business_name: string; country: string; address: string; city: string }) | null;
  buyer: (Record<string, string | null> & { business_name: string; country: string; address: string; city: string }) | null;
  settings: BillingSettings | null;
};

export async function createInvoiceDraft(buyerId: string, orderIds: string[]): Promise<ActionResult<{ id: string }>> {
  if (!UUID.test(buyerId) || orderIds.length === 0 || orderIds.some((x) => !UUID.test(x))) return { ok: false, error: "Scegli almeno un servizio." };
  const supabase = await createClient();
  const { data: partiesRaw, error: pErr } = await supabase.rpc("network_invoice_parties", { p_buyer: buyerId });
  if (pErr) return { ok: false, error: message(pErr.message) };
  const parties = partiesRaw as Parties;
  if (!parties.seller) return { ok: false, error: "Completa prima il tuo profilo nella Rete (Il mio profilo): servono i tuoi dati in fattura." };
  if (!parties.buyer) return { ok: false, error: "Mancano i dati di fatturazione del cliente." };
  const { data: rows, error: oErr } = await supabase.rpc("network_orders_list", { p_role: "seller" });
  if (oErr) return { ok: false, error: message(oErr.message) };
  const orders = ((rows ?? []) as OrderRow[]).filter((o) => orderIds.includes(o.id));
  if (orders.length !== orderIds.length) return { ok: false, error: "Alcuni servizi non sono più disponibili: ricarica la pagina." };
  const settings: BillingSettings = { ...DEFAULT_SETTINGS, ...(parties.settings ?? {}) } as BillingSettings;
  const seller = partyFromProfile(parties.seller as never, settings);
  const buyer = partyFromProfile(parties.buyer as never, null);
  const today = todayRome();
  const { doc, number } = buildDraft(orders, seller, buyer, settings, today);
  const t = computeTotals(doc);
  const { data, error } = await supabase.rpc("network_invoice_create", {
    p_buyer: buyerId,
    p_orders: orderIds,
    p_doc: doc,
    p_number: number,
    p_issue_date: today,
    p_due_date: addDays(today, settings.payment_days),
    p_totals: { imponibile: t.imponibile, iva: t.iva, ritenuta: t.ritenuta, bollo: t.bollo, totale: t.totale, netto: t.netto },
  });
  if (error || typeof data !== "string") return { ok: false, error: message(error?.message) };
  refresh();
  return { ok: true, id: data };
}

// Ripulisce le righe arrivate dalla pagina (il calcolo lo rifà sempre il server)
function sanitizeLines(lines: InvoiceLine[]): InvoiceLine[] {
  const natura = (n: unknown): Natura | null => (n === "N1" || n === "N2.1" || n === "N2.2" || n === "N4" ? n : null);
  return lines.slice(0, 200).map((l, i) => {
    const vat = [22, 10, 5, 4, 0].includes(Number(l.vat_rate)) ? Number(l.vat_rate) : 22;
    return {
      id: String(l.id || `l${i + 1}`).slice(0, 20),
      order_id: l.order_id && UUID.test(l.order_id) ? l.order_id : null,
      kind: l.kind === "spesa" || l.kind === "bollo" ? l.kind : "servizio",
      description: String(l.description ?? "").slice(0, 1000),
      quantity: Math.round((Number(l.quantity) || 0) * 100) / 100,
      unit: l.unit ? String(l.unit).slice(0, 10) : null,
      unit_price: Math.round((Number(l.unit_price) || 0) * 100) / 100,
      vat_rate: vat,
      natura: vat === 0 ? natura(l.natura) : null,
      ritenuta: !!l.ritenuta,
    };
  });
}

export async function saveInvoice(
  id: string,
  doc: InvoiceDoc,
  meta: { number: string; issueDate: string; dueDate: string | null },
  emit: boolean,
): Promise<ActionResult> {
  if (!UUID.test(id)) return { ok: false, error: "Fattura non trovata." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("network_invoices").select("doc, currency, status").eq("id", id).maybeSingle();
  const cur = current as { doc: InvoiceDoc; currency: string; status: string } | null;
  if (!cur || cur.status !== "bozza") return { ok: false, error: "Questa fattura non è più una bozza." };
  // Intestazioni e regime restano quelli della bozza: dalla pagina cambiano solo righe, bollo, note e pagamento
  const clean: InvoiceDoc = {
    ...cur.doc,
    lines: sanitizeLines(doc.lines ?? []),
    bollo: !!doc.bollo,
    notes: (doc.notes ?? "").slice(0, 1200) || null,
    payment: { iban: (doc.payment?.iban ?? "").replace(/\s+/g, "").toUpperCase() || null, bank: (doc.payment?.bank ?? "").slice(0, 80) || null, method: "MP05" },
    ritenuta: { ...cur.doc.ritenuta, enabled: !!doc.ritenuta?.enabled && cur.doc.regime === "RF01", rate: Math.min(50, Math.max(1, Number(doc.ritenuta?.rate) || 20)) },
    buyer: { ...cur.doc.buyer, sdi_code: (doc.buyer?.sdi_code ?? cur.doc.buyer.sdi_code ?? "")?.toUpperCase().slice(0, 7) || null, pec: (doc.buyer?.pec ?? cur.doc.buyer.pec ?? "").slice(0, 120) || null },
  };
  const number = meta.number.trim().slice(0, 20);
  const issue = /^\d{4}-\d{2}-\d{2}$/.test(meta.issueDate) ? meta.issueDate : null;
  const due = meta.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(meta.dueDate) ? meta.dueDate : null;
  if (emit) {
    const errors = checkInvoice(clean, { number, issueDate: issue, currency: cur.currency }).filter((p) => p.level === "errore");
    if (errors.length) return { ok: false, error: errors.map((e) => e.text).join(" ") };
  }
  const t = computeTotals(clean);
  const totals = { imponibile: t.imponibile, iva: t.iva, ritenuta: t.ritenuta, bollo: t.bollo, totale: t.totale, netto: t.netto };
  const { error } = await supabase.rpc(emit ? "network_invoice_emit" : "network_invoice_save", {
    p_id: id,
    p_doc: clean,
    p_number: number,
    p_issue_date: issue,
    p_due_date: due,
    p_totals: totals,
  });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  revalidatePath(`/rete/fatture/${id}`);
  if (emit)
    await notify(
      { invoice: id },
      { title: "Nuova fattura ricevuta", body: `Fattura ${number}: ${t.netto.toFixed(2)} da pagare`, url: `/dashboard/ordini/fatture/${id}` },
      { subject: `Fattura ${number} ricevuta su Grand Route`, text: `Un tuo fornitore ha emesso la fattura ${number} (da pagare: ${t.netto.toFixed(2)} ${cur.currency}). La trovi su Grand Route con il dettaglio dei servizi.` },
    );
  return { ok: true };
}

export async function deleteInvoiceDraft(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_invoice_delete_draft", { p_id: id });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  return { ok: true };
}

export async function voidInvoice(id: string, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_invoice_void", { p_id: id, p_note: note });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  revalidatePath(`/rete/fatture/${id}`);
  await notify({ invoice: id }, { title: "Fattura stornata", body: note || "Il fornitore ha stornato una fattura.", url: "/dashboard/ordini?vista=fatture" });
  return { ok: true };
}

export async function setInvoicePaid(id: string, paid: boolean, date: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("network_invoice_set_paid", { p_id: id, p_paid: paid, p_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null });
  if (error) return { ok: false, error: message(error.message) };
  refresh();
  revalidatePath(`/rete/fatture/${id}`);
  revalidatePath(`/dashboard/ordini/fatture/${id}`);
  if (paid) await notify({ invoice: id }, { title: "Fattura segnata come pagata", body: "Controlla l'incasso.", url: `/rete/fatture/${id}` });
  return { ok: true };
}
