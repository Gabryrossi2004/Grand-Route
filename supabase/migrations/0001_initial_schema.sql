-- ============================================================
-- Migrazione 0001: schema iniziale (profili, clienti, viaggi,
-- giorni, attività, documenti) + archiviazione file.
--
-- NOTA STORICA IMPORTANTE
-- Questo file è una RICOSTRUZIONE. Lo schema iniziale del progetto
-- era stato eseguito a mano nell'SQL Editor di Supabase all'inizio
-- dello sviluppo e non era mai stato salvato come file di migrazione:
-- le migrazioni versionate partivano da 0002. Ricostruirlo è servito
-- per poter ricreare il database da zero su un nuovo progetto.
--
-- È stato ricostruito a partire da:
--   - i tipi TypeScript in src/lib/types.ts (le colonne di oggi);
--   - tutte le "alter table ... add column" delle migrazioni 0002-0028
--     (cioè le colonne aggiunte DOPO, che qui non devono esserci);
--   - le query effettive del codice (chi legge/scrive cosa, e con
--     quale ruolo: agenzia, cliente, o visitatore non autenticato).
--
-- ORDINE DI ESECUZIONE: questo file va eseguito per PRIMO su un
-- progetto Supabase nuovo, poi 0002, 0003, ... fino all'ultimo.
-- Le migrazioni successive aggiungono le colonne mancanti, quindi il
-- risultato finale coincide con lo schema attuale.
-- ============================================================


-- ============================================================
-- 1. PROFILI (un profilo per ogni account registrato)
-- ============================================================
-- L'id è lo stesso dell'utente in auth.users: il profilo è l'estensione
-- "applicativa" dell'account di accesso gestito da Supabase.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  account_type text not null default 'individual'
    check (account_type in ('individual', 'agency')),
  agency_name text,
  logo_url text,
  brand_color text,
  created_at timestamptz not null default now()
);

-- La registrazione (src/app/signup/actions.ts) chiama solo
-- supabase.auth.signUp(): il profilo NON viene creato dal codice
-- dell'app, lo crea questo trigger. Senza, ogni nuovo iscritto
-- resterebbe senza profilo e la dashboard non si aprirebbe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 2. CLIENTI (rubrica dell'agenzia)
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 3. VIAGGI
-- ============================================================
-- public_slug: indirizzo segreto della pagina pubblica (/t/<slug>).
-- is_published: finché è false il viaggio non è visibile a nessuno
-- tranne l'agenzia proprietaria (vedi policy più sotto).
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  destination text,
  start_date date,
  end_date date,
  cover_image_url text,
  public_slug text not null unique,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 4. GIORNI DEL VIAGGIO
-- ============================================================
create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_date date,
  day_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 5. ATTIVITÀ (le voci dentro ogni giorno)
-- ============================================================
-- activity_type e details non sono qui: vengono aggiunti dalle
-- migrazioni 0002 e 0003.
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  start_time time,
  title text not null,
  description text,
  location text,
  activity_order integer not null default 0,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 6. DOCUMENTI DEL VIAGGIO
-- ============================================================
-- I file stanno nel bucket privato "trip-documents"; qui si salva solo
-- il percorso, e l'app genera di volta in volta un link temporaneo.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);


-- ============================================================
-- 7. INDICI
-- ============================================================
-- Ogni chiave esterna usata per filtrare ha il suo indice: senza,
-- Postgres scansiona tutta la tabella ad ogni apertura di pagina, e
-- con la distanza di rete tra server applicativo e database ogni
-- query lenta si sente subito.
create index if not exists clients_owner_id_idx on public.clients (owner_id);
create index if not exists trips_owner_id_idx on public.trips (owner_id);
create index if not exists trips_client_id_idx on public.trips (client_id);
create index if not exists trip_days_trip_id_idx on public.trip_days (trip_id);
create index if not exists trip_days_trip_id_order_idx on public.trip_days (trip_id, day_order);
create index if not exists activities_trip_day_id_idx on public.activities (trip_day_id);
create index if not exists activities_day_order_idx on public.activities (trip_day_id, activity_order);
create index if not exists documents_trip_id_idx on public.documents (trip_id);


-- ============================================================
-- 8. SICUREZZA A LIVELLO DI RIGA (RLS)
-- ============================================================
-- Regola generale: ogni agenzia vede e modifica solo i propri dati.
-- In più, chi ha il link di un viaggio PUBBLICATO può leggerlo senza
-- essere registrato (è lo scopo della pagina pubblica).
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.activities enable row level security;
alter table public.documents enable row level security;

-- --- PROFILI ---
-- Ognuno legge e modifica solo il proprio profilo.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- La pagina pubblica del viaggio mostra nome, logo e condizioni
-- dell'agenzia: chi non è registrato deve poter leggere il profilo di
-- un'agenzia, ma SOLO se quell'agenzia ha almeno un viaggio pubblicato.
drop policy if exists "profiles_select_published_owner" on public.profiles;
create policy "profiles_select_published_owner" on public.profiles
  for select using (
    exists (
      select 1 from public.trips
      where trips.owner_id = profiles.id and trips.is_published
    )
  );

-- Nota: la policy qui sopra dà accesso alla riga intera, email compresa.
-- La restrizione alle sole colonne pubbliche è nella migrazione 0029,
-- che va eseguita dopo perché una di quelle colonne
-- (terms_and_conditions) viene creata solo nella 0017.

-- --- CLIENTI ---
drop policy if exists "clients_all_own" on public.clients;
create policy "clients_all_own" on public.clients
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- --- VIAGGI ---
drop policy if exists "trips_all_own" on public.trips;
create policy "trips_all_own" on public.trips
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "trips_select_published" on public.trips;
create policy "trips_select_published" on public.trips
  for select using (is_published);

-- --- GIORNI ---
drop policy if exists "trip_days_all_own" on public.trip_days;
create policy "trip_days_all_own" on public.trip_days
  for all using (
    exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.owner_id = auth.uid())
  );

drop policy if exists "trip_days_select_published" on public.trip_days;
create policy "trip_days_select_published" on public.trip_days
  for select using (
    exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.is_published)
  );

-- --- ATTIVITÀ ---
drop policy if exists "activities_all_own" on public.activities;
create policy "activities_all_own" on public.activities
  for all using (
    exists (
      select 1 from public.trip_days
      join public.trips on trips.id = trip_days.trip_id
      where trip_days.id = activities.trip_day_id and trips.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.trip_days
      join public.trips on trips.id = trip_days.trip_id
      where trip_days.id = activities.trip_day_id and trips.owner_id = auth.uid()
    )
  );

drop policy if exists "activities_select_published" on public.activities;
create policy "activities_select_published" on public.activities
  for select using (
    exists (
      select 1 from public.trip_days
      join public.trips on trips.id = trip_days.trip_id
      where trip_days.id = activities.trip_day_id and trips.is_published
    )
  );

-- --- DOCUMENTI ---
-- Nessuna lettura pubblica: i documenti (passaporti, voucher) restano
-- privati anche quando il viaggio è pubblicato.
drop policy if exists "documents_all_own" on public.documents;
create policy "documents_all_own" on public.documents
  for all using (
    exists (select 1 from public.trips where trips.id = documents.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = documents.trip_id and trips.owner_id = auth.uid())
  );


-- ============================================================
-- 9. ARCHIVIAZIONE FILE (bucket)
-- ============================================================
-- public-assets: immagini destinate a essere viste da chiunque
-- (copertine, foto delle attività, logo dell'agenzia, foto community).
-- trip-documents: privato, per i documenti di viaggio; l'app genera
-- link temporanei firmati quando servono.
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', false)
on conflict (id) do nothing;

-- Tutti i file vengono caricati dal codice sotto una cartella che ha
-- per nome l'id dell'utente (es. "<id-utente>/trips/<id-viaggio>/..."):
-- le regole qui sotto si appoggiano a questa convenzione, così ogni
-- agenzia può scrivere solo dentro la propria cartella.
drop policy if exists "public_assets_read_all" on storage.objects;
create policy "public_assets_read_all" on storage.objects
  for select using (bucket_id = 'public-assets');

drop policy if exists "public_assets_write_own_folder" on storage.objects;
create policy "public_assets_write_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "public_assets_update_own_folder" on storage.objects;
create policy "public_assets_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "public_assets_delete_own_folder" on storage.objects;
create policy "public_assets_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_documents_read_own_folder" on storage.objects;
create policy "trip_documents_read_own_folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_documents_write_own_folder" on storage.objects;
create policy "trip_documents_write_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_documents_update_own_folder" on storage.objects;
create policy "trip_documents_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_documents_delete_own_folder" on storage.objects;
create policy "trip_documents_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
