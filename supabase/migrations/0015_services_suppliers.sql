-- Migrazione: Fornitori e Servizi (Fase 1 del modulo "gestionale vero e
-- proprio": amministrazione e prenotazione dei servizi).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0014_...
--
-- FORNITORI: rubrica dei fornitori dell'agenzia (hotel, compagnie di
-- trasporto, guide, ecc.), indipendente dai viaggi: uno stesso fornitore
-- si riusa su più viaggi.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  category text not null default 'altro'
    check (category in ('alloggio', 'trasporto', 'attivita', 'ristorazione', 'altro')),
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- SERVIZI: i servizi da prenotare/prenotati per un viaggio. Volutamente
-- separati dalle "activities" dell'itinerario: non sono visti dal cliente e
-- non sono obbligatori per costruire un viaggio. Possono opzionalmente
-- riferirsi a un'attività dell'itinerario (per sapere "a cosa corrisponde"),
-- ma non è richiesto.
create table if not exists public.trip_services (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  title text not null,
  status text not null default 'da_prenotare'
    check (status in ('da_prenotare', 'richiesto', 'confermato', 'cancellato')),
  net_cost numeric(10, 2),
  confirmation_number text,
  notes text,
  service_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists suppliers_owner_id_idx on public.suppliers (owner_id);
create index if not exists trip_services_trip_id_idx on public.trip_services (trip_id);

alter table public.suppliers enable row level security;
alter table public.trip_services enable row level security;

-- FORNITORI: solo il proprietario (come clients, activity_templates, ecc.)
drop policy if exists "suppliers_all_own" on public.suppliers;
create policy "suppliers_all_own" on public.suppliers
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- SERVIZI: solo il proprietario del viaggio a cui appartengono (stessa
-- logica già usata per trip_days/documents/activities)
drop policy if exists "trip_services_all_own" on public.trip_services;
create policy "trip_services_all_own" on public.trip_services
  for all using (
    exists (select 1 from public.trips where trips.id = trip_services.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = trip_services.trip_id and trips.owner_id = auth.uid())
  );
