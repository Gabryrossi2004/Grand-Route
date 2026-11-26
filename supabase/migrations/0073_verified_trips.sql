-- 0073 — «Viaggio verificato» e Sconto Rotta: quali viaggi di un'agenzia contano davvero per lo sconto.
-- Un viaggio conta se: itinerario Finale, cliente collegato con un account vero (e diverso dall'agenzia),
-- rientro già avvenuto (negli ultimi 12 mesi) e almeno UNA conferma indipendente:
--   · il cliente tocca «Sì, ho fatto il viaggio» nella sua area, oppure
--   · un fornitore verificato ha confermato un servizio ordinato per quel viaggio (ordine tra partner «confermato»).
-- Se il cliente tocca «Non sono partito» il viaggio non conta. Max 2 viaggi per lo stesso cliente ogni 12 mesi.
-- Scaglioni: 5 viaggi −10%, 15 viaggi −20%, 40 viaggi −30%. Lo sconto si applicherà quando partiranno i piani a pagamento.
-- Serve aver eseguito prima 0015 (servizi) e 0065 (ordini tra partner).

create table if not exists public.trip_verifications (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  client_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'in_attesa' check (status in ('in_attesa', 'confermato', 'non_partito')),
  responded_at timestamptz,
  reminder_sent_at timestamptz,          -- promemoria mandato dall'agenzia al cliente (una volta sola)
  created_at timestamptz not null default now()
);
alter table public.trip_verifications enable row level security;
-- (nessuna policy: si passa solo dalle funzioni qui sotto)

-- Sconto in base ai viaggi verificati
create or replace function public.rotta_discount(n integer)
returns integer
language sql
immutable
as $$ select case when n >= 40 then 30 when n >= 15 then 20 when n >= 5 then 10 else 0 end $$;

-- Stato di ogni viaggio dell'agenzia negli ultimi 12 mesi (uso interno: non raggiungibile da chi è collegato)
create or replace function public.rotta_trips(p_owner uuid)
returns table (
  trip_id uuid, title text, destination text, end_day date, client_name text,
  state text, confirmed_by text, counted boolean, reminder_sent_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with today as (select (now() at time zone 'Europe/Rome')::date as d),
  owner as (select lower(p.email) as email, split_part(lower(p.email), '@', 2) as dom from public.profiles p where p.id = p_owner),
  free as (select array['gmail.com','googlemail.com','outlook.com','outlook.it','hotmail.com','hotmail.it','live.com','live.it',
                        'libero.it','virgilio.it','yahoo.com','yahoo.it','icloud.com','me.com','tiscali.it','alice.it','tin.it',
                        'fastwebnet.it','email.it','proton.me','protonmail.com','pec.it'] as list),
  base as (
    select t.id, t.title, t.destination, coalesce(t.end_date, t.start_date) as end_day,
           c.id as client_id, c.full_name, c.user_id as client_user, lower(cp.email) as client_email,
           v.status as vstatus, v.reminder_sent_at,
           exists (
             select 1 from public.trip_services s
             join public.network_orders o on o.buyer_service_id = s.id
             join public.network_profiles np on np.user_id = o.seller_id
             where s.trip_id = t.id and o.status = 'confermato' and o.buyer_id = p_owner and np.status = 'verificato'
           ) as supplier_ok
    from public.trips t
    join public.clients c on c.id = t.client_id
    left join public.profiles cp on cp.id = c.user_id
    left join public.trip_verifications v on v.trip_id = t.id
    where t.owner_id = p_owner
      and t.itinerary_stage = 'finale'
      and coalesce(t.end_date, t.start_date) < (select d from today)
      and coalesce(t.end_date, t.start_date) >= (select d from today) - 365
  ),
  judged as (
    select b.*,
           -- l'account del cliente c'è ed è un'altra persona (stessa email, o stesso dominio aziendale, non vale)
           (b.client_user is not null and b.client_email is not null
            and b.client_user <> p_owner
            and b.client_email <> coalesce((select email from owner), '')
            and not (split_part(b.client_email, '@', 2) = coalesce((select dom from owner), '#')
                     and array_position((select list from free), coalesce((select dom from owner), '#')) is null)) as account_ok
    from base b
  ),
  staged as (
    select j.*,
           case
             when j.vstatus = 'non_partito' then 'non_partito'
             when not j.account_ok then 'senza_account'
             when j.vstatus = 'confermato' or j.supplier_ok then 'verificato'
             else 'in_attesa'
           end as st
    from judged j
  ),
  ranked as (
    select s.*,
           row_number() over (partition by s.client_id, (s.st = 'verificato') order by s.end_day desc, s.id) as rn
    from staged s
  )
  select r.id, r.title, r.destination, r.end_day, r.full_name,
         case when r.st = 'verificato' and r.rn > 2 then 'oltre_limite' else r.st end,
         case when r.st <> 'verificato' then null when r.vstatus = 'confermato' then 'cliente' else 'fornitore' end,
         (r.st = 'verificato' and r.rn <= 2),
         r.reminder_sent_at
  from ranked r
  order by r.end_day desc, r.id;
$$;
revoke all on function public.rotta_trips(uuid) from public, anon, authenticated;

-- Riepilogo per l'agenzia collegata: viaggi che contano, in attesa, sconto attuale e prossimo traguardo
create or replace function public.rotta_summary()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with r as (select * from public.rotta_trips(auth.uid())),
  n as (select count(*) filter (where counted)::int as verified,
               count(*) filter (where state = 'in_attesa')::int as pending,
               count(*) filter (where state in ('senza_account', 'non_partito', 'oltre_limite'))::int as excluded
        from r)
  select jsonb_build_object(
    'verified', n.verified,
    'pending', n.pending,
    'excluded', n.excluded,
    'discount', public.rotta_discount(n.verified),
    'next_at', case when n.verified < 5 then 5 when n.verified < 15 then 15 when n.verified < 40 then 40 end,
    'next_discount', case when n.verified < 5 then 10 when n.verified < 15 then 20 when n.verified < 40 then 30 end
  )
  from n
  where auth.uid() is not null;
$$;

-- Elenco dei viaggi con il loro stato (pagina «Sconto Rotta»)
create or replace function public.rotta_trip_list()
returns table (
  trip_id uuid, title text, destination text, end_day date, client_name text,
  state text, confirmed_by text, counted boolean, reminder_sent_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select * from public.rotta_trips(auth.uid()) where auth.uid() is not null;
$$;

-- L'agenzia sta per mandare il promemoria al cliente: si può fare una volta sola per viaggio, solo se è «in attesa».
-- Restituisce i dati per la mail (nessuna riga = non si può).
create or replace function public.rotta_claim_reminder(p_trip uuid)
returns table (client_email text, client_name text, trip_title text, agency_name text, agency_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if auth.uid() is null then return; end if;
  select exists (select 1 from public.rotta_trips(auth.uid()) r
                 where r.trip_id = p_trip and r.state = 'in_attesa' and r.reminder_sent_at is null)
    into v_ok;
  if not v_ok then return; end if;

  insert into public.trip_verifications (trip_id, reminder_sent_at) values (p_trip, now())
  on conflict (trip_id) do update set reminder_sent_at = now() where public.trip_verifications.reminder_sent_at is null;

  return query
    select cp.email, c.full_name, t.title, coalesce(o.agency_name, o.full_name, ''), o.email
    from public.trips t
    join public.clients c on c.id = t.client_id
    join public.profiles cp on cp.id = c.user_id
    join public.profiles o on o.id = t.owner_id
    where t.id = p_trip and t.owner_id = auth.uid();
end;
$$;

-- Se la mail non parte, il promemoria si può riprovare
create or replace function public.rotta_release_reminder(p_trip uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.trip_verifications v set reminder_sent_at = null
  where v.trip_id = p_trip and v.status = 'in_attesa'
    and exists (select 1 from public.trips t where t.id = p_trip and t.owner_id = auth.uid());
$$;

-- Lato cliente: viaggi conclusi (ultimi 90 giorni) in cui non ha ancora risposto
create or replace function public.client_pending_confirmations()
returns table (trip_id uuid, title text, destination text, end_day date, agency_name text)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.title, t.destination, coalesce(t.end_date, t.start_date), coalesce(o.agency_name, o.full_name, '')
  from public.trips t
  join public.clients c on c.id = t.client_id
  join public.profiles o on o.id = t.owner_id
  left join public.trip_verifications v on v.trip_id = t.id
  where auth.uid() is not null
    and c.user_id = auth.uid()
    and t.owner_id <> auth.uid()
    and t.itinerary_stage = 'finale'
    and coalesce(t.end_date, t.start_date) < (now() at time zone 'Europe/Rome')::date
    and coalesce(t.end_date, t.start_date) >= (now() at time zone 'Europe/Rome')::date - 90
    and coalesce(v.status, 'in_attesa') = 'in_attesa'
  order by 4 desc
  limit 10;
$$;

-- Lato cliente: «Sì, ho fatto il viaggio» / «Non sono partito»
create or replace function public.client_confirm_trip(p_trip uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_status not in ('confermato', 'non_partito') then return false; end if;
  if not exists (select 1 from public.client_pending_confirmations() p where p.trip_id = p_trip) then return false; end if;

  insert into public.trip_verifications (trip_id, client_user_id, status, responded_at)
  values (p_trip, auth.uid(), p_status, now())
  on conflict (trip_id) do update
    set client_user_id = auth.uid(), status = excluded.status, responded_at = now();
  return true;
end;
$$;

revoke all on function public.rotta_summary() from public, anon;
revoke all on function public.rotta_trip_list() from public, anon;
revoke all on function public.rotta_claim_reminder(uuid) from public, anon;
revoke all on function public.rotta_release_reminder(uuid) from public, anon;
revoke all on function public.client_pending_confirmations() from public, anon;
revoke all on function public.client_confirm_trip(uuid, text) from public, anon;
grant execute on function public.rotta_summary() to authenticated;
grant execute on function public.rotta_trip_list() to authenticated;
grant execute on function public.rotta_claim_reminder(uuid) to authenticated;
grant execute on function public.rotta_release_reminder(uuid) to authenticated;
grant execute on function public.client_pending_confirmations() to authenticated;
grant execute on function public.client_confirm_trip(uuid, text) to authenticated;
