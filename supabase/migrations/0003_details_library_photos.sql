-- Migrazione: dettagli specifici per tipo attività, libreria attività, foto
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0002_...

-- Dettagli extra dell'attività (es. per un volo: compagnia, PNR; per un hotel: tipo camera, trattamento)
-- Li salviamo come "jsonb", cioè un contenitore flessibile di campi, perché ogni tipologia
-- di attività ha campi diversi e così non dobbiamo creare decine di colonne quasi sempre vuote.
alter table public.activities
  add column if not exists details jsonb not null default '{}'::jsonb;

-- Libreria: attività "modello" salvate per essere riutilizzate in altri viaggi
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

alter table public.activity_templates enable row level security;

drop policy if exists "activity_templates_all_own" on public.activity_templates;
create policy "activity_templates_all_own" on public.activity_templates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Foto allegate a un'attività (es. foto dell'hotel, della camera, ecc.)
create table if not exists public.activity_photos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  url text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

alter table public.activity_photos enable row level security;

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
