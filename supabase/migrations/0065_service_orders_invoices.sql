-- 0065 — Rete: ordini di servizio tra partner, variazioni di prezzo, servizi svolti e fattura precompilata del fornitore.
--
-- Come funziona
--   • Un ORDINE collega chi compra (agenzia, tour operator…) e chi svolge il servizio (guida, autista, struttura…).
--     Lo può creare l'uno o l'altro, solo tra partner (collaborazione accettata). Ogni modifica va confermata
--     dall'altra parte.
--   • Il giorno dopo la data del servizio l'ordine diventa «svolto» da solo. Si può annullare fino al giorno del
--     servizio: gratis fino alla data limite, dopo con la penale concordata (solo se a cancellare è chi compra).
--   • Il prezzo cambia con le VARIAZIONI (ore di attesa, spese anticipate, sconti). Quelle del fornitore in aumento
--     si possono contestare per 3 giorni; poi valgono come accettate.
--   • Il fornitore sceglie i servizi svolti di un cliente e prepara la FATTURA: la bozza si compila da sola, si
--     modifica, si emette (la invia lui allo SDI) e si segna pagata. Grand Route non emette fatture.
--
-- Serve aver eseguito prima 0061, 0064.

-- ============================================================
-- 0. Data di oggi in Italia (lo «svolto» scatta a mezzanotte, ora italiana)
-- ============================================================
create or replace function public.network_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- ============================================================
-- 1. Impostazioni di fatturazione del fornitore
-- ============================================================
create table if not exists public.network_billing_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  person boolean not null default false,              -- persona fisica (nome e cognome) o società (denominazione)
  first_name text check (first_name is null or char_length(first_name) <= 60),
  last_name text check (last_name is null or char_length(last_name) <= 60),
  regime text not null default 'RF01' check (regime in ('RF01', 'RF02', 'RF19')),
  default_vat numeric(5, 2) not null default 22 check (default_vat in (0, 4, 5, 10, 22)),
  default_natura text check (default_natura is null or default_natura in ('N1', 'N2.1', 'N2.2', 'N4')),
  ritenuta boolean not null default false,
  ritenuta_rate numeric(5, 2) not null default 20 check (ritenuta_rate > 0 and ritenuta_rate <= 50),
  ritenuta_type text not null default 'RT01' check (ritenuta_type in ('RT01', 'RT02')),
  bollo_charge boolean not null default true,          -- la marca da bollo si addebita al cliente
  iban text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  bank text check (bank is null or char_length(bank) <= 80),
  payment_days integer not null default 30 check (payment_days between 0 and 180),
  next_number integer not null default 1 check (next_number between 1 and 999999),
  number_pattern text not null default '{n}/{anno}' check (char_length(number_pattern) between 3 and 30 and number_pattern like '%{n}%'),
  free_cancel_days integer not null default 2 check (free_cancel_days between 0 and 365),
  penalty_pct integer not null default 100 check (penalty_pct between 0 and 100),
  invoice_notes text check (invoice_notes is null or char_length(invoice_notes) <= 400),
  updated_at timestamptz not null default now()
);
alter table public.network_billing_settings enable row level security;
drop policy if exists "nbs_own" on public.network_billing_settings;
create policy "nbs_own" on public.network_billing_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- 2. Fatture (prima delle ordini, che le richiamano)
-- ============================================================
create table if not exists public.network_invoices (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'bozza' check (status in ('bozza', 'emessa', 'pagata', 'stornata')),
  number text check (number is null or char_length(number) between 1 and 20),
  issue_date date,
  due_date date,
  currency char(3) not null default 'EUR',
  doc jsonb not null default '{}'::jsonb,               -- intestazioni, righe, regime: la copia esatta della fattura
  imponibile numeric(12, 2) not null default 0,
  iva numeric(12, 2) not null default 0,
  ritenuta numeric(12, 2) not null default 0,
  bollo numeric(12, 2) not null default 0,
  totale numeric(12, 2) not null default 0,             -- totale documento (IVA compresa)
  netto numeric(12, 2) not null default 0,              -- da pagare (totale meno ritenuta)
  emitted_at timestamptz,
  paid_at date,
  paid_by uuid references public.profiles (id) on delete set null,
  void_note text check (void_note is null or char_length(void_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);
create index if not exists network_invoices_seller_idx on public.network_invoices (seller_id, created_at desc);
create index if not exists network_invoices_buyer_idx on public.network_invoices (buyer_id, created_at desc);
alter table public.network_invoices enable row level security;
-- Il fornitore vede tutte le sue; il cliente le vede solo da emesse in poi. Le scritture passano dalle funzioni.
drop policy if exists "ninv_select" on public.network_invoices;
create policy "ninv_select" on public.network_invoices for select to authenticated
  using (seller_id = auth.uid() or (buyer_id = auth.uid() and status <> 'bozza'));

-- ============================================================
-- 3. Ordini di servizio
-- ============================================================
create table if not exists public.network_orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  last_edit_by uuid not null references public.profiles (id) on delete cascade,  -- deve confermare l'altra parte
  buyer_service_id uuid references public.trip_services (id) on delete set null, -- servizio del viaggio (solo per chi compra)
  title text not null check (char_length(title) between 2 and 200),
  details text check (details is null or char_length(details) <= 2000),
  service_date date not null,
  end_date date,
  start_time time,
  place text check (place is null or char_length(place) <= 200),
  pax integer check (pax is null or pax between 1 and 9999),
  reference text check (reference is null or char_length(reference) <= 200),
  lead_name text check (lead_name is null or char_length(lead_name) <= 120),
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit text not null default 'servizio' check (char_length(unit) between 1 and 20),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  free_cancel_days integer not null default 2 check (free_cancel_days between 0 and 365),
  penalty_pct integer not null default 100 check (penalty_pct between 0 and 100),
  status text not null default 'richiesto' check (status in ('richiesto', 'confermato', 'rifiutato', 'annullato')),
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 300),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  penalty_amount numeric(12, 2) check (penalty_amount is null or penalty_amount >= 0),
  invoice_id uuid references public.network_invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_id <> buyer_id),
  check (end_date is null or end_date >= service_date)
);
create index if not exists network_orders_seller_idx on public.network_orders (seller_id, service_date);
create index if not exists network_orders_buyer_idx on public.network_orders (buyer_id, service_date);
create index if not exists network_orders_invoice_idx on public.network_orders (invoice_id);
alter table public.network_orders enable row level security;
drop policy if exists "norders_select" on public.network_orders;
create policy "norders_select" on public.network_orders for select to authenticated
  using (seller_id = auth.uid() or buyer_id = auth.uid());

-- Variazioni: extra sul servizio, spese anticipate per il cliente, sconti
create table if not exists public.network_order_extras (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.network_orders (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'servizio' check (kind in ('servizio', 'spesa')),
  description text not null check (char_length(description) between 2 and 300),
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price between -999999 and 999999),
  receipt_path text check (receipt_path is null or char_length(receipt_path) <= 300),
  status text not null default 'proposta' check (status in ('proposta', 'accettata', 'contestata')),
  proposed_at timestamptz not null default now(),
  decided_at timestamptz,
  contest_note text check (contest_note is null or char_length(contest_note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists network_order_extras_order_idx on public.network_order_extras (order_id);
alter table public.network_order_extras enable row level security;
drop policy if exists "nextras_select" on public.network_order_extras;
create policy "nextras_select" on public.network_order_extras for select to authenticated
  using (exists (select 1 from public.network_orders o where o.id = order_id and (o.seller_id = auth.uid() or o.buyer_id = auth.uid())));

-- ============================================================
-- 4. Regole di calcolo (le stesse del sito)
-- ============================================================
-- Fase di un ordine: da_confermare, confermato, svolto, penale, annullato, rifiutato, fatturato
create or replace function public.network_order_phase(o public.network_orders)
returns text
language sql
stable
as $$
  select case
    when o.invoice_id is not null then 'fatturato'
    when o.status = 'rifiutato' then 'rifiutato'
    when o.status = 'annullato' then case when coalesce(o.penalty_amount, 0) > 0 then 'penale' else 'annullato' end
    when coalesce(o.end_date, o.service_date) < public.network_today() then 'svolto'
    when o.status = 'confermato' then 'confermato'
    else 'da_confermare'
  end;
$$;

-- Stato effettivo di una variazione: proposta (in attesa), accettata (anche in silenzio dopo 3 giorni), contestata
create or replace function public.network_extra_state(e public.network_order_extras)
returns text
language sql
stable
as $$
  select case
    when e.status = 'contestata' then 'contestata'
    when e.status = 'accettata' then 'accettata'
    when e.proposed_at <= now() - interval '3 days' then 'accettata'
    else 'proposta'
  end;
$$;

-- Ultimo giorno in cui si annulla gratis
create or replace function public.network_order_free_until(o public.network_orders)
returns date
language sql
immutable
as $$
  select o.service_date - o.free_cancel_days;
$$;

create or replace function public.network_is_order_party(p_order uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.network_orders o where o.id = p_order and (o.seller_id = auth.uid() or o.buyer_id = auth.uid()));
$$;

create or replace function public.network_is_order_folder(p_folder text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_folder ~ '^[0-9a-f-]{36}$' and public.network_is_order_party(p_folder::uuid);
$$;

-- Ricevute delle spese (foto o PDF): le vedono solo le due parti dell'ordine
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('network-orders', 'network-orders', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "network_orders_files_read" on storage.objects;
create policy "network_orders_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'network-orders' and public.network_is_order_folder((storage.foldername(name))[1]));
drop policy if exists "network_orders_files_write" on storage.objects;
create policy "network_orders_files_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'network-orders' and public.network_is_order_folder((storage.foldername(name))[1]));
drop policy if exists "network_orders_files_delete" on storage.objects;
create policy "network_orders_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'network-orders' and owner = auth.uid());

-- Aggiorna lo stato del servizio nel viaggio di chi compra (se l'ordine è nato da lì)
create or replace function public.network_sync_trip_service(p_order uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.network_orders%rowtype;
begin
  select * into o from public.network_orders where id = p_order;
  if not found or o.buyer_service_id is null then return; end if;
  update public.trip_services s set status = p_status
   where s.id = o.buyer_service_id
     and exists (select 1 from public.trips t where t.id = s.trip_id and t.owner_id = o.buyer_id);
end;
$$;

-- ============================================================
-- 5. Ordini: creare, modificare, confermare, rifiutare, annullare
-- ============================================================
create or replace function public.network_order_create(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := p ->> 'role';                    -- 'buyer' (ordino io) o 'seller' (registro un lavoro che svolgo io)
  v_other uuid := nullif(p ->> 'counterpart', '')::uuid;
  v_seller uuid;
  v_buyer uuid;
  v_service uuid := nullif(p ->> 'buyer_service_id', '')::uuid;
  v_terms public.network_billing_settings%rowtype;
  v_id uuid;
begin
  if v_uid is null or not public.network_has_access(v_uid) then raise exception 'Serve un accesso attivo alla Rete.'; end if;
  if v_role not in ('buyer', 'seller') or v_other is null or v_other = v_uid then raise exception 'Dati non validi.'; end if;
  if not public.network_are_partners(v_uid, v_other) then
    raise exception 'Puoi creare ordini solo con i tuoi partner: proponi prima una collaborazione.';
  end if;
  if (select count(*) from public.network_orders where created_by = v_uid and created_at > now() - interval '1 day') >= 300 then
    raise exception 'Troppi ordini creati oggi: riprova domani.';
  end if;
  v_seller := case when v_role = 'seller' then v_uid else v_other end;
  v_buyer := case when v_role = 'buyer' then v_uid else v_other end;
  if v_service is not null and (v_role <> 'buyer' or not exists (
    select 1 from public.trip_services s join public.trips t on t.id = s.trip_id where s.id = v_service and t.owner_id = v_uid)) then
    v_service := null;
  end if;
  select * into v_terms from public.network_billing_settings where user_id = v_seller;

  insert into public.network_orders (
    seller_id, buyer_id, created_by, last_edit_by, buyer_service_id, title, details, service_date, end_date, start_time,
    place, pax, reference, lead_name, quantity, unit, unit_price, currency, free_cancel_days, penalty_pct
  ) values (
    v_seller, v_buyer, v_uid, v_uid, v_service,
    trim(p ->> 'title'), nullif(trim(coalesce(p ->> 'details', '')), ''),
    (p ->> 'service_date')::date, nullif(p ->> 'end_date', '')::date, nullif(p ->> 'start_time', '')::time,
    nullif(trim(coalesce(p ->> 'place', '')), ''), nullif(p ->> 'pax', '')::int,
    nullif(trim(coalesce(p ->> 'reference', '')), ''), nullif(trim(coalesce(p ->> 'lead_name', '')), ''),
    coalesce(nullif(p ->> 'quantity', '')::numeric, 1), coalesce(nullif(trim(coalesce(p ->> 'unit', '')), ''), 'servizio'),
    (p ->> 'unit_price')::numeric, upper(coalesce(nullif(p ->> 'currency', ''), 'EUR')),
    coalesce(nullif(p ->> 'free_cancel_days', '')::int, v_terms.free_cancel_days, 2),
    coalesce(nullif(p ->> 'penalty_pct', '')::int, v_terms.penalty_pct, 100)
  ) returning id into v_id;

  if v_service is not null then perform public.network_sync_trip_service(v_id, 'richiesto'); end if;

  -- I profili di prova non possono rispondere: confermano da soli
  if exists (select 1 from public.profiles where id = v_other and email like '%@demo.grandroute.invalid') then
    update public.network_orders set status = 'confermato', confirmed_at = now() where id = v_id;
    if v_service is not null then perform public.network_sync_trip_service(v_id, 'confermato'); end if;
  end if;
  return v_id;
end;
$$;

-- Modifica: i dati che contano (data, prezzo, quantità, condizioni…) tornano da confermare all'altra parte
create or replace function public.network_order_update(p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.network_orders%rowtype;
  n public.network_orders%rowtype;
  v_uid uuid := auth.uid();
begin
  select * into o from public.network_orders where id = p_id and (seller_id = v_uid or buyer_id = v_uid) for update;
  if not found then raise exception 'Ordine non trovato.'; end if;
  if o.status not in ('richiesto', 'confermato') or o.invoice_id is not null then raise exception 'Questo ordine non si può più modificare.'; end if;
  if public.network_today() > o.service_date then
    raise exception 'Il servizio è già iniziato: per cambiare il prezzo aggiungi una variazione.';
  end if;
  n := o;
  n.title := trim(p ->> 'title');
  n.details := nullif(trim(coalesce(p ->> 'details', '')), '');
  n.service_date := (p ->> 'service_date')::date;
  n.end_date := nullif(p ->> 'end_date', '')::date;
  n.start_time := nullif(p ->> 'start_time', '')::time;
  n.place := nullif(trim(coalesce(p ->> 'place', '')), '');
  n.pax := nullif(p ->> 'pax', '')::int;
  n.reference := nullif(trim(coalesce(p ->> 'reference', '')), '');
  n.lead_name := nullif(trim(coalesce(p ->> 'lead_name', '')), '');
  n.quantity := coalesce(nullif(p ->> 'quantity', '')::numeric, 1);
  n.unit := coalesce(nullif(trim(coalesce(p ->> 'unit', '')), ''), 'servizio');
  n.unit_price := (p ->> 'unit_price')::numeric;
  n.currency := upper(coalesce(nullif(p ->> 'currency', ''), o.currency));
  n.free_cancel_days := coalesce(nullif(p ->> 'free_cancel_days', '')::int, o.free_cancel_days);
  n.penalty_pct := coalesce(nullif(p ->> 'penalty_pct', '')::int, o.penalty_pct);

  if (n.title, n.service_date, n.end_date, n.start_time, n.place, n.pax, n.quantity, n.unit, n.unit_price, n.currency, n.free_cancel_days, n.penalty_pct)
     is distinct from
     (o.title, o.service_date, o.end_date, o.start_time, o.place, o.pax, o.quantity, o.unit, o.unit_price, o.currency, o.free_cancel_days, o.penalty_pct) then
    update public.network_orders set
      title = n.title, details = n.details, service_date = n.service_date, end_date = n.end_date, start_time = n.start_time,
      place = n.place, pax = n.pax, reference = n.reference, lead_name = n.lead_name, quantity = n.quantity, unit = n.unit,
      unit_price = n.unit_price, currency = n.currency, free_cancel_days = n.free_cancel_days, penalty_pct = n.penalty_pct,
      status = 'richiesto', confirmed_at = null, last_edit_by = v_uid, updated_at = now()
    where id = p_id;
    perform public.network_sync_trip_service(p_id, 'richiesto');
  else
    -- solo note, riferimento o nome: nessuna nuova conferma
    update public.network_orders set details = n.details, reference = n.reference, lead_name = n.lead_name, updated_at = now() where id = p_id;
  end if;
end;
$$;

create or replace function public.network_order_confirm(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.network_orders%rowtype;
begin
  select * into o from public.network_orders where id = p_id and (seller_id = auth.uid() or buyer_id = auth.uid()) for update;
  if not found or o.status <> 'richiesto' or o.invoice_id is not null then raise exception 'Ordine non trovato o già gestito.'; end if;
  if o.last_edit_by = auth.uid() then raise exception 'Aspetta la conferma dell''altra parte.'; end if;
  update public.network_orders set status = 'confermato', confirmed_at = now(), updated_at = now() where id = p_id;
  perform public.network_sync_trip_service(p_id, 'confermato');
end;
$$;

create or replace function public.network_order_decline(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.network_orders%rowtype;
begin
  select * into o from public.network_orders where id = p_id and (seller_id = auth.uid() or buyer_id = auth.uid()) for update;
  if not found or o.status <> 'richiesto' or o.invoice_id is not null then raise exception 'Ordine non trovato o già gestito.'; end if;
  if o.last_edit_by = auth.uid() then raise exception 'Non puoi rifiutare una proposta tua: annullala.'; end if;
  update public.network_orders set status = 'rifiutato', decline_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''), updated_at = now() where id = p_id;
  perform public.network_sync_trip_service(p_id, 'da_prenotare');
end;
$$;

-- Annullare: fino al giorno del servizio. Penale solo se annulla chi compra, su un ordine confermato, dopo la data limite.
create or replace function public.network_order_cancel(p_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.network_orders%rowtype;
  v_penalty numeric(12, 2) := 0;
begin
  select * into o from public.network_orders where id = p_id and (seller_id = auth.uid() or buyer_id = auth.uid()) for update;
  if not found or o.status not in ('richiesto', 'confermato') or o.invoice_id is not null then raise exception 'Ordine non trovato o già chiuso.'; end if;
  if public.network_today() > o.service_date then raise exception 'Il servizio è già passato: non si può più annullare.'; end if;
  if auth.uid() = o.buyer_id and o.status = 'confermato' and public.network_today() > public.network_order_free_until(o) then
    v_penalty := round(o.quantity * o.unit_price * o.penalty_pct / 100.0, 2);
  end if;
  update public.network_orders set status = 'annullato', cancelled_at = now(), cancelled_by = auth.uid(),
    penalty_amount = nullif(v_penalty, 0), updated_at = now() where id = p_id;
  perform public.network_sync_trip_service(p_id, 'cancellato');
  return v_penalty;
end;
$$;

-- Il fornitore può ridurre (o togliere) la penale
create or replace function public.network_order_set_penalty(p_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.network_orders%rowtype;
begin
  select * into o from public.network_orders where id = p_id and seller_id = auth.uid() for update;
  if not found or o.status <> 'annullato' or o.invoice_id is not null or coalesce(o.penalty_amount, 0) = 0 then raise exception 'Ordine non trovato.'; end if;
  if p_amount is null or p_amount < 0 or p_amount > o.penalty_amount then raise exception 'La penale si può solo ridurre.'; end if;
  update public.network_orders set penalty_amount = nullif(round(p_amount, 2), 0), updated_at = now() where id = p_id;
end;
$$;

-- ============================================================
-- 6. Variazioni
-- ============================================================
create or replace function public.network_extra_add(p_order uuid, p_kind text, p_description text, p_quantity numeric, p_unit_price numeric, p_receipt text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.network_orders%rowtype;
  v_id uuid;
  v_auto boolean;
begin
  select * into o from public.network_orders where id = p_order and (seller_id = auth.uid() or buyer_id = auth.uid());
  if not found or o.status not in ('richiesto', 'confermato') or o.invoice_id is not null then raise exception 'A questo ordine non si possono aggiungere variazioni.'; end if;
  if p_kind not in ('servizio', 'spesa') then raise exception 'Dati non validi.'; end if;
  if p_receipt is not null and p_receipt not like p_order::text || '/%' then p_receipt := null; end if;
  if (select count(*) from public.network_order_extras where order_id = p_order) >= 50 then raise exception 'Troppe variazioni per un ordine.'; end if;
  -- si accetta da sola se la aggiunge chi paga, o se riduce il prezzo
  v_auto := auth.uid() = o.buyer_id or coalesce(p_quantity, 1) * p_unit_price <= 0;
  insert into public.network_order_extras (order_id, created_by, kind, description, quantity, unit_price, receipt_path, status, decided_at)
  values (p_order, auth.uid(), p_kind, trim(p_description), coalesce(p_quantity, 1), round(p_unit_price, 2), p_receipt,
          case when v_auto then 'accettata' else 'proposta' end, case when v_auto then now() end)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.network_extra_update(p_id uuid, p_kind text, p_description text, p_quantity numeric, p_unit_price numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.network_order_extras%rowtype;
  o public.network_orders%rowtype;
begin
  select * into e from public.network_order_extras where id = p_id and created_by = auth.uid() for update;
  if not found then raise exception 'Variazione non trovata.'; end if;
  select * into o from public.network_orders where id = e.order_id;
  if o.invoice_id is not null then raise exception 'L''ordine è già in fattura.'; end if;
  if public.network_extra_state(e) = 'accettata' and auth.uid() <> o.buyer_id then raise exception 'Variazione già accettata: aggiungine un''altra per correggerla.'; end if;
  update public.network_order_extras set kind = p_kind, description = trim(p_description), quantity = coalesce(p_quantity, 1),
    unit_price = round(p_unit_price, 2),
    status = case when auth.uid() = o.buyer_id or coalesce(p_quantity, 1) * p_unit_price <= 0 then 'accettata' else 'proposta' end,
    proposed_at = now(), decided_at = null, contest_note = null
  where id = p_id;
end;
$$;

create or replace function public.network_extra_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.network_order_extras%rowtype;
begin
  select * into e from public.network_order_extras where id = p_id and created_by = auth.uid();
  if not found then raise exception 'Variazione non trovata.'; end if;
  if exists (select 1 from public.network_orders where id = e.order_id and invoice_id is not null) then raise exception 'L''ordine è già in fattura.'; end if;
  delete from public.network_order_extras where id = p_id;
end;
$$;

-- Chi paga accetta o contesta (contestare si può solo finché la variazione è in attesa)
create or replace function public.network_extra_decide(p_id uuid, p_accept boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.network_order_extras%rowtype;
  o public.network_orders%rowtype;
  v_state text;
begin
  select * into e from public.network_order_extras where id = p_id for update;
  if not found then raise exception 'Variazione non trovata.'; end if;
  select * into o from public.network_orders where id = e.order_id;
  if o.buyer_id <> auth.uid() or e.created_by = auth.uid() or o.invoice_id is not null then raise exception 'Variazione non trovata.'; end if;
  v_state := public.network_extra_state(e);
  if p_accept then
    update public.network_order_extras set status = 'accettata', decided_at = now(), contest_note = null where id = p_id;
  else
    if v_state <> 'proposta' then raise exception 'Il tempo per contestare è scaduto (3 giorni).'; end if;
    update public.network_order_extras set status = 'contestata', decided_at = now(), contest_note = nullif(left(trim(coalesce(p_note, '')), 300), '') where id = p_id;
  end if;
end;
$$;

-- ============================================================
-- 7. Elenchi
-- ============================================================
create or replace function public.network_orders_list(p_role text)
returns table (
  id uuid, role text, counterpart uuid, counterpart_name text, counterpart_kind text,
  created_by uuid, last_edit_by uuid, title text, details text, service_date date, end_date date, start_time time,
  place text, pax integer, reference text, lead_name text, quantity numeric, unit text, unit_price numeric, currency text,
  free_cancel_days integer, penalty_pct integer, status text, phase text, free_until date, decline_reason text,
  confirmed_at timestamptz, cancelled_at timestamptz, cancelled_by uuid, penalty_amount numeric,
  invoice_id uuid, invoice_status text, invoice_number text, buyer_service_id uuid, trip_id uuid, trip_title text, service_net_cost numeric,
  extras jsonb, created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select o.id,
         case when o.seller_id = auth.uid() then 'seller' else 'buyer' end,
         c.id, coalesce(np.business_name, c.agency_name, c.full_name, 'Professionista'), public.network_kind_of(c.id),
         o.created_by, o.last_edit_by, o.title, o.details, o.service_date, o.end_date, o.start_time,
         o.place, o.pax, o.reference, o.lead_name, o.quantity, o.unit, o.unit_price, o.currency::text,
         o.free_cancel_days, o.penalty_pct, o.status, public.network_order_phase(o), public.network_order_free_until(o), o.decline_reason,
         o.confirmed_at, o.cancelled_at, o.cancelled_by, o.penalty_amount,
         o.invoice_id, i.status, i.number,
         case when o.buyer_id = auth.uid() then o.buyer_service_id end,
         case when o.buyer_id = auth.uid() then t.id end,
         case when o.buyer_id = auth.uid() then t.title end,
         case when o.buyer_id = auth.uid() then s.net_cost end,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', e.id, 'created_by', e.created_by, 'kind', e.kind, 'description', e.description, 'quantity', e.quantity,
             'unit_price', e.unit_price, 'receipt_path', e.receipt_path, 'state', public.network_extra_state(e),
             'proposed_at', e.proposed_at, 'contest_note', e.contest_note) order by e.created_at)
           from public.network_order_extras e where e.order_id = o.id
         ), '[]'::jsonb),
         o.created_at
  from public.network_orders o
  join public.profiles c on c.id = case when o.seller_id = auth.uid() then o.buyer_id else o.seller_id end
  left join public.network_profiles np on np.user_id = c.id
  left join public.network_invoices i on i.id = o.invoice_id
  left join public.trip_services s on s.id = o.buyer_service_id and o.buyer_id = auth.uid()
  left join public.trips t on t.id = s.trip_id and t.owner_id = auth.uid()
  where (p_role = 'seller' and o.seller_id = auth.uid())
     or (p_role = 'buyer' and o.buyer_id = auth.uid())
     or (p_role = 'all' and (o.seller_id = auth.uid() or o.buyer_id = auth.uid()))
  order by o.service_date desc, o.created_at desc
  limit 1000;
$$;

-- Partner con cui posso creare ordini, e le condizioni di cancellazione del fornitore
create or replace function public.network_order_partners()
returns table (user_id uuid, name text, kind text, free_cancel_days integer, penalty_pct integer)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, coalesce(np.business_name, o.agency_name, o.full_name, 'Professionista'), public.network_kind_of(o.id),
         coalesce(b.free_cancel_days, 2), coalesce(b.penalty_pct, 100)
  from public.network_collaborations c
  join public.profiles o on o.id = case when c.from_user = auth.uid() then c.to_user else c.from_user end
  left join public.network_profiles np on np.user_id = o.id
  left join public.network_billing_settings b on b.user_id = o.id
  where c.status = 'accettata' and (c.from_user = auth.uid() or c.to_user = auth.uid())
  order by 2;
$$;

-- Cose da fare (per i contatori nei menu)
create or replace function public.network_todo_counts()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'seller', (select count(*) from public.network_orders o
               where o.seller_id = auth.uid() and o.status = 'richiesto' and o.last_edit_by <> auth.uid()
                 and o.invoice_id is null and public.network_order_phase(o) = 'da_confermare')
            + (select count(*) from public.network_order_extras e join public.network_orders o on o.id = e.order_id
               where o.seller_id = auth.uid() and o.invoice_id is null and public.network_extra_state(e) = 'contestata'),
    'buyer', (select count(*) from public.network_orders o
              where o.buyer_id = auth.uid() and o.status = 'richiesto' and o.last_edit_by <> auth.uid()
                and o.invoice_id is null and public.network_order_phase(o) = 'da_confermare')
           + (select count(*) from public.network_order_extras e join public.network_orders o on o.id = e.order_id
              where o.buyer_id = auth.uid() and e.created_by <> auth.uid() and o.invoice_id is null and public.network_extra_state(e) = 'proposta')
           + (select count(*) from public.network_invoices i where i.buyer_id = auth.uid() and i.status = 'emessa')
  );
$$;

-- ============================================================
-- 8. Fatture: bozza, salvataggio, emissione, pagamento, storno
-- ============================================================
-- Un ordine si può fatturare se è svolto (o annullato con penale), non è già in fattura e non ha variazioni in sospeso
create or replace function public.network_order_billable(o public.network_orders)
returns boolean
language sql
stable
as $$
  select o.invoice_id is null
     and public.network_order_phase(o) in ('svolto', 'penale')
     and (public.network_order_phase(o) = 'penale' or not exists (
       select 1 from public.network_order_extras e where e.order_id = o.id and public.network_extra_state(e) in ('proposta', 'contestata')));
$$;

create or replace function public.network_invoice_create(p_buyer uuid, p_orders uuid[], p_doc jsonb, p_number text, p_issue_date date, p_due_date date, p_totals jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_count int;
  v_currency text;
begin
  if v_uid is null or coalesce(array_length(p_orders, 1), 0) = 0 or array_length(p_orders, 1) > 200 then raise exception 'Scegli almeno un servizio.'; end if;
  perform 1 from public.network_orders where id = any (p_orders) for update;
  select count(*), min(currency) into v_count, v_currency from public.network_orders o
   where o.id = any (p_orders) and o.seller_id = v_uid and o.buyer_id = p_buyer and public.network_order_billable(o);
  if v_count <> array_length(p_orders, 1) then raise exception 'Alcuni servizi non sono più da fatturare: ricarica la pagina.'; end if;
  if (select count(distinct currency) from public.network_orders where id = any (p_orders)) > 1 then raise exception 'Servizi in valute diverse: fai una fattura per valuta.'; end if;
  insert into public.network_invoices (seller_id, buyer_id, number, issue_date, due_date, currency, doc,
    imponibile, iva, ritenuta, bollo, totale, netto)
  values (v_uid, p_buyer, nullif(trim(coalesce(p_number, '')), ''), p_issue_date, p_due_date, v_currency, coalesce(p_doc, '{}'::jsonb),
    coalesce((p_totals ->> 'imponibile')::numeric, 0), coalesce((p_totals ->> 'iva')::numeric, 0), coalesce((p_totals ->> 'ritenuta')::numeric, 0),
    coalesce((p_totals ->> 'bollo')::numeric, 0), coalesce((p_totals ->> 'totale')::numeric, 0), coalesce((p_totals ->> 'netto')::numeric, 0))
  returning id into v_id;
  update public.network_orders set invoice_id = v_id, updated_at = now() where id = any (p_orders);
  return v_id;
end;
$$;

create or replace function public.network_invoice_save(p_id uuid, p_doc jsonb, p_number text, p_issue_date date, p_due_date date, p_totals jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.network_invoices set doc = coalesce(p_doc, doc), number = nullif(trim(coalesce(p_number, '')), ''),
    issue_date = p_issue_date, due_date = p_due_date,
    imponibile = coalesce((p_totals ->> 'imponibile')::numeric, 0), iva = coalesce((p_totals ->> 'iva')::numeric, 0),
    ritenuta = coalesce((p_totals ->> 'ritenuta')::numeric, 0), bollo = coalesce((p_totals ->> 'bollo')::numeric, 0),
    totale = coalesce((p_totals ->> 'totale')::numeric, 0), netto = coalesce((p_totals ->> 'netto')::numeric, 0), updated_at = now()
  where id = p_id and seller_id = auth.uid() and status = 'bozza';
  if not found then raise exception 'Bozza non trovata.'; end if;
end;
$$;

create or replace function public.network_invoice_emit(p_id uuid, p_doc jsonb, p_number text, p_issue_date date, p_due_date date, p_totals jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text := nullif(trim(coalesce(p_number, '')), '');
  v_n int;
begin
  if v_number is null or p_issue_date is null then raise exception 'Servono numero e data della fattura.'; end if;
  if p_issue_date > public.network_today() then raise exception 'La data della fattura non può essere nel futuro.'; end if;
  if exists (select 1 from public.network_invoices where seller_id = auth.uid() and id <> p_id and status in ('emessa', 'pagata')
             and number = v_number and extract(year from issue_date) = extract(year from p_issue_date)) then
    raise exception 'Hai già emesso una fattura con il numero % nello stesso anno.', v_number;
  end if;
  perform public.network_invoice_save(p_id, p_doc, v_number, p_issue_date, p_due_date, p_totals);
  update public.network_invoices set status = 'emessa', emitted_at = now(), updated_at = now() where id = p_id and seller_id = auth.uid() and status = 'bozza';
  -- il prossimo numero suggerito va avanti
  v_n := nullif(substring(v_number from '^[0-9]+'), '')::int;
  if v_n is not null then
    insert into public.network_billing_settings (user_id, next_number) values (auth.uid(), v_n + 1)
    on conflict (user_id) do update set next_number = greatest(public.network_billing_settings.next_number, excluded.next_number);
  end if;
end;
$$;

create or replace function public.network_invoice_delete_draft(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.network_invoices where id = p_id and seller_id = auth.uid() and status = 'bozza') then raise exception 'Bozza non trovata.'; end if;
  update public.network_orders set invoice_id = null, updated_at = now() where invoice_id = p_id;
  delete from public.network_invoices where id = p_id;
end;
$$;

-- Storno (dopo aver emesso una nota di credito): i servizi tornano da fatturare
create or replace function public.network_invoice_void(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.network_invoices set status = 'stornata', void_note = nullif(left(trim(coalesce(p_note, '')), 300), ''), updated_at = now()
   where id = p_id and seller_id = auth.uid() and status in ('emessa', 'pagata');
  if not found then raise exception 'Fattura non trovata.'; end if;
  update public.network_orders set invoice_id = null, updated_at = now() where invoice_id = p_id;
end;
$$;

create or replace function public.network_invoice_set_paid(p_id uuid, p_paid boolean, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.network_invoices set
    status = case when p_paid then 'pagata' else 'emessa' end,
    paid_at = case when p_paid then coalesce(p_date, public.network_today()) end,
    paid_by = case when p_paid then auth.uid() end,
    updated_at = now()
  where id = p_id and (seller_id = auth.uid() or buyer_id = auth.uid()) and status in ('emessa', 'pagata');
  if not found then raise exception 'Fattura non trovata.'; end if;
end;
$$;

create or replace function public.network_invoices_list(p_role text)
returns table (
  id uuid, role text, counterpart uuid, counterpart_name text, status text, number text, issue_date date, due_date date,
  currency text, imponibile numeric, iva numeric, ritenuta numeric, bollo numeric, totale numeric, netto numeric,
  paid_at date, emitted_at timestamptz, created_at timestamptz, orders_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  select i.id, case when i.seller_id = auth.uid() then 'seller' else 'buyer' end,
         c.id, coalesce(np.business_name, c.agency_name, c.full_name, 'Professionista'),
         i.status, i.number, i.issue_date, i.due_date, i.currency::text, i.imponibile, i.iva, i.ritenuta, i.bollo, i.totale, i.netto,
         i.paid_at, i.emitted_at, i.created_at,
         (select count(*)::int from public.network_orders o where o.invoice_id = i.id)
  from public.network_invoices i
  join public.profiles c on c.id = case when i.seller_id = auth.uid() then i.buyer_id else i.seller_id end
  left join public.network_profiles np on np.user_id = c.id
  where (p_role = 'seller' and i.seller_id = auth.uid())
     or (p_role = 'buyer' and i.buyer_id = auth.uid() and i.status <> 'bozza')
  order by coalesce(i.issue_date, i.created_at::date) desc, i.created_at desc
  limit 1000;
$$;

-- Dati di fatturazione delle due parti (per precompilare): il fornitore li chiede per sé e per il cliente
create or replace function public.network_invoice_parties(p_buyer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.network_are_partners(v_uid, p_buyer)
     and not exists (select 1 from public.network_orders where seller_id = v_uid and buyer_id = p_buyer) then
    raise exception 'Cliente non trovato.';
  end if;
  return jsonb_build_object(
    'seller', (select to_jsonb(n) - 'kind_data' - 'description' - 'countries_served' - 'languages' - 'specialties' - 'gallery' - 'cover_path' - 'logo_path' - 'tagline' - 'brand_color'
               from public.network_profiles n where n.user_id = v_uid),
    'buyer', (select jsonb_build_object('business_name', n.business_name, 'legal_form', n.legal_form, 'country', n.country, 'vat_number', n.vat_number,
                     'tax_code', n.tax_code, 'sdi_code', n.sdi_code, 'pec', n.pec, 'address', n.address, 'postal_code', n.postal_code,
                     'city', n.city, 'province', n.province)
              from public.network_profiles n where n.user_id = p_buyer),
    'settings', (select to_jsonb(b) from public.network_billing_settings b where b.user_id = v_uid)
  );
end;
$$;

-- ============================================================
-- 9. Notifiche: le iscrizioni push e l'email dell'altra parte (solo per chi è parte dell'ordine o della fattura)
-- ============================================================
create or replace function public.network_counterpart_of(p_order uuid, p_invoice uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select case when o.seller_id = auth.uid() then o.buyer_id when o.buyer_id = auth.uid() then o.seller_id end
       from public.network_orders o where o.id = p_order),
    (select case when i.seller_id = auth.uid() then i.buyer_id when i.buyer_id = auth.uid() and i.status <> 'bozza' then i.seller_id end
       from public.network_invoices i where i.id = p_invoice)
  );
$$;

create or replace function public.network_party_push_targets(p_order uuid, p_invoice uuid)
returns table (endpoint text, p256dh text, auth_key text)
language sql
security definer
set search_path = public
stable
as $$
  select ps.endpoint, ps.p256dh, ps.auth
  from public.push_subscriptions ps
  where ps.profile_id = public.network_counterpart_of(p_order, p_invoice);
$$;

create or replace function public.network_party_email(p_order uuid, p_invoice uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.email from public.profiles p
  where p.id = public.network_counterpart_of(p_order, p_invoice) and p.email not like '%@demo.grandroute.invalid';
$$;

-- ============================================================
-- 10. Permessi
-- ============================================================
revoke all on function public.network_sync_trip_service(uuid, text) from public, anon, authenticated;
revoke all on function public.network_counterpart_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public.network_is_order_party(uuid) from public, anon;
revoke all on function public.network_is_order_folder(text) from public, anon;
revoke all on function public.network_order_create(jsonb) from public, anon;
revoke all on function public.network_order_update(uuid, jsonb) from public, anon;
revoke all on function public.network_order_confirm(uuid) from public, anon;
revoke all on function public.network_order_decline(uuid, text) from public, anon;
revoke all on function public.network_order_cancel(uuid) from public, anon;
revoke all on function public.network_order_set_penalty(uuid, numeric) from public, anon;
revoke all on function public.network_extra_add(uuid, text, text, numeric, numeric, text) from public, anon;
revoke all on function public.network_extra_update(uuid, text, text, numeric, numeric) from public, anon;
revoke all on function public.network_extra_delete(uuid) from public, anon;
revoke all on function public.network_extra_decide(uuid, boolean, text) from public, anon;
revoke all on function public.network_orders_list(text) from public, anon;
revoke all on function public.network_order_partners() from public, anon;
revoke all on function public.network_todo_counts() from public, anon;
revoke all on function public.network_invoice_create(uuid, uuid[], jsonb, text, date, date, jsonb) from public, anon;
revoke all on function public.network_invoice_save(uuid, jsonb, text, date, date, jsonb) from public, anon;
revoke all on function public.network_invoice_emit(uuid, jsonb, text, date, date, jsonb) from public, anon;
revoke all on function public.network_invoice_delete_draft(uuid) from public, anon;
revoke all on function public.network_invoice_void(uuid, text) from public, anon;
revoke all on function public.network_invoice_set_paid(uuid, boolean, date) from public, anon;
revoke all on function public.network_invoices_list(text) from public, anon;
revoke all on function public.network_invoice_parties(uuid) from public, anon;
revoke all on function public.network_party_push_targets(uuid, uuid) from public, anon;
revoke all on function public.network_party_email(uuid, uuid) from public, anon;
grant execute on function public.network_is_order_party(uuid) to authenticated;
grant execute on function public.network_is_order_folder(text) to authenticated;
grant execute on function public.network_order_create(jsonb) to authenticated;
grant execute on function public.network_order_update(uuid, jsonb) to authenticated;
grant execute on function public.network_order_confirm(uuid) to authenticated;
grant execute on function public.network_order_decline(uuid, text) to authenticated;
grant execute on function public.network_order_cancel(uuid) to authenticated;
grant execute on function public.network_order_set_penalty(uuid, numeric) to authenticated;
grant execute on function public.network_extra_add(uuid, text, text, numeric, numeric, text) to authenticated;
grant execute on function public.network_extra_update(uuid, text, text, numeric, numeric) to authenticated;
grant execute on function public.network_extra_delete(uuid) to authenticated;
grant execute on function public.network_extra_decide(uuid, boolean, text) to authenticated;
grant execute on function public.network_orders_list(text) to authenticated;
grant execute on function public.network_order_partners() to authenticated;
grant execute on function public.network_todo_counts() to authenticated;
grant execute on function public.network_invoice_create(uuid, uuid[], jsonb, text, date, date, jsonb) to authenticated;
grant execute on function public.network_invoice_save(uuid, jsonb, text, date, date, jsonb) to authenticated;
grant execute on function public.network_invoice_emit(uuid, jsonb, text, date, date, jsonb) to authenticated;
grant execute on function public.network_invoice_delete_draft(uuid) to authenticated;
grant execute on function public.network_invoice_void(uuid, text) to authenticated;
grant execute on function public.network_invoice_set_paid(uuid, boolean, date) to authenticated;
grant execute on function public.network_invoices_list(text) to authenticated;
grant execute on function public.network_invoice_parties(uuid) to authenticated;
grant execute on function public.network_party_push_targets(uuid, uuid) to authenticated;
grant execute on function public.network_party_email(uuid, uuid) to authenticated;

-- ============================================================
-- 11. Profili di prova: ordini, variazioni e una fattura ricevuta, per provare tutto subito
-- ============================================================
create or replace function public.demo_apply_orders(p_admin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.network_today();
  v_guide uuid;
  v_driver uuid;
  v_agency uuid;
  v_order uuid;
  v_invoice uuid;
  v_seller jsonb;
  v_buyer jsonb;
begin
  if p_admin is null then return; end if;
  select id into v_guide from public.profiles where email = 'demo-guida-roma@demo.grandroute.invalid';
  select id into v_driver from public.profiles where email = 'demo-autista-sicilia@demo.grandroute.invalid';
  select id into v_agency from public.profiles where email = 'demo-agenzia-bussola@demo.grandroute.invalid';
  if v_guide is null or v_driver is null or v_agency is null then return; end if;

  -- Partite IVA italiane di prova: 00000000000 (formalmente valida, chiaramente finta)
  update public.network_profiles set vat_number = '00000000000'
   where country = 'IT' and user_id in (select id from public.profiles where email like '%@demo.grandroute.invalid');

  -- Impostazioni di fatturazione dei fornitori di prova
  insert into public.network_billing_settings (user_id, person, first_name, last_name, regime, default_vat, ritenuta, iban, bank, payment_days, free_cancel_days, penalty_pct)
  values (v_guide, true, 'Marta', 'Ferri', 'RF01', 22, true, 'IT60X0542811101000000123456', 'Banca di prova', 30, 2, 100)
  on conflict (user_id) do nothing;
  insert into public.network_billing_settings (user_id, regime, default_vat, default_natura, ritenuta, iban, bank, payment_days, free_cancel_days, penalty_pct)
  values (v_driver, 'RF19', 0, 'N2.2', false, 'IT60X0542811101000000123456', 'Banca di prova', 15, 1, 50)
  on conflict (user_id) do nothing;

  -- Collaborazioni con chi sta provando (se non ci sono già)
  insert into public.network_collaborations (from_user, to_user, message, status, responded_at)
  select x, p_admin, 'Collaborazione di prova', 'accettata', now() from unnest(array[v_guide, v_driver, v_agency]) as x
  on conflict do nothing;
  perform public.network_save_partner(p_admin, v_guide);
  perform public.network_save_partner(p_admin, v_driver);
  perform public.network_save_partner(p_admin, v_agency);
  perform public.network_save_partner(v_agency, p_admin);

  -- Tu compri dall'autista: un transfer già svolto con variazioni (una accettata, una in attesa) e un tour in programma
  insert into public.network_orders (seller_id, buyer_id, created_by, last_edit_by, title, service_date, start_time, place, pax, reference, lead_name,
    quantity, unit, unit_price, free_cancel_days, penalty_pct, status, confirmed_at)
  values (v_driver, p_admin, p_admin, p_admin, 'Transfer aeroporto di Catania → Taormina', v_today - 12, '10:30', 'Aeroporto di Catania, arrivi', 4,
    'Pratica 2026/045 – Sicilia classica', 'Sig.ra Rossi', 1, 'servizio', 120, 1, 50, 'confermato', now() - interval '20 days')
  returning id into v_order;
  insert into public.network_order_extras (order_id, created_by, kind, description, quantity, unit_price, status, proposed_at, decided_at)
  values (v_order, v_driver, 'servizio', 'Ore di attesa extra per ritardo del volo', 2, 35, 'accettata', now() - interval '11 days', now() - interval '10 days'),
         (v_order, v_driver, 'spesa', 'Pedaggi autostradali anticipati', 1, 18.40, 'proposta', now() - interval '1 hour', null);

  insert into public.network_orders (seller_id, buyer_id, created_by, last_edit_by, title, details, service_date, start_time, place, pax, reference,
    quantity, unit, unit_price, free_cancel_days, penalty_pct, status, confirmed_at)
  values (v_driver, p_admin, p_admin, p_admin, 'Tour Etna e Taormina (giornata intera)', 'Minivan con aria condizionata, sosta pranzo libera.',
    v_today + 10, '08:30', 'Hotel Villa Belvedere, Taormina', 6, 'Pratica 2026/051 – Gruppo Bianchi', 1, 'giornata', 380, 1, 50, 'confermato', now() - interval '2 days');

  -- Tu compri dalla guida: visita già fatturata (fattura emessa, da pagare)
  insert into public.network_orders (seller_id, buyer_id, created_by, last_edit_by, title, service_date, start_time, place, pax, reference, lead_name,
    quantity, unit, unit_price, status, confirmed_at)
  values (v_guide, p_admin, p_admin, p_admin, 'Visita guidata Musei Vaticani (3 ore)', v_today - 20, '09:00', 'Ingresso Musei Vaticani', 2,
    'Pratica 2026/038 – Roma in coppia', 'Sig. Verdi', 1, 'servizio', 210, 'confermato', now() - interval '30 days')
  returning id into v_order;
  insert into public.network_order_extras (order_id, created_by, kind, description, quantity, unit_price, status, proposed_at, decided_at)
  values (v_order, v_guide, 'spesa', 'Biglietti d''ingresso anticipati', 2, 20, 'accettata', now() - interval '19 days', now() - interval '18 days');

  select jsonb_build_object('name', 'Marta Ferri', 'person', true, 'first_name', 'Marta', 'last_name', 'Ferri', 'vat', n.vat_number, 'tax_code', n.tax_code,
           'address', n.address, 'postal_code', n.postal_code, 'city', n.city, 'province', n.province, 'country', n.country)
    into v_seller from public.network_profiles n where n.user_id = v_guide;
  select coalesce(
           (select jsonb_build_object('name', n.business_name, 'vat', n.vat_number, 'tax_code', n.tax_code, 'address', n.address,
              'postal_code', n.postal_code, 'city', n.city, 'province', n.province, 'country', n.country, 'sdi_code', n.sdi_code, 'pec', n.pec)
            from public.network_profiles n where n.user_id = p_admin),
           (select jsonb_build_object('name', coalesce(p.agency_name, p.full_name, 'La tua agenzia'), 'vat', null, 'address', '', 'city', '', 'country', 'IT')
            from public.profiles p where p.id = p_admin))
    into v_buyer;
  insert into public.network_invoices (seller_id, buyer_id, status, number, issue_date, due_date, currency, doc,
    imponibile, iva, ritenuta, bollo, totale, netto, emitted_at)
  values (v_guide, p_admin, 'emessa', '14/' || extract(year from v_today - 15)::int, v_today - 15, v_today + 15, 'EUR',
    jsonb_build_object('version', 1, 'seller', v_seller, 'buyer', v_buyer, 'regime', 'RF01',
      'ritenuta', jsonb_build_object('enabled', true, 'rate', 20, 'type', 'RT01', 'causale', 'A'),
      'lines', jsonb_build_array(
        jsonb_build_object('id', 'l1', 'order_id', v_order, 'kind', 'servizio', 'description', 'Visita guidata Musei Vaticani (3 ore) – ' || to_char(v_today - 20, 'DD/MM/YYYY') || ' – Rif. Pratica 2026/038',
          'quantity', 1, 'unit', 'servizio', 'unit_price', 210, 'vat_rate', 22, 'natura', null, 'ritenuta', true),
        jsonb_build_object('id', 'l2', 'order_id', v_order, 'kind', 'spesa', 'description', 'Biglietti d''ingresso anticipati',
          'quantity', 2, 'unit', null, 'unit_price', 20, 'vat_rate', 0, 'natura', 'N1', 'ritenuta', false)),
      'bollo', false, 'payment', jsonb_build_object('iban', 'IT60X0542811101000000123456', 'bank', 'Banca di prova', 'method', 'MP05'),
      'notes', 'Servizi del mese'),
    250, 46.20, 42, 0, 296.20, 254.20, now() - interval '15 days')
  returning id into v_invoice;
  update public.network_orders set invoice_id = v_invoice where id = v_order;

  -- Tu svolgi servizi per l'agenzia di prova: da fatturare, uno da confermare, una penale
  insert into public.network_orders (seller_id, buyer_id, created_by, last_edit_by, title, service_date, start_time, place, pax, reference, lead_name,
    quantity, unit, unit_price, status, confirmed_at)
  values (p_admin, v_agency, v_agency, v_agency, 'Accompagnamento gruppo – Torino città (mezza giornata)', v_today - 8, '09:30', 'Piazza Castello', 18,
    'Gruppo Bussola – Piemonte d''autunno', 'Sig. Neri', 1, 'servizio', 180, 'confermato', now() - interval '25 days');
  insert into public.network_orders (seller_id, buyer_id, created_by, last_edit_by, title, service_date, start_time, place, pax, reference,
    quantity, unit, unit_price, status, confirmed_at)
  values (p_admin, v_agency, v_agency, v_agency, 'Assistenza all''arrivo in aeroporto (Malpensa)', v_today - 3, '07:00', 'Malpensa T1, arrivi', 18,
    'Gruppo Bussola – Piemonte d''autunno', 2, 'ore', 45, 'confermato', now() - interval '10 days');
  insert into public.network_orders (seller_id, buyer_id, created_by, last_edit_by, title, details, service_date, start_time, place, pax, reference,
    quantity, unit, unit_price, status)
  values (p_admin, v_agency, v_agency, v_agency, 'Organizzazione cena di benvenuto', 'Menù piemontese, un tavolo per 24 persone.', v_today + 20, '20:00',
    'Torino centro', 24, 'Gruppo Bussola – Natale a Torino', 1, 'servizio', 250, 'richiesto');
  insert into public.network_orders (seller_id, buyer_id, created_by, last_edit_by, title, service_date, start_time, pax, reference,
    quantity, unit, unit_price, free_cancel_days, penalty_pct, status, confirmed_at, cancelled_at, cancelled_by, penalty_amount)
  values (p_admin, v_agency, v_agency, v_agency, 'Transfer stazione → hotel', v_today + 1, '18:00', 6, 'Gruppo Bussola – Natale a Torino',
    1, 'servizio', 60, 2, 100, 'annullato', now() - interval '6 days', now() - interval '1 day', v_agency, 60);
end;
$$;
revoke all on function public.demo_apply_orders(uuid) from public, anon, authenticated;

-- «Crea» e «Rimuovi» dei profili di prova: tolgono anche le voci di rubrica legate ai profili di prova
create or replace function public.admin_demo_remove()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n int;
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  delete from public.suppliers where network_user_id in (select id from public.profiles where email like '%@demo.grandroute.invalid');
  delete from auth.users where email like '%@demo.grandroute.invalid';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.admin_demo_create()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n int;
  v_admin uuid := auth.uid();
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  delete from public.suppliers where network_user_id in (select id from public.profiles where email like '%@demo.grandroute.invalid');
  n := public.admin_demo_create_base();
  perform public.demo_apply_media();
  if v_admin is not null then
    insert into public.network_collaborations (from_user, to_user, message)
    select p.id, v_admin, 'Buongiorno, lavoriamo con molte agenzie italiane e ci piacerebbe collaborare con voi: vi mandiamo volentieri cataloghi e condizioni riservate.'
    from public.profiles p where p.email = 'demo-to-orizzonti@demo.grandroute.invalid'
    on conflict do nothing;
    perform public.demo_apply_orders(v_admin);
  end if;
  return n;
end;
$$;
revoke all on function public.admin_demo_remove() from public, anon;
revoke all on function public.admin_demo_create() from public, anon;
grant execute on function public.admin_demo_remove() to authenticated;
grant execute on function public.admin_demo_create() to authenticated;
