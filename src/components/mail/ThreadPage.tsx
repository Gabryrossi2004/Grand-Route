import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNetworkUser, getTeamContext, getTeamPeople } from "@/lib/team";
import ThreadView, { type ThreadTeam } from "@/components/mail/ThreadView";
import type { MailAttachment, MailMessage } from "@/lib/mail/shared";
import type { OrderPartner, OrderRow } from "@/lib/orders/shared";

// Una conversazione: messaggi, eventi dell'ordine, allegati. Aprendola si segna come letta.
export default async function ThreadPage({ id, base, invoiceBase }: { id: string; base: string; invoiceBase: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getNetworkUser();
  if (!user) redirect(`/professionisti?next=${base}/${id}`);
  const supabase = await createClient();
  const { data: t } = await supabase.from("mail_threads").select("id, subject, kind, order_id").eq("id", id).maybeSingle();
  const thread = t as { id: string; subject: string; kind: string; order_id: string | null } | null;
  if (!thread) notFound();

  // Prima della migrazione 0077 alcune colonne e tabelle non ci sono: si ripiega sullo stato per azienda
  const loadMessages = async () => {
    const q = (cols: string) => supabase.from("mail_messages").select(cols).eq("thread_id", id).eq("draft", false).order("created_at", { ascending: true }).limit(2000);
    const r = await q("id, author_id, author_person, kind, body, created_at, draft");
    return r.error ? q("id, author_id, kind, body, created_at, draft") : r;
  };
  const [{ data: parts }, { data: msgs }, { data: atts }, { data: partners }, orderRows, personState, assignment, authorRows, team, teamPeople] = await Promise.all([
    supabase.from("mail_participants").select("user_id, starred, archived").eq("thread_id", id),
    loadMessages(),
    supabase.from("mail_attachments").select("id, message_id, path, name, size_bytes, mime").eq("thread_id", id),
    supabase.rpc("network_order_partners"),
    thread.order_id ? supabase.rpc("network_orders_list", { p_role: "all" }) : Promise.resolve({ data: null }),
    supabase.from("mail_person_state").select("starred, archived").eq("thread_id", id).eq("user_id", user.personId).maybeSingle(),
    supabase.from("mail_assignments").select("assignee_id, private, handoff_note, handoff_by, handoff_at").eq("thread_id", id).eq("company_id", user.id).maybeSingle(),
    supabase.rpc("mail_people", { p_thread: id }),
    getTeamContext(),
    getTeamPeople(),
  ]);
  const participants = (parts ?? []) as { user_id: string; starred: boolean; archived: boolean }[];
  const teamReady = !personState.error;
  const mine = teamReady
    ? ((personState.data as { starred: boolean; archived: boolean } | null) ?? { starred: false, archived: false })
    : participants.find((p) => p.user_id === user.id);
  const messages = ((msgs ?? []) as unknown as MailMessage[]);

  // Nomi dei partecipanti (anche chi ha scritto e poi è uscito)
  const ids = [...new Set([...participants.map((p) => p.user_id), ...messages.map((m) => m.author_id).filter(Boolean)])] as string[];
  const [{ data: profs }, { data: nps }] = await Promise.all([
    supabase.from("profiles").select("id, agency_name, full_name").in("id", ids),
    supabase.from("network_profiles").select("user_id, business_name").in("user_id", ids),
  ]);
  const npName = new Map(((nps ?? []) as { user_id: string; business_name: string }[]).map((n) => [n.user_id, n.business_name]));
  const people = ((profs ?? []) as { id: string; agency_name: string | null; full_name: string | null }[]).map((p) => ({ id: p.id, name: npName.get(p.id) || p.agency_name || p.full_name || "Partner" }));
  // Chi ha scritto, persona per persona («Mario Rossi»), anche per gli altri partner
  const authors: Record<string, string> = {};
  for (const a of ((authorRows.data ?? []) as { person_id: string; company_id: string; name: string; company: string }[])) {
    if (a.person_id) authors[a.person_id] = a.company_id === user.id || a.name === a.company ? a.name : `${a.name} · ${a.company}`;
  }

  // Posta del team: chi la segue, nota di passaggio, privata (solo se ci sono colleghi)
  let teamInfo: ThreadTeam | null = null;
  if (teamReady && team && teamPeople.length > 1) {
    const a = assignment.data as { assignee_id: string | null; private: boolean; handoff_note: string | null; handoff_by: string | null; handoff_at: string | null } | null;
    const nameOf = (pid: string | null) => teamPeople.find((p) => p.id === pid)?.name ?? null;
    teamInfo = {
      people: teamPeople.map((p) => ({ id: p.id, name: p.name })),
      assigneeId: a?.assignee_id ?? null,
      isPrivate: !!a?.private,
      handoff: a?.handoff_by && a.assignee_id === user.personId && a.handoff_by !== user.personId
        ? { by: nameOf(a.handoff_by) ?? "Un collega", note: a.handoff_note, at: a.handoff_at }
        : null,
      isTitolare: team.isTitolare,
    };
  }

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
      mePerson={user.personId}
      thread={{ id: thread.id, subject: thread.subject, kind: thread.kind, starred: !!mine?.starred, archived: !!mine?.archived }}
      people={people}
      authors={authors}
      team={teamInfo}
      messages={messages}
      attachments={attachments}
      thumbs={thumbs}
      order={order}
      partners={(partners ?? []) as OrderPartner[]}
      invoiceBase={invoiceBase}
    />
  );
}
