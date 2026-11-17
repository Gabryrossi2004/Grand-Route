-- Migrazione: il cliente può riferire un messaggio o una richiesta di modifica
-- a una singola attività (non solo a un giorno).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0036_...
--
-- Il sito funziona anche prima di questo passaggio: resta possibile solo il
-- riferimento al giorno.
alter table public.trip_messages
  add column if not exists activity_id uuid references public.activities (id) on delete set null;

-- Giorno e attività indicati devono appartenere davvero a quel viaggio.
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
    and (
      day_id is null
      or exists (select 1 from public.trip_days d where d.id = day_id and d.trip_id = trip_messages.trip_id)
    )
    and (
      activity_id is null
      or exists (
        select 1 from public.activities a
        join public.trip_days d on d.id = a.trip_day_id
        where a.id = activity_id and d.trip_id = trip_messages.trip_id
      )
    )
  );

-- Nuova versione della funzione di approvazione, con l'attività (la vecchia,
-- a quattro parametri, viene tolta).
drop function if exists public.client_set_trip_approval(uuid, text, text, uuid);

create or replace function public.client_set_trip_approval(
  p_trip_id uuid,
  p_status text,
  p_note text default null,
  p_day_id uuid default null,
  p_activity_id uuid default null
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
  if p_day_id is not null and not exists (
    select 1 from public.trip_days d where d.id = p_day_id and d.trip_id = p_trip_id
  ) then
    raise exception 'giorno non valido';
  end if;
  if p_activity_id is not null and not exists (
    select 1 from public.activities a
    join public.trip_days d on d.id = a.trip_day_id
    where a.id = p_activity_id and d.trip_id = p_trip_id
  ) then
    raise exception 'attività non valida';
  end if;

  update public.trips
    set approval_status = p_status, approval_updated_at = now()
    where id = p_trip_id;

  insert into public.trip_messages (trip_id, author_id, author_role, kind, body, day_id, activity_id)
  values (
    p_trip_id,
    auth.uid(),
    'client',
    case when p_status = 'approved' then 'approved' else 'change_request' end,
    left(coalesce(v_note, 'Itinerario approvato'), 2000),
    p_day_id,
    p_activity_id
  );
end;
$$;

revoke all on function public.client_set_trip_approval(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.client_set_trip_approval(uuid, text, text, uuid, uuid) to authenticated;
