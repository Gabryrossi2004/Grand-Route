-- Migrazione: Listino prezzi dei fornitori (Fase 1 del modulo "proponi
-- itinerario da richiesta cliente", pensato per i tour operator che
-- lavorano con fornitori locali via listini mail).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0026_...
--
-- Separata da "trip_services": qui non si tratta di un servizio prenotato
-- per UN viaggio, ma del catalogo prezzi riutilizzabile di un fornitore,
-- da cui in futuro si potrà proporre un itinerario a partire da una
-- richiesta cliente. owner_id diretto (come "suppliers"), non serve
-- passare dal viaggio: il listino non appartiene a nessun viaggio.
create table if not exists public.supplier_price_list_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  category text not null default 'altro'
    check (category in ('alloggio', 'trasporto', 'attivita', 'ristorazione', 'altro')),
  title text not null,
  description text,
  price numeric(10, 2),
  unit text,
  valid_from date,
  valid_to date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists supplier_price_list_items_owner_id_idx
  on public.supplier_price_list_items (owner_id);
create index if not exists supplier_price_list_items_supplier_id_idx
  on public.supplier_price_list_items (supplier_id);

alter table public.supplier_price_list_items enable row level security;

drop policy if exists "supplier_price_list_items_all_own" on public.supplier_price_list_items;
create policy "supplier_price_list_items_all_own" on public.supplier_price_list_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
