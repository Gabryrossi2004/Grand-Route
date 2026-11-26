-- 0070 — Per i fornitori: promemoria della sera prima (il FORNITORE chiede la riconferma all'agenzia con una sola email
-- precompilata e modificabile), agenda con «riconferma ricevuta», calendario interno con impegni e statistiche.
-- Serve aver eseguito prima 0065 (ordini) e 0067 (posta). Comprende anche la funzione dell'agenda (0069): se avevi già
-- eseguito la 0069 non c'è problema, questa la sostituisce.

-- ============================================================
-- 1. Preferenze del professionista: promemoria (automatico / lo rivedo io / spento) e testo personalizzato
-- ============================================================
create table if not exists public.network_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reminder_mode text not null default 'auto' check (reminder_mode in ('auto', 'manual', 'off')),
  reminder_subject text check (reminder_subject is null or char_length(reminder_subject) <= 200),
  reminder_intro text check (reminder_intro is null or char_length(reminder_intro) <= 1500),
  reminder_outro text check (reminder_outro is null or char_length(reminder_outro) <= 1500),
  last_manual_notice date,                    -- ultimo giorno in cui, in modalità «lo rivedo io», si è avvisato il fornitore
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
-- 2. «Riconferma ricevuta»: il fornitore segna che l'agenzia gli ha già riconfermato il servizio
--    (anche per WhatsApp o telefono). La riconferma dell'agenzia al fornitore resta quella dell'Operativo.
-- ============================================================
alter table public.network_orders add column if not exists reconfirmed_at timestamptz;
alter table public.network_orders add column if not exists reconfirmed_by uuid references public.profiles (id) on delete set null;

-- Riconfermato = segnato dopo l'ultima conferma dell'ordine (se l'ordine cambia e si riconferma, vale la nuova riconferma)
create or replace function public.network_order_reconfirmed(o public.network_orders)
returns boolean
language sql
stable
as $$
  select o.reconfirmed_at is not null and o.reconfirmed_at >= coalesce(o.confirmed_at, '-infinity'::timestamptz);
$$;

create or replace function public.network_reconfirm_received(p_orders uuid[], p_received boolean default true)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  r record;
begin
  if auth.uid() is null or coalesce(array_length(p_orders, 1), 0) = 0 or array_length(p_orders, 1) > 200 then
    raise exception 'Scegli almeno un servizio.';
  end if;
  n := 0;
  for r in
    update public.network_orders o
       set reconfirmed_at = case when p_received then now() end,
           reconfirmed_by = case when p_received then auth.uid() end,
           updated_at = now()
     where o.id = any (p_orders) and o.seller_id = auth.uid() and o.status = 'confermato' and o.invoice_id is null
    returning o.id, o.service_date
  loop
    n := n + 1;
    perform public.mail_order_event(r.id, case when p_received then 'Riconferma ricevuta per il servizio del ' || to_char(r.service_date, 'DD/MM/YYYY') || '.'
                                               else 'Riconferma tolta: di nuovo da riconfermare.' end);
  end loop;
  return n;
end;
$$;

-- ============================================================
-- 3. Agenda dei servizi (leggera, con telefono del partner, conversazione e «riconfermato»)
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
create index if not exists network_orders_seller_date_idx on public.network_orders (seller_id, service_date) where status in ('richiesto', 'confermato');
create index if not exists network_orders_buyer_date_idx on public.network_orders (buyer_id, service_date) where status in ('richiesto', 'confermato');

-- ============================================================
-- 4. Promemoria della sera prima: il fornitore chiede la riconferma all'agenzia con UNA email in blocco
--    (tutti i servizi dell'agenzia per i prossimi giorni), precompilata e modificabile.
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

-- Ultimo giorno coperto dal promemoria: domani; il venerdì fino a lunedì, il sabato fino a lunedì
create or replace function public.network_reminder_last_day(p_today date)
returns date
language sql
immutable
as $$
  select p_today + case extract(dow from p_today)::int when 5 then 3 when 6 then 2 else 1 end;
$$;

-- Per ogni agenzia: i servizi confermati dei prossimi giorni di cui non è arrivata la riconferma, né segnata dal fornitore
-- né scrivendo al fornitore in Posta oggi. Uso interno (le funzioni qui sotto lo chiamano).
create or replace function public.network_reminder_candidates(p_seller uuid, p_today date, p_since timestamptz)
returns table (seller_id uuid, buyer_id uuid, n integer, services jsonb, sent_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  with cand as (
    select o.*
    from public.network_orders o
    where (p_seller is null or o.seller_id = p_seller)
      and o.status = 'confermato' and o.invoice_id is null
      and o.service_date between p_today + 1 and public.network_reminder_last_day(p_today)
      and not public.network_order_reconfirmed(o)
      and not exists (            -- l'agenzia ha già scritto al fornitore oggi (in qualsiasi conversazione)
        select 1 from public.mail_messages m
        join public.mail_participants ps on ps.thread_id = m.thread_id and ps.user_id = o.seller_id
        where m.author_id = o.buyer_id and m.kind = 'messaggio' and not m.draft and m.created_at >= p_since)
  )
  select c.seller_id, c.buyer_id, count(*)::int,
         jsonb_agg(jsonb_build_object(
           'id', c.id, 'date', c.service_date, 'time', to_char(c.start_time, 'HH24:MI'), 'title', c.title, 'place', c.place,
           'pax', c.pax, 'lead_name', c.lead_name, 'reference', c.reference, 'quantity', c.quantity, 'unit', c.unit,
           'amount', c.quantity * c.unit_price, 'currency', c.currency::text)
           order by c.service_date, c.start_time nulls last, c.created_at),
         (select l.sent_at from public.network_service_reminders l where l.seller_id = c.seller_id and l.buyer_id = c.buyer_id and l.run_date = p_today)
  from cand c
  group by c.seller_id, c.buyer_id;
$$;
revoke all on function public.network_reminder_candidates(uuid, date, timestamptz) from public, anon, authenticated;

-- Le agenzie da sollecitare, per l'Agenda del fornitore (con lo stato: già inviato oggi?)
create or replace function public.network_reminder_drafts()
returns table (buyer_id uuid, buyer_name text, buyer_kind text, services jsonb, n integer, sent_at timestamptz, can_email boolean)
language sql
security definer
set search_path = public
stable
as $$
  select c.buyer_id, coalesce(bp.business_name, b.agency_name, b.full_name, 'Agenzia'), public.network_kind_of(c.buyer_id),
         c.services, c.n, c.sent_at, b.email not like '%@demo.grandroute.invalid'
  from public.network_reminder_candidates(auth.uid(), public.network_today(), (public.network_today()::timestamp at time zone 'Europe/Rome')) c
  join public.profiles b on b.id = c.buyer_id
  left join public.network_profiles bp on bp.user_id = c.buyer_id
  order by coalesce(bp.business_name, b.agency_name, b.full_name);
$$;

-- Invio dalla bozza modificata dal fornitore: qui si ricavano i dati per l'email (l'invio lo fa il sito)
create or replace function public.network_reminder_claim(p_buyer uuid)
returns table (buyer_name text, buyer_email text, seller_name text, seller_email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.network_are_partners(auth.uid(), p_buyer) then raise exception 'Puoi scrivere solo ai tuoi partner.'; end if;
  if not exists (select 1 from public.network_reminder_candidates(auth.uid(), public.network_today(), (public.network_today()::timestamp at time zone 'Europe/Rome')) c where c.buyer_id = p_buyer) then
    raise exception 'Non ci sono servizi da riconfermare per questa agenzia: ricarica la pagina.';
  end if;
  return query
  select coalesce(bp.business_name, b.agency_name, b.full_name, 'Agenzia'), b.email,
         coalesce(sp.business_name, s.agency_name, s.full_name, 'Il tuo fornitore'), s.email
  from public.profiles b
  join public.profiles s on s.id = auth.uid()
  left join public.network_profiles bp on bp.user_id = b.id
  left join public.network_profiles sp on sp.user_id = s.id
  where b.id = p_buyer;
end;
$$;

-- Dopo l'invio: si segna (così il promemoria automatico non lo ripete oggi) e resta traccia in ogni ordine
create or replace function public.network_reminder_mark_sent(p_buyer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is null or not public.network_are_partners(auth.uid(), p_buyer) then raise exception 'Puoi scrivere solo ai tuoi partner.'; end if;
  select c.n, c.services into r from public.network_reminder_candidates(auth.uid(), public.network_today(), (public.network_today()::timestamp at time zone 'Europe/Rome')) c where c.buyer_id = p_buyer;
  if not found then return; end if;
  insert into public.network_service_reminders (seller_id, buyer_id, run_date, orders) values (auth.uid(), p_buyer, public.network_today(), r.n)
  on conflict (seller_id, buyer_id, run_date) do update set sent_at = now(), orders = excluded.orders;
  insert into public.mail_messages (thread_id, author_id, kind, body)
  select t.id, auth.uid(), 'evento', 'Riconferma richiesta con email per il ' || to_char((e ->> 'date')::date, 'DD/MM/YYYY') || '.'
  from jsonb_array_elements(r.services) e join public.mail_threads t on t.order_id = (e ->> 'id')::uuid;
  update public.mail_threads set last_message_at = now() where order_id in (select (e ->> 'id')::uuid from jsonb_array_elements(r.services) e);
end;
$$;

-- Modalità AUTOMATICA (di base): dopo le 16:00 (ora italiana) una email per agenzia, una volta al giorno, con il testo
-- del fornitore (o quello standard). Ne parte una solo per le agenzie di cui non è arrivata la riconferma.
drop function if exists public.network_service_reminder_targets(text);
drop function if exists public.network_service_reminder_targets(text, timestamptz);
create or replace function public.network_service_reminder_targets(p_secret text, p_now timestamptz default null)
returns table (
  seller_id uuid, seller_name text, seller_email text,
  buyer_id uuid, buyer_name text, buyer_email text,
  services jsonb, tpl_subject text, tpl_intro text, tpl_outro text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());           -- p_now serve solo ai controlli automatici
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Rome')::date;
  v_since timestamptz := ((coalesce(p_now, now()) at time zone 'Europe/Rome')::date)::timestamp at time zone 'Europe/Rome';
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  if extract(hour from (v_now at time zone 'Europe/Rome')) < 16 then return; end if;

  return query
  with mine as (
    select c.seller_id as s, c.buyer_id as b, c.n, c.services, pr.reminder_subject, pr.reminder_intro, pr.reminder_outro
    from public.network_reminder_candidates(null, v_today, v_since) c
    left join public.network_prefs pr on pr.user_id = c.seller_id
    where c.sent_at is null and coalesce(pr.reminder_mode, 'auto') = 'auto'
  ), claimed as (
    insert into public.network_service_reminders (seller_id, buyer_id, run_date, orders)
    select m.s, m.b, v_today, m.n from mine m
    on conflict do nothing
    returning network_service_reminders.seller_id as cs, network_service_reminders.buyer_id as cb
  ), evt as (
    insert into public.mail_messages (thread_id, author_id, kind, body)
    select t.id, m.s, 'evento', 'Promemoria automatico: riconferma richiesta per il ' || to_char((e ->> 'date')::date, 'DD/MM/YYYY') || '.'
    from mine m
    join claimed cl on cl.cs = m.s and cl.cb = m.b
    cross join lateral jsonb_array_elements(m.services) e
    join public.mail_threads t on t.order_id = (e ->> 'id')::uuid
    returning thread_id
  ), touch as (
    update public.mail_threads set last_message_at = now() where id in (select thread_id from evt)
    returning id
  )
  select m.s, coalesce(sp.business_name, s.agency_name, s.full_name, 'Il tuo fornitore'), s.email,
         m.b, coalesce(bp.business_name, b.agency_name, b.full_name, 'Agenzia'), b.email,
         m.services, m.reminder_subject, m.reminder_intro, m.reminder_outro
  from mine m
  join claimed cl on cl.cs = m.s and cl.cb = m.b
  join public.profiles s on s.id = m.s
  join public.profiles b on b.id = m.b
  left join public.network_profiles sp on sp.user_id = m.s
  left join public.network_profiles bp on bp.user_id = m.b
  where b.email not like '%@demo.grandroute.invalid';
end;
$$;

-- Modalità «LO RIVEDO IO»: dopo le 16:00 il fornitore riceve un avviso (una volta al giorno) con quante agenzie
-- non hanno riconfermato; le bozze delle email sono nella sua Agenda, da rivedere, modificare e inviare.
create or replace function public.network_service_reminder_manual_targets(p_secret text, p_now timestamptz default null)
returns table (seller_id uuid, agencies integer, services integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Rome')::date;
  v_since timestamptz := ((coalesce(p_now, now()) at time zone 'Europe/Rome')::date)::timestamp at time zone 'Europe/Rome';
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'not allowed';
  end if;
  if extract(hour from (v_now at time zone 'Europe/Rome')) < 16 then return; end if;

  return query
  with todo as (
    select c.seller_id as s, count(*)::int as a, sum(c.n)::int as sv
    from public.network_reminder_candidates(null, v_today, v_since) c
    join public.network_prefs pr on pr.user_id = c.seller_id
    where c.sent_at is null and pr.reminder_mode = 'manual' and pr.last_manual_notice is distinct from v_today
    group by c.seller_id
  ), upd as (
    update public.network_prefs p set last_manual_notice = v_today from todo t where p.user_id = t.s returning p.user_id
  )
  select t.s, t.a, t.sv from todo t join upd u on u.user_id = t.s;
end;
$$;

-- ============================================================
-- 5. Calendario interno del fornitore: i suoi impegni (giorni non disponibili e note), privati
-- ============================================================
create table if not exists public.network_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'non_disponibile' check (kind in ('non_disponibile', 'nota')),
  title text not null default '' check (char_length(title) <= 120),
  day_from date not null,
  day_to date not null,
  created_at timestamptz not null default now(),
  check (day_to >= day_from and day_to - day_from <= 366)
);
create index if not exists network_calendar_events_user_idx on public.network_calendar_events (user_id, day_from);
alter table public.network_calendar_events enable row level security;
drop policy if exists "ncal_select" on public.network_calendar_events;
create policy "ncal_select" on public.network_calendar_events for select to authenticated using (user_id = auth.uid());
drop policy if exists "ncal_insert" on public.network_calendar_events;
create policy "ncal_insert" on public.network_calendar_events for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "ncal_update" on public.network_calendar_events;
create policy "ncal_update" on public.network_calendar_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ncal_delete" on public.network_calendar_events;
create policy "ncal_delete" on public.network_calendar_events for delete to authenticated using (user_id = auth.uid());

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
revoke all on function public.network_reconfirm_received(uuid[], boolean) from public, anon;
revoke all on function public.network_agenda(date, date) from public, anon;
revoke all on function public.network_reminder_last_day(date) from public, anon;
revoke all on function public.network_reminder_drafts() from public, anon;
revoke all on function public.network_reminder_claim(uuid) from public, anon;
revoke all on function public.network_reminder_mark_sent(uuid) from public, anon;
revoke all on function public.network_service_reminder_targets(text, timestamptz) from public;
revoke all on function public.network_service_reminder_manual_targets(text, timestamptz) from public;
revoke all on function public.network_profile_view(uuid) from public, anon;
revoke all on function public.network_stats_orders(date, date) from public, anon;
revoke all on function public.network_stats(date, date) from public, anon;
grant execute on function public.network_order_reconfirmed(public.network_orders) to authenticated;
grant execute on function public.network_reconfirm_received(uuid[], boolean) to authenticated;
grant execute on function public.network_agenda(date, date) to authenticated;
grant execute on function public.network_reminder_last_day(date) to authenticated;
grant execute on function public.network_reminder_drafts() to authenticated;
grant execute on function public.network_reminder_claim(uuid) to authenticated;
grant execute on function public.network_reminder_mark_sent(uuid) to authenticated;
-- le attività programmate chiamano senza accesso utente (protette dal segreto)
grant execute on function public.network_service_reminder_targets(text, timestamptz) to anon, authenticated;
grant execute on function public.network_service_reminder_manual_targets(text, timestamptz) to anon, authenticated;
grant execute on function public.network_profile_view(uuid) to authenticated;
grant execute on function public.network_stats_orders(date, date) to authenticated;
grant execute on function public.network_stats(date, date) to authenticated;
