-- 0054 — Vantaggi, seconda fase: «presenta un amico», convenzioni con i fornitori per paese,
-- notifiche delle offerte, auguri di compleanno e anniversari di viaggio.
--
-- Il sito funziona anche prima di questo passaggio: le nuove parti avvisano che serve l'aggiornamento.

-- 1. Nuove impostazioni del programma
alter table public.agency_loyalty
  add column if not exists referral_bonus integer not null default 100 check (referral_bonus between 0 and 100000),
  add column if not exists birthday_bonus integer not null default 0 check (birthday_bonus between 0 and 100000),
  add column if not exists greetings boolean not null default false;

-- 2. Offerte: anche «convenzioni» con fornitori in un paese o luogo
alter table public.agency_offers
  add column if not exists kind text not null default 'offerta',
  add column if not exists country_code text,
  add column if not exists place text;
alter table public.agency_offers drop constraint if exists agency_offers_kind_check;
alter table public.agency_offers add constraint agency_offers_kind_check check (kind in ('offerta', 'convenzione'));
alter table public.agency_offers drop constraint if exists agency_offers_country_check;
alter table public.agency_offers add constraint agency_offers_country_check check (country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.agency_offers drop constraint if exists agency_offers_place_check;
alter table public.agency_offers add constraint agency_offers_place_check check (place is null or char_length(place) <= 80);

-- 3. «Presenta un amico»: codice personale del cliente e richieste ricevute dall'agenzia
alter table public.clients add column if not exists referral_code text;
create unique index if not exists clients_referral_code_idx on public.clients (referral_code) where referral_code is not null;

create table if not exists public.agency_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  referrer_client_id uuid references public.clients (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  contact text not null check (char_length(contact) between 3 and 160),
  message text check (message is null or char_length(message) <= 1000),
  source text not null default 'amico' check (source in ('amico', 'privato')),
  status text not null default 'nuova' check (status in ('nuova', 'contattata', 'cliente', 'archiviata')),
  bonus_given boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists agency_leads_owner_idx on public.agency_leads (owner_id, created_at desc);
alter table public.agency_leads enable row level security;
drop policy if exists "agency_leads_select_own" on public.agency_leads;
create policy "agency_leads_select_own" on public.agency_leads
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "agency_leads_update_own" on public.agency_leads;
create policy "agency_leads_update_own" on public.agency_leads
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "agency_leads_delete_own" on public.agency_leads;
create policy "agency_leads_delete_own" on public.agency_leads
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Il cliente ottiene (o crea) il proprio link personale per ogni agenzia con cui viaggia
create or replace function public.client_referral_codes()
returns table(owner_id uuid, agency_name text, code text)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients c
     set referral_code = encode(gen_random_bytes(6), 'hex')
   where c.user_id = auth.uid() and c.referral_code is null;
  return query
    select distinct on (c.owner_id) c.owner_id, o.agency_name, c.referral_code
    from public.clients c
    join public.profiles o on o.id = c.owner_id
    where c.user_id = auth.uid() and c.referral_code is not null
    order by c.owner_id, c.created_at;
end;
$$;
revoke all on function public.client_referral_codes() from public, anon;
grant execute on function public.client_referral_codes() to authenticated;

-- Pagina pubblica dell'invito: solo nome e logo dell'agenzia e il nome di battesimo di chi invita
create or replace function public.referral_info(p_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'agency_name', o.agency_name,
    'logo_url', o.logo_url,
    'brand_color', to_jsonb(o) ->> 'brand_color',
    'friend', split_part(coalesce(c.full_name, ''), ' ', 1)
  )
  from public.clients c
  join public.profiles o on o.id = c.owner_id
  where c.referral_code = p_code and p_code ~ '^[0-9a-f]{12}$'
  limit 1;
$$;
revoke all on function public.referral_info(text) from public;
grant execute on function public.referral_info(text) to anon, authenticated;

-- L'amico lascia nome e contatto (con il suo consenso): arriva all'agenzia come richiesta
create or replace function public.submit_referral(p_code text, p_name text, p_contact text, p_message text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
begin
  if p_code !~ '^[0-9a-f]{12}$' then
    return false;
  end if;
  select * into v_client from public.clients where referral_code = p_code;
  if not found then
    return false;
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(trim(coalesce(p_contact, ''))) < 3 then
    return false;
  end if;
  -- tetto contro gli abusi: al massimo 10 richieste al giorno per ogni link
  if (select count(*) from public.agency_leads
      where referrer_client_id = v_client.id and created_at > now() - interval '1 day') >= 10 then
    return false;
  end if;
  insert into public.agency_leads (owner_id, referrer_client_id, name, contact, message, source)
  values (v_client.owner_id, v_client.id, left(trim(p_name), 120), left(trim(p_contact), 160),
          nullif(left(trim(coalesce(p_message, '')), 1000), ''), 'amico');
  return true;
end;
$$;
revoke all on function public.submit_referral(text, text, text, text) from public;
grant execute on function public.submit_referral(text, text, text, text) to anon, authenticated;

-- 4. Notifica ai clienti di una nuova offerta (solo l'agenzia che l'ha pubblicata)
create or replace function public.get_offer_push_targets(p_offer_id uuid)
returns table(endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.agency_offers where id = p_offer_id and owner_id = auth.uid()) then
    return;
  end if;
  return query
    select distinct ps.endpoint, ps.p256dh, ps.auth
    from public.clients c
    join public.profiles cp on cp.id = c.user_id
    join public.push_subscriptions ps on ps.profile_id = c.user_id
    where c.owner_id = auth.uid() and c.user_id is not null and cp.notify_trips;
end;
$$;
revoke all on function public.get_offer_push_targets(uuid) from public, anon;
grant execute on function public.get_offer_push_targets(uuid) to authenticated;

-- 5. Auguri (compleanno e anniversario di viaggio), chiamata dal cron giornaliero con il segreto.
--    La data di nascita è cifrata: il server la decifra e sceglie chi festeggia oggi.
create or replace function public.get_greeting_candidates(p_secret text)
returns table(kind text, client_id uuid, agency_name text, dob text, trip_id uuid, trip_title text,
              endpoint text, p256dh text, auth_key text)
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
    select 'compleanno'::text, c.id, coalesce(o.agency_name, ''), c.date_of_birth, null::uuid, null::text,
           ps.endpoint, ps.p256dh, ps.auth
    from public.clients c
    join public.agency_loyalty l on l.owner_id = c.owner_id and l.greetings
    join public.profiles o on o.id = c.owner_id
    join public.profiles cp on cp.id = c.user_id
    join public.push_subscriptions ps on ps.profile_id = c.user_id
    where c.user_id is not null and c.date_of_birth is not null and cp.notify_trips
    union all
    select 'anniversario'::text, c.id, coalesce(o.agency_name, ''), null::text, t.id, t.title,
           ps.endpoint, ps.p256dh, ps.auth
    from public.trips t
    join public.clients c on c.id = t.client_id
    join public.agency_loyalty l on l.owner_id = t.owner_id and l.greetings
    join public.profiles o on o.id = t.owner_id
    join public.profiles cp on cp.id = c.user_id
    join public.push_subscriptions ps on ps.profile_id = c.user_id
    where c.user_id is not null and cp.notify_trips and t.end_date is not null
      and extract(month from t.end_date) = extract(month from v_today)
      and extract(day from t.end_date) = extract(day from v_today)
      and t.end_date < v_today - 300;
end;
$$;
revoke all on function public.get_greeting_candidates(text) from public;
grant execute on function public.get_greeting_candidates(text) to anon, authenticated;

-- Bonus di compleanno (una volta all'anno per cliente, se l'agenzia l'ha previsto)
create or replace function public.award_birthday_bonus(p_secret text, p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_bonus integer;
  v_reason text := 'Buon compleanno! (' || extract(year from (now() at time zone 'Europe/Rome'))::int || ')';
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;
  select c.owner_id, l.birthday_bonus into v_owner, v_bonus
    from public.clients c join public.agency_loyalty l on l.owner_id = c.owner_id
    where c.id = p_client_id and l.enabled and l.greetings;
  if v_owner is null or coalesce(v_bonus, 0) <= 0 then
    return;
  end if;
  if exists (select 1 from public.loyalty_adjustments where client_id = p_client_id and reason = v_reason) then
    return;
  end if;
  insert into public.loyalty_adjustments (owner_id, client_id, points, reason) values (v_owner, p_client_id, v_bonus, v_reason);
end;
$$;
revoke all on function public.award_birthday_bonus(text, uuid) from public;
grant execute on function public.award_birthday_bonus(text, uuid) to anon, authenticated;

-- 6. Vantaggi per il cliente: aggiunge convenzioni (paese/luogo), bonus amico e paesi dei suoi viaggi
create or replace function public.client_benefits()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_out jsonb := '[]'::jsonb;
  r record;
begin
  for r in
    select o.id as owner_id, o.agency_name, o.logo_url, to_jsonb(o) ->> 'brand_color' as brand_color,
           (to_jsonb(o) ->> 'emergency_phone') is not null as has_emergency,
           array_agg(c.id) as client_ids
    from public.clients c
    join public.profiles o on o.id = c.owner_id
    where c.user_id = auth.uid()
    group by o.id
  loop
    v_out := v_out || jsonb_build_array(
      (
        select jsonb_build_object(
          'owner_id', r.owner_id,
          'agency_name', r.agency_name,
          'logo_url', r.logo_url,
          'brand_color', r.brand_color,
          'has_emergency', r.has_emergency,
          'enabled', coalesce(l.enabled, false),
          'euros_per_point', coalesce(l.euros_per_point, 10),
          'referral_bonus', coalesce(l.referral_bonus, 0),
          'intro', l.intro,
          'levels', coalesce(l.levels, '[]'::jsonb),
          'paid', coalesce((
            select sum(p.amount) from public.trip_payments p
            join public.trips t on t.id = p.trip_id
            where t.client_id = any (r.client_ids) and t.owner_id = r.owner_id
              and p.direction = 'incasso' and p.paid_date is not null
          ), 0),
          'bonus', coalesce((select sum(a.points) from public.loyalty_adjustments a where a.client_id = any (r.client_ids) and a.owner_id = r.owner_id), 0),
          'history', coalesce((
            select jsonb_agg(jsonb_build_object('points', h.points, 'reason', h.reason, 'created_at', h.created_at))
            from (
              select points, reason, created_at from public.loyalty_adjustments
              where client_id = any (r.client_ids) and owner_id = r.owner_id
              order by created_at desc limit 20
            ) h
          ), '[]'::jsonb),
          'countries', coalesce((
            select jsonb_agg(distinct x)
            from public.trips t, unnest(coalesce(t.countries, '{}') || coalesce(t.auto_countries, '{}')) x
            where t.client_id = any (r.client_ids) and t.owner_id = r.owner_id
          ), '[]'::jsonb),
          'offers', coalesce((
            select jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'body', f.body, 'valid_until', f.valid_until,
                                                'kind', f.kind, 'country_code', f.country_code, 'place', f.place))
            from (
              select id, title, body, valid_until, kind, country_code, place from public.agency_offers
              where owner_id = r.owner_id and active
                and (valid_until is null or valid_until >= (now() at time zone 'Europe/Rome')::date)
              order by created_at desc limit 50
            ) f
          ), '[]'::jsonb)
        )
        from (select 1) one
        left join public.agency_loyalty l on l.owner_id = r.owner_id
      )
    );
  end loop;
  return v_out;
end;
$$;
revoke all on function public.client_benefits() from public, anon;
grant execute on function public.client_benefits() to authenticated;
