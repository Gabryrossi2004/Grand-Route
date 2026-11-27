-- 0074 — «Invita un collega»: ogni professionista ha un suo codice d'invito. Chi si registra dal suo link entra
-- legato a lui; quando il collega è verificato dal team e ha iniziato a lavorare (un viaggio, un ordine o una
-- collaborazione) l'invito diventa «attivo» e matura lo sconto: −20% per 3 mesi a entrambi (max 12 mesi accumulati,
-- tetto complessivo degli sconti 40%). Lo sconto si applicherà quando partiranno i piani a pagamento.
-- Non vale se i due hanno la stessa partita IVA. Serve aver eseguito prima 0061 (rete professionisti).

alter table public.profiles add column if not exists referral_code text;
update public.profiles set referral_code = substr(md5(gen_random_uuid()::text), 1, 8) where referral_code is null;
alter table public.profiles alter column referral_code set default substr(md5(gen_random_uuid()::text), 1, 8);
create unique index if not exists profiles_referral_code_idx on public.profiles (referral_code);

create table if not exists public.referrals (
  invitee_id uuid primary key references public.profiles (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);
create index if not exists referrals_inviter_idx on public.referrals (inviter_id);
alter table public.referrals enable row level security;
-- (nessuna policy: si passa solo dalle funzioni qui sotto)

-- Chi si è appena registrato dal link di un collega: lega l'invito (una volta sola, entro 30 giorni dalla registrazione)
create or replace function public.claim_referral()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lower(nullif(auth.jwt() -> 'user_metadata' ->> 'referral_code', ''));
  v_inviter uuid;
begin
  if auth.uid() is null or v_code is null or v_code !~ '^[a-f0-9]{8}$' then return false; end if;
  if exists (select 1 from public.referrals where invitee_id = auth.uid()) then return false; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.created_at > now() - interval '30 days') then return false; end if;
  select id into v_inviter from public.profiles where referral_code = v_code and id <> auth.uid();
  if v_inviter is null then return false; end if;
  insert into public.referrals (invitee_id, inviter_id) values (auth.uid(), v_inviter) on conflict do nothing;
  return true;
end;
$$;

-- Tutto quello che serve alla pagina «Invita un collega»: il mio codice, chi mi ha invitato, chi ho invitato e a che punto sono
create or replace function public.referral_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_me uuid := auth.uid();
  v_code text;
  v_by jsonb;
  v_list jsonb;
  v_active int;
begin
  if v_me is null then return null; end if;
  select referral_code into v_code from public.profiles where id = v_me;

  with st as (
    select r.invitee_id, r.inviter_id, r.created_at,
           np.business_name, np.status as np_status, np.vat_number,
           coalesce(np.business_name, p.agency_name, p.full_name, 'Collega') as name,
           (select vat_number from public.network_profiles x where x.user_id = r.inviter_id) as inviter_vat,
           (exists (select 1 from public.trips t where t.owner_id = r.invitee_id)
            or exists (select 1 from public.network_orders o where r.invitee_id in (o.seller_id, o.buyer_id))
            or exists (select 1 from public.network_collaborations c where r.invitee_id in (c.from_user, c.to_user) and c.status = 'accettata')) as worked
    from public.referrals r
    join public.profiles p on p.id = r.invitee_id
    left join public.network_profiles np on np.user_id = r.invitee_id
  ), judged as (
    select s.*,
           case
             when s.vat_number is not null and s.vat_number = s.inviter_vat then 'non_valido'
             when s.np_status = 'verificato' and s.worked then 'attivo'
             when s.np_status = 'verificato' then 'verificato'
             else 'registrato'
           end as state
    from st s
  )
  select coalesce((select jsonb_agg(jsonb_build_object('name', j.name, 'state', j.state, 'since', j.created_at) order by j.created_at desc)
                   from judged j where j.inviter_id = v_me), '[]'::jsonb),
         (select count(*) from judged j where j.inviter_id = v_me and j.state = 'attivo')::int,
         (select jsonb_build_object('name', coalesce(ip.agency_name, inp.business_name, ip.full_name, 'un collega'), 'state', j.state)
          from judged j
          join public.profiles ip on ip.id = j.inviter_id
          left join public.network_profiles inp on inp.user_id = j.inviter_id
          where j.invitee_id = v_me)
    into v_list, v_active, v_by;

  return jsonb_build_object(
    'code', v_code,
    'invited_by', v_by,
    'invitees', v_list,
    'active', v_active,
    'banked_months', least(12, 3 * v_active)
  );
end;
$$;

revoke all on function public.claim_referral() from public, anon;
revoke all on function public.referral_overview() from public, anon;
grant execute on function public.claim_referral() to authenticated;
grant execute on function public.referral_overview() to authenticated;
