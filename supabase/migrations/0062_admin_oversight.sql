-- 0062 — Amministrazione: panoramica, elenco utenti, sospensione degli account e segnalazioni della Community.
-- Serve aver eseguito prima 0033 (amministratori), 0051 (Community a vetrina), 0058 (viaggiatori) e 0061 (Rete).
--
-- Per diventare amministratore (una volta sola, solo il tuo utente):
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'LA-TUA-EMAIL-DI-ACCESSO'
--   on conflict do nothing;

-- 1. Sospensione di un account
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

-- Solo gli amministratori possono sospendere o riattivare (nessuno può togliersi la sospensione da solo)
create or replace function public.profiles_suspension_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    new.suspended_at := old.suspended_at;
    new.suspended_reason := old.suspended_reason;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_suspension_guard_trg on public.profiles;
create trigger profiles_suspension_guard_trg before update on public.profiles
  for each row execute function public.profiles_suspension_guard();

-- 2. Panoramica (numeri per la pagina Amministrazione)
create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
begin
  if not public.is_platform_admin() then return null; end if;
  select jsonb_build_object(
    'agenzia',       count(*) filter (where is_professional and not is_traveler and coalesce(business_kind, 'agenzia') = 'agenzia'),
    'tour_operator', count(*) filter (where is_professional and not is_traveler and business_kind = 'tour_operator'),
    'dmc',           count(*) filter (where is_professional and not is_traveler and business_kind = 'dmc'),
    'guida',         count(*) filter (where is_professional and not is_traveler and business_kind = 'guida'),
    'autista',       count(*) filter (where is_professional and not is_traveler and business_kind = 'autista'),
    'struttura',     count(*) filter (where is_professional and not is_traveler and business_kind = 'struttura'),
    'esperienze',    count(*) filter (where is_professional and not is_traveler and business_kind = 'esperienze'),
    'altro',         count(*) filter (where is_professional and not is_traveler and business_kind = 'altro'),
    'viaggiatori',   count(*) filter (where is_traveler),
    'clienti',       count(*) filter (where not is_professional and not is_traveler),
    'sospesi',       count(*) filter (where suspended_at is not null),
    'nuovi_7_giorni', count(*) filter (where created_at > now() - interval '7 days')
  ) into v from public.profiles;
  v := v || jsonb_build_object('segnalazioni_aperte', (select count(*) from public.community_reports where not handled));
  return v;
end;
$$;

-- 3. Elenco degli utenti, con ricerca
create or replace function public.admin_users(p_query text default null, p_kind text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, email text, full_name text, agency_name text, kind text, created_at timestamptz,
  last_sign_in_at timestamptz, suspended_at timestamptz, suspended_reason text, is_admin boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.email, p.full_name, p.agency_name,
         case when p.is_traveler then 'viaggiatore'
              when not p.is_professional then 'cliente'
              else coalesce(p.business_kind, 'agenzia') end,
         p.created_at, u.last_sign_in_at, p.suspended_at, p.suspended_reason,
         exists (select 1 from public.platform_admins a where a.user_id = p.id)
  from public.profiles p
  left join auth.users u on u.id = p.id
  where public.is_platform_admin()
    and (p_query is null or p_query = '' or p.email ilike '%' || p_query || '%' or p.full_name ilike '%' || p_query || '%' or p.agency_name ilike '%' || p_query || '%')
    and (p_kind is null or p_kind = '' or
         (case when p.is_traveler then 'viaggiatore' when not p.is_professional then 'cliente' else coalesce(p.business_kind, 'agenzia') end) = p_kind)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

-- 4. Sospendere o riattivare (motivo vuoto = riattiva). Non si sospende se stessi né un altro amministratore.
create or replace function public.admin_set_suspended(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  if p_user = auth.uid() then raise exception 'Non puoi sospendere te stesso.'; end if;
  if exists (select 1 from public.platform_admins where user_id = p_user) then raise exception 'Non si sospende un altro amministratore.'; end if;
  update public.profiles
     set suspended_at = case when v_reason is null then null else now() end,
         suspended_reason = left(v_reason, 300)
   where id = p_user;
  -- un profilo sospeso esce dall'elenco della Rete
  if v_reason is not null and to_regclass('public.network_profiles') is not null then
    execute 'update public.network_profiles set status = ''sospeso'', status_note = $2 where user_id = $1' using p_user, left(v_reason, 300);
  end if;
end;
$$;

-- 5. Segnalazioni della Community (tutte, non solo quelle dei propri gruppi)
create or replace function public.admin_reports(p_handled boolean default false)
returns table (
  id uuid, reason text, note text, created_at timestamptz, handled boolean, group_name text,
  post_id uuid, comment_id uuid, content text, author_id uuid, author_name text, reporter_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.reason, r.note, r.created_at, r.handled, g.name, r.post_id, r.comment_id,
         left(coalesce(c.body, po.body), 600),
         coalesce(c.author_id, po.author_id),
         coalesce(ap.agency_name, ap.full_name, ap.email),
         coalesce(rp.agency_name, rp.full_name, rp.email)
  from public.community_reports r
  left join public.community_groups g on g.id = r.group_id
  left join public.community_comments c on c.id = r.comment_id
  left join public.community_posts po on po.id = coalesce(r.post_id, c.post_id)
  left join public.profiles ap on ap.id = coalesce(c.author_id, po.author_id)
  left join public.profiles rp on rp.id = r.reporter_id
  where public.is_platform_admin() and r.handled = p_handled
  order by r.created_at desc
  limit 100;
$$;

-- 6. Gestire una segnalazione: «gestita», «riapri» oppure «rimuovi» (cancella il contenuto segnalato)
create or replace function public.admin_handle_report(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post uuid;
  v_comment uuid;
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  select post_id, comment_id into v_post, v_comment from public.community_reports where id = p_id;
  if p_action = 'rimuovi' then
    if v_comment is not null then delete from public.community_comments where id = v_comment;
    elsif v_post is not null then delete from public.community_posts where id = v_post;
    end if;
    update public.community_reports set handled = true where id = p_id;
  elsif p_action = 'gestita' then
    update public.community_reports set handled = true where id = p_id;
  elsif p_action = 'riapri' then
    update public.community_reports set handled = false where id = p_id;
  end if;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_users(text, text, int, int) from public, anon;
revoke all on function public.admin_set_suspended(uuid, text) from public, anon;
revoke all on function public.admin_reports(boolean) from public, anon;
revoke all on function public.admin_handle_report(uuid, text) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_users(text, text, int, int) to authenticated;
grant execute on function public.admin_set_suspended(uuid, text) to authenticated;
grant execute on function public.admin_reports(boolean) to authenticated;
grant execute on function public.admin_handle_report(uuid, text) to authenticated;
