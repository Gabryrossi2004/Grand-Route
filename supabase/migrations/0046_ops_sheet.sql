-- Scheda operativa «day by day»: una riga per ogni servizio di ogni giorno
-- (cliente, agente, fornitore, contatto, persone, servizio, orario e punto di ritrovo, note, responsabile).
-- Le righe si scrivono a mano o si importano dagli itinerari dei viaggi; restano modificabili.
create table if not exists public.ops_rows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  service_date date not null,
  client text not null default '',
  agent text not null default '',
  supplier text not null default '',
  supplier_contact text not null default '',
  pax text not null default '',
  service text not null default '',
  meeting_time text not null default '',
  meeting_point text not null default '',
  notes text not null default '',
  responsible text not null default '',
  row_color text check (row_color in ('blu', 'giallo', 'verde', 'rosso', 'arancio', 'viola', 'grigio')),
  cell_colors jsonb not null default '{}'::jsonb,
  trip_id uuid references public.trips (id) on delete set null,
  activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_rows_owner_date_idx on public.ops_rows (owner_id, service_date);
-- un'attività dell'itinerario si importa una sola volta
create unique index if not exists ops_rows_owner_activity_idx on public.ops_rows (owner_id, activity_id) where activity_id is not null;

alter table public.ops_rows enable row level security;

drop policy if exists "ops_rows_all_own" on public.ops_rows;
create policy "ops_rows_all_own" on public.ops_rows
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
