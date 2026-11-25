-- 0067 — Posta di Grand Route: conversazioni tra partner come le email (oggetto, più destinatari, storico, allegati,
-- letti/non letti, stella, archivio, ricerca). Ogni ordine di servizio ha la sua conversazione: la richiesta parte da qui
-- e conferme, modifiche, variazioni e fatture vi compaiono come eventi.
-- Serve aver eseguito prima 0065 e 0066.

-- ============================================================
-- 1. Tabelle
-- ============================================================
create table if not exists public.mail_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 1 and 200),
  kind text not null default 'messaggio' check (kind in ('messaggio', 'richiesta')),
  order_id uuid references public.network_orders (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create unique index if not exists mail_threads_order_idx on public.mail_threads (order_id) where order_id is not null;

create table if not exists public.mail_participants (
  thread_id uuid not null references public.mail_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  archived boolean not null default false,
  starred boolean not null default false,
  last_notified_at timestamptz,
  added_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists mail_participants_user_idx on public.mail_participants (user_id);

create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mail_threads (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'messaggio' check (kind in ('messaggio', 'evento')),
  body text not null check (char_length(body) <= 50000),
  draft boolean not null default false,              -- in invio (allegati in caricamento): la vede solo chi scrive
  created_at timestamptz not null default now()
);
create index if not exists mail_messages_thread_idx on public.mail_messages (thread_id, created_at);

create table if not exists public.mail_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.mail_messages (id) on delete cascade,
  thread_id uuid not null references public.mail_threads (id) on delete cascade,
  path text not null check (char_length(path) <= 400),
  name text not null check (char_length(name) between 1 and 200),
  size_bytes integer,
  mime text,
  created_at timestamptz not null default now()
);
create index if not exists mail_attachments_message_idx on public.mail_attachments (message_id);

create or replace function public.mail_is_participant(p_thread uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.mail_participants where thread_id = p_thread and user_id = auth.uid());
$$;

alter table public.mail_threads enable row level security;
alter table public.mail_participants enable row level security;
alter table public.mail_messages enable row level security;
alter table public.mail_attachments enable row level security;
drop policy if exists "mail_threads_select" on public.mail_threads;
create policy "mail_threads_select" on public.mail_threads for select to authenticated using (public.mail_is_participant(id));
drop policy if exists "mail_participants_select" on public.mail_participants;
create policy "mail_participants_select" on public.mail_participants for select to authenticated using (public.mail_is_participant(thread_id));
drop policy if exists "mail_messages_select" on public.mail_messages;
create policy "mail_messages_select" on public.mail_messages for select to authenticated
  using (public.mail_is_participant(thread_id) and (not draft or author_id = auth.uid()));
drop policy if exists "mail_attachments_select" on public.mail_attachments;
create policy "mail_attachments_select" on public.mail_attachments for select to authenticated
  using (public.mail_is_participant(thread_id) and exists (select 1 from public.mail_messages m where m.id = message_id and (not m.draft or m.author_id = auth.uid())));

-- Allegati: cartella privata, un file al massimo di 25 MB; li vede solo chi partecipa alla conversazione
insert into storage.buckets (id, name, public, file_size_limit)
values ('mail-files', 'mail-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.mail_is_thread_folder(p_folder text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_folder ~ '^[0-9a-f-]{36}$' and public.mail_is_participant(p_folder::uuid);
$$;

drop policy if exists "mail_files_read" on storage.objects;
create policy "mail_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'mail-files' and public.mail_is_thread_folder((storage.foldername(name))[1]));
drop policy if exists "mail_files_write" on storage.objects;
create policy "mail_files_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'mail-files' and public.mail_is_thread_folder((storage.foldername(name))[1]));
drop policy if exists "mail_files_delete" on storage.objects;
create policy "mail_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'mail-files' and owner = auth.uid());

-- ============================================================
-- 2. Scrivere: si apre il messaggio (anche una nuova conversazione), si caricano gli allegati, si invia
-- ============================================================
create or replace function public.mail_start(p_thread uuid, p_subject text, p_recipients uuid[], p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_thread uuid := p_thread;
  v_msg uuid;
  r uuid;
begin
  if v_uid is null or not public.network_has_access(v_uid) then raise exception 'Serve un accesso attivo alla Rete.'; end if;
  if char_length(coalesce(p_body, '')) > 50000 then raise exception 'Il messaggio è troppo lungo.'; end if;
  if (select count(*) from public.mail_messages where author_id = v_uid and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Troppi messaggi in un''ora: riprova più tardi.';
  end if;
  if v_thread is null then
    if coalesce(array_length(p_recipients, 1), 0) = 0 then raise exception 'Scegli almeno un destinatario.'; end if;
    if array_length(p_recipients, 1) > 20 then raise exception 'Al massimo 20 destinatari.'; end if;
    foreach r in array p_recipients loop
      if r = v_uid or not public.network_are_partners(v_uid, r) then raise exception 'Puoi scrivere solo ai tuoi partner.'; end if;
    end loop;
    insert into public.mail_threads (subject, created_by) values (left(trim(coalesce(nullif(p_subject, ''), '(senza oggetto)')), 200), v_uid)
    returning id into v_thread;
    insert into public.mail_participants (thread_id, user_id, last_read_at) values (v_thread, v_uid, now());
    insert into public.mail_participants (thread_id, user_id)
    select v_thread, x from (select distinct unnest(p_recipients) as x) s where x <> v_uid;
  elsif not public.mail_is_participant(v_thread) then
    raise exception 'Conversazione non trovata.';
  end if;
  insert into public.mail_messages (thread_id, author_id, body, draft) values (v_thread, v_uid, coalesce(p_body, ''), true)
  returning id into v_msg;
  return jsonb_build_object('thread_id', v_thread, 'message_id', v_msg);
end;
$$;

create or replace function public.mail_finish(p_message uuid, p_files jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mail_messages%rowtype;
  f jsonb;
begin
  select * into m from public.mail_messages where id = p_message and author_id = auth.uid() and draft for update;
  if not found then raise exception 'Messaggio non trovato.'; end if;
  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_files, '[]'::jsonb)) > 20 then raise exception 'Troppi allegati (massimo 20).'; end if;
  if char_length(trim(m.body)) = 0 and jsonb_array_length(coalesce(p_files, '[]'::jsonb)) = 0 then raise exception 'Scrivi un messaggio o allega un file.'; end if;
  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    if (f ->> 'path') not like m.thread_id::text || '/%' then raise exception 'Allegato non valido.'; end if;
    insert into public.mail_attachments (message_id, thread_id, path, name, size_bytes, mime)
    values (m.id, m.thread_id, f ->> 'path', left(coalesce(nullif(f ->> 'name', ''), 'allegato'), 200), nullif(f ->> 'size', '')::int, left(f ->> 'mime', 100));
  end loop;
  update public.mail_messages set draft = false, created_at = now() where id = m.id;
  update public.mail_threads set last_message_at = now() where id = m.thread_id;
  -- come nelle email: un nuovo messaggio riporta la conversazione in arrivo per tutti
  update public.mail_participants set archived = false where thread_id = m.thread_id;
  update public.mail_participants set last_read_at = now() where thread_id = m.thread_id and user_id = auth.uid();
  return m.thread_id;
end;
$$;

-- Un messaggio rimasto in invio (es. caricamento interrotto) si può togliere
create or replace function public.mail_discard(p_message uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.mail_messages where id = p_message and author_id = auth.uid() and draft;
$$;

-- Aggiungere un partner a una conversazione (vede anche i messaggi precedenti, come in un inoltro con storico)
create or replace function public.mail_add_participant(p_thread uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mail_is_participant(p_thread) then raise exception 'Conversazione non trovata.'; end if;
  if not public.network_are_partners(auth.uid(), p_user) then raise exception 'Puoi aggiungere solo i tuoi partner.'; end if;
  if (select count(*) from public.mail_participants where thread_id = p_thread) >= 25 then raise exception 'Troppi partecipanti.'; end if;
  insert into public.mail_participants (thread_id, user_id) values (p_thread, p_user) on conflict do nothing;
  insert into public.mail_messages (thread_id, author_id, kind, body)
  select p_thread, auth.uid(), 'evento', 'Ha aggiunto ' || coalesce(np.business_name, p.agency_name, p.full_name, 'un partner') || ' alla conversazione.'
  from public.profiles p left join public.network_profiles np on np.user_id = p.id where p.id = p_user;
end;
$$;

-- Letto / non letto, stella, archivio (solo per sé)
create or replace function public.mail_set_state(p_thread uuid, p_read boolean, p_starred boolean, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mail_participants set
    last_read_at = case when p_read is null then last_read_at when p_read then now() else null end,
    starred = coalesce(p_starred, starred),
    archived = coalesce(p_archived, archived)
  where thread_id = p_thread and user_id = auth.uid();
  if not found then raise exception 'Conversazione non trovata.'; end if;
end;
$$;

-- ============================================================
-- 3. Conversazione di un ordine: si apre con la richiesta, poi gli eventi
-- ============================================================
create or replace function public.mail_order_thread(p_order uuid, p_subject text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.network_orders%rowtype;
  v_thread uuid;
begin
  select * into o from public.network_orders where id = p_order and (seller_id = auth.uid() or buyer_id = auth.uid());
  if not found then raise exception 'Ordine non trovato.'; end if;
  select id into v_thread from public.mail_threads where order_id = p_order;
  if v_thread is not null then
    insert into public.mail_participants (thread_id, user_id) values (v_thread, o.seller_id), (v_thread, o.buyer_id) on conflict do nothing;
    return v_thread;
  end if;
  insert into public.mail_threads (subject, kind, order_id, created_by)
  values (left(trim(coalesce(nullif(p_subject, ''), o.title)), 200), 'richiesta', p_order, auth.uid())
  returning id into v_thread;
  insert into public.mail_participants (thread_id, user_id, last_read_at)
  values (v_thread, o.seller_id, case when o.seller_id = auth.uid() then now() end),
         (v_thread, o.buyer_id, case when o.buyer_id = auth.uid() then now() end);
  if char_length(trim(coalesce(p_body, ''))) > 0 then
    insert into public.mail_messages (thread_id, author_id, body) values (v_thread, auth.uid(), left(p_body, 50000));
  end if;
  return v_thread;
end;
$$;

-- Evento nella conversazione dell'ordine (conferma, modifica, variazione, annullamento, fattura…)
create or replace function public.mail_order_event(p_order uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread uuid;
begin
  if not exists (select 1 from public.network_orders where id = p_order and (seller_id = auth.uid() or buyer_id = auth.uid())) then return; end if;
  select id into v_thread from public.mail_threads where order_id = p_order;
  if v_thread is null then return; end if;
  insert into public.mail_messages (thread_id, author_id, kind, body) values (v_thread, auth.uid(), 'evento', left(coalesce(p_text, ''), 2000));
  update public.mail_threads set last_message_at = now() where id = v_thread;
  update public.mail_participants set archived = false where thread_id = v_thread;
  update public.mail_participants set last_read_at = now() where thread_id = v_thread and user_id = auth.uid();
end;
$$;

-- ============================================================
-- 4. Leggere: elenco con cartelle e ricerca, contatore, ricerca nei messaggi (per Zefiro)
-- ============================================================
create or replace function public.mail_list(p_folder text, p_query text, p_limit integer, p_offset integer)
returns table (
  thread_id uuid, subject text, kind text, order_id uuid, last_message_at timestamptz, unread boolean, starred boolean, archived boolean,
  participants jsonb, last_author text, last_snippet text, has_attachments boolean, messages_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  with mine as (
    select t.*, p.last_read_at, p.starred, p.archived
    from public.mail_threads t
    join public.mail_participants p on p.thread_id = t.id and p.user_id = auth.uid()
  )
  select m.id, m.subject, m.kind, m.order_id, m.last_message_at,
         exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft and x.author_id is distinct from auth.uid()
                 and x.created_at > coalesce(m.last_read_at, '-infinity'::timestamptz)),
         m.starred, m.archived,
         (select jsonb_agg(jsonb_build_object('id', pp.user_id, 'name', coalesce(np.business_name, pr.agency_name, pr.full_name, 'Professionista')) order by pp.added_at)
            from public.mail_participants pp join public.profiles pr on pr.id = pp.user_id left join public.network_profiles np on np.user_id = pp.user_id
            where pp.thread_id = m.id and pp.user_id <> auth.uid()),
         (select coalesce(np.business_name, pr.agency_name, pr.full_name, '') from public.mail_messages x
            left join public.profiles pr on pr.id = x.author_id left join public.network_profiles np on np.user_id = x.author_id
            where x.thread_id = m.id and not x.draft order by x.created_at desc limit 1),
         (select left(regexp_replace(x.body, '\s+', ' ', 'g'), 160) from public.mail_messages x
            where x.thread_id = m.id and not x.draft order by x.created_at desc limit 1),
         exists (select 1 from public.mail_attachments a join public.mail_messages x on x.id = a.message_id where a.thread_id = m.id and not x.draft),
         (select count(*)::int from public.mail_messages x where x.thread_id = m.id and not x.draft)
  from mine m
  where (
      (p_folder = 'inbox' and not m.archived and exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft and x.author_id is distinct from auth.uid()))
   or (p_folder = 'sent' and exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft and x.author_id = auth.uid() and x.kind = 'messaggio'))
   or (p_folder = 'starred' and m.starred)
   or (p_folder = 'archived' and m.archived)
   or (p_folder = 'orders' and m.order_id is not null and not m.archived)
   or (p_folder = 'all')
  )
  and (
    p_query is null or p_query = ''
    or m.subject ilike '%' || p_query || '%'
    or exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft and x.body ilike '%' || p_query || '%')
    or exists (select 1 from public.mail_attachments a where a.thread_id = m.id and a.name ilike '%' || p_query || '%')
    or exists (select 1 from public.mail_participants pp join public.profiles pr on pr.id = pp.user_id left join public.network_profiles np on np.user_id = pp.user_id
               where pp.thread_id = m.id and pp.user_id <> auth.uid() and coalesce(np.business_name, pr.agency_name, pr.full_name, '') ilike '%' || p_query || '%')
  )
  and exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft)
  order by m.last_message_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.mail_unread_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.mail_participants p
  where p.user_id = auth.uid() and not p.archived
    and exists (select 1 from public.mail_messages x where x.thread_id = p.thread_id and not x.draft and x.author_id is distinct from auth.uid()
                and x.created_at > coalesce(p.last_read_at, '-infinity'::timestamptz));
$$;

-- Messaggi che contengono le parole cercate (tutte le conversazioni dell'utente), per la ricerca con Zefiro
create or replace function public.mail_search_messages(p_words text[], p_limit integer)
returns table (message_id uuid, thread_id uuid, subject text, author text, created_at timestamptz, body text, hits integer)
language sql
security definer
set search_path = public
stable
as $$
  select x.id, t.id, t.subject, coalesce(np.business_name, pr.agency_name, pr.full_name, 'Grand Route'), x.created_at, left(x.body, 3000),
         (select count(*)::int from unnest(p_words) w where x.body ilike '%' || w || '%' or t.subject ilike '%' || w || '%') as hits
  from public.mail_messages x
  join public.mail_threads t on t.id = x.thread_id
  join public.mail_participants me on me.thread_id = t.id and me.user_id = auth.uid()
  left join public.profiles pr on pr.id = x.author_id
  left join public.network_profiles np on np.user_id = x.author_id
  where not x.draft
    and (coalesce(array_length(p_words, 1), 0) = 0
         or exists (select 1 from unnest(p_words) w where x.body ilike '%' || w || '%' or t.subject ilike '%' || w || '%'))
  order by hits desc, x.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 80);
$$;

-- Destinatari da avvisare di un messaggio appena inviato: push sempre, email al massimo ogni 10 minuti per conversazione
create or replace function public.mail_notify_targets(p_message uuid)
returns table (user_id uuid, email text, send_email boolean, endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mail_messages%rowtype;
begin
  select * into m from public.mail_messages where id = p_message and author_id = auth.uid() and not draft;
  if not found then return; end if;
  return query
  with recipients as (
    select p.user_id, pr.email, (p.last_notified_at is null or p.last_notified_at < now() - interval '10 minutes') as mail_ok
    from public.mail_participants p join public.profiles pr on pr.id = p.user_id
    where p.thread_id = m.thread_id and p.user_id <> auth.uid()
  ), upd as (
    update public.mail_participants p set last_notified_at = now()
    from recipients r where p.thread_id = m.thread_id and p.user_id = r.user_id and r.mail_ok
    returning p.user_id
  )
  select r.user_id, r.email, r.mail_ok and r.email not like '%@demo.grandroute.invalid', ps.endpoint, ps.p256dh, ps.auth
  from recipients r left join public.push_subscriptions ps on ps.profile_id = r.user_id;
end;
$$;

-- ============================================================
-- 5. Permessi
-- ============================================================
revoke all on function public.mail_is_participant(uuid) from public, anon;
revoke all on function public.mail_is_thread_folder(text) from public, anon;
revoke all on function public.mail_start(uuid, text, uuid[], text) from public, anon;
revoke all on function public.mail_finish(uuid, jsonb) from public, anon;
revoke all on function public.mail_discard(uuid) from public, anon;
revoke all on function public.mail_add_participant(uuid, uuid) from public, anon;
revoke all on function public.mail_set_state(uuid, boolean, boolean, boolean) from public, anon;
revoke all on function public.mail_order_thread(uuid, text, text) from public, anon;
revoke all on function public.mail_order_event(uuid, text) from public, anon;
revoke all on function public.mail_list(text, text, integer, integer) from public, anon;
revoke all on function public.mail_unread_count() from public, anon;
revoke all on function public.mail_search_messages(text[], integer) from public, anon;
revoke all on function public.mail_notify_targets(uuid) from public, anon;
grant execute on function public.mail_is_participant(uuid) to authenticated;
grant execute on function public.mail_is_thread_folder(text) to authenticated;
grant execute on function public.mail_start(uuid, text, uuid[], text) to authenticated;
grant execute on function public.mail_finish(uuid, jsonb) to authenticated;
grant execute on function public.mail_discard(uuid) to authenticated;
grant execute on function public.mail_add_participant(uuid, uuid) to authenticated;
grant execute on function public.mail_set_state(uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.mail_order_thread(uuid, text, text) to authenticated;
grant execute on function public.mail_order_event(uuid, text) to authenticated;
grant execute on function public.mail_list(text, text, integer, integer) to authenticated;
grant execute on function public.mail_unread_count() to authenticated;
grant execute on function public.mail_search_messages(text[], integer) to authenticated;
grant execute on function public.mail_notify_targets(uuid) to authenticated;

-- ============================================================
-- 6. Profili di prova: le conversazioni degli ordini di prova
-- ============================================================
create or replace function public.demo_apply_mail(p_admin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  v_thread uuid;
  v_driver uuid;
begin
  if p_admin is null then return; end if;
  select id into v_driver from public.profiles where email = 'demo-autista-sicilia@demo.grandroute.invalid';
  for o in
    select n.* from public.network_orders n
    join public.profiles s on s.id = n.seller_id join public.profiles b on b.id = n.buyer_id
    where (n.seller_id = p_admin or n.buyer_id = p_admin)
      and (s.email like '%@demo.grandroute.invalid' or b.email like '%@demo.grandroute.invalid')
      and not exists (select 1 from public.mail_threads t where t.order_id = n.id)
  loop
    insert into public.mail_threads (subject, kind, order_id, created_by, created_at, last_message_at)
    values (upper('Richiesta servizio - ' || to_char(o.service_date, 'DD') || ' ' ||
              (array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'])[extract(month from o.service_date)::int]
              || coalesce(' - ' || split_part(coalesce(o.lead_name, ''), ' ', 2), '') || coalesce(' x' || o.pax, '')),
            'richiesta', o.id, o.created_by, o.created_at, o.created_at)
    returning id into v_thread;
    insert into public.mail_participants (thread_id, user_id, last_read_at)
    values (v_thread, o.seller_id, case when o.seller_id = p_admin then null else now() end),
           (v_thread, o.buyer_id, case when o.buyer_id = p_admin then null else now() end);
    insert into public.mail_messages (thread_id, author_id, body, created_at)
    values (v_thread, o.created_by,
      'Buongiorno,' || chr(10) || 'vi scrivo per richiedere il seguente servizio:' || chr(10) || chr(10) ||
      upper(o.title) || chr(10) ||
      coalesce(upper(o.lead_name) || coalesce(' (' || o.pax || ' PAX)', '') || chr(10), '') ||
      'DATA: ' || to_char(o.service_date, 'DD/MM/YYYY') || coalesce(' ORE ' || to_char(o.start_time, 'HH24:MI'), '') || chr(10) ||
      coalesce('LUOGO: ' || upper(o.place) || chr(10), '') ||
      'TARIFFA: ' || to_char(o.quantity * o.unit_price, 'FM999G990D00') || ' € + IVA' || chr(10) || chr(10) ||
      'Attendo una vostra cortese conferma.' || chr(10) || 'Saluti',
      o.created_at);
    if o.confirmed_at is not null then
      insert into public.mail_messages (thread_id, author_id, kind, body, created_at)
      values (v_thread, case when o.created_by = o.seller_id then o.buyer_id else o.seller_id end, 'evento', 'Ha confermato il servizio.', o.confirmed_at);
      insert into public.mail_messages (thread_id, author_id, body, created_at)
      values (v_thread, case when o.created_by = o.seller_id then o.buyer_id else o.seller_id end, 'Confermo con piacere il servizio richiesto.' || chr(10) || 'Cordiali saluti', o.confirmed_at + interval '1 minute');
    end if;
    if o.seller_id = v_driver and exists (select 1 from public.network_order_extras e where e.order_id = o.id) then
      insert into public.mail_messages (thread_id, author_id, kind, body, created_at)
      values (v_thread, v_driver, 'evento', 'Ha aggiunto una variazione: Ore di attesa extra per ritardo del volo (2 × 35,00 €).', now() - interval '11 days');
      insert into public.mail_messages (thread_id, author_id, body, created_at)
      values (v_thread, v_driver, 'Buongiorno, vi segnalo che i clienti sono usciti 1 ora e 45 minuti dopo l''atterraggio: abbiamo aggiunto 2 ore di attesa come da accordi. Resto a disposizione.', now() - interval '11 days' + interval '2 minutes');
    end if;
    update public.mail_threads set last_message_at = (select max(created_at) from public.mail_messages where thread_id = v_thread) where id = v_thread;
  end loop;
end;
$$;
revoke all on function public.demo_apply_mail(uuid) from public, anon, authenticated;

create or replace function public.admin_demo_create()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n int;
  v_admin uuid := auth.uid();
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  delete from public.suppliers where network_user_id in (select id from public.profiles where email like '%@demo.grandroute.invalid');
  delete from public.mail_threads where id in (
    select p.thread_id from public.mail_participants p join public.profiles pr on pr.id = p.user_id where pr.email like '%@demo.grandroute.invalid');
  n := public.admin_demo_create_base();
  perform public.demo_apply_media();
  if v_admin is not null then
    insert into public.network_collaborations (from_user, to_user, message)
    select p.id, v_admin, 'Buongiorno, lavoriamo con molte agenzie italiane e ci piacerebbe collaborare con voi: vi mandiamo volentieri cataloghi e condizioni riservate.'
    from public.profiles p where p.email = 'demo-to-orizzonti@demo.grandroute.invalid'
    on conflict do nothing;
    perform public.demo_apply_orders(v_admin);
    perform public.demo_apply_mail(v_admin);
  end if;
  return n;
end;
$$;
revoke all on function public.admin_demo_create() from public, anon;
grant execute on function public.admin_demo_create() to authenticated;

create or replace function public.admin_demo_remove()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n int;
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  delete from public.suppliers where network_user_id in (select id from public.profiles where email like '%@demo.grandroute.invalid');
  delete from public.mail_threads where id in (
    select p.thread_id from public.mail_participants p join public.profiles pr on pr.id = p.user_id where pr.email like '%@demo.grandroute.invalid');
  delete from auth.users where email like '%@demo.grandroute.invalid';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.admin_demo_remove() from public, anon;
grant execute on function public.admin_demo_remove() to authenticated;
