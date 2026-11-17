-- Migrazione: dialogo cliente-agenzia sul viaggio (messaggi, approvazione
-- dell'itinerario, richieste di modifica) con notifiche push.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0035_...
--
-- Il sito funziona anche prima di questo passaggio: semplicemente i messaggi
-- e l'approvazione non compaiono.

-- 1. Stato di approvazione dell'itinerario (lo imposta l'agenzia; il cliente
--    lo cambia solo tramite la funzione client_set_trip_approval più sotto).
alter table public.trips
  add column if not exists approval_status text not null default 'none'
    check (approval_status in ('none', 'pending', 'approved', 'changes_requested')),
  add column if not exists approval_updated_at timestamptz;

-- 2. Messaggi del viaggio
create table if not exists public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_role text not null check (author_role in ('agency', 'client')),
  kind text not null default 'message'
    check (kind in ('message', 'change_request', 'approved', 'sent_for_approval')),
  body text not null check (char_length(body) between 1 and 2000),
  day_id uuid references public.trip_days (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists trip_messages_trip_created_idx
  on public.trip_messages (trip_id, created_at);

alter table public.trip_messages enable row level security;

-- Chi può partecipare: l'agenzia proprietaria del viaggio e il cliente
-- collegato a quel viaggio.
create or replace function public.is_trip_agency(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = auth.uid());
$$;

create or replace function public.is_trip_client(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trips t
    join public.clients c on c.id = t.client_id
    where t.id = p_trip_id and c.user_id = auth.uid()
  );
$$;

revoke all on function public.is_trip_agency(uuid) from public, anon;
revoke all on function public.is_trip_client(uuid) from public, anon;
grant execute on function public.is_trip_agency(uuid) to authenticated;
grant execute on function public.is_trip_client(uuid) to authenticated;

drop policy if exists "trip_messages_select_parties" on public.trip_messages;
create policy "trip_messages_select_parties" on public.trip_messages
  for select to authenticated
  using (public.is_trip_agency(trip_id) or public.is_trip_client(trip_id));

-- Si scrive solo a proprio nome e nel proprio ruolo; i messaggi "di sistema"
-- (approvato, modifiche richieste) li crea la funzione qui sotto.
drop policy if exists "trip_messages_insert_parties" on public.trip_messages;
create policy "trip_messages_insert_parties" on public.trip_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and kind in ('message', 'sent_for_approval')
    and (
      (author_role = 'agency' and public.is_trip_agency(trip_id))
      or (author_role = 'client' and kind = 'message' and public.is_trip_client(trip_id))
    )
  );

-- Nessuna policy di update/delete: i messaggi non si modificano né si
-- cancellano (la lettura si segna con la funzione sotto).

-- 3. Il cliente approva l'itinerario o chiede modifiche.
create or replace function public.client_set_trip_approval(
  p_trip_id uuid,
  p_status text,
  p_note text default null,
  p_day_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('approved', 'changes_requested') then
    raise exception 'stato non valido';
  end if;
  if not public.is_trip_client(p_trip_id) then
    raise exception 'non autorizzato';
  end if;
  if p_status = 'changes_requested' and v_note is null then
    raise exception 'descrivi le modifiche richieste';
  end if;

  update public.trips
    set approval_status = p_status, approval_updated_at = now()
    where id = p_trip_id;

  insert into public.trip_messages (trip_id, author_id, author_role, kind, body, day_id)
  values (
    p_trip_id,
    auth.uid(),
    'client',
    case when p_status = 'approved' then 'approved' else 'change_request' end,
    left(coalesce(v_note, 'Itinerario approvato'), 2000),
    p_day_id
  );
end;
$$;

revoke all on function public.client_set_trip_approval(uuid, text, text, uuid) from public, anon;
grant execute on function public.client_set_trip_approval(uuid, text, text, uuid) to authenticated;

-- 4. Segna come letti i messaggi dell'altra parte.
create or replace function public.mark_trip_messages_read(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if public.is_trip_agency(p_trip_id) then v_role := 'agency';
  elsif public.is_trip_client(p_trip_id) then v_role := 'client';
  else return;
  end if;

  update public.trip_messages
    set read_at = now()
    where trip_id = p_trip_id and author_role <> v_role and read_at is null;
end;
$$;

revoke all on function public.mark_trip_messages_read(uuid) from public, anon;
grant execute on function public.mark_trip_messages_read(uuid) to authenticated;

-- 5. Destinatari della notifica push: l'altra parte del viaggio.
create or replace function public.get_trip_message_push_targets(p_trip_id uuid)
returns table(endpoint text, p256dh text, auth_key text, recipient_role text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trip_agency(p_trip_id) then
    return query
      select ps.endpoint, ps.p256dh, ps.auth, 'client'::text
      from public.trips t
      join public.clients c on c.id = t.client_id
      join public.profiles p on p.id = c.user_id
      join public.push_subscriptions ps on ps.profile_id = c.user_id
      where t.id = p_trip_id and c.user_id is not null and p.notify_trips;
  elsif public.is_trip_client(p_trip_id) then
    return query
      select ps.endpoint, ps.p256dh, ps.auth, 'agency'::text
      from public.trips t
      join public.profiles p on p.id = t.owner_id
      join public.push_subscriptions ps on ps.profile_id = t.owner_id
      where t.id = p_trip_id and p.notify_trips;
  end if;
end;
$$;

revoke all on function public.get_trip_message_push_targets(uuid) from public, anon;
grant execute on function public.get_trip_message_push_targets(uuid) to authenticated;
