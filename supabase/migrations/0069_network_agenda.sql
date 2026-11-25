-- 0069 — Agenda e Home dei fornitori: i servizi in un intervallo di date, leggeri (senza variazioni e fatture),
-- con il telefono del partner e la conversazione della Posta collegata. Serve aver eseguito prima 0065 e 0067.

create or replace function public.network_agenda(p_from date, p_to date)
returns table (
  id uuid, role text, counterpart_name text, counterpart_kind text, counterpart_phone text,
  last_edit_by uuid, title text, details text, service_date date, end_date date, start_time time,
  place text, pax integer, reference text, lead_name text, status text, phase text,
  amount numeric, currency text, thread_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select o.id,
         case when o.seller_id = auth.uid() then 'seller' else 'buyer' end,
         coalesce(np.business_name, c.agency_name, c.full_name, 'Professionista'),
         public.network_kind_of(c.id),
         nullif(coalesce(np.phone, ''), ''),
         o.last_edit_by, o.title, o.details, o.service_date, o.end_date, o.start_time,
         o.place, o.pax, o.reference, o.lead_name, o.status, public.network_order_phase(o),
         o.quantity * o.unit_price
           + coalesce((select sum(e.quantity * e.unit_price) from public.network_order_extras e
                       where e.order_id = o.id and public.network_extra_state(e) = 'accettata'), 0),
         o.currency::text,
         (select t.id from public.mail_threads t where t.order_id = o.id)
  from public.network_orders o
  join public.profiles c on c.id = case when o.seller_id = auth.uid() then o.buyer_id else o.seller_id end
  left join public.network_profiles np on np.user_id = c.id
  where (o.seller_id = auth.uid() or o.buyer_id = auth.uid())
    and p_to - p_from <= 62
    and o.service_date <= p_to
    and coalesce(o.end_date, o.service_date) >= p_from
    and o.status in ('richiesto', 'confermato')
  order by o.service_date, o.start_time nulls last, o.created_at
  limit 500;
$$;
revoke all on function public.network_agenda(date, date) from public, anon;
grant execute on function public.network_agenda(date, date) to authenticated;

create index if not exists network_orders_seller_date_idx on public.network_orders (seller_id, service_date) where status in ('richiesto', 'confermato');
create index if not exists network_orders_buyer_date_idx on public.network_orders (buyer_id, service_date) where status in ('richiesto', 'confermato');
