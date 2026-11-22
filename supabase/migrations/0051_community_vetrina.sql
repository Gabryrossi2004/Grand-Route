-- 0051 — Community a vetrina: gruppi aperti (visibili a tutti i professionisti) e gruppi privati su invito,
-- tipi di post (domanda, recensione, chat), segnalazioni.
--
-- Il sito continua a funzionare anche prima di questo passaggio, ma la nuova community
-- (gruppi aperti, recensioni, segnalazioni) si attiva solo dopo averlo eseguito.

-- 1. Gruppi: aperto/privato, categoria
alter table public.community_groups
  add column if not exists is_open boolean not null default false,
  add column if not exists category text;

alter table public.community_groups drop constraint if exists community_groups_category_check;
alter table public.community_groups
  add constraint community_groups_category_check
  check (category is null or category in ('hotel', 'tour', 'trasporti', 'esperienze', 'destinazioni', 'fornitori', 'altro'));

-- 2. Post: tipo e campi della recensione
alter table public.community_posts
  add column if not exists kind text not null default 'chat',
  add column if not exists subject text,
  add column if not exists rating smallint,
  add column if not exists pros text,
  add column if not exists cons text,
  add column if not exists country_code text,
  add column if not exists would_resell boolean;

alter table public.community_posts drop constraint if exists community_posts_kind_check;
alter table public.community_posts
  add constraint community_posts_kind_check check (kind in ('domanda', 'recensione', 'chat'));
alter table public.community_posts drop constraint if exists community_posts_rating_check;
alter table public.community_posts
  add constraint community_posts_rating_check check (rating is null or rating between 1 and 5);

create index if not exists community_posts_group_created_idx on public.community_posts (group_id, created_at desc);

-- 3. Chi può leggere un gruppo: i membri, e tutti i professionisti se il gruppo è aperto
create or replace function public.can_read_community_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_community_group_member(p_group_id)
    or (
      public.is_current_user_professional()
      and exists (select 1 from public.community_groups g where g.id = p_group_id and g.is_open)
    );
$$;

drop policy if exists "community_groups_select_member" on public.community_groups;
create policy "community_groups_select_member" on public.community_groups
  for select using (created_by = auth.uid() or public.can_read_community_group(id));

drop policy if exists "community_group_members_select_member" on public.community_group_members;
create policy "community_group_members_select_member" on public.community_group_members
  for select using (public.can_read_community_group(group_id));

-- 4. Bacheca generale esistente (post senza gruppo): diventa un gruppo aperto «Bacheca generale»
do $$
declare
  v_owner uuid;
  v_group uuid;
begin
  select author_id into v_owner from public.community_posts where group_id is null order by created_at limit 1;
  if v_owner is not null then
    insert into public.community_groups (name, description, created_by, is_open, category)
    values ('Bacheca generale', 'Novità, avvisi e consigli tra agenzie.', v_owner, true, 'altro')
    returning id into v_group;
    insert into public.community_group_members (group_id, profile_id, role)
      select v_group, a.author_id, 'member'
      from (select distinct author_id from public.community_posts where group_id is null) a
      where a.author_id <> v_owner
      on conflict do nothing;
    update public.community_posts set group_id = v_group where group_id is null;
  end if;
end $$;

-- 5. Lettura di post, foto, commenti e «mi piace»: chi può leggere il gruppo
drop policy if exists "community_posts_select" on public.community_posts;
create policy "community_posts_select" on public.community_posts
  for select using (
    (group_id is null and public.is_current_user_professional())
    or (group_id is not null and public.can_read_community_group(group_id))
  );

drop policy if exists "community_post_photos_select" on public.community_post_photos;
create policy "community_post_photos_select" on public.community_post_photos
  for select using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_post_photos.post_id
        and ((p.group_id is null and public.is_current_user_professional())
          or (p.group_id is not null and public.can_read_community_group(p.group_id)))
    )
  );

drop policy if exists "community_comments_select" on public.community_comments;
create policy "community_comments_select" on public.community_comments
  for select using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and ((p.group_id is null and public.is_current_user_professional())
          or (p.group_id is not null and public.can_read_community_group(p.group_id)))
    )
  );

drop policy if exists "community_post_likes_select" on public.community_post_likes;
create policy "community_post_likes_select" on public.community_post_likes
  for select using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_post_likes.post_id
        and ((p.group_id is null and public.is_current_user_professional())
          or (p.group_id is not null and public.can_read_community_group(p.group_id)))
    )
  );
-- (scrivere post, commenti e «mi piace» resta riservato ai membri del gruppo)

-- 6. Entrare in un gruppo aperto con un clic
create or replace function public.join_open_community_group(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_professional() then
    raise exception 'Solo i professionisti possono unirsi a un gruppo.';
  end if;
  if not exists (select 1 from public.community_groups where id = p_group_id and is_open) then
    raise exception 'Questo gruppo è privato: serve un invito.';
  end if;
  insert into public.community_group_members (group_id, profile_id, role)
  values (p_group_id, auth.uid(), 'member')
  on conflict (group_id, profile_id) do nothing;
  return p_group_id;
end;
$$;
revoke all on function public.join_open_community_group(uuid) from public, anon;
grant execute on function public.join_open_community_group(uuid) to authenticated;

-- 7. Numero di membri dei gruppi aperti (per la vetrina)
create or replace function public.community_group_counts()
returns table(group_id uuid, members bigint, posts bigint, last_post timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select g.id,
         (select count(*) from public.community_group_members m where m.group_id = g.id),
         (select count(*) from public.community_posts p where p.group_id = g.id),
         (select max(p.created_at) from public.community_posts p where p.group_id = g.id)
  from public.community_groups g
  where public.can_read_community_group(g.id);
$$;
revoke all on function public.community_group_counts() from public, anon;
grant execute on function public.community_group_counts() to authenticated;

-- 8. Segnalazioni: ogni membro può segnalare un post o un commento; le vede il responsabile del gruppo
create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  group_id uuid references public.community_groups (id) on delete cascade,
  reason text not null check (reason in ('offensivo', 'spam', 'dati_personali', 'falso', 'altro')),
  note text check (note is null or char_length(note) <= 500),
  handled boolean not null default false,
  created_at timestamptz not null default now(),
  check (post_id is not null or comment_id is not null),
  unique (reporter_id, post_id, comment_id)
);
create index if not exists community_reports_group_idx on public.community_reports (group_id, handled);
alter table public.community_reports enable row level security;

drop policy if exists "community_reports_insert" on public.community_reports;
create policy "community_reports_insert" on public.community_reports
  for insert with check (
    reporter_id = auth.uid()
    and group_id is not null
    and public.is_community_group_member(group_id)
  );

drop policy if exists "community_reports_select" on public.community_reports;
create policy "community_reports_select" on public.community_reports
  for select using (
    reporter_id = auth.uid()
    or exists (
      select 1 from public.community_group_members m
      where m.group_id = community_reports.group_id and m.profile_id = auth.uid() and m.role = 'owner'
    )
  );

drop policy if exists "community_reports_update_owner" on public.community_reports;
create policy "community_reports_update_owner" on public.community_reports
  for update using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_reports.group_id and m.profile_id = auth.uid() and m.role = 'owner'
    )
  );

drop policy if exists "community_reports_delete_owner" on public.community_reports;
create policy "community_reports_delete_owner" on public.community_reports
  for delete using (
    exists (
      select 1 from public.community_group_members m
      where m.group_id = community_reports.group_id and m.profile_id = auth.uid() and m.role = 'owner'
    )
  );
