-- 0059 — Viaggiatori: lista della valigia, persone del viaggio, spese divise tra amici e budget.
--
-- Il sito funziona anche prima di questo passaggio: le pagine «Valigia» e «Spese» del viaggio
-- avvisano che serve l'aggiornamento.

-- Budget del viaggio (facoltativo)
alter table public.trips
  add column if not exists budget_eur numeric(10, 2) check (budget_eur is null or (budget_eur >= 0 and budget_eur <= 10000000));

-- 1. Valigia
create table if not exists public.trip_packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 120),
  category text not null default 'Altro' check (char_length(category) between 1 and 40),
  done boolean not null default false,
  item_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists trip_packing_items_trip_idx on public.trip_packing_items (trip_id, item_order);
alter table public.trip_packing_items enable row level security;
drop policy if exists "trip_packing_items_all_own" on public.trip_packing_items;
create policy "trip_packing_items_all_own" on public.trip_packing_items
  for all to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_packing_items.trip_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t where t.id = trip_packing_items.trip_id and t.owner_id = (select auth.uid())));

-- 2. Persone del viaggio (non serve che abbiano un account: sono solo nomi)
create table if not exists public.trip_people (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists trip_people_trip_name_idx on public.trip_people (trip_id, lower(name));
alter table public.trip_people enable row level security;
drop policy if exists "trip_people_all_own" on public.trip_people;
create policy "trip_people_all_own" on public.trip_people
  for all to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_people.trip_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t where t.id = trip_people.trip_id and t.owner_id = (select auth.uid())));

-- 3. Spese: chi ha pagato e tra chi si divide (elenco di persone)
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 120),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 1000000),
  category text not null default 'Altro' check (char_length(category) between 1 and 40),
  paid_by uuid not null references public.trip_people (id) on delete restrict,
  shared_with uuid[] not null default '{}',
  expense_date date,
  created_at timestamptz not null default now()
);
create index if not exists trip_expenses_trip_idx on public.trip_expenses (trip_id, created_at desc);
alter table public.trip_expenses enable row level security;
drop policy if exists "trip_expenses_all_own" on public.trip_expenses;
create policy "trip_expenses_all_own" on public.trip_expenses
  for all to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_expenses.trip_id and t.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t where t.id = trip_expenses.trip_id and t.owner_id = (select auth.uid())));
