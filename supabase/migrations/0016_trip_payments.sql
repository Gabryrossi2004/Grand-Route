-- Migrazione: Scadenzario pagamenti (Fase 2 del gestionale prenotazioni).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0015_...
--
-- PAGAMENTI: sia gli incassi dal cliente (saldo, acconto...) sia i
-- pagamenti ai fornitori, con una data di scadenza e una data di
-- pagamento/incasso effettivo (null finché non è successo). Un pagamento
-- può opzionalmente riferirsi a un servizio specifico (es. "acconto Hotel
-- Lotus"), ma può anche essere generico per il viaggio (es. "saldo cliente").
create table if not exists public.trip_payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  service_id uuid references public.trip_services (id) on delete set null,
  direction text not null check (direction in ('incasso', 'pagamento')),
  amount numeric(10, 2) not null,
  due_date date,
  paid_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists trip_payments_trip_id_idx on public.trip_payments (trip_id);

alter table public.trip_payments enable row level security;

drop policy if exists "trip_payments_all_own" on public.trip_payments;
create policy "trip_payments_all_own" on public.trip_payments
  for all using (
    exists (select 1 from public.trips where trips.id = trip_payments.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = trip_payments.trip_id and trips.owner_id = auth.uid())
  );
