-- Migrazione: tasto emergenza (WhatsApp), like sui post della community,
-- notifiche push (preferenze + iscrizioni + funzioni di invio).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0021_...
--
-- NOTA: questo file inserisce un segreto segnaposto in app_secrets. Subito
-- dopo aver eseguito questo script, esegui ANCHE la query separata che ti
-- ho mandato in chat per impostare il segreto vero (deve combaciare con la
-- variabile d'ambiente CRON_SECRET su Vercel) — così il valore vero non
-- resta scritto nel codice sorgente del progetto.

-- ============================================================
-- 0. Numero di emergenza + preferenze di notifica (agenzia)
-- ============================================================
alter table public.profiles
  add column if not exists emergency_phone text,
  add column if not exists notify_trips boolean not null default true,
  add column if not exists notify_community boolean not null default true,
  add column if not exists notify_emergencies boolean not null default true;

-- Interruttore per singolo viaggio: non tutte le agenzie hanno copertura h24.
alter table public.trips
  add column if not exists show_emergency_button boolean not null default false;

-- ============================================================
-- 1. LIKE sui post della community
-- ============================================================
create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

alter table public.community_post_likes enable row level security;

drop policy if exists "community_post_likes_select" on public.community_post_likes;
create policy "community_post_likes_select" on public.community_post_likes
  for select using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_post_likes.post_id
        and (
          (p.group_id is null and public.is_current_user_professional())
          or (p.group_id is not null and public.is_community_group_member(p.group_id))
        )
    )
  );

drop policy if exists "community_post_likes_insert_own" on public.community_post_likes;
create policy "community_post_likes_insert_own" on public.community_post_likes
  for insert with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and (
          (p.group_id is null and public.is_current_user_professional())
          or (p.group_id is not null and public.is_community_group_member(p.group_id))
        )
    )
  );

drop policy if exists "community_post_likes_delete_own" on public.community_post_likes;
create policy "community_post_likes_delete_own" on public.community_post_likes
  for delete using (profile_id = auth.uid());

-- ============================================================
-- 2. Iscrizioni alle notifiche push (una per dispositivo/browser)
-- ============================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own_all" on public.push_subscriptions;
create policy "push_subscriptions_own_all" on public.push_subscriptions
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ============================================================
-- 3. Segreto per la funzione usata dal cron giornaliero (nessuna policy:
--    leggibile solo dalle funzioni security definer, mai direttamente)
-- ============================================================
create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);

alter table public.app_secrets enable row level security;

insert into public.app_secrets (key, value)
values ('cron_secret', 'da-sostituire')
on conflict (key) do nothing;

-- ============================================================
-- 4. Funzioni che restituiscono i destinatari per ciascun invio push.
--    Ognuna verifica da sé chi può chiamarla, così il codice dell'app non
--    ha mai bisogno di leggere le iscrizioni push di un altro utente
--    direttamente.
-- ============================================================

-- Emergenza: solo il cliente collegato a quel viaggio (con il tasto
-- attivato) può far scattare una notifica all'agenzia proprietaria.
create or replace function public.get_emergency_push_targets(p_trip_id uuid)
returns table(endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.trips t
    join public.clients c on c.id = t.client_id
    where t.id = p_trip_id and c.user_id = auth.uid() and t.show_emergency_button
  ) then
    return;
  end if;

  return query
    select ps.endpoint, ps.p256dh, ps.auth
    from public.trips t
    join public.profiles p on p.id = t.owner_id
    join public.push_subscriptions ps on ps.profile_id = t.owner_id
    where t.id = p_trip_id and p.notify_emergencies;
end;
$$;

revoke all on function public.get_emergency_push_targets(uuid) from public;
grant execute on function public.get_emergency_push_targets(uuid) to authenticated;

-- Nuovo post in community: solo l'autore del post (appena creato) può far
-- scattare la notifica ai destinatari giusti (tutti i professionisti per la
-- bacheca pubblica, solo i membri per un gruppo).
create or replace function public.get_community_post_push_targets(p_post_id uuid)
returns table(endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
begin
  select * into v_post from public.community_posts where id = p_post_id;
  if v_post is null or v_post.author_id <> auth.uid() then
    return;
  end if;

  if v_post.group_id is null then
    return query
      select ps.endpoint, ps.p256dh, ps.auth
      from public.push_subscriptions ps
      join public.profiles p on p.id = ps.profile_id
      where p.is_professional and p.notify_community and ps.profile_id <> v_post.author_id;
  else
    return query
      select ps.endpoint, ps.p256dh, ps.auth
      from public.push_subscriptions ps
      join public.community_group_members gm on gm.profile_id = ps.profile_id
      join public.profiles p on p.id = ps.profile_id
      where gm.group_id = v_post.group_id
        and p.notify_community
        and ps.profile_id <> v_post.author_id;
  end if;
end;
$$;

revoke all on function public.get_community_post_push_targets(uuid) from public;
grant execute on function public.get_community_post_push_targets(uuid) to authenticated;

-- Promemoria partenze: nessun utente collegato (la chiama il cron
-- giornaliero dell'applicazione), quindi è protetta da un segreto invece
-- che da auth.uid().
create or replace function public.get_departure_reminder_push_targets(p_secret text)
returns table(endpoint text, p256dh text, auth_key text, trip_title text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is null or p_secret <> (select value from public.app_secrets where key = 'cron_secret') then
    raise exception 'non autorizzato';
  end if;

  return query
    select ps.endpoint, ps.p256dh, ps.auth, t.title
    from public.trips t
    join public.profiles p on p.id = t.owner_id
    join public.push_subscriptions ps on ps.profile_id = t.owner_id
    where p.notify_trips
      and t.start_date is not null
      and t.start_date = (current_date + interval '3 days')::date;
end;
$$;

revoke all on function public.get_departure_reminder_push_targets(text) from public;
grant execute on function public.get_departure_reminder_push_targets(text) to anon, authenticated;
