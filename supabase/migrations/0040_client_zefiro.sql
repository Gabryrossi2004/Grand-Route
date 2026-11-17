-- Migrazione: Zefiro per i clienti (domande sul proprio viaggio nell'area clienti).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0039_...
--
-- Le domande dei clienti si addebitano al budget giornaliero dell'agenzia
-- (vedi 0035). Per non lasciare l'agenzia senza budget, ogni cliente può fare
-- al massimo 8 domande all'ora e 25 al giorno, e il sito ferma Zefiro per i
-- clienti quando è stato usato il 70% del budget del giorno.
--
-- Il sito funziona anche prima di questo passaggio: Zefiro per i clienti
-- semplicemente non compare.

-- 1. Interruttore per viaggio: 'default' = come nelle Impostazioni dell'agenzia
alter table public.trips
  add column if not exists client_zefiro text not null default 'default'
    check (client_zefiro in ('default', 'on', 'off'));

-- 2. Chi ha fatto la domanda (per i limiti per cliente)
alter table public.ai_usage
  add column if not exists client_user_id uuid references auth.users (id) on delete set null;

create index if not exists ai_usage_client_idx
  on public.ai_usage (client_user_id, created_at desc)
  where client_user_id is not null;

-- 3. Stato di Zefiro per un viaggio: acceso o spento, pacchetto, spesa di oggi
--    e domande già fatte da questo cliente.
create or replace function public.client_zefiro_status(p_trip_id uuid)
returns table(enabled boolean, plan text, spent_today numeric, calls_hour integer, calls_day integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_mode text;
  v_pref text;
  v_plan text;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
begin
  if not public.is_trip_client(p_trip_id) then
    return;
  end if;

  select t.owner_id, t.client_zefiro into v_owner, v_mode from public.trips t where t.id = p_trip_id;
  select to_jsonb(p) -> 'ai_preferences' ->> 'client_zefiro', coalesce(to_jsonb(p) ->> 'ai_plan', 'start')
    into v_pref, v_plan
    from public.profiles p where p.id = v_owner;

  return query
    select
      case v_mode when 'on' then true when 'off' then false else coalesce(v_pref, 'on') <> 'off' end,
      v_plan,
      coalesce((
        select sum(u.cost_eur) from public.ai_usage u
        where u.user_id = v_owner and u.created_at >= v_day_start
          and (u.kind like 'cost:%' or u.kind = 'client:zefiro')
      ), 0)::numeric,
      (select count(*)::integer from public.ai_usage u
        where u.user_id = v_owner and u.kind = 'client:zefiro' and u.client_user_id = auth.uid()
          and u.created_at > now() - interval '1 hour'),
      (select count(*)::integer from public.ai_usage u
        where u.user_id = v_owner and u.kind = 'client:zefiro' and u.client_user_id = auth.uid()
          and u.created_at > now() - interval '24 hours');
end;
$$;

revoke all on function public.client_zefiro_status(uuid) from public, anon;
grant execute on function public.client_zefiro_status(uuid) to authenticated;

-- 4. Prenota una domanda (controlla i limiti per cliente) e restituisce il suo id.
create or replace function public.client_zefiro_reserve(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_id uuid;
begin
  if not public.is_trip_client(p_trip_id) then
    raise exception 'non autorizzato';
  end if;
  select owner_id into v_owner from public.trips where id = p_trip_id;

  if (select count(*) from public.ai_usage u
        where u.user_id = v_owner and u.kind = 'client:zefiro' and u.client_user_id = auth.uid()
          and u.created_at > now() - interval '1 hour') >= 8
     or (select count(*) from public.ai_usage u
        where u.user_id = v_owner and u.kind = 'client:zefiro' and u.client_user_id = auth.uid()
          and u.created_at > now() - interval '24 hours') >= 25 then
    raise exception 'limite_zefiro';
  end if;

  insert into public.ai_usage (user_id, kind, client_user_id)
  values (v_owner, 'client:zefiro', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.client_zefiro_reserve(uuid) from public, anon;
grant execute on function public.client_zefiro_reserve(uuid) to authenticated;

-- 5. Registra il costo reale di quella domanda (una sola volta, entro 15 minuti,
--    con un tetto per domanda).
create or replace function public.client_zefiro_record_cost(
  p_call_id uuid,
  p_input integer,
  p_output integer,
  p_cost numeric
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage
    set input_tokens = least(greatest(coalesce(p_input, 0), 0), 500000),
        output_tokens = least(greatest(coalesce(p_output, 0), 0), 100000),
        cost_eur = least(greatest(coalesce(p_cost, 0), 0), 0.03)
    where id = p_call_id
      and kind = 'client:zefiro'
      and client_user_id = auth.uid()
      and cost_eur = 0
      and created_at > now() - interval '15 minutes';
$$;

revoke all on function public.client_zefiro_record_cost(uuid, integer, integer, numeric) from public, anon;
grant execute on function public.client_zefiro_record_cost(uuid, integer, integer, numeric) to authenticated;
