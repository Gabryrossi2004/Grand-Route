-- 0056 — Itinerari dell'agenzia in Libreria: l'agente salva un suo viaggio come proposta per un paese
-- o una regione italiana; compare nella scheda paese/regione e in «Consulta proposte» di Zefiro.
--
-- Il sito funziona anche prima di questo passaggio: la scheda «Itinerari» della Libreria avvisa che
-- serve l'aggiornamento e Zefiro mostra solo le proposte di Grand Route.

create table if not exists public.agency_itineraries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('country', 'italy')),
  place_key text not null check (char_length(place_key) between 2 and 40),
  place_label text not null check (char_length(place_label) between 1 and 80),
  title text not null check (char_length(title) between 2 and 160),
  route text check (route is null or char_length(route) <= 600),
  description text check (description is null or char_length(description) <= 2000),
  days integer not null check (days between 1 and 60),
  program jsonb not null,
  source_trip_id uuid references public.trips (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists agency_itineraries_owner_place_idx on public.agency_itineraries (owner_id, kind, place_key);
alter table public.agency_itineraries enable row level security;
drop policy if exists "agency_itineraries_all_own" on public.agency_itineraries;
create policy "agency_itineraries_all_own" on public.agency_itineraries
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
