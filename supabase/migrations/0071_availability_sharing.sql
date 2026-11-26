-- 0071 — Disponibilità del fornitore visibile ai partner: il fornitore può mostrare, solo alle agenzie e ai professionisti
-- con cui ha una collaborazione attiva, i giorni in cui non è disponibile (e, se vuole, quelli già impegnati con altri servizi).
-- Mai nomi, luoghi o note. Serve aver eseguito prima la 0070.

alter table public.network_prefs add column if not exists share_availability boolean not null default false;
alter table public.network_prefs add column if not exists share_busy boolean not null default false;

-- Giorni non disponibili (e, se scelto, già impegnati) di un partner. Vuoto se non è un partner o se non ha attivato la condivisione.
create or replace function public.network_availability(p_user uuid, p_from date, p_to date)
returns table (day date, state text)
language sql
security definer
set search_path = public
stable
as $$
  with ok as (
    select pr.share_busy
    from public.network_prefs pr
    where pr.user_id = p_user and pr.share_availability
      and auth.uid() is not null and p_user <> auth.uid()
      and coalesce(public.network_are_partners(auth.uid(), p_user), false)
      and p_to >= p_from and p_to - p_from <= 190
  ), off as (
    select distinct d::date as day
    from public.network_calendar_events e
    cross join lateral generate_series(greatest(e.day_from, p_from)::timestamp, least(e.day_to, p_to)::timestamp, interval '1 day') d
    where e.user_id = p_user and e.kind = 'non_disponibile' and exists (select 1 from ok)
      and e.day_from <= p_to and e.day_to >= p_from
  ), busy as (
    select distinct d::date as day
    from public.network_orders o
    cross join lateral generate_series(greatest(o.service_date, p_from)::timestamp, least(coalesce(o.end_date, o.service_date), p_to)::timestamp, interval '1 day') d
    where o.seller_id = p_user and o.status = 'confermato' and exists (select 1 from ok where share_busy)
      and o.service_date <= p_to and coalesce(o.end_date, o.service_date) >= p_from
  )
  select off.day, 'non_disponibile'::text from off
  union all
  select busy.day, 'impegnato'::text from busy where busy.day not in (select off.day from off)
  order by 1;
$$;

-- Il partner condivide la disponibilità? (per sapere se mostrare il calendario nella sua scheda)
create or replace function public.network_availability_info(p_user uuid)
returns table (shared boolean, with_busy boolean)
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(pr.share_availability, false) and auth.uid() is not null and p_user <> auth.uid() and coalesce(public.network_are_partners(auth.uid(), p_user), false),
         coalesce(pr.share_busy, false)
  from (select 1) x
  left join public.network_prefs pr on pr.user_id = p_user;
$$;

revoke all on function public.network_availability(uuid, date, date) from public, anon;
revoke all on function public.network_availability_info(uuid) from public, anon;
grant execute on function public.network_availability(uuid, date, date) to authenticated;
grant execute on function public.network_availability_info(uuid) to authenticated;
