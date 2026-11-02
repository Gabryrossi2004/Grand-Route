-- Migrazione: tipologie di attività colorate, varianti di viaggio (gruppi)
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver già eseguito supabase/schema.sql.
-- (cover_image_url esiste già dalla prima versione dello schema, non serve aggiungerlo)

-- Tipologia di ogni attività (determina anche il colore mostrato)
alter table public.activities
  add column if not exists activity_type text not null default 'altro'
  check (activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'altro'));

-- Gruppo di varianti: più proposte di viaggio alternative per lo stesso cliente
create table if not exists public.trip_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.trips
  add column if not exists group_id uuid references public.trip_groups (id) on delete set null;

alter table public.trip_groups enable row level security;

drop policy if exists "trip_groups_all_own" on public.trip_groups;
create policy "trip_groups_all_own" on public.trip_groups
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
