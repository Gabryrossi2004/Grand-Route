import { notFound, redirect } from "next/navigation";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import ThreadView from "@/components/mail/ThreadView";
import type { MailAttachment, MailMessage } from "@/lib/mail/shared";
import type { OrderPartner, OrderRow } from "@/lib/orders/shared";

// Una conversazione: messaggi, eventi dell'ordine, allegati. Aprendola si segna come letta.
export default async function ThreadPage({ id, base, invoiceBase }: { id: string; base: string; invoiceBase: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCachedUser();
  if (!user) redirect(`/professionisti?next=${base}/${id}`);
  const supabase = await createClient();
  const { data: t } = await supabase.from("mail_threads").select("id, subject, kind, order_id").eq("id", id).maybeSingle();
  const thread = t as { id: string; subject: string; kind: string; order_id: string | null } | null;
  if (!thread) notFound();

  const [{ data: parts }, { data: msgs }, { data: atts }, { data: partners }, orderRows] = await Promise.all([
    supabase.from("mail_participants").select("user_id, starred, archived").eq("thread_id", id),
    supabase.from("mail_messages").select("id, author_id, kind, body, created_at, draft").eq("thread_id", id).eq("draft", false).order("created_at", { ascending: true }).limit(2000),
    supabase.from("mail_attachments").select("id, message_id, path, name, size_bytes, mime").eq("thread_id", id),
    supabase.rpc("network_order_partners"),
    thread.order_id ? supabase.rpc("network_orders_list", { p_role: "all" }) : Promise.resolve({ data: null }),
  ]);
  const participants = (parts ?? []) as { user_id: string; starred: boolean; archived: boolean }[];
  const mine = participants.find((p) => p.user_id === user.id);

  // Nomi dei partecipanti (anche chi ha scritto e poi è uscito)
  const ids = [...new Set([...participants.map((p) => p.user_id), ...((msgs ?? []) as MailMessage[]).map((m) => m.author_id).filter(Boolean)])] as string[];
  const [{ data: profs }, { data: nps }] = await Promise.all([
    supabase.from("profiles").select("id, agency_name, full_name").in("id", ids),
    supabase.from("network_profiles").select("user_id, business_name").in("user_id", ids),
  ]);
  const npName = new Map(((nps ?? []) as { user_id: string; business_name: string }[]).map((n) => [n.user_id, n.business_name]));
  const people = ((profs ?? []) as { id: string; agency_name: string | null; full_name: string | null }[]).map((p) => ({ id: p.id, name: npName.get(p.id) || p.agency_name || p.full_name || "Partner" }));

  // Anteprime delle foto allegate
  const attachments = (atts ?? []) as MailAttachment[];
  const images = attachments.filter((a) => (a.mime ?? "").startsWith("image/")).slice(0, 60);
  const thumbs: Record<string, string> = {};
  if (images.length) {
    const { data: signed } = await supabase.storage.from("mail-files").createSignedUrls(images.map((a) => a.path), 3600);
    for (const s of signed ?? []) {
      const a = images.find((x) => x.path === s.path);
      if (a && s.signedUrl) thumbs[a.id] = s.signedUrl;
    }
  }

  // Si segna come letta aprendola
  await supabase.rpc("mail_set_state", { p_thread: id, p_read: true, p_starred: null, p_archived: null });

  const order = thread.order_id ? (((orderRows as { data: OrderRow[] | null }).data ?? []) as OrderRow[]).find((o) => o.id === thread.order_id) ?? null : null;
  return (
    <ThreadView
      base={base}
      me={user.id}
      thread={{ id: thread.id, subject: thread.subject, kind: thread.kind, starred: !!mine?.starred, archived: !!mine?.archived }}
      people={people}
      messages={(msgs ?? []) as MailMessage[]}
      attachments={attachments}
      thumbs={thumbs}
      order={order}
      partners={(partners ?? []) as OrderPartner[]}
      invoiceBase={invoiceBase}
    />
  );
}
