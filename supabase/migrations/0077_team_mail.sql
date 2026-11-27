-- Team, fase 2b: la posta del team.
-- Ogni conversazione ha, dentro l'azienda, una persona che la segue ("Lo segue").
--  * I titolari vedono tutte le conversazioni dell'azienda, tranne quelle private di un altro titolare.
--  * Gli altri colleghi vedono solo le conversazioni che seguono.
--  * Le conversazioni che nessuno segue stanno nella posta generale (la vedono i titolari).
--  * Letto / non letto, stella e archivio sono per persona.
--  * Si può passare una conversazione a un collega con una nota interna (il partner non la vede).
-- Richiede la 0075 (team) e la 0076 (posta e rete per azienda).

-- 1) Chi segue la conversazione, per ogni azienda partecipante (dato interno all'azienda)
create table if not exists public.mail_assignments (
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  company_id uuid not null references public.profiles(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  private boolean not null default false,
  handoff_note text,
  handoff_by uuid references public.profiles(id) on delete set null,
  handoff_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (thread_id, company_id)
);
create index if not exists mail_assignments_assignee_idx on public.mail_assignments (assignee_id);
alter table public.mail_assignments enable row level security;

-- 2) Stato personale: letto, stella, archivio
create table if not exists public.mail_person_state (
  thread_id uuid not null references public.mail_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  starred boolean not null default false,
  archived boolean not null default false,
  primary key (thread_id, user_id)
);
alter table public.mail_person_state enable row level security;
drop policy if exists mail_person_state_select on public.mail_person_state;
create policy mail_person_state_select on public.mail_person_state for select to authenticated using (user_id = auth.uid());

-- Lo stato attuale (per azienda) diventa lo stato del titolare che ha creato l'azienda
insert into public.mail_person_state (thread_id, user_id, last_read_at, starred, archived)
select p.thread_id, p.user_id, p.last_read_at, p.starred, p.archived from public.mail_participants p
on conflict do nothing;

-- 3) Chi ha scritto davvero il messaggio (la persona, non solo l'azienda)
alter table public.mail_messages add column if not exists author_person uuid references public.profiles(id) on delete set null;

create or replace function public.mail_set_author_person()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.author_person is null and auth.uid() is not null and new.author_id = public.my_company() then
    new.author_person := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists mail_messages_author_person on public.mail_messages;
create trigger mail_messages_author_person before insert on public.mail_messages
for each row execute function public.mail_set_author_person();

-- 4) Chi vede cosa
create or replace function public.mail_can_see(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mail_participants p where p.thread_id = p_thread and p.user_id = public.my_company())
    and case
      when public.my_team_role() = 'titolare' then
        not exists (select 1 from public.mail_assignments a
                    where a.thread_id = p_thread and a.company_id = public.my_company()
                      and a.private and a.assignee_id is distinct from auth.uid())
      else
        exists (select 1 from public.mail_assignments a
                where a.thread_id = p_thread and a.company_id = public.my_company() and a.assignee_id = auth.uid())
    end;
$$;

drop policy if exists mail_assignments_select on public.mail_assignments;
create policy mail_assignments_select on public.mail_assignments for select to authenticated
  using (company_id = public.my_company() and public.mail_can_see(thread_id));

drop policy if exists mail_threads_select on public.mail_threads;
create policy mail_threads_select on public.mail_threads for select to authenticated using (public.mail_can_see(id));
drop policy if exists mail_participants_select on public.mail_participants;
create policy mail_participants_select on public.mail_participants for select to authenticated using (public.mail_can_see(thread_id));
drop policy if exists mail_messages_select on public.mail_messages;
create policy mail_messages_select on public.mail_messages for select to authenticated
  using (public.mail_can_see(thread_id) and (not draft or coalesce(author_person, author_id) = auth.uid()));
drop policy if exists mail_attachments_select on public.mail_attachments;
create policy mail_attachments_select on public.mail_attachments for select to authenticated
  using (public.mail_can_see(thread_id) and exists (
    select 1 from public.mail_messages m where m.id = mail_attachments.message_id and (not m.draft or coalesce(m.author_person, m.author_id) = auth.uid())));

-- Allegati in archivio: solo chi vede la conversazione
create or replace function public.mail_is_thread_folder(p_folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_folder ~ '^[0-9a-f-]{36}$' and public.mail_can_see(p_folder::uuid);
$$;

-- 5) Chi segue una conversazione appena nasce
--  * chi la crea la segue
--  * per le richieste di servizio, dal lato di chi compra la segue chi segue il viaggio
--  * altrimenti resta nella posta generale finché qualcuno risponde
create or replace function public.mail_assign_on_join()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_person uuid;
begin
  if auth.uid() is not null and new.user_id = public.my_company() then
    v_person := auth.uid();
  else
    select t.assigned_to into v_person
    from public.mail_threads th
    join public.network_orders o on o.id = th.order_id and o.buyer_id = new.user_id
    join public.trip_services s on s.id = o.buyer_service_id
    join public.trips t on t.id = s.trip_id
    where th.id = new.thread_id;
    if v_person is not null and not (
      v_person = new.user_id or exists (select 1 from public.team_members m where m.user_id = v_person and m.company_id = new.user_id)
    ) then
      v_person := null;
    end if;
  end if;
  if v_person is not null then
    insert into public.mail_assignments (thread_id, company_id, assignee_id)
    values (new.thread_id, new.user_id, v_person)
    on conflict (thread_id, company_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists mail_participants_assign on public.mail_participants;
create trigger mail_participants_assign after insert on public.mail_participants
for each row execute function public.mail_assign_on_join();

-- 6) Funzioni della posta, per persona
create or replace function public.mail_start(p_thread uuid, p_subject text, p_recipients uuid[], p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.my_company();
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
  elsif not public.mail_can_see(v_thread) then
    raise exception 'Conversazione non trovata.';
  end if;
  insert into public.mail_messages (thread_id, author_id, author_person, body, draft)
  values (v_thread, v_uid, auth.uid(), coalesce(p_body, ''), true)
  returning id into v_msg;
  return jsonb_build_object('thread_id', v_thread, 'message_id', v_msg);
end;
$$;

create or replace function public.mail_discard(p_message uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.mail_messages
  where id = p_message and author_id = public.my_company() and coalesce(author_person, author_id) = auth.uid() and draft;
$$;

create or replace function public.mail_finish(p_message uuid, p_files jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  m public.mail_messages%rowtype;
  f jsonb;
begin
  select * into m from public.mail_messages
  where id = p_message and author_id = public.my_company() and coalesce(author_person, author_id) = auth.uid() and draft for update;
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
  update public.mail_person_state set archived = false where thread_id = m.thread_id;
  update public.mail_participants set last_read_at = now() where thread_id = m.thread_id and user_id = public.my_company();
  insert into public.mail_person_state (thread_id, user_id, last_read_at) values (m.thread_id, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
  -- chi risponde a una conversazione della posta generale la prende in carico
  insert into public.mail_assignments (thread_id, company_id, assignee_id)
  values (m.thread_id, public.my_company(), auth.uid())
  on conflict (thread_id, company_id) do update set assignee_id = excluded.assignee_id, updated_at = now()
  where public.mail_assignments.assignee_id is null;
  return m.thread_id;
end;
$$;

create or replace function public.mail_set_state(p_thread uuid, p_read boolean, p_starred boolean, p_archived boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.mail_can_see(p_thread) then raise exception 'Conversazione non trovata.'; end if;
  insert into public.mail_person_state (thread_id, user_id, last_read_at, starred, archived)
  values (p_thread, auth.uid(), case when p_read then now() end, coalesce(p_starred, false), coalesce(p_archived, false))
  on conflict (thread_id, user_id) do update set
    last_read_at = case when p_read is null then public.mail_person_state.last_read_at when p_read then now() else null end,
    starred = coalesce(p_starred, public.mail_person_state.starred),
    archived = coalesce(p_archived, public.mail_person_state.archived);
end;
$$;

create or replace function public.mail_add_participant(p_thread uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.mail_can_see(p_thread) then raise exception 'Conversazione non trovata.'; end if;
  if not public.network_are_partners(public.my_company(), p_user) then raise exception 'Puoi aggiungere solo i tuoi partner.'; end if;
  if (select count(*) from public.mail_participants where thread_id = p_thread) >= 25 then raise exception 'Troppi partecipanti.'; end if;
  insert into public.mail_participants (thread_id, user_id) values (p_thread, p_user) on conflict do nothing;
  insert into public.mail_messages (thread_id, author_id, kind, body)
  select p_thread, public.my_company(), 'evento', 'Ha aggiunto ' || coalesce(np.business_name, p.agency_name, p.full_name, 'un partner') || ' alla conversazione.'
  from public.profiles p left join public.network_profiles np on np.user_id = p.id where p.id = p_user;
end;
$$;

-- Quando una conversazione è "non letta" per me:
--  * c'è un messaggio di un partner dopo l'ultima volta che l'ho letta
--  * oppure un collega ci ha scritto (e io la seguo o sono titolare)
--  * oppure un collega me l'ha appena passata
-- I messaggi arrivati prima che entrassi nel team contano come già letti.
create or replace function public.mail_is_unread(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with st as (
    select coalesce(
      (select s.last_read_at from public.mail_person_state s where s.thread_id = p_thread and s.user_id = auth.uid()),
      (select m.created_at from public.team_members m where m.user_id = auth.uid()),
      '-infinity'::timestamptz) as seen
  )
  select exists (
    select 1 from public.mail_messages x, st
    where x.thread_id = p_thread and not x.draft and x.created_at > st.seen
      and (x.author_id is distinct from public.my_company()
           or (x.kind = 'messaggio' and coalesce(x.author_person, x.author_id) is distinct from auth.uid()))
  ) or exists (
    select 1 from public.mail_assignments a, st
    where a.thread_id = p_thread and a.company_id = public.my_company() and a.assignee_id = auth.uid()
      and a.handoff_by is distinct from auth.uid() and a.handoff_at > st.seen
  );
$$;

drop function if exists public.mail_list(text, text, integer, integer);
create or replace function public.mail_list(p_folder text, p_query text, p_limit integer, p_offset integer)
returns table(thread_id uuid, subject text, kind text, order_id uuid, last_message_at timestamptz, unread boolean, starred boolean, archived boolean,
              participants jsonb, last_author text, last_snippet text, has_attachments boolean, messages_count integer,
              assignee_id uuid, assignee_name text, is_private boolean, handed_to_me boolean)
language sql stable security definer set search_path = public as $$
  with mine as (
    select t.*, coalesce(s.starred, false) as p_starred, coalesce(s.archived, false) as p_archived,
           a.assignee_id as a_assignee, coalesce(a.private, false) as a_private,
           (a.assignee_id = auth.uid() and a.handoff_by is not null and a.handoff_by <> auth.uid()) as a_handed
    from public.mail_threads t
    join public.mail_participants p on p.thread_id = t.id and p.user_id = public.my_company()
    left join public.mail_person_state s on s.thread_id = t.id and s.user_id = auth.uid()
    left join public.mail_assignments a on a.thread_id = t.id and a.company_id = public.my_company()
    where public.mail_can_see(t.id)
  )
  select m.id, m.subject, m.kind, m.order_id, m.last_message_at,
         public.mail_is_unread(m.id),
         m.p_starred, m.p_archived,
         (select jsonb_agg(jsonb_build_object('id', pp.user_id, 'name', coalesce(np.business_name, pr.agency_name, pr.full_name, 'Professionista')) order by pp.added_at)
            from public.mail_participants pp join public.profiles pr on pr.id = pp.user_id left join public.network_profiles np on np.user_id = pp.user_id
            where pp.thread_id = m.id and pp.user_id <> public.my_company()),
         (select case when x.author_id = public.my_company()
                      then case when coalesce(x.author_person, x.author_id) = auth.uid() then 'Tu'
                                else coalesce(nullif(split_part(trim(pa.full_name), ' ', 1), ''), 'Un collega') end
                      else coalesce(np.business_name, pr.agency_name, pr.full_name, '') end
            from public.mail_messages x
            left join public.profiles pr on pr.id = x.author_id left join public.network_profiles np on np.user_id = x.author_id
            left join public.profiles pa on pa.id = x.author_person
            where x.thread_id = m.id and not x.draft order by x.created_at desc limit 1),
         (select left(regexp_replace(x.body, '\s+', ' ', 'g'), 160) from public.mail_messages x
            where x.thread_id = m.id and not x.draft order by x.created_at desc limit 1),
         exists (select 1 from public.mail_attachments a join public.mail_messages x on x.id = a.message_id where a.thread_id = m.id and not x.draft),
         (select count(*)::int from public.mail_messages x where x.thread_id = m.id and not x.draft),
         m.a_assignee,
         (select coalesce(nullif(trim(pr.full_name), ''), pr.email) from public.profiles pr where pr.id = m.a_assignee),
         m.a_private,
         coalesce(m.a_handed, false)
  from mine m
  where (
      (p_folder = 'inbox' and not m.p_archived and (
         exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft and x.author_id is distinct from public.my_company())
         or coalesce(m.a_handed, false)))
   or (p_folder = 'sent' and exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft and x.kind = 'messaggio'
                                       and x.author_id = public.my_company() and coalesce(x.author_person, x.author_id) = auth.uid()))
   or (p_folder = 'starred' and m.p_starred)
   or (p_folder = 'archived' and m.p_archived)
   or (p_folder = 'orders' and m.order_id is not null and not m.p_archived)
   or (p_folder = 'mine' and m.a_assignee = auth.uid() and not m.p_archived)
   or (p_folder = 'general' and m.a_assignee is null and not m.p_archived)
   or (p_folder = 'private' and m.a_private)
   or (p_folder = 'all')
  )
  and (
    p_query is null or p_query = ''
    or m.subject ilike '%' || p_query || '%'
    or exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft and x.body ilike '%' || p_query || '%')
    or exists (select 1 from public.mail_attachments a where a.thread_id = m.id and a.name ilike '%' || p_query || '%')
    or exists (select 1 from public.mail_participants pp join public.profiles pr on pr.id = pp.user_id left join public.network_profiles np on np.user_id = pp.user_id
               where pp.thread_id = m.id and pp.user_id <> public.my_company() and coalesce(np.business_name, pr.agency_name, pr.full_name, '') ilike '%' || p_query || '%')
  )
  and exists (select 1 from public.mail_messages x where x.thread_id = m.id and not x.draft)
  order by m.last_message_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.mail_unread_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.mail_participants p
  left join public.mail_person_state s on s.thread_id = p.thread_id and s.user_id = auth.uid()
  where p.user_id = public.my_company() and not coalesce(s.archived, false)
    and public.mail_can_see(p.thread_id) and public.mail_is_unread(p.thread_id);
$$;

-- 7) Passare la conversazione a un collega, prenderla in carico, rimetterla nella posta generale
create or replace function public.mail_assign(p_thread uuid, p_person uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company();
begin
  if auth.uid() is null or not public.mail_can_see(p_thread) then raise exception 'Conversazione non trovata.'; end if;
  if p_person is not null and not public.in_my_company(p_person) then raise exception 'Puoi passarla solo a un collega del tuo team.'; end if;
  insert into public.mail_assignments (thread_id, company_id, assignee_id, private, handoff_note, handoff_by, handoff_at, updated_at)
  values (p_thread, v_company, p_person, false,
          case when p_person is not null and p_person <> auth.uid() then nullif(left(trim(coalesce(p_note, '')), 1000), '') end,
          case when p_person is not null and p_person <> auth.uid() then auth.uid() end,
          case when p_person is not null and p_person <> auth.uid() then now() end,
          now())
  on conflict (thread_id, company_id) do update set
    assignee_id = excluded.assignee_id, private = false,
    handoff_note = excluded.handoff_note, handoff_by = excluded.handoff_by, handoff_at = excluded.handoff_at,
    updated_at = now();
  -- chi la riceve la ritrova in arrivo anche se l'aveva archiviata
  if p_person is not null then
    update public.mail_person_state set archived = false where thread_id = p_thread and user_id = p_person;
  end if;
end;
$$;

-- Solo un titolare può rendere privata una conversazione: la segue lui e la vede solo lui
create or replace function public.mail_set_private(p_thread uuid, p_private boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.mail_can_see(p_thread) then raise exception 'Conversazione non trovata.'; end if;
  if public.my_team_role() <> 'titolare' then raise exception 'Solo un titolare può rendere privata una conversazione.'; end if;
  insert into public.mail_assignments (thread_id, company_id, assignee_id, private)
  values (p_thread, public.my_company(), auth.uid(), coalesce(p_private, false))
  on conflict (thread_id, company_id) do update set
    assignee_id = auth.uid(), private = coalesce(p_private, false),
    handoff_note = case when coalesce(p_private, false) then null else public.mail_assignments.handoff_note end,
    updated_at = now();
end;
$$;

-- Nomi di chi ha scritto: la persona e la sua azienda
create or replace function public.mail_people(p_thread uuid)
returns table(person_id uuid, company_id uuid, name text, company text)
language sql stable security definer set search_path = public as $$
  select distinct x.author_person, x.author_id,
         coalesce(nullif(trim(pa.full_name), ''), coalesce(np.business_name, pr.agency_name, pr.full_name, 'Partner')),
         coalesce(np.business_name, pr.agency_name, pr.full_name, 'Partner')
  from public.mail_messages x
  join public.profiles pr on pr.id = x.author_id
  left join public.network_profiles np on np.user_id = x.author_id
  left join public.profiles pa on pa.id = x.author_person
  where x.thread_id = p_thread and x.author_person is not null and public.mail_can_see(p_thread);
$$;

-- 8) Notifiche: le riceve chi segue la conversazione; se non la segue nessuno, i titolari
create or replace function public.mail_notify_targets(p_message uuid)
returns table(user_id uuid, email text, send_email boolean, endpoint text, p256dh text, auth_key text)
language plpgsql security definer set search_path = public as $$
declare
  m public.mail_messages%rowtype;
begin
  select * into m from public.mail_messages where id = p_message and author_id = public.my_company() and not draft;
  if not found then return; end if;
  return query
  with recipients as (
    select p.user_id, (p.last_notified_at is null or p.last_notified_at < now() - interval '10 minutes') as mail_ok
    from public.mail_participants p
    where p.thread_id = m.thread_id and p.user_id <> public.my_company()
  ), upd as (
    update public.mail_participants p set last_notified_at = now()
    from recipients r where p.thread_id = m.thread_id and p.user_id = r.user_id and r.mail_ok
    returning p.user_id
  ), people as (
    select r.user_id as company_id, coalesce(a.assignee_id, r.user_id) as person_id, r.mail_ok
    from recipients r left join public.mail_assignments a on a.thread_id = m.thread_id and a.company_id = r.user_id
    union
    -- nessuno la segue: anche gli altri titolari dell'azienda
    select r.user_id, tm.user_id, false
    from recipients r join public.team_members tm on tm.company_id = r.user_id and tm.role = 'titolare'
    where not exists (select 1 from public.mail_assignments a where a.thread_id = m.thread_id and a.company_id = r.user_id and a.assignee_id is not null)
  )
  select pe.company_id, pr.email, pe.mail_ok and pr.email not like '%@demo.grandroute.invalid', ps.endpoint, ps.p256dh, ps.auth
  from people pe
  join public.profiles pr on pr.id = pe.person_id
  left join public.push_subscriptions ps on ps.profile_id = pe.person_id;
end;
$$;

grant execute on function public.mail_can_see(uuid), public.mail_is_unread(uuid), public.mail_assign(uuid, uuid, text),
  public.mail_set_private(uuid, boolean), public.mail_people(uuid), public.mail_list(text, text, integer, integer) to authenticated;
