-- 0076 — Team, fase 2a: i colleghi lavorano nella rete Partner a nome dell'agenzia. Serve aver eseguito prima 0075.
--
-- Nella rete (profilo Partner, ordini, fatture, agenda, collaborazioni, contatti, Posta con i partner) l'identità di
-- chi opera era la persona collegata (auth.uid()). Ora è l'AZIENDA (my_company()): un collega che conferma un ordine,
-- emette una fattura o scrive in Posta lo fa a nome dell'agenzia, e tutti i colleghi vedono gli stessi ordini,
-- fatture e conversazioni. Per chi lavora da solo (azienda = sé stesso) non cambia nulla.
-- La Posta con responsabile, reparti e area privata del titolare arriva con la fase 2b.
-- Si può rieseguire senza danni.

-- 1) Funzioni della rete e della Posta: «io» diventa «la mia azienda»
do $$
declare
  r record;
  v_def text;
  v_new text;
  v_n int := 0;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'network\_%' or p.proname like 'mail\_%')
      and p.prosrc like '%auth.uid()%'
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(v_def, 'auth.uid()', 'public.my_company()');
    if v_new <> v_def then
      execute v_new;
      v_n := v_n + 1;
    end if;
  end loop;
  raise notice 'Team, rete: % funzioni passate all''azienda', v_n;
end $$;

-- 2) Regole delle tabelle della rete e della Posta
do $$
declare
  r record;
  v_qual text;
  v_check text;
  v_sql text;
  v_n int := 0;
begin
  for r in
    select p.tablename, p.policyname, p.qual, p.with_check
    from pg_policies p
    where p.schemaname = 'public'
      and (p.tablename like 'network\_%' or p.tablename like 'mail\_%')
      and p.permissive = 'PERMISSIVE'
      and (coalesce(p.qual, '') || coalesce(p.with_check, '')) like '%auth.uid()%'
  loop
    v_qual := replace(r.qual, 'auth.uid()', 'public.my_company()');
    v_check := replace(r.with_check, 'auth.uid()', 'public.my_company()');
    v_sql := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if v_qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
    v_n := v_n + 1;
  end loop;
  raise notice 'Team, rete: % regole passate all''azienda', v_n;
end $$;

-- Valori predefiniti (es. network_files.user_id): l'azienda invece della persona
do $$
declare
  r record;
begin
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public' and (table_name like 'network\_%' or table_name like 'mail\_%')
      and column_default like '%auth.uid()%'
  loop
    execute format('alter table public.%I alter column %I set default public.my_company()', r.table_name, r.column_name);
  end loop;
end $$;

-- 3) Il profilo Partner dell'agenzia lo può creare chi ha aperto l'account o un titolare (non gli altri colleghi)
do $$
begin
  if to_regclass('public.network_profiles') is not null then
    drop policy if exists "network_profiles_team_insert" on public.network_profiles;
    create policy "network_profiles_team_insert" on public.network_profiles
      as restrictive for insert to authenticated
      with check (not (select public.is_team_member()) or (select public.my_team_role()) = 'titolare');
  end if;
end $$;

-- 4) Foto e documenti del profilo Partner: cartella dell'agenzia (per chi lavora da solo è la stessa di prima)
do $$
declare
  v_folder text := '(storage.foldername(name))[1] in ((select auth.uid())::text, (select public.my_company())::text)';
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects non trovato: regole dei file saltate';
    return;
  end if;
  drop policy if exists "network_media_write_own" on storage.objects;
  execute format('create policy "network_media_write_own" on storage.objects for insert to authenticated with check (bucket_id = %L and %s)', 'network-media', v_folder);
  drop policy if exists "network_media_update_own" on storage.objects;
  execute format('create policy "network_media_update_own" on storage.objects for update to authenticated using (bucket_id = %L and %s)', 'network-media', v_folder);
  drop policy if exists "network_media_delete_own" on storage.objects;
  execute format('create policy "network_media_delete_own" on storage.objects for delete to authenticated using (bucket_id = %L and %s)', 'network-media', v_folder);
  drop policy if exists "network_files_write_own" on storage.objects;
  execute format('create policy "network_files_write_own" on storage.objects for insert to authenticated with check (bucket_id = %L and %s)', 'network-files', v_folder);
  drop policy if exists "network_files_delete_own" on storage.objects;
  execute format('create policy "network_files_delete_own" on storage.objects for delete to authenticated using (bucket_id = %L and %s)', 'network-files', v_folder);
  drop policy if exists "network_files_read" on storage.objects;
  execute format('create policy "network_files_read" on storage.objects for select to authenticated using (bucket_id = %L and (%s or public.network_can_read_file(name)))', 'network-files', v_folder);
end $$;

-- 5) Avvisi della Posta: l'email va all'agenzia (come prima), la notifica sul telefono a tutto il team
create or replace function public.mail_notify_targets(p_message uuid)
returns table (user_id uuid, email text, send_email boolean, endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mail_messages%rowtype;
begin
  select * into m from public.mail_messages where id = p_message and author_id = public.my_company() and not draft;
  if not found then return; end if;
  return query
  with recipients as (
    select p.user_id, pr.email, (p.last_notified_at is null or p.last_notified_at < now() - interval '10 minutes') as mail_ok
    from public.mail_participants p join public.profiles pr on pr.id = p.user_id
    where p.thread_id = m.thread_id and p.user_id <> public.my_company()
  ), upd as (
    update public.mail_participants p set last_notified_at = now()
    from recipients r where p.thread_id = m.thread_id and p.user_id = r.user_id and r.mail_ok
    returning p.user_id
  ), people as (
    -- l'agenzia destinataria e i suoi colleghi
    select r.user_id as company_id, r.user_id as person_id from recipients r
    union
    select r.user_id, tm.user_id from recipients r join public.team_members tm on tm.company_id = r.user_id
  )
  select r.user_id, r.email, r.mail_ok and r.email not like '%@demo.grandroute.invalid', ps.endpoint, ps.p256dh, ps.auth
  from recipients r
  left join people pe on pe.company_id = r.user_id
  left join public.push_subscriptions ps on ps.profile_id = pe.person_id;
end;
$$;
