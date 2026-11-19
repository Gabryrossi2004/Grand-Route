-- Migrazione: mappamondo dell'agenzia e schede paese.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0044_...
--
-- 1. Paesi di ogni viaggio: quelli scelti a mano dall'agenzia (countries) e quelli
--    ricavati in automatico dalle località dell'itinerario (auto_countries, codici ISO
--    a due lettere). auto_countries = null vuol dire "da ricalcolare": si azzera da solo
--    quando cambiano destinazione, giorni o attività del viaggio.
-- 2. Schede paese dell'agenzia (country_sheets): scheda tecnica, descrizione e foto,
--    preparate una volta da Zefiro e salvate; ogni agenzia vede solo le proprie.
--
-- Il sito funziona anche prima di questo passaggio: la pagina Mappamondo avvisa
-- che serve questo aggiornamento.

alter table public.trips
  add column if not exists countries text[] not null default '{}',
  add column if not exists auto_countries text[];

-- Ricalcolo automatico dei paesi quando cambia l'itinerario
create or replace function public.trips_reset_auto_countries()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_trip uuid;
begin
  if tg_table_name = 'trip_days' then
    v_trip := coalesce(new.trip_id, old.trip_id);
  else
    select d.trip_id into v_trip from public.trip_days d where d.id = coalesce(new.trip_day_id, old.trip_day_id);
  end if;
  if v_trip is not null then
    update public.trips set auto_countries = null where id = v_trip and auto_countries is not null;
  end if;
  return null;
end;
$$;

drop trigger if exists trip_days_reset_countries on public.trip_days;
create trigger trip_days_reset_countries
  after insert or delete or update of title on public.trip_days
  for each row execute function public.trips_reset_auto_countries();

drop trigger if exists activities_reset_countries on public.activities;
create trigger activities_reset_countries
  after insert or delete or update of location, title, trip_day_id on public.activities
  for each row execute function public.trips_reset_auto_countries();

create or replace function public.trips_destination_reset_countries()
returns trigger language plpgsql as $$
begin
  if new.destination is distinct from old.destination then
    new.auto_countries := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trips_destination_reset_countries on public.trips;
create trigger trips_destination_reset_countries
  before update of destination on public.trips
  for each row execute function public.trips_destination_reset_countries();

-- Schede paese
create table if not exists public.country_sheets (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  content jsonb not null,
  photos jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, country_code)
);

alter table public.country_sheets enable row level security;

drop policy if exists "country_sheets_all_own" on public.country_sheets;
create policy "country_sheets_all_own" on public.country_sheets
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
