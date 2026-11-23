-- 0053 — Vantaggi per chi viaggia con l'agenzia: programma fedeltà a punti, bonus e offerte riservate.
--
-- Il sito funziona anche prima di questo passaggio: senza queste tabelle la pagina «Vantaggi»
-- del cliente mostra solo i servizi inclusi e l'agenzia vede l'avviso che serve l'aggiornamento.

-- 1. Impostazioni del programma fedeltà di ogni agenzia
create table if not exists public.agency_loyalty (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  euros_per_point numeric(10, 2) not null default 10 check (euros_per_point > 0 and euros_per_point <= 10000),
  intro text check (intro is null or char_length(intro) <= 1000),
  levels jsonb not null default '[
    {"name": "Viaggiatore", "min": 0, "perks": "Assistenza dedicata in chat e numero per le emergenze durante il viaggio."},
    {"name": "Esploratore", "min": 300, "perks": "Priorità sulle offerte riservate e check-in seguito dall''agenzia."},
    {"name": "Giramondo", "min": 1000, "perks": "Un servizio in omaggio o uno sconto sul prossimo viaggio, deciso con l''agenzia."}
  ]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.agency_loyalty enable row level security;
drop policy if exists "agency_loyalty_all_own" on public.agency_loyalty;
create policy "agency_loyalty_all_own" on public.agency_loyalty
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 2. Punti dati o usati a mano dall'agenzia (bonus, premi riscattati, amico presentato…)
create table if not exists public.loyalty_adjustments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  points integer not null check (points <> 0 and points between -100000 and 100000),
  reason text not null check (char_length(reason) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists loyalty_adjustments_client_idx on public.loyalty_adjustments (client_id, created_at desc);
alter table public.loyalty_adjustments enable row level security;
drop policy if exists "loyalty_adjustments_all_own" on public.loyalty_adjustments;
create policy "loyalty_adjustments_all_own" on public.loyalty_adjustments
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.owner_id = (select auth.uid()))
  );

-- 3. Offerte riservate ai clienti dell'agenzia
create table if not exists public.agency_offers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  body text check (body is null or char_length(body) <= 2000),
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists agency_offers_owner_idx on public.agency_offers (owner_id, created_at desc);
alter table public.agency_offers enable row level security;
drop policy if exists "agency_offers_all_own" on public.agency_offers;
create policy "agency_offers_all_own" on public.agency_offers
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 4. Per il cliente: i vantaggi di ogni agenzia con cui viaggia (punti, livello, offerte attive).
--    I punti si calcolano dai pagamenti registrati come incassati, più i bonus dell'agenzia.
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
          'agency_name', r.agency_name,
          'logo_url', r.logo_url,
          'brand_color', r.brand_color,
          'has_emergency', r.has_emergency,
          'enabled', coalesce(l.enabled, false),
          'euros_per_point', coalesce(l.euros_per_point, 10),
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
          'offers', coalesce((
            select jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'body', f.body, 'valid_until', f.valid_until))
            from (
              select id, title, body, valid_until from public.agency_offers
              where owner_id = r.owner_id and active
                and (valid_until is null or valid_until >= (now() at time zone 'Europe/Rome')::date)
              order by created_at desc limit 20
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
