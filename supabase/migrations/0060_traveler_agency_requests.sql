-- 0060 — Viaggiatori: «Fallo preparare da un'agenzia».
-- Le agenzie possono comparire in un elenco per i viaggiatori (vetrina); il viaggiatore sceglie
-- un'agenzia e le manda il suo viaggio: l'agenzia riceve una COPIA dell'itinerario e una nuova
-- richiesta in «Clienti → Nuove richieste».
--
-- Il sito funziona anche prima di questo passaggio: la pagina «Agenzia» del viaggio avvisa che serve
-- l'aggiornamento.

-- 1. Vetrina dell'agenzia per i viaggiatori (spenta di base)
alter table public.profiles
  add column if not exists traveler_listing boolean not null default false,
  add column if not exists traveler_blurb text check (traveler_blurb is null or char_length(traveler_blurb) <= 600),
  add column if not exists traveler_countries text[] not null default '{}';

-- 2. Le richieste dei viaggiatori arrivano tra le «Nuove richieste» dell'agenzia
alter table public.agency_leads
  add column if not exists trip_id uuid references public.trips (id) on delete set null,
  add column if not exists traveler_id uuid references auth.users (id) on delete set null;

-- 3. Cosa ha mandato il viaggiatore (lo vede solo lui)
create table if not exists public.traveler_requests (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  agency_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid references public.agency_leads (id) on delete set null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists traveler_requests_traveler_idx on public.traveler_requests (traveler_id, created_at desc);
alter table public.traveler_requests enable row level security;
drop policy if exists "traveler_requests_select_own" on public.traveler_requests;
create policy "traveler_requests_select_own" on public.traveler_requests
  for select to authenticated using (traveler_id = (select auth.uid()));

-- 4. L'elenco delle agenzie per i viaggiatori: solo i dati della vetrina
create or replace function public.list_agencies_for_travelers()
returns table(id uuid, agency_name text, logo_url text, brand_color text, blurb text, countries text[])
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.agency_name, p.logo_url, p.brand_color, p.traveler_blurb, p.traveler_countries
  from public.profiles p
  where p.traveler_listing
    and p.is_professional
    and coalesce(p.agency_name, '') <> ''
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_traveler)
  order by p.agency_name;
$$;
revoke all on function public.list_agencies_for_travelers() from public, anon;
grant execute on function public.list_agencies_for_travelers() to authenticated;

-- 5. Le richieste del viaggiatore, con lo stato deciso dall'agenzia
create or replace function public.my_traveler_requests()
returns table(id uuid, trip_id uuid, agency_name text, status text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.trip_id, a.agency_name, coalesce(l.status, 'archiviata'), r.created_at
  from public.traveler_requests r
  join public.profiles a on a.id = r.agency_id
  left join public.agency_leads l on l.id = r.lead_id
  where r.traveler_id = auth.uid()
  order by r.created_at desc
  limit 50;
$$;
revoke all on function public.my_traveler_requests() from public, anon;
grant execute on function public.my_traveler_requests() to authenticated;

-- 6. Invio della richiesta: copia l'itinerario all'agenzia e crea la richiesta
create or replace function public.submit_traveler_request(p_trip_id uuid, p_agency_id uuid, p_message text, p_contact text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_trip public.trips%rowtype;
  v_new_trip uuid;
  v_new_day uuid;
  v_day record;
  v_lead uuid;
begin
  if v_uid is null then
    raise exception 'Sessione scaduta: accedi di nuovo.';
  end if;
  select coalesce(nullif(trim(full_name), ''), 'Viaggiatore') into v_name
    from public.profiles where id = v_uid and is_traveler;
  if v_name is null then
    raise exception 'Solo i viaggiatori possono mandare un viaggio a un''agenzia.';
  end if;
  if char_length(trim(coalesce(p_contact, ''))) < 3 then
    raise exception 'Scrivi un contatto (email o telefono) per farti rispondere.';
  end if;
  select * into v_trip from public.trips where id = p_trip_id and owner_id = v_uid;
  if not found then
    raise exception 'Viaggio non trovato.';
  end if;
  if not exists (select 1 from public.profiles where id = p_agency_id and traveler_listing and is_professional) then
    raise exception 'Questa agenzia non è disponibile.';
  end if;
  if exists (
    select 1 from public.traveler_requests r
    left join public.agency_leads l on l.id = r.lead_id
    where r.traveler_id = v_uid and r.trip_id = p_trip_id and r.agency_id = p_agency_id
      and coalesce(l.status, 'archiviata') in ('nuova', 'contattata')
  ) then
    raise exception 'Hai già mandato questo viaggio a questa agenzia: aspetta la sua risposta.';
  end if;
  if (select count(*) from public.traveler_requests where traveler_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Hai mandato molte richieste oggi. Riprova domani.';
  end if;

  -- Copia dell'itinerario (senza foto, documenti, spese e valigia) intestata all'agenzia
  insert into public.trips (owner_id, title, destination, start_date, end_date, public_slug)
  values (
    p_agency_id,
    left('Viaggiatore: ' || v_trip.title, 200),
    v_trip.destination,
    v_trip.start_date,
    v_trip.end_date,
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  )
  returning id into v_new_trip;

  for v_day in select * from public.trip_days where trip_id = p_trip_id order by day_order loop
    insert into public.trip_days (trip_id, day_date, day_order, title, notes)
    values (v_new_trip, v_day.day_date, v_day.day_order, v_day.title, v_day.notes)
    returning id into v_new_day;
    insert into public.activities (trip_day_id, start_time, title, description, location, activity_type, details, activity_order)
    select v_new_day, a.start_time, a.title, a.description, a.location, a.activity_type, a.details, a.activity_order
    from public.activities a where a.trip_day_id = v_day.id;
  end loop;

  insert into public.agency_leads (owner_id, name, contact, message, source, trip_id, traveler_id)
  values (
    p_agency_id,
    left(v_name, 120),
    left(trim(p_contact), 160),
    left('Ha preparato un viaggio e vorrebbe che lo organizzaste voi: «' || v_trip.title || '». ' || coalesce(nullif(trim(p_message), ''), ''), 1000),
    'privato',
    v_new_trip,
    v_uid
  )
  returning id into v_lead;

  insert into public.traveler_requests (traveler_id, trip_id, agency_id, lead_id)
  values (v_uid, p_trip_id, p_agency_id, v_lead);

  return v_lead;
end;
$$;
revoke all on function public.submit_traveler_request(uuid, uuid, text, text) from public, anon;
grant execute on function public.submit_traveler_request(uuid, uuid, text, text) to authenticated;
