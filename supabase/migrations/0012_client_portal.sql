-- Migrazione: area clienti. Collega un account di accesso a una scheda
-- cliente e permette a quel cliente di leggere (solo in lettura) i propri
-- viaggi, anche se non pubblicati, senza toccare l'accesso dell'agenzia.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0011_...

alter table public.clients
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- Un utente non può essere collegato due volte alla stessa agenzia.
create unique index if not exists clients_owner_user_unique
  on public.clients (owner_id, user_id)
  where user_id is not null;

-- Il cliente può leggere (solo leggere) la propria scheda, per vedere es. il
-- proprio nome nell'area riservata. Le modifiche restano solo all'agenzia
-- (vedi "clients_all_own" in schema.sql).
drop policy if exists "clients_select_own_as_client" on public.clients;
create policy "clients_select_own_as_client" on public.clients
  for select using (auth.uid() = user_id);

-- TRIPS: un cliente autenticato legge i propri viaggi, pubblicati o no.
drop policy if exists "trips_select_as_client" on public.trips;
create policy "trips_select_as_client" on public.trips
  for select using (
    exists (
      select 1 from public.clients
      where clients.id = trips.client_id and clients.user_id = auth.uid()
    )
  );

drop policy if exists "trip_days_select_as_client" on public.trip_days;
create policy "trip_days_select_as_client" on public.trip_days
  for select using (
    exists (
      select 1 from public.trips
      join public.clients on clients.id = trips.client_id
      where trips.id = trip_days.trip_id and clients.user_id = auth.uid()
    )
  );

drop policy if exists "activities_select_as_client" on public.activities;
create policy "activities_select_as_client" on public.activities
  for select using (
    exists (
      select 1 from public.trip_days
      join public.trips on trips.id = trip_days.trip_id
      join public.clients on clients.id = trips.client_id
      where trip_days.id = activities.trip_day_id and clients.user_id = auth.uid()
    )
  );

drop policy if exists "activity_photos_select_as_client" on public.activity_photos;
create policy "activity_photos_select_as_client" on public.activity_photos
  for select using (
    exists (
      select 1 from public.activities
      join public.trip_days on trip_days.id = activities.trip_day_id
      join public.trips on trips.id = trip_days.trip_id
      join public.clients on clients.id = trips.client_id
      where activities.id = activity_photos.activity_id and clients.user_id = auth.uid()
    )
  );

-- Un cliente deve poter leggere nome agenzia/logo di chi gli ha organizzato
-- il viaggio (stessa cosa che già succede sulla pagina pubblica).
drop policy if exists "profiles_select_as_client_trip_owner" on public.profiles;
create policy "profiles_select_as_client_trip_owner" on public.profiles
  for select using (
    exists (
      select 1 from public.trips
      join public.clients on clients.id = trips.client_id
      where trips.owner_id = profiles.id and clients.user_id = auth.uid()
    )
  );

-- Funzione sicura chiamata al login del cliente: collega automaticamente
-- (solo per email corrispondente e non già presa da nessun altro) tutte le
-- schede cliente, di qualunque agenzia, che hanno quella email ma nessun
-- account ancora associato. "security definer" serve solo per poter leggere
-- l'email verificata della sessione corrente ed eseguire l'aggiornamento
-- mirato: non espone nessun'altra riga oltre a quelle con quella email.
create or replace function public.claim_client_profiles()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
  set user_id = auth.uid()
  where user_id is null
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
end;
$$;

revoke all on function public.claim_client_profiles() from public;
grant execute on function public.claim_client_profiles() to authenticated;
