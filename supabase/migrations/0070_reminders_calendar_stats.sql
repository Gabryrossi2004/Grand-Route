-- 0070 — Per i fornitori: promemoria automatico la sera prima (riconferma alle agenzie), calendario del telefono (.ics)
-- e statistiche. Serve aver eseguito prima 0065, 0067 e 0069.

-- ============================================================
-- 1. Preferenze del professionista (promemoria acceso/spento)
-- ============================================================
create table if not exists public.network_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  service_reminders boolean not null default true,   -- promemoria automatico della sera prima
  updated_at timestamptz not null default now()
);
alter table public.network_prefs enable row level security;
drop policy if exists "nprefs_select" on public.network_prefs;
create policy "nprefs_select" on public.network_prefs for select to authenticated using (user_id = auth.uid());
drop policy if exists "nprefs_insert" on public.network_prefs;
create policy "nprefs_insert" on public.network_prefs for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "nprefs_update" on public.network_prefs;
create policy "nprefs_update" on public.network_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- 2. Riconferma dei servizi da parte dell'agenzia (il giorno prima)
-- ============================================================
alter table public.network_orders add column if not exists reconfirmed_at timestamptz;
alter table public.network_orders add column if not exists reconfirmed_by uuid references public.profiles (id) on delete set null;

-- Riconfermato = l'agenzia ha premuto «Riconferma» dopo l'ultima conferma dell'ordine
-- (se l'ordine viene modificato e riconfermato, la vecchia riconferma non vale più)
create or replace function public.network_order_reconfirmed(o public.network_orders)
returns boolean
language sql
stable
as $$
  select o.reconfirmed_at is not null and o.reconfirmed_at >= coalesce(o.confirmed_at, '-infinity'::timestamptz);
$$;

create or replace function public.network_reconfirm(p_orders uuid[])
returns table (order_id uuid, seller_id uuid, title text, service_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is null or coalesce(array_length(p_orders, 1), 0) = 0 or array_length(p_orders, 1) > 100 then
    raise exception 'Scegli almeno un servizio.';
  end if;
  for r in
    update public.network_orders o
       set reconfirmed_at = now(), reconfirmed_by = auth.uid(), updated_at = now()
     where o.id = any (p_orders) and o.buyer_id = auth.uid() and o.status = 'confermato' and o.invoice_id is null
       and coalesce(o.end_date, o.service_date) >= public.network_today()
    returning o.id, o.seller_id, o.title, o.service_date
  loop
    perform public.mail_order_event(r.id, 'Ha riconfermato il servizio del ' || to_char(r.service_date, 'DD/MM/YYYY') || '.');
    order_id := r.id; seller_id := r.seller_id; title := r.title; service_date := r.service_date;
    return next;
  end loop;
end;
$$;

-- ============================================================
-- 3. Agenda: adesso dice anche se l'agenzia ha riconfermato
-- ============================================================
drop function if exists public.network_agenda(date, date);
create or replace function public.network_agenda(p_from date, p_to date)
returns table (
  id uuid, role text, counterpart_name text, counterpart_kind text, counterpart_phone text,
  last_edit_by uuid, title text, details text, service_date date, end_date date, start_time time,
  place text, pax integer, reference text, lead_name text, status text, phase text,
  amount numeric, currency text, thread_id uuid, reconfirmed boolean
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
         (select t.id from public.mail_threads t where t.order_id = o.id),
         public.network_order_reconfirmed(o)
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

-- ============================================================
-- 4. Promemoria automatico della sera prima (lo lancia l'attività programmata dopo le 16:00)
-- ============================================================
create table if not exists public.network_service_reminders (
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  run_date date not null,
  orders integer not null,
  sent_at timestamptz not null default now(),
  primary key (seller_id, buyer_id, run_date)
);
alter table public.network_service_reminders enable row level security;
drop policy if exists "nsr_select" on public.network_service_reminders;
create policy "nsr_select" on public.network_service_reminders for select to authenticated
  using (seller_id = auth.uid() or buyer_id = auth.uid());

-- Un'email per ogni agenzia con tutti i suoi servizi del giorno dopo (il venerdì fino a lunedì, il sabato fino a lunedì)
-- che NON ha ancora riconfermato: né con il tasto «Riconferma» né scrivendo nella conversazione dell'ordine oggi.
-- Parte solo dopo le 16:00 (ora italiana), se il fornitore non ha spento il promemoria, una volta sola per agenzia al giorno.
drop function if exists public.network_service_reminder_targets(text);
create or replace function public.network_service_reminder_targets(p_secret text, p_now timestamptz default null)
returns table (
  seller_id uuid, seller_name text, seller_email text,
  buyer_id uuid, buyer_name text, buyer_email text,
  services jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());           -- p_now serve solo ai controlli automatici
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Rome')::date;
  v_dow int := extract(dow from (coalesce(p_now, now()) at time zone 'Europe/Rome')::date);
  v_last date;
  v_since timestamptz := (((coalesce(p_now, now()) at time zone 'Europe/Rome')::date)::timestamp at time zone 'Europe/Rome');
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  if extract(hour from (v_now at time zone 'Europe/Rome')) < 16 then return; end if;
  v_last := v_today + case v_dow when 5 then 3 when 6 then 2 else 1 end;

  return query
  with cand as (
    select o.*
    from public.network_orders o
    left join public.network_prefs pr on pr.user_id = o.seller_id
    where o.status = 'confermato' and o.invoice_id is null
      and o.service_date between v_today + 1 and v_last
      and coalesce(pr.service_reminders, true)
      and not public.network_order_reconfirmed(o)
      and not exists (            -- l'agenzia ha già scritto oggi nella conversazione dell'ordine
        select 1 from public.mail_messages m join public.mail_threads t on t.id = m.thread_id
        where t.order_id = o.id and m.author_id = o.buyer_id and m.kind = 'messaggio' and not m.draft and m.created_at >= v_since)
      and not exists (select 1 from public.network_service_reminders l where l.seller_id = o.seller_id and l.buyer_id = o.buyer_id and l.run_date = v_today)
  ), grp as (
    select c.seller_id, c.buyer_id, count(*)::int as n,
           jsonb_agg(jsonb_build_object(
             'id', c.id, 'date', c.service_date, 'time', to_char(c.start_time, 'HH24:MI'), 'title', c.title, 'place', c.place,
             'pax', c.pax, 'lead_name', c.lead_name, 'reference', c.reference, 'quantity', c.quantity, 'unit', c.unit,
             'amount', c.quantity * c.unit_price, 'currency', c.currency::text)
             order by c.service_date, c.start_time nulls last, c.created_at) as services
    from cand c group by c.seller_id, c.buyer_id
  ), claimed as (
    insert into public.network_service_reminders (seller_id, buyer_id, run_date, orders)
    select g.seller_id, g.buyer_id, v_today, g.n from grp g
    on conflict do nothing
    returning network_service_reminders.seller_id as s, network_service_reminders.buyer_id as b
  ), evt as (                     -- riga di cronologia nella conversazione di ogni ordine
    insert into public.mail_messages (thread_id, author_id, kind, body)
    select t.id, c.seller_id, 'evento', 'Promemoria automatico: riconferma richiesta per il ' || to_char(c.service_date, 'DD/MM/YYYY') || '.'
    from cand c
    join claimed cl on cl.s = c.seller_id and cl.b = c.buyer_id
    join public.mail_threads t on t.order_id = c.id
    returning thread_id
  ), touch as (
    update public.mail_threads set last_message_at = now() where id in (select thread_id from evt)
    returning id
  )
  select g.seller_id, coalesce(sp.business_name, s.agency_name, s.full_name, 'Il tuo fornitore'), s.email,
         g.buyer_id, coalesce(bp.business_name, b.agency_name, b.full_name, 'Agenzia'), b.email,
         g.services
  from grp g
  join claimed cl on cl.s = g.seller_id and cl.b = g.buyer_id
  join public.profiles s on s.id = g.seller_id
  join public.profiles b on b.id = g.buyer_id
  left join public.network_profiles sp on sp.user_id = g.seller_id
  left join public.network_profiles bp on bp.user_id = g.buyer_id
  where b.email not like '%@demo.grandroute.invalid';
end;
$$;

revoke all on function public.network_service_reminder_targets(text, timestamptz) from public;
grant execute on function public.network_service_reminder_targets(text, timestamptz) to anon, authenticated;

-- ============================================================
-- 5. Calendario del telefono: link privato (webcal) con i servizi del fornitore
-- ============================================================
create table if not exists public.network_calendar_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table public.network_calendar_tokens enable row level security;
-- (nessuna policy: si passa solo dalle funzioni qui sotto)

create or replace function public.network_calendar_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if auth.uid() is null then raise exception 'Serve un accesso.'; end if;
  insert into public.network_calendar_tokens (user_id, token)
  values (auth.uid(), replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (user_id) do nothing;
  select token into v_token from public.network_calendar_tokens where user_id = auth.uid();
  return v_token;
end;
$$;

-- Nuovo link: quello vecchio smette di funzionare
create or replace function public.network_calendar_token_reset()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then raise exception 'Serve un accesso.'; end if;
  insert into public.network_calendar_tokens (user_id, token) values (auth.uid(), v_token)
  on conflict (user_id) do update set token = excluded.token, created_at = now();
  return v_token;
end;
$$;

-- Servizi del calendario: dal mese scorso a un anno avanti; il link privato (token) fa da password
create or replace function public.network_calendar_feed(p_token text)
returns table (
  id uuid, role text, counterpart_name text, title text, details text, service_date date, end_date date, start_time time,
  place text, pax integer, lead_name text, reference text, status text, updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select o.id,
         case when o.seller_id = t.user_id then 'seller' else 'buyer' end,
         coalesce(np.business_name, c.agency_name, c.full_name, 'Professionista'),
         o.title, o.details, o.service_date, o.end_date, o.start_time, o.place, o.pax, o.lead_name, o.reference, o.status, o.updated_at
  from public.network_calendar_tokens t
  join public.network_orders o on (o.seller_id = t.user_id or o.buyer_id = t.user_id)
  join public.profiles c on c.id = case when o.seller_id = t.user_id then o.buyer_id else o.seller_id end
  left join public.network_profiles np on np.user_id = c.id
  where t.token = p_token and length(p_token) >= 32
    and o.status in ('richiesto', 'confermato')
    and coalesce(o.end_date, o.service_date) >= public.network_today() - 31
    and o.service_date <= public.network_today() + 400
  order by o.service_date, o.start_time nulls last
  limit 1500;
$$;

-- Il link esiste ancora? (un calendario valido ma vuoto non deve risultare uguale a un link revocato)
create or replace function public.network_calendar_exists(p_token text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.network_calendar_tokens t where t.token = p_token and length(p_token) >= 32);
$$;

-- ============================================================
-- 6. Visite alla scheda (per le statistiche): una per professionista al giorno, senza mostrare chi
-- ============================================================
create table if not exists public.network_profile_views (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default public.network_today(),
  primary key (profile_id, viewer_id, day)
);
create index if not exists network_profile_views_day_idx on public.network_profile_views (profile_id, day);
alter table public.network_profile_views enable row level security;
-- (nessuna policy: solo le funzioni)

create or replace function public.network_profile_view(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_profile is null or p_profile = auth.uid() then return; end if;
  insert into public.network_profile_views (profile_id, viewer_id) values (p_profile, auth.uid()) on conflict do nothing;
end;
$$;

-- ============================================================
-- 7. Statistiche del fornitore
-- ============================================================
-- Servizi del periodo con importo (servizio + variazioni accettate; se annullato, la penale) e fase
create or replace function public.network_stats_orders(p_from date, p_to date)
returns table (
  id uuid, buyer_id uuid, service_date date, currency text, status text, phase text, amount numeric,
  created_by uuid, created_at timestamptz, confirmed_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.buyer_id, o.service_date, o.currency::text, o.status, public.network_order_phase(o),
         case when o.status = 'annullato' then coalesce(o.penalty_amount, 0)
              else o.quantity * o.unit_price
                   + coalesce((select sum(e.quantity * e.unit_price) from public.network_order_extras e
                               where e.order_id = o.id and public.network_extra_state(e) = 'accettata'), 0) end,
         o.created_by, o.created_at, o.confirmed_at
  from public.network_orders o
  where o.seller_id = auth.uid() and o.service_date between p_from and p_to;
$$;

create or replace function public.network_stats(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_me uuid := auth.uid();
  v_len int;
  v_pfrom date;
  v_pto date;
  v_m0 date;
  v_cur text;
  v_today date := public.network_today();
begin
  if v_me is null then raise exception 'Serve un accesso.'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 800 then raise exception 'Periodo non valido.'; end if;
  v_len := p_to - p_from + 1;
  v_pfrom := p_from - v_len;
  v_pto := p_from - 1;
  v_m0 := (date_trunc('month', p_to) - interval '11 months')::date;

  -- valuta principale: quella in cui si è fatturato di più nel periodo
  select coalesce((select o.currency from public.network_stats_orders(p_from, p_to) o
                    where o.phase in ('svolto', 'fatturato', 'penale') group by o.currency order by sum(o.amount) desc limit 1), 'EUR')
    into v_cur;

  return jsonb_build_object(
    'currency', v_cur,
    'from', p_from, 'to', p_to,
    'now', (select jsonb_build_object(
        'done', count(*) filter (where phase in ('svolto', 'fatturato')),
        'penalty', count(*) filter (where phase = 'penale'),
        'cancelled', count(*) filter (where phase = 'annullato'),
        'declined', count(*) filter (where phase = 'rifiutato'),
        'upcoming', count(*) filter (where phase = 'confermato'),
        'pending', count(*) filter (where phase = 'da_confermare'),
        'revenue', coalesce(sum(amount) filter (where phase in ('svolto', 'fatturato', 'penale') and currency = v_cur), 0),
        'other', coalesce((select jsonb_object_agg(z.c, z.a) from (
                   select x.currency as c, sum(x.amount) as a from public.network_stats_orders(p_from, p_to) x
                   where x.phase in ('svolto', 'fatturato', 'penale') and x.currency <> v_cur group by x.currency) z), '{}'::jsonb)
      ) from public.network_stats_orders(p_from, p_to)),
    'prev', (select jsonb_build_object(
        'done', count(*) filter (where phase in ('svolto', 'fatturato')),
        'revenue', coalesce(sum(amount) filter (where phase in ('svolto', 'fatturato', 'penale') and currency = v_cur), 0)
      ) from public.network_stats_orders(v_pfrom, v_pto)),
    -- richieste ricevute dalle agenzie: quante accettate e in quanto tempo
    'requests', (select jsonb_build_object(
        'received', count(*),
        'accepted', count(*) filter (where confirmed_at is not null),
        'declined', count(*) filter (where phase = 'rifiutato'),
        'avg_hours', round((avg(extract(epoch from (confirmed_at - created_at)) / 3600) filter (where confirmed_at is not null))::numeric, 1)
      ) from public.network_stats_orders(p_from, p_to) where created_by <> v_me),
    'top_clients', coalesce((select jsonb_agg(jsonb_build_object('name', q.name, 'services', q.n, 'amount', q.amount) order by q.amount desc) from (
        select coalesce(np.business_name, pf.agency_name, pf.full_name, 'Cliente') as name, count(*) as n, sum(o.amount) as amount
        from public.network_stats_orders(p_from, p_to) o
        join public.profiles pf on pf.id = o.buyer_id
        left join public.network_profiles np on np.user_id = o.buyer_id
        where o.phase in ('svolto', 'fatturato', 'penale') and o.currency = v_cur
        group by o.buyer_id, np.business_name, pf.agency_name, pf.full_name
        order by sum(o.amount) desc limit 5) q), '[]'::jsonb),
    -- ultimi 12 mesi (finiscono nel mese di «a»): servizi svolti e fatturato
    'months', (select jsonb_agg(jsonb_build_object('month', to_char(m.d, 'YYYY-MM'), 'services', coalesce(a.n, 0), 'revenue', coalesce(a.amount, 0)) order by m.d)
               from generate_series(v_m0::timestamp, date_trunc('month', p_to::timestamp), interval '1 month') as m(d)
               left join (select date_trunc('month', o.service_date)::date as d, count(*) as n, sum(o.amount) filter (where o.currency = v_cur) as amount
                          from public.network_stats_orders(v_m0, p_to) o
                          where o.phase in ('svolto', 'fatturato', 'penale') group by 1) a on a.d = m.d::date),
    'invoices', jsonb_build_object(
      'collected', coalesce((select sum(i.netto) from public.network_invoices i
                             where i.seller_id = v_me and i.doc_type = 'TD01' and i.status = 'pagata' and i.currency::text = v_cur and i.paid_at between p_from and p_to), 0),
      'avg_days_to_pay', (select round(avg(i.paid_at - i.issue_date)::numeric, 0) from public.network_invoices i
                          where i.seller_id = v_me and i.doc_type = 'TD01' and i.status = 'pagata' and i.paid_at between p_from and p_to and i.issue_date is not null),
      'outstanding', coalesce((select sum(greatest(i.netto - coalesce((select sum(n.netto) from public.network_invoices n
                                  where n.credit_of = i.id and n.status = 'emessa' and not n.credit_full), 0), 0))
                               from public.network_invoices i where i.seller_id = v_me and i.doc_type = 'TD01' and i.status = 'emessa' and i.currency::text = v_cur), 0),
      'overdue_count', (select count(*) from public.network_invoices i where i.seller_id = v_me and i.doc_type = 'TD01' and i.status = 'emessa' and i.due_date < v_today),
      'to_bill', (select count(*) from public.network_orders o where o.seller_id = v_me and public.network_order_billable(o))
    ),
    'profile', jsonb_build_object(
      'views', (select count(distinct v.viewer_id) from public.network_profile_views v where v.profile_id = v_me and v.day between p_from and p_to),
      'views_prev', (select count(distinct v.viewer_id) from public.network_profile_views v where v.profile_id = v_me and v.day between v_pfrom and v_pto),
      'collab_received', (select count(*) from public.network_collaborations c where c.to_user = v_me and c.created_at::date between p_from and p_to),
      'collab_accepted', (select count(*) from public.network_collaborations c where c.to_user = v_me and c.status = 'accettata' and c.created_at::date between p_from and p_to),
      'partners', (select count(*) from public.network_collaborations c where (c.to_user = v_me or c.from_user = v_me) and c.status = 'accettata')
    )
  );
end;
$$;

-- ============================================================
-- 8. Permessi
-- ============================================================
revoke all on function public.network_order_reconfirmed(public.network_orders) from public, anon;
revoke all on function public.network_reconfirm(uuid[]) from public, anon;
revoke all on function public.network_agenda(date, date) from public, anon;
revoke all on function public.network_calendar_token() from public, anon;
revoke all on function public.network_calendar_token_reset() from public, anon;
revoke all on function public.network_calendar_feed(text) from public;
revoke all on function public.network_calendar_exists(text) from public;
revoke all on function public.network_profile_view(uuid) from public, anon;
revoke all on function public.network_stats_orders(date, date) from public, anon;
revoke all on function public.network_stats(date, date) from public, anon;
grant execute on function public.network_order_reconfirmed(public.network_orders) to authenticated;
grant execute on function public.network_reconfirm(uuid[]) to authenticated;
grant execute on function public.network_agenda(date, date) to authenticated;
grant execute on function public.network_calendar_token() to authenticated;
grant execute on function public.network_calendar_token_reset() to authenticated;
grant execute on function public.network_calendar_feed(text) to anon, authenticated;   -- il calendario lo legge l'app del telefono, senza accesso
grant execute on function public.network_calendar_exists(text) to anon, authenticated;
grant execute on function public.network_profile_view(uuid) to authenticated;
grant execute on function public.network_stats_orders(date, date) to authenticated;
grant execute on function public.network_stats(date, date) to authenticated;
