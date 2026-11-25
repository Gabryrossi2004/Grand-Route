-- 0068 — Briefing di Zefiro diviso tra Viaggi e Contabilità: in una sola chiamata le note su fatture e ordini tra partner
-- (fatture da pagare e da incassare, bozze, servizi da fatturare, variazioni di prezzo, ordini da confermare).
-- Serve aver eseguito prima 0065, 0066 e 0067. Aggiunge anche qualche indice per velocizzare le pagine più usate.

create or replace function public.network_accounting_briefing()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with me as (select auth.uid() as uid, public.network_today() as today),
  open_inv as (
    select i.id, i.number, i.due_date, i.currency::text as currency, i.reminders_sent,
           case when i.seller_id = me.uid then 'seller' else 'buyer' end as role,
           coalesce(np.business_name, c.agency_name, c.full_name, 'Professionista') as counterpart,
           greatest(i.netto - coalesce((select sum(n.netto) from public.network_invoices n
                                        where n.credit_of = i.id and n.status = 'emessa' and not n.credit_full), 0), 0) as residuo
    from public.network_invoices i
    cross join me
    join public.profiles c on c.id = case when i.seller_id = me.uid then i.buyer_id else i.seller_id end
    left join public.network_profiles np on np.user_id = c.id
    where (i.seller_id = me.uid or i.buyer_id = me.uid) and i.status = 'emessa' and i.doc_type = 'TD01'
  )
  select jsonb_build_object(
    'today', (select today from me),
    -- fatture ricevute da pagare: scadute o in scadenza entro 7 giorni (le più urgenti)
    'to_pay', coalesce((select jsonb_agg(x order by x.due_date nulls last) from (
        select id, number, due_date, currency, counterpart, residuo from open_inv, me
        where role = 'buyer' and residuo > 0 and (due_date is null or due_date <= me.today + 7)
        order by due_date nulls last limit 8) x), '[]'::jsonb),
    'to_pay_total', (select count(*) from open_inv where role = 'buyer' and residuo > 0),
    -- fatture emesse non ancora pagate e già scadute
    'to_collect', coalesce((select jsonb_agg(x order by x.due_date) from (
        select id, number, due_date, currency, counterpart, residuo, reminders_sent from open_inv, me
        where role = 'seller' and residuo > 0 and due_date < me.today
        order by due_date limit 8) x), '[]'::jsonb),
    'drafts', (select count(*) from public.network_invoices i, me where i.seller_id = me.uid and i.status = 'bozza'),
    'billable', (select count(*) from public.network_orders o, me where o.seller_id = me.uid and public.network_order_billable(o)),
    'billable_clients', (select count(distinct o.buyer_id) from public.network_orders o, me where o.seller_id = me.uid and public.network_order_billable(o)),
    -- variazioni di prezzo proposte dal fornitore, da accettare o contestare
    'extras_to_decide', (select count(*) from public.network_order_extras e join public.network_orders o on o.id = e.order_id, me
                         where o.buyer_id = me.uid and e.created_by <> me.uid and o.invoice_id is null and public.network_extra_state(e) = 'proposta'),
    -- variazioni contestate dal cliente, da rivedere
    'extras_contested', (select count(*) from public.network_order_extras e join public.network_orders o on o.id = e.order_id, me
                         where o.seller_id = me.uid and o.invoice_id is null and public.network_extra_state(e) = 'contestata'),
    -- ordini che aspettano una mia conferma
    'orders_to_confirm_buyer', (select count(*) from public.network_orders o, me
                                where o.buyer_id = me.uid and o.status = 'richiesto' and o.last_edit_by <> me.uid
                                  and o.invoice_id is null and public.network_order_phase(o) = 'da_confermare'),
    'orders_to_confirm_seller', (select count(*) from public.network_orders o, me
                                 where o.seller_id = me.uid and o.status = 'richiesto' and o.last_edit_by <> me.uid
                                   and o.invoice_id is null and public.network_order_phase(o) = 'da_confermare')
  );
$$;
revoke all on function public.network_accounting_briefing() from public, anon;
grant execute on function public.network_accounting_briefing() to authenticated;

-- Indici per le pagine più aperte (Home, elenco viaggi, pagamenti, messaggi, posta)
create index if not exists network_invoices_open_idx on public.network_invoices (buyer_id, status) where status in ('emessa', 'bozza');
create index if not exists network_invoices_seller_status_idx on public.network_invoices (seller_id, status);
create index if not exists network_orders_open_idx on public.network_orders (seller_id) where invoice_id is null;
create index if not exists network_orders_buyer_open_idx on public.network_orders (buyer_id) where invoice_id is null;
create index if not exists mail_messages_author_idx on public.mail_messages (author_id, created_at desc);
create index if not exists mail_threads_last_idx on public.mail_threads (last_message_at desc);
create index if not exists trip_checklist_items_open_idx on public.trip_checklist_items (trip_id) where done = false;
create index if not exists trip_messages_unread_idx on public.trip_messages (trip_id) where read_at is null and author_role = 'client';
