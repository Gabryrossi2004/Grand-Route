-- Migrazione: bacheca comunità tra agenzie/professionisti + gruppi su invito.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0020_...

-- Serve per generare il token casuale degli inviti (gen_random_bytes).
create extension if not exists pgcrypto;

-- ============================================================
-- 0. Distinguere professionisti (agenzie) da clienti
-- ============================================================
-- "profiles" viene creato automaticamente sia per chi si registra come
-- agenzia/professionista (/signup) sia per chi si registra come cliente
-- (/client/signup): questa colonna permette di separare i due casi, per
-- escludere i clienti dalla bacheca tra agenzie.
alter table public.profiles
  add column if not exists is_professional boolean not null default true;

-- Chi è già collegato come cliente di un'agenzia (clients.user_id) non è un
-- professionista: lo correggiamo subito per chi si è già registrato.
update public.profiles
set is_professional = false
where id in (select user_id from public.clients where user_id is not null);

-- Riusiamo la funzione già richiamata al login/registrazione del cliente per
-- marcare automaticamente anche i nuovi account cliente.
create or replace function public.claim_client_profiles()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_professional = false
  where id = auth.uid();

  update public.clients
  set user_id = auth.uid()
  where user_id is null
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
end;
$$;

-- ============================================================
-- 1. GRUPPI (sempre su invito)
-- ============================================================
create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_group_members (
  group_id uuid not null references public.community_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table if not exists public.community_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references public.profiles (id) on delete cascade,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Chi crea un gruppo ne diventa automaticamente il responsabile ("owner").
create or replace function public.handle_new_community_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_group_members (group_id, profile_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

drop trigger if exists on_community_group_created on public.community_groups;
create trigger on_community_group_created
  after insert on public.community_groups
  for each row execute procedure public.handle_new_community_group();

-- ============================================================
-- 2. POST E COMMENTI (bacheca pubblica se group_id è nullo, altrimenti
--    bacheca del gruppo)
-- ============================================================
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.community_groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. Vista "rubrica" per mostrare autore/membri senza esporre email o altri
--    dati del profilo a tutti i professionisti.
-- ============================================================
create or replace view public.community_profile_directory as
  select id, full_name, agency_name, logo_url
  from public.profiles;

alter view public.community_profile_directory set (security_invoker = true);

-- ============================================================
-- 4. RLS
-- ============================================================
alter table public.community_groups enable row level security;
alter table public.community_group_members enable row level security;
alter table public.community_group_invites enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_post_photos enable row level security;
alter table public.community_comments enable row level security;

create or replace function public.is_community_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.community_group_members
    where group_id = p_group_id and profile_id = auth.uid()
  );
$$;

create or replace function public.is_current_user_professional()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_professional
  );
$$;

-- Permette a qualunque professionista di leggere il profilo (completo) di
-- un altro professionista: serve per mostrare nome/agenzia/logo nella
-- bacheca. L'applicazione deve selezionare solo le colonne non sensibili
-- (o passare dalla vista community_profile_directory) quando mostra questi
-- dati, per non esporre l'email ad altri utenti.
drop policy if exists "profiles_select_as_professional_peer" on public.profiles;
create policy "profiles_select_as_professional_peer" on public.profiles
  for select using (is_professional and public.is_current_user_professional());

-- GRUPPI
drop policy if exists "community_groups_select_member" on public.community_groups;
create policy "community_groups_select_member" on public.community_groups
  for select using (public.is_community_group_member(id));

drop policy if exists "community_groups_insert_professional" on public.community_groups;
create policy "community_groups_insert_professional" on public.community_groups
  for insert with check (created_by = auth.uid() and public.is_current_user_professional());

drop policy if exists "community_groups_update_owner" on public.community_groups;
create policy "community_groups_update_owner" on public.community_groups
  for update using (
    exists (
      select 1 from public.community_group_members
      where group_id = id and profile_id = auth.uid() and role = 'owner'
    )
  );

drop policy if exists "community_groups_delete_owner" on public.community_groups;
create policy "community_groups_delete_owner" on public.community_groups
  for delete using (
    exists (
      select 1 from public.community_group_members
      where group_id = id and profile_id = auth.uid() and role = 'owner'
    )
  );

-- MEMBRI DEL GRUPPO (gli inserimenti avvengono solo tramite il trigger di
-- creazione gruppo o la funzione redeem_community_invite, entrambe
-- security definer: nessuna policy di insert diretta per gli utenti)
drop policy if exists "community_group_members_select_member" on public.community_group_members;
create policy "community_group_members_select_member" on public.community_group_members
  for select using (public.is_community_group_member(group_id));

drop policy if exists "community_group_members_leave_self" on public.community_group_members;
create policy "community_group_members_leave_self" on public.community_group_members
  for delete using (profile_id = auth.uid() and role <> 'owner');

drop policy if exists "community_group_members_remove_by_owner" on public.community_group_members;
create policy "community_group_members_remove_by_owner" on public.community_group_members
  for delete using (
    exists (
      select 1 from public.community_group_members gm2
      where gm2.group_id = community_group_members.group_id
        and gm2.profile_id = auth.uid()
        and gm2.role = 'owner'
    )
  );

-- INVITI (solo il responsabile del gruppo li crea/vede/revoca; il
-- collegamento effettivo avviene tramite redeem_community_invite, che è
-- security definer e non richiede una policy di select pubblica)
drop policy if exists "community_group_invites_owner_all" on public.community_group_invites;
create policy "community_group_invites_owner_all" on public.community_group_invites
  for all using (
    exists (
      select 1 from public.community_group_members
      where group_id = community_group_invites.group_id and profile_id = auth.uid() and role = 'owner'
    )
  ) with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.community_group_members
      where group_id = community_group_invites.group_id and profile_id = auth.uid() and role = 'owner'
    )
  );

create or replace function public.redeem_community_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  if not public.is_current_user_professional() then
    raise exception 'Solo i professionisti possono unirsi a un gruppo.';
  end if;

  select * into v_invite from public.community_group_invites
  where token = p_token and not revoked
  for update;

  if v_invite is null then
    raise exception 'Invito non valido o revocato.';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invito scaduto.';
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'Invito già utilizzato il numero massimo di volte consentito.';
  end if;

  insert into public.community_group_members (group_id, profile_id, role)
  values (v_invite.group_id, auth.uid(), 'member')
  on conflict (group_id, profile_id) do nothing;

  update public.community_group_invites
  set use_count = use_count + 1
  where id = v_invite.id;

  return v_invite.group_id;
end;
$$;

revoke all on function public.redeem_community_invite(text) from public;
grant execute on function public.redeem_community_invite(text) to authenticated;

-- POST
drop policy if exists "community_posts_select" on public.community_posts;
create policy "community_posts_select" on public.community_posts
  for select using (
    (group_id is null and public.is_current_user_professional())
    or (group_id is not null and public.is_community_group_member(group_id))
  );

drop policy if exists "community_posts_insert" on public.community_posts;
create policy "community_posts_insert" on public.community_posts
  for insert with check (
    author_id = auth.uid()
    and (
      (group_id is null and public.is_current_user_professional())
      or (group_id is not null and public.is_community_group_member(group_id))
    )
  );

drop policy if exists "community_posts_update_own" on public.community_posts;
create policy "community_posts_update_own" on public.community_posts
  for update using (author_id = auth.uid());

drop policy if exists "community_posts_delete" on public.community_posts;
create policy "community_posts_delete" on public.community_posts
  for delete using (
    author_id = auth.uid()
    or (
      group_id is not null
      and exists (
        select 1 from public.community_group_members
        where group_id = community_posts.group_id and profile_id = auth.uid() and role = 'owner'
      )
    )
  );

-- FOTO DEL POST
drop policy if exists "community_post_photos_select" on public.community_post_photos;
create policy "community_post_photos_select" on public.community_post_photos
  for select using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_post_photos.post_id
        and (
          (p.group_id is null and public.is_current_user_professional())
          or (p.group_id is not null and public.is_community_group_member(p.group_id))
        )
    )
  );

drop policy if exists "community_post_photos_insert_own" on public.community_post_photos;
create policy "community_post_photos_insert_own" on public.community_post_photos
  for insert with check (
    exists (select 1 from public.community_posts where id = post_id and author_id = auth.uid())
  );

drop policy if exists "community_post_photos_delete_own" on public.community_post_photos;
create policy "community_post_photos_delete_own" on public.community_post_photos
  for delete using (
    exists (select 1 from public.community_posts where id = post_id and author_id = auth.uid())
  );

-- COMMENTI
drop policy if exists "community_comments_select" on public.community_comments;
create policy "community_comments_select" on public.community_comments
  for select using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and (
          (p.group_id is null and public.is_current_user_professional())
          or (p.group_id is not null and public.is_community_group_member(p.group_id))
        )
    )
  );

drop policy if exists "community_comments_insert" on public.community_comments;
create policy "community_comments_insert" on public.community_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and (
          (p.group_id is null and public.is_current_user_professional())
          or (p.group_id is not null and public.is_community_group_member(p.group_id))
        )
    )
  );

drop policy if exists "community_comments_delete" on public.community_comments;
create policy "community_comments_delete" on public.community_comments
  for delete using (
    author_id = auth.uid()
    or exists (
      select 1 from public.community_posts p
      join public.community_group_members gm on gm.group_id = p.group_id
      where p.id = community_comments.post_id and gm.profile_id = auth.uid() and gm.role = 'owner'
    )
  );
