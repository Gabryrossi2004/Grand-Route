-- 0055 — Zefiro per il cliente: richiesta di preventivo per il prossimo viaggio, diario della sera
-- e convenzione del giorno durante il viaggio.
--
-- Il sito funziona anche prima di questo passaggio: il bottone del preventivo avvisa che serve
-- l'aggiornamento e le notifiche della sera e del mattino semplicemente non partono.

-- 1. Le richieste possono arrivare anche dai clienti dell'agenzia
alter table public.agency_leads drop constraint if exists agency_leads_source_check;
alter table public.agency_leads add constraint agency_leads_source_check check (source in ('amico', 'privato', 'cliente'));

-- 2. Il cliente chiede un preventivo alla sua agenzia (l'ultima con cui ha viaggiato)
create or replace function public.client_request_quote(p_title text, p_message text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_contact text;
begin
  select c.* into v_client
    from public.clients c
    left join public.trips t on t.client_id = c.id
    where c.user_id = auth.uid()
    order by t.start_date desc nulls last, c.created_at desc
    limit 1;
  if not found then
    return false;
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 2 then
    return false;
  end if;
  if (select count(*) from public.agency_leads
      where referrer_client_id = v_client.id and source = 'cliente' and created_at > now() - interval '1 day') >= 5 then
    return false;
  end if;
  v_contact := coalesce(nullif(v_client.email, ''), nullif(v_client.phone, ''), (select email from auth.users where id = auth.uid()), 'area clienti');
  insert into public.agency_leads (owner_id, referrer_client_id, name, contact, message, source)
  values (
    v_client.owner_id, v_client.id, left(coalesce(nullif(v_client.full_name, ''), 'Cliente'), 120), left(v_contact, 160),
    left('Vorrebbe un preventivo per: ' || trim(p_title) || coalesce(nullif('. ' || trim(coalesce(p_message, '')), '. '), ''), 1000),
    'cliente'
  );
  return true;
end;
$$;
revoke all on function public.client_request_quote(text, text) from public, anon;
grant execute on function public.client_request_quote(text, text) to authenticated;

-- 3. Clienti in viaggio oggi (per il diario della sera e la convenzione del mattino), solo per le
--    agenzie che hanno attivato i «Messaggi automatici ai clienti». Chiamata dal cron con il segreto.
create or replace function public.get_traveling_client_targets(p_secret text)
returns table(endpoint text, p256dh text, auth_key text, trip_id uuid, trip_title text, agency_name text,
              day_title text, place text, deals text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  return query
    select ps.endpoint, ps.p256dh, ps.auth, t.id, t.title, coalesce(o.agency_name, ''),
           d.title,
           (select a.location from public.activities a where a.trip_day_id = d.id and coalesce(a.location, '') <> '' order by a.activity_order limit 1),
           coalesce((
             select array_agg(f.title order by f.created_at desc)
             from public.agency_offers f
             where f.owner_id = t.owner_id and f.active and f.kind = 'convenzione'
               and (f.valid_until is null or f.valid_until >= v_today)
               and (f.country_code is null or f.country_code = any (coalesce(t.countries, '{}') || coalesce(t.auto_countries, '{}')))
           ), '{}')
    from public.trips t
    join public.clients c on c.id = t.client_id
    join public.profiles o on o.id = t.owner_id
    join public.profiles cp on cp.id = c.user_id
    join public.push_subscriptions ps on ps.profile_id = c.user_id
    left join public.trip_days d on d.trip_id = t.id and d.day_date = v_today
    where c.user_id is not null and cp.notify_trips
      and t.start_date <= v_today and t.end_date >= v_today
      and coalesce(to_jsonb(o) -> 'ai_preferences' ->> 'auto_messages', 'off') = 'on';
end;
$$;
revoke all on function public.get_traveling_client_targets(text) from public;
grant execute on function public.get_traveling_client_targets(text) to anon, authenticated;
