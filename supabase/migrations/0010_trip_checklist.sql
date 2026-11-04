-- Migrazione: checklist/promemoria interni per ogni viaggio (es. "Richiedere
-- saldo", "Confermare hotel"), visibili solo all'agenzia, mai al cliente.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0009_...

create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  item_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.trip_checklist_items enable row level security;

drop policy if exists "trip_checklist_items_all_own" on public.trip_checklist_items;
create policy "trip_checklist_items_all_own" on public.trip_checklist_items
  for all using (
    exists (
      select 1 from public.trips
      where trips.id = trip_checklist_items.trip_id and trips.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.trips
      where trips.id = trip_checklist_items.trip_id and trips.owner_id = auth.uid()
    )
  );
