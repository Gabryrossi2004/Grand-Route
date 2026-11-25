-- 0066 — Note di credito (storno totale o parziale di una fattura) e solleciti automatici per le fatture scadute.
-- Serve aver eseguito prima 0065.

-- 1. Tipo di documento: fattura (TD01) o nota di credito (TD04) collegata a una fattura
alter table public.network_invoices
  add column if not exists doc_type text not null default 'TD01',
  add column if not exists credit_of uuid references public.network_invoices (id) on delete restrict,
  add column if not exists credit_full boolean not null default false,
  add column if not exists reminders_sent integer not null default 0,
  add column if not exists last_reminder_at timestamptz;
alter table public.network_invoices drop constraint if exists network_invoices_doc_type_check;
alter table public.network_invoices add constraint network_invoices_doc_type_check check (
  doc_type in ('TD01', 'TD04') and ((doc_type = 'TD04') = (credit_of is not null))
);
create index if not exists network_invoices_credit_idx on public.network_invoices (credit_of);

-- Solleciti automatici (attivi di base)
alter table public.network_billing_settings add column if not exists auto_reminders boolean not null default true;

-- 2. Nota di credito: totale (annulla la fattura, i servizi tornano da fatturare) o parziale (es. una differenza di prezzo)
create or replace function public.network_credit_note_create(p_invoice uuid, p_full boolean, p_doc jsonb, p_number text, p_issue_date date, p_totals jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.network_invoices%rowtype;
  v_id uuid;
begin
  select * into i from public.network_invoices where id = p_invoice and seller_id = auth.uid() for update;
  if not found or i.doc_type <> 'TD01' or i.status not in ('emessa', 'pagata') then raise exception 'Fattura non trovata o non ancora emessa.'; end if;
  if p_full and exists (select 1 from public.network_invoices where credit_of = p_invoice and credit_full and status <> 'stornata') then
    raise exception 'Per questa fattura c''è già una nota di credito totale.';
  end if;
  insert into public.network_invoices (seller_id, buyer_id, status, doc_type, credit_of, credit_full, number, issue_date, currency, doc,
    imponibile, iva, ritenuta, bollo, totale, netto)
  values (i.seller_id, i.buyer_id, 'bozza', 'TD04', i.id, coalesce(p_full, false), nullif(trim(coalesce(p_number, '')), ''), p_issue_date, i.currency,
    coalesce(p_doc, i.doc),
    coalesce((p_totals ->> 'imponibile')::numeric, 0), coalesce((p_totals ->> 'iva')::numeric, 0), coalesce((p_totals ->> 'ritenuta')::numeric, 0),
    coalesce((p_totals ->> 'bollo')::numeric, 0), coalesce((p_totals ->> 'totale')::numeric, 0), coalesce((p_totals ->> 'netto')::numeric, 0))
  returning id into v_id;
  return v_id;
end;
$$;

-- 3. Emissione: numero unico per tipo e anno; la nota di credito totale storna la fattura e rimette i servizi da fatturare
create or replace function public.network_invoice_emit(p_id uuid, p_doc jsonb, p_number text, p_issue_date date, p_due_date date, p_totals jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text := nullif(trim(coalesce(p_number, '')), '');
  v_n int;
  i public.network_invoices%rowtype;
begin
  select * into i from public.network_invoices where id = p_id and seller_id = auth.uid() and status = 'bozza' for update;
  if not found then raise exception 'Bozza non trovata.'; end if;
  if v_number is null or p_issue_date is null then raise exception 'Servono numero e data del documento.'; end if;
  if p_issue_date > public.network_today() then raise exception 'La data non può essere nel futuro.'; end if;
  if exists (select 1 from public.network_invoices where seller_id = auth.uid() and id <> p_id and status in ('emessa', 'pagata', 'stornata')
             and doc_type = i.doc_type and number = v_number and extract(year from issue_date) = extract(year from p_issue_date)) then
    raise exception 'Hai già emesso un documento con il numero % nello stesso anno.', v_number;
  end if;
  if i.doc_type = 'TD04' then
    if p_issue_date < (select issue_date from public.network_invoices where id = i.credit_of) then
      raise exception 'La nota di credito non può essere precedente alla fattura.';
    end if;
  end if;
  perform public.network_invoice_save(p_id, p_doc, v_number, p_issue_date, case when i.doc_type = 'TD04' then null else p_due_date end, p_totals);
  update public.network_invoices set status = 'emessa', emitted_at = now(), updated_at = now() where id = p_id;
  if i.doc_type = 'TD04' and i.credit_full then
    update public.network_invoices set status = 'stornata', void_note = 'Nota di credito n. ' || v_number, updated_at = now()
     where id = i.credit_of and status in ('emessa', 'pagata');
    update public.network_orders set invoice_id = null, updated_at = now() where invoice_id = i.credit_of;
  end if;
  v_n := nullif(substring(v_number from '^[0-9]+'), '')::int;
  if v_n is not null then
    insert into public.network_billing_settings (user_id, next_number) values (auth.uid(), v_n + 1)
    on conflict (user_id) do update set next_number = greatest(public.network_billing_settings.next_number, excluded.next_number);
  end if;
end;
$$;

-- Pagata / storno solo per le fatture (non per le note di credito)
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
  where id = p_id and doc_type = 'TD01' and (seller_id = auth.uid() or buyer_id = auth.uid()) and status in ('emessa', 'pagata');
  if not found then raise exception 'Fattura non trovata.'; end if;
end;
$$;

create or replace function public.network_invoice_void(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.network_invoices set status = 'stornata', void_note = nullif(left(trim(coalesce(p_note, '')), 300), ''), updated_at = now()
   where id = p_id and doc_type = 'TD01' and seller_id = auth.uid() and status in ('emessa', 'pagata');
  if not found then raise exception 'Fattura non trovata.'; end if;
  update public.network_orders set invoice_id = null, updated_at = now() where invoice_id = p_id;
end;
$$;

-- 4. Elenco con tipo di documento, fattura collegata e quanto resta da pagare (al netto delle note di credito parziali)
drop function if exists public.network_invoices_list(text);
create or replace function public.network_invoices_list(p_role text)
returns table (
  id uuid, role text, counterpart uuid, counterpart_name text, status text, number text, issue_date date, due_date date,
  currency text, imponibile numeric, iva numeric, ritenuta numeric, bollo numeric, totale numeric, netto numeric,
  paid_at date, emitted_at timestamptz, created_at timestamptz, orders_count integer,
  doc_type text, credit_of uuid, credit_of_number text, credited numeric, residuo numeric, reminders_sent integer
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
         (select count(*)::int from public.network_orders o where o.invoice_id = i.id),
         i.doc_type, i.credit_of, orig.number,
         cr.amount,
         case when i.doc_type = 'TD01' then greatest(i.netto - coalesce(cr.amount, 0), 0) end,
         i.reminders_sent
  from public.network_invoices i
  join public.profiles c on c.id = case when i.seller_id = auth.uid() then i.buyer_id else i.seller_id end
  left join public.network_profiles np on np.user_id = c.id
  left join public.network_invoices orig on orig.id = i.credit_of
  left join lateral (
    select sum(n.netto) as amount from public.network_invoices n where n.credit_of = i.id and n.status = 'emessa' and not n.credit_full
  ) cr on true
  where (p_role = 'seller' and i.seller_id = auth.uid())
     or (p_role = 'buyer' and i.buyer_id = auth.uid() and i.status <> 'bozza')
  order by coalesce(i.issue_date, i.created_at::date) desc, i.created_at desc
  limit 1000;
$$;

-- Le cose da fare contano solo le fatture da pagare (non le note di credito)
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
           + (select count(*) from public.network_invoices i where i.buyer_id = auth.uid() and i.status = 'emessa' and i.doc_type = 'TD01')
  );
$$;

-- 5. Solleciti
-- Sollecito a mano dal fornitore (al massimo uno al giorno per fattura)
create or replace function public.network_invoice_remind(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.network_invoices%rowtype;
begin
  select * into i from public.network_invoices where id = p_id and seller_id = auth.uid() for update;
  if not found or i.doc_type <> 'TD01' or i.status <> 'emessa' then raise exception 'Fattura non trovata o già pagata.'; end if;
  if i.last_reminder_at > now() - interval '20 hours' then raise exception 'Hai già mandato un sollecito oggi.'; end if;
  update public.network_invoices set reminders_sent = reminders_sent + 1, last_reminder_at = now() where id = p_id;
  return i.reminders_sent + 1;
end;
$$;

-- Solleciti automatici (chiamata una volta al giorno dal sito, con il segreto delle attività programmate):
-- 1 giorno, 7, 15 e 30 giorni dopo la scadenza, se il fornitore non li ha spenti
create or replace function public.network_invoice_reminder_targets(p_secret text)
returns table (
  invoice_id uuid, number text, issue_date date, due_date date, days_overdue integer, stage integer,
  residuo numeric, currency text, seller_id uuid, seller_name text, seller_email text, buyer_id uuid, buyer_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  return query
  with due as (
    select i.*, (public.network_today() - i.due_date) as late,
           case when public.network_today() - i.due_date >= 30 then 4
                when public.network_today() - i.due_date >= 15 then 3
                when public.network_today() - i.due_date >= 7 then 2
                else 1 end as st
    from public.network_invoices i
    left join public.network_billing_settings b on b.user_id = i.seller_id
    where i.doc_type = 'TD01' and i.status = 'emessa' and i.due_date < public.network_today()
      and coalesce(b.auto_reminders, true)
      and (i.last_reminder_at is null or i.last_reminder_at < now() - interval '20 hours')
  )
  select d.id, d.number, d.issue_date, d.due_date, d.late::int, d.st,
         greatest(d.netto - coalesce((select sum(n.netto) from public.network_invoices n where n.credit_of = d.id and n.status = 'emessa' and not n.credit_full), 0), 0),
         d.currency::text, d.seller_id, coalesce(sp.business_name, s.agency_name, s.full_name, 'Il tuo fornitore'), s.email, d.buyer_id, b.email
  from due d
  join public.profiles s on s.id = d.seller_id
  join public.profiles b on b.id = d.buyer_id
  left join public.network_profiles sp on sp.user_id = d.seller_id
  where d.reminders_sent < d.st
    and b.email not like '%@demo.grandroute.invalid';
end;
$$;

create or replace function public.network_invoice_mark_reminded(p_secret text, p_id uuid, p_stage integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  update public.network_invoices set reminders_sent = greatest(reminders_sent, p_stage), last_reminder_at = now() where id = p_id;
end;
$$;

create or replace function public.network_user_push_targets(p_secret text, p_user uuid)
returns table (endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  return query select ps.endpoint, ps.p256dh, ps.auth from public.push_subscriptions ps where ps.profile_id = p_user;
end;
$$;

revoke all on function public.network_credit_note_create(uuid, boolean, jsonb, text, date, jsonb) from public, anon;
revoke all on function public.network_invoice_emit(uuid, jsonb, text, date, date, jsonb) from public, anon;
revoke all on function public.network_invoice_set_paid(uuid, boolean, date) from public, anon;
revoke all on function public.network_invoice_void(uuid, text) from public, anon;
revoke all on function public.network_invoices_list(text) from public, anon;
revoke all on function public.network_todo_counts() from public, anon;
revoke all on function public.network_invoice_remind(uuid) from public, anon;
revoke all on function public.network_invoice_reminder_targets(text) from public;
revoke all on function public.network_invoice_mark_reminded(text, uuid, integer) from public;
revoke all on function public.network_user_push_targets(text, uuid) from public;
grant execute on function public.network_credit_note_create(uuid, boolean, jsonb, text, date, jsonb) to authenticated;
grant execute on function public.network_invoice_emit(uuid, jsonb, text, date, date, jsonb) to authenticated;
grant execute on function public.network_invoice_set_paid(uuid, boolean, date) to authenticated;
grant execute on function public.network_invoice_void(uuid, text) to authenticated;
grant execute on function public.network_invoices_list(text) to authenticated;
grant execute on function public.network_todo_counts() to authenticated;
grant execute on function public.network_invoice_remind(uuid) to authenticated;
-- le attività programmate chiamano senza accesso utente (protette dal segreto)
grant execute on function public.network_invoice_reminder_targets(text) to anon, authenticated;
grant execute on function public.network_invoice_mark_reminded(text, uuid, integer) to anon, authenticated;
grant execute on function public.network_user_push_targets(text, uuid) to anon, authenticated;
