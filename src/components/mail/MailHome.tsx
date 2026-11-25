import Link from "next/link";
import { redirect } from "next/navigation";
import { Paperclip, PenSquare, Search, Star } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import ZefiroMailPanel from "@/components/mail/ZefiroMailPanel";
import { FOLDERS, isFolder, mailDate, type ThreadRow } from "@/lib/mail/shared";

// Posta: cartelle, ricerca, elenco delle conversazioni (come una casella email)
export default async function MailHome({ base, cartella, q, pagina }: { base: string; cartella?: string; q?: string; pagina?: string }) {
  const user = await getCachedUser();
  if (!user) redirect(`/login?next=${base}`);
  const folder = isFolder(cartella) ? cartella : "inbox";
  const query = (q ?? "").trim().slice(0, 100);
  const page = Math.max(0, Number(pagina) || 0);
  const PAGE = 50;
  const supabase = await createClient();
  const [{ data, error }, { data: unread }] = await Promise.all([
    supabase.rpc("mail_list", { p_folder: query ? "all" : folder, p_query: query || null, p_limit: PAGE + 1, p_offset: page * PAGE }),
    supabase.rpc("mail_unread_count"),
  ]);
  if (error) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Per la posta serve l&apos;aggiornamento del database (migrazione 0067, in Supabase → SQL Editor).</p>;
  const rows = ((data ?? []) as ThreadRow[]).slice(0, PAGE);
  const more = (data ?? []).length > PAGE;
  const unreadCount = typeof unread === "number" ? unread : 0;
  const href = (f: string, p = 0) => `${base}?cartella=${f}${p ? `&pagina=${p}` : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl text-[#233c5e]">Posta</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ZefiroMailPanel base={base} />
          <Link href={`${base}/nuovo`} className="inline-flex items-center gap-2 rounded-full bg-[#233c5e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#17283f]">
            <PenSquare size={16} /> Scrivi
          </Link>
        </div>
      </div>
      <form className="mt-4 flex gap-2" action={base}>
        <input type="hidden" name="cartella" value={folder} />
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={query} placeholder="Cerca per oggetto, testo, allegato o partner" className="w-full rounded-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#cda876]" />
        </div>
        <button className="rounded-full border border-[#e6d7bb] bg-white px-4 text-sm font-medium text-[#233c5e]">Cerca</button>
      </form>
      <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Cartelle">
        {FOLDERS.map((f) => (
          <Link key={f.id} href={href(f.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${!query && folder === f.id ? "bg-[#233c5e] text-white" : "border border-[#e6d7bb] bg-white text-[#233c5e]"}`}>
            {f.label}
            {f.id === "inbox" && unreadCount > 0 && <span className="ml-1.5 rounded-full bg-[#c0392b] px-1.5 text-[11px] font-semibold text-white">{unreadCount}</span>}
          </Link>
        ))}
      </nav>
      {query && <p className="mt-3 text-sm text-slate-600">Risultati per «{query}» in tutte le cartelle · <Link href={href(folder)} className="underline">togli la ricerca</Link></p>}

      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#e6d7bb] bg-white/70 p-8 text-center text-slate-600">
          {query ? "Nessuna conversazione trovata." : folder === "inbox" ? "Nessun messaggio in arrivo. Le richieste di servizio e le risposte dei partner arrivano qui." : "Nessuna conversazione in questa cartella."}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[#f2e2c4] overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white">
          {rows.map((r) => {
            const names = (r.participants ?? []).map((p) => p.name).join(", ") || "Solo tu";
            return (
              <li key={r.thread_id}>
                <Link href={`${base}/${r.thread_id}`} className={`flex gap-3 px-4 py-3 hover:bg-[#fffaf0] ${r.unread ? "bg-[#fffdf7]" : ""}`}>
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${r.unread ? "bg-[#c58f2d]" : "bg-transparent"}`} aria-label={r.unread ? "Non letto" : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${r.unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                        {names}
                        {r.messages_count > 1 && <span className="ml-1 font-normal text-slate-400">({r.messages_count})</span>}
                      </span>
                      <span className={`shrink-0 text-xs ${r.unread ? "font-semibold text-slate-800" : "text-slate-500"}`}>{mailDate(r.last_message_at)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {r.order_id && <span className="shrink-0 rounded bg-[#faf3e6] px-1.5 text-[11px] font-semibold uppercase text-[#8a5a12]">Ordine</span>}
                      <span className={`truncate text-sm ${r.unread ? "font-semibold text-[#233c5e]" : "text-[#233c5e]"}`}>{r.subject}</span>
                      {r.has_attachments && <Paperclip size={13} className="shrink-0 text-slate-400" />}
                      {r.starred && <Star size={13} className="shrink-0 fill-[#c58f2d] text-[#c58f2d]" />}
                    </span>
                    <span className="block truncate text-sm text-slate-500">{r.last_author ? `${r.last_author}: ` : ""}{r.last_snippet}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(page > 0 || more) && (
        <div className="mt-3 flex justify-between text-sm">
          {page > 0 ? <Link href={href(folder, page - 1)} className="underline">← Più recenti</Link> : <span />}
          {more && <Link href={href(folder, page + 1)} className="underline">Meno recenti →</Link>}
        </div>
      )}
    </div>
  );
}
