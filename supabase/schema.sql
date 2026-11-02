-- Schema del database per "prova gestionale"
-- Esegui questo intero file nell'editor SQL di Supabase (Dashboard -> SQL Editor -> New query -> Run)
-- Puoi eseguirlo più volte senza rompere nulla: ogni comando controlla se la cosa esiste già.

-- ============================================================
-- 1. PROFILES: un profilo per ogni utente che si registra
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  account_type text not null default 'individual' check (account_type in ('individual', 'agency')),
  agency_name text,
  logo_url text,
  brand_color text default '#2563eb',
  created_at timestamptz not null default now()
);

-- Quando qualcuno si registra (auth.users), creiamo automaticamente la sua riga in profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. CLIENTS: la rubrica clienti (usata soprattutto da chi ha account_type = 'agency')
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
-- 3. TRIP_GROUPS: raggruppa più varianti/proposte dello stesso viaggio
-- per lo stesso cliente (es. "Opzione economica" / "Opzione lusso")
-- ============================================================
create table if not exists public.trip_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. TRIPS: i viaggi/itinerari
-- ============================================================
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  group_id uuid references public.trip_groups (id) on delete set null,
  title text not null,
  destination text,
  start_date date,
  end_date date,
  cover_image_url text,
  public_slug text not null unique,
  is_published boolean not null default false,
  price_mode text not null default 'nessuno' check (price_mode in ('nessuno', 'lordo', 'commissioni')),
  price_amount numeric(10, 2),
  price_net numeric(10, 2),
  price_commission numeric(10, 2),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. TRIP_DAYS: i giorni di un viaggio
-- ============================================================
create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_date date,
  day_order integer not null default 0,
  notes text
);

-- ============================================================
-- 6. ACTIVITIES: le attività dentro ogni giorno
-- ============================================================
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  start_time time,
  title text not null,
  description text,
  location text,
  activity_type text not null default 'altro'
    check (activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'altro')),
  -- Campi extra specifici per tipo (es. per un volo: compagnia, PNR; per un hotel: tipo camera, trattamento)
  details jsonb not null default '{}'::jsonb,
  activity_order integer not null default 0
);

-- ============================================================
-- 6b. ACTIVITY_TEMPLATES: libreria di attività riutilizzabili
-- ============================================================
create table if not exists public.activity_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  activity_type text not null default 'altro'
    check (activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'altro')),
  title text not null,
  description text,
  location text,
  details jsonb not null default '{}'::jsonb,
  cover_photo_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 6c. ACTIVITY_PHOTOS: foto allegate a un'attività
-- ============================================================
create table if not exists public.activity_photos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  url text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. DOCUMENTS: file allegati a un viaggio (biglietti, voucher, ecc.)
-- ============================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- Se impostato, il documento è collegato a una singola attività (es. voucher, biglietto).
  -- Se vuoto, è un documento generale del viaggio (passaporto, visti, ecc.).
  activity_id uuid references public.activities (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- 8. SICUREZZA (Row Level Security)
-- Regola generale: ognuno vede e modifica SOLO le proprie righe.
-- Eccezione: un viaggio pubblicato (is_published = true) è leggibile da chiunque
-- abbia il link, perché serve per la pagina condivisibile col cliente.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.trip_groups enable row level security;
alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.activities enable row level security;
alter table public.activity_templates enable row level security;
alter table public.activity_photos enable row level security;
alter table public.documents enable row level security;

-- PROFILES: ognuno vede e modifica solo il proprio profilo
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Chi visita una pagina pubblica deve poter leggere nome agenzia/logo/colore del proprietario del viaggio
drop policy if exists "profiles_select_public_trip_owner" on public.profiles;
create policy "profiles_select_public_trip_owner" on public.profiles
  for select using (
    exists (
      select 1 from public.trips
      where trips.owner_id = profiles.id
        and trips.is_published = true
    )
  );

-- CLIENTS: solo il proprietario
drop policy if exists "clients_all_own" on public.clients;
create policy "clients_all_own" on public.clients
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- TRIP_GROUPS: solo il proprietario
drop policy if exists "trip_groups_all_own" on public.trip_groups;
create policy "trip_groups_all_own" on public.trip_groups
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- TRIPS: il proprietario fa tutto; chiunque può leggere un viaggio pubblicato
drop policy if exists "trips_all_own" on public.trips;
create policy "trips_all_own" on public.trips
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "trips_select_published" on public.trips;
create policy "trips_select_published" on public.trips
  for select using (is_published = true);

-- TRIP_DAYS: il proprietario del viaggio fa tutto; pubblico se il viaggio è pubblicato
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
    exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.is_published = true)
  );

-- ACTIVITIES: stessa logica, un livello più in profondità
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
      where trip_days.id = activities.trip_day_id and trips.is_published = true
    )
  );

-- ACTIVITY_TEMPLATES: la libreria è privata di ogni utente
drop policy if exists "activity_templates_all_own" on public.activity_templates;
create policy "activity_templates_all_own" on public.activity_templates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ACTIVITY_PHOTOS: stessa logica delle attività
drop policy if exists "activity_photos_all_own" on public.activity_photos;
create policy "activity_photos_all_own" on public.activity_photos
  for all using (
    exists (
      select 1 from public.activities
      join public.trip_days on trip_days.id = activities.trip_day_id
      join public.trips on trips.id = trip_days.trip_id
      where activities.id = activity_photos.activity_id and trips.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.activities
      join public.trip_days on trip_days.id = activities.trip_day_id
      join public.trips on trips.id = trip_days.trip_id
      where activities.id = activity_photos.activity_id and trips.owner_id = auth.uid()
    )
  );

drop policy if exists "activity_photos_select_published" on public.activity_photos;
create policy "activity_photos_select_published" on public.activity_photos
  for select using (
    exists (
      select 1 from public.activities
      join public.trip_days on trip_days.id = activities.trip_day_id
      join public.trips on trips.id = trip_days.trip_id
      where activities.id = activity_photos.activity_id and trips.is_published = true
    )
  );

-- DOCUMENTS: solo il proprietario del viaggio
drop policy if exists "documents_all_own" on public.documents;
create policy "documents_all_own" on public.documents
  for all using (
    exists (select 1 from public.trips where trips.id = documents.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = documents.trip_id and trips.owner_id = auth.uid())
  );

-- ============================================================
-- 9. STORAGE: bucket per i file caricati (biglietti, voucher, loghi)
-- Convenzione: ogni file viene salvato come "<id-utente>/<resto-del-percorso>"
-- così la regola di sicurezza sa subito di chi è, senza bisogno di altre tabelle.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

drop policy if exists "trip_documents_owner_all" on storage.objects;
create policy "trip_documents_owner_all" on storage.objects
  for all using (
    bucket_id = 'trip-documents' and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'trip-documents' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "public_assets_owner_write" on storage.objects;
create policy "public_assets_owner_write" on storage.objects
  for all using (
    bucket_id = 'public-assets' and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'public-assets' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "public_assets_read_all" on storage.objects;
create policy "public_assets_read_all" on storage.objects
  for select using (bucket_id = 'public-assets');
