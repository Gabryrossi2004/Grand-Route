-- 0052 — Diario di viaggio del cliente: note private per paese (e luogo), con data.
--
-- Il sito funziona anche prima di questo passaggio: la bacheca dei ricordi resta com'è
-- e la scheda «Diario» avvisa che non è ancora attiva.

create table if not exists public.client_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  country text not null check (char_length(country) between 2 and 80),
  place text check (place is null or char_length(place) <= 80),
  entry_date date not null default current_date,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists client_journal_user_country_idx
  on public.client_journal (user_id, country, entry_date desc, created_at desc);

alter table public.client_journal enable row level security;

drop policy if exists "client_journal_select_own" on public.client_journal;
create policy "client_journal_select_own" on public.client_journal
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "client_journal_insert_own" on public.client_journal;
create policy "client_journal_insert_own" on public.client_journal
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (trip_id is null or public.is_trip_client(trip_id)));

drop policy if exists "client_journal_update_own" on public.client_journal;
create policy "client_journal_update_own" on public.client_journal
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (trip_id is null or public.is_trip_client(trip_id)));

drop policy if exists "client_journal_delete_own" on public.client_journal;
create policy "client_journal_delete_own" on public.client_journal
  for delete to authenticated using (user_id = (select auth.uid()));

-- Tetto di sicurezza: al massimo 2000 note per persona
create or replace function public.client_journal_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.client_journal where user_id = new.user_id) >= 2000 then
    raise exception 'Hai raggiunto il numero massimo di note.';
  end if;
  return new;
end;
$$;

drop trigger if exists client_journal_cap_trg on public.client_journal;
create trigger client_journal_cap_trg
  before insert on public.client_journal
  for each row execute function public.client_journal_cap();
