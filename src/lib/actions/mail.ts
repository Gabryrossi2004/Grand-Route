"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getNetworkUser } from "@/lib/team";
import { sendPushToTargets, type PushTarget } from "@/lib/webpush";
import { sendMail } from "@/lib/email";
import { reserveAiCall } from "@/lib/aiQuota";
import { askMail, draftReply, summarizeThread, type MailAskResult, type MailSummary } from "@/lib/mailAi";
import { orderRequestBody, orderRequestSubject, safeFileName } from "@/lib/mail/shared";
import type { OrderRow } from "@/lib/orders/shared";

export type MailResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_READY = "Per la posta serve l'aggiornamento del database (migrazione 0067).";
const message = (m?: string) => (m && !/function|relation|schema cache|does not exist|permission denied/i.test(m) ? m : NOT_READY);

function refresh(threadId?: string) {
  revalidatePath("/rete/posta");
  revalidatePath("/dashboard/posta");
  if (threadId) {
    revalidatePath(`/rete/posta/${threadId}`);
    revalidatePath(`/dashboard/posta/${threadId}`);
  }
  revalidatePath("/rete", "layout");
  revalidatePath("/dashboard", "layout");
}

async function myName(): Promise<string> {
  const user = await getNetworkUser();
  if (!user) return "";
  const supabase = await createClient();
  const [{ data: np }, { data: pr }] = await Promise.all([
    supabase.from("network_profiles").select("business_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("agency_name, full_name").eq("id", user.id).maybeSingle(),
  ]);
  const company = (np as { business_name?: string } | null)?.business_name || (pr as { agency_name?: string; full_name?: string } | null)?.agency_name || (pr as { full_name?: string } | null)?.full_name || "";
  // Chi scrive per un'agenzia con un team: «Mario Rossi · Agenzia X»
  if (user.personId !== user.id) {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.personId).maybeSingle();
    const person = (me as { full_name?: string } | null)?.full_name?.trim();
    if (person) return company ? `${person} · ${company}` : person;
  }
  return company;
}

// ---------------- Scrivere ----------------
// 1) si apre il messaggio (eventualmente una nuova conversazione), 2) il browser carica gli allegati, 3) si invia
export async function startMessage(threadId: string | null, subject: string, recipients: string[], body: string): Promise<MailResult<{ threadId: string; messageId: string }>> {
  if (threadId && !UUID.test(threadId)) return { ok: false, error: "Conversazione non trovata." };
  if (!threadId && (recipients.length === 0 || recipients.some((r) => !UUID.test(r)))) return { ok: false, error: "Scegli almeno un destinatario." };
  if (body.length > 50000) return { ok: false, error: "Il messaggio è troppo lungo." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mail_start", {
    p_thread: threadId,
    p_subject: subject.trim().slice(0, 200),
    p_recipients: threadId ? null : recipients,
    p_body: body.replace(/\r/g, ""),
  });
  if (error || !data) return { ok: false, error: message(error?.message) };
  const d = data as { thread_id: string; message_id: string };
  return { ok: true, threadId: d.thread_id, messageId: d.message_id };
}

export async function finishMessage(messageId: string, files: { path: string; name: string; size: number; mime: string }[]): Promise<MailResult<{ threadId: string }>> {
  if (!UUID.test(messageId)) return { ok: false, error: "Messaggio non trovato." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mail_finish", {
    p_message: messageId,
    p_files: files.slice(0, 20).map((f) => ({ path: f.path, name: f.name.slice(0, 200), size: Math.round(f.size), mime: (f.mime || "").slice(0, 100) })),
  });
  if (error || typeof data !== "string") return { ok: false, error: message(error?.message) };
  await notifyNewMessage(messageId, data);
  refresh(data);
  return { ok: true, threadId: data };
}

export async function discardMessage(messageId: string): Promise<void> {
  if (!UUID.test(messageId)) return;
  const supabase = await createClient();
  await supabase.rpc("mail_discard", { p_message: messageId });
}

// Avvisi: notifica sul telefono a ogni messaggio, email al massimo ogni 10 minuti per conversazione
async function notifyNewMessage(messageId: string, threadId: string) {
  try {
    const supabase = await createClient();
    const [{ data: rows }, { data: msg }, { data: thread }, sender] = await Promise.all([
      supabase.rpc("mail_notify_targets", { p_message: messageId }),
      supabase.from("mail_messages").select("body").eq("id", messageId).maybeSingle(),
      supabase.from("mail_threads").select("subject").eq("id", threadId).maybeSingle(),
      myName(),
    ]);
    type Row = { user_id: string; email: string | null; send_email: boolean } & PushTarget;
    const list = (rows ?? []) as Row[];
    const subject = (thread as { subject?: string } | null)?.subject ?? "Nuovo messaggio";
    const body = (msg as { body?: string } | null)?.body ?? "";
    const push = list.filter((r) => r.endpoint);
    if (push.length) {
      const { expiredEndpoints } = await sendPushToTargets(push, { title: `${sender || "Nuovo messaggio"}: ${subject}`.slice(0, 120), body: body.slice(0, 140) || "Allegato", url: `/rete/posta/${threadId}` });
      if (expiredEndpoints.length) await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://grandroute.it";
    const link = `${site}/rete/posta/${threadId}`;
    const emails = [...new Set(list.filter((r) => r.send_email && r.email).map((r) => r.email as string))];
    const esc = (t: string) => t.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
    const preview = body.length > 3000 ? `${body.slice(0, 3000)}…` : body;
    await Promise.all(
      emails.map((to) =>
        sendMail({
          to,
          subject: `${subject} – nuovo messaggio da ${sender || "un partner"}`,
          text: `${sender || "Un partner"} ti ha scritto su Grand Route:\n\n${preview}\n\nPer rispondere apri la conversazione (le risposte a questa email non arrivano): ${link}`,
          html: `<p><strong>${esc(sender || "Un partner")}</strong> ti ha scritto su Grand Route:</p><blockquote style="border-left:3px solid #cda876;padding-left:12px;color:#333;white-space:pre-wrap">${esc(preview)}</blockquote><p><a href="${link}">Apri la conversazione e rispondi</a></p><p style="color:#888;font-size:12px">Le risposte a questa email non arrivano: rispondi da Grand Route.</p>`,
          fromName: sender ? `${sender} via Grand Route` : null,
        }),
      ),
    );
  } catch (e) {
    console.error("[mail notify]", (e as Error).message);
  }
}

// ---------------- Stato, partecipanti, allegati ----------------
export async function setThreadState(threadId: string, state: { read?: boolean; starred?: boolean; archived?: boolean }): Promise<MailResult> {
  if (!UUID.test(threadId)) return { ok: false, error: "Conversazione non trovata." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mail_set_state", { p_thread: threadId, p_read: state.read ?? null, p_starred: state.starred ?? null, p_archived: state.archived ?? null });
  if (error) return { ok: false, error: message(error.message) };
  refresh(threadId);
  return { ok: true };
}

// ---------------- Posta del team ----------------
// Passa la conversazione a un collega (con una nota interna che il partner non vede),
// la prende in carico chi la apre (personId = sé stessi) o la rimette nella posta generale (null)
export async function assignThread(threadId: string, personId: string | null, note: string): Promise<MailResult> {
  if (!UUID.test(threadId) || (personId !== null && !UUID.test(personId))) return { ok: false, error: "Dati non validi." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mail_assign", { p_thread: threadId, p_person: personId, p_note: note.trim().slice(0, 1000) || null });
  if (error) return { ok: false, error: teamMessage(error.message) };
  refresh(threadId);
  return { ok: true };
}

// Solo i titolari: la conversazione la segue e la vede solo chi la rende privata
export async function setThreadPrivate(threadId: string, isPrivate: boolean): Promise<MailResult> {
  if (!UUID.test(threadId)) return { ok: false, error: "Conversazione non trovata." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mail_set_private", { p_thread: threadId, p_private: isPrivate });
  if (error) return { ok: false, error: teamMessage(error.message) };
  refresh(threadId);
  return { ok: true };
}

const teamMessage = (m?: string) =>
  m && !/function|relation|schema cache|does not exist|permission denied/i.test(m) ? m : "Per la posta del team serve l'aggiornamento del database (migrazione 0077).";

export async function addParticipant(threadId: string, userId: string): Promise<MailResult> {
  if (!UUID.test(threadId) || !UUID.test(userId)) return { ok: false, error: "Dati non validi." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mail_add_participant", { p_thread: threadId, p_user: userId });
  if (error) return { ok: false, error: message(error.message) };
  refresh(threadId);
  return { ok: true };
}

export async function attachmentUrl(path: string, name: string): Promise<MailResult<{ url: string }>> {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w.-]+$/i.test(path)) return { ok: false, error: "File non trovato." };
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("mail-files").createSignedUrl(path, 300, { download: name });
  if (error || !data) return { ok: false, error: "File non trovato." };
  return { ok: true, url: data.signedUrl };
}

// Inoltro: nuova conversazione con il messaggio citato e gli allegati copiati
export async function forwardMessage(messageId: string, recipients: string[], note: string): Promise<MailResult<{ threadId: string }>> {
  if (!UUID.test(messageId) || recipients.length === 0) return { ok: false, error: "Scegli almeno un destinatario." };
  const supabase = await createClient();
  const { data: m } = await supabase.from("mail_messages").select("id, thread_id, author_id, body, created_at").eq("id", messageId).maybeSingle();
  const orig = m as { id: string; thread_id: string; author_id: string | null; body: string; created_at: string } | null;
  if (!orig) return { ok: false, error: "Messaggio non trovato." };
  const [{ data: t }, { data: atts }, { data: author }] = await Promise.all([
    supabase.from("mail_threads").select("subject").eq("id", orig.thread_id).maybeSingle(),
    supabase.from("mail_attachments").select("path, name, size_bytes, mime").eq("message_id", messageId),
    orig.author_id ? supabase.from("profiles").select("agency_name, full_name").eq("id", orig.author_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const subject = (t as { subject?: string } | null)?.subject ?? "";
  const who = (author as { agency_name?: string; full_name?: string } | null)?.agency_name || (author as { full_name?: string } | null)?.full_name || "";
  const quoted = `${note.trim()}\n\n---------- Messaggio inoltrato ----------\nDa: ${who}\nData: ${new Date(orig.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}\nOggetto: ${subject}\n\n${orig.body}`.trim();
  const started = await startMessage(null, `I: ${subject}`.slice(0, 200), recipients, quoted);
  if (!started.ok) return started;
  const files: { path: string; name: string; size: number; mime: string }[] = [];
  for (const a of (atts ?? []) as { path: string; name: string; size_bytes: number | null; mime: string | null }[]) {
    const dest = `${started.threadId}/${started.messageId}/${safeFileName(a.name)}`;
    const { error } = await supabase.storage.from("mail-files").copy(a.path, dest);
    if (!error) files.push({ path: dest, name: a.name, size: a.size_bytes ?? 0, mime: a.mime ?? "" });
  }
  return finishMessage(started.messageId, files);
}

// ---------------- Ordini: la richiesta apre la conversazione, gli eventi la aggiornano ----------------
export async function ensureOrderThread(orderId: string): Promise<MailResult<{ threadId: string }>> {
  if (!UUID.test(orderId)) return { ok: false, error: "Ordine non trovato." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("mail_threads").select("id").eq("order_id", orderId).maybeSingle();
  if ((existing as { id?: string } | null)?.id) return { ok: true, threadId: (existing as { id: string }).id };
  const { data: rows } = await supabase.rpc("network_orders_list", { p_role: "all" });
  const o = ((rows ?? []) as OrderRow[]).find((r) => r.id === orderId);
  if (!o) return { ok: false, error: "Ordine non trovato." };
  const kind = o.created_by === o.counterpart ? (o.role === "buyer" ? "lavoro" : "richiesta") : o.role === "buyer" ? "richiesta" : "lavoro";
  const user = await getNetworkUser();
  // il testo della richiesta lo scrive solo chi ha creato l'ordine; per gli altri la conversazione si apre vuota
  const iCreated = !!user && o.created_by === user.id;
  const sender = iCreated ? await myName() : "";
  const { data, error } = await supabase.rpc("mail_order_thread", {
    p_order: orderId,
    p_subject: orderRequestSubject(o, kind),
    p_body: iCreated ? orderRequestBody(o, sender, kind) : "",
  });
  if (error || typeof data !== "string") return { ok: false, error: message(error?.message) };
  refresh(data);
  return { ok: true, threadId: data };
}

// ---------------- Zefiro (facoltativo) ----------------
const STOP = new Set(
  "il lo la i gli le un una uno di da in con su per tra fra a e o ma che chi cosa come quando dove del della dei delle dal dalla nel nella sul sulla al alla ai agli mi ti ci vi si non più è sono ho hai ha abbiamo avete hanno trova trovami cerca cercami mostra quale quali quel quella questo questa mail email messaggio messaggi conversazione".split(" "),
);

export async function askZefiroMail(question: string): Promise<MailResult<{ result: MailAskResult; threads: Record<string, { thread_id: string; subject: string }> }>> {
  const q = question.trim().slice(0, 500);
  if (q.length < 3) return { ok: false, error: "Scrivi cosa cerchi." };
  const quota = await reserveAiCall("mail");
  if (!quota.ok) return { ok: false, error: quota.error };
  const words = [...new Set(q.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w)))].slice(0, 8);
  const supabase = await createClient();
  let { data, error } = await supabase.rpc("mail_search_messages", { p_words: words, p_limit: 40 });
  if (!error && (data ?? []).length === 0 && words.length) ({ data, error } = await supabase.rpc("mail_search_messages", { p_words: [], p_limit: 40 }));
  if (error) return { ok: false, error: message(error.message) };
  type Hit = { message_id: string; thread_id: string; subject: string; author: string; created_at: string; body: string };
  const hits = (data ?? []) as Hit[];
  const snippets = hits.map((h, i) => ({
    ref: `M${i + 1}`,
    thread_id: h.thread_id,
    subject: h.subject,
    author: h.author,
    date: new Date(h.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }),
    body: h.body.slice(0, 1500),
  }));
  try {
    const result = await askMail(q, snippets);
    if (!result) return { ok: false, error: "Zefiro non è riuscito a rispondere. Prova con altre parole." };
    const threads: Record<string, { thread_id: string; subject: string }> = {};
    for (const s of snippets) threads[s.ref] = { thread_id: s.thread_id, subject: s.subject };
    return { ok: true, result, threads };
  } catch (e) {
    console.error("[mail ai]", (e as Error).message);
    return { ok: false, error: "Zefiro non è disponibile in questo momento." };
  }
}

async function transcriptOf(threadId: string): Promise<{ subject: string; text: string } | null> {
  const supabase = await createClient();
  const [{ data: t }, { data: msgs }] = await Promise.all([
    supabase.from("mail_threads").select("subject").eq("id", threadId).maybeSingle(),
    supabase.from("mail_messages").select("author_id, kind, body, created_at").eq("thread_id", threadId).eq("draft", false).order("created_at", { ascending: true }).limit(200),
  ]);
  if (!t) return null;
  const list = (msgs ?? []) as { author_id: string | null; kind: string; body: string; created_at: string }[];
  const ids = [...new Set(list.map((m) => m.author_id).filter(Boolean))] as string[];
  const { data: names } = ids.length ? await supabase.from("profiles").select("id, agency_name, full_name").in("id", ids) : { data: [] };
  const nameOf = new Map(((names ?? []) as { id: string; agency_name: string | null; full_name: string | null }[]).map((p) => [p.id, p.agency_name || p.full_name || "Partner"]));
  let text = list
    .map((m) => `[${new Date(m.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })}] ${nameOf.get(m.author_id ?? "") ?? "Grand Route"}${m.kind === "evento" ? " (evento)" : ""}: ${m.body}`)
    .join("\n\n");
  if (text.length > 40000) text = `…\n${text.slice(-40000)}`;
  return { subject: (t as { subject: string }).subject, text };
}

export async function summarizeWithZefiro(threadId: string): Promise<MailResult<{ summary: MailSummary }>> {
  if (!UUID.test(threadId)) return { ok: false, error: "Conversazione non trovata." };
  const quota = await reserveAiCall("mail");
  if (!quota.ok) return { ok: false, error: quota.error };
  const tr = await transcriptOf(threadId);
  if (!tr) return { ok: false, error: "Conversazione non trovata." };
  try {
    const summary = await summarizeThread(tr.subject, tr.text);
    return summary ? { ok: true, summary } : { ok: false, error: "Zefiro non è riuscito a riassumere." };
  } catch {
    return { ok: false, error: "Zefiro non è disponibile in questo momento." };
  }
}

export async function draftReplyWithZefiro(threadId: string, hint: string): Promise<MailResult<{ text: string }>> {
  if (!UUID.test(threadId)) return { ok: false, error: "Conversazione non trovata." };
  const quota = await reserveAiCall("mail");
  if (!quota.ok) return { ok: false, error: quota.error };
  const tr = await transcriptOf(threadId);
  if (!tr) return { ok: false, error: "Conversazione non trovata." };
  try {
    const text = await draftReply(tr.subject, tr.text, (await myName()) || "me", hint.slice(0, 500));
    return text ? { ok: true, text } : { ok: false, error: "Zefiro non è riuscito a scrivere la bozza." };
  } catch {
    return { ok: false, error: "Zefiro non è disponibile in questo momento." };
  }
}
