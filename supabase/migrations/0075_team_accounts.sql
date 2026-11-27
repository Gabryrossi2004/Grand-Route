-- 0075 — Account di squadra, fase 1 (gestionale). Serve aver eseguito prima 0074.
--
-- Un'agenzia può invitare i collaboratori: ognuno entra con la sua email e la sua password e lavora sui dati
-- dell'agenzia (viaggi, clienti, fornitori, pagamenti…). L'«azienda» è il profilo di chi l'ha aperta (il fondatore):
-- le colonne owner_id continuano a voler dire «di quale azienda è il dato». Nessun dato esistente viene spostato:
-- ogni account di oggi è un'azienda di una persona sola, e per lui tutto resta identico.
--
-- Cosa fa:
--  1) tabelle team_members (chi fa parte di quale azienda, con che ruolo) e team_invites (inviti via email);
--  2) funzioni my_company(), my_team_role(), team_can(sezione): la matrice dei permessi sta in team_role_can();
--  3) riscrive le regole di sicurezza delle tabelle del gestionale: «owner_id = auth.uid()» diventa
--     «owner_id = my_company()»: tutta la squadra vede e modifica tutti i dati dell'azienda (anche in emergenza
--     l'operativo può correggere ciò che ha fatto il booking e viceversa). I ruoli sono etichette; solo i titolari
--     gestiscono la squadra, le impostazioni dell'agenzia e il piano;
--  4) account «individuale» (come oggi, predefinito per chi c'è già) o «azienda» (può invitare colleghi);
--  5) profilo dell'azienda (logo, nome, preferenze) leggibile dalla squadra, modificabile solo dai titolari;
--  6) cartelle dei file (loghi, documenti, foto) dell'azienda condivise con la squadra;
--  7) viaggi «assegnati a» un membro (trips.assigned_to);
--  8) funzioni per accettare un invito, cambiare ruolo, togliere un membro.
-- La rete Partner (network_*, Posta, ordini e fatture fornitori) per ora resta solo del fondatore: è la fase 2.
-- Si può rieseguire senza danni.

-- ---------- 1) Tabelle ----------
-- Tipo di account (vedi sezione 4): «individuale» per tutti quelli di oggi
alter table public.profiles add column if not exists account_mode text not null default 'individuale';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_account_mode_check') then
    alter table public.profiles add constraint profiles_account_mode_check check (account_mode in ('individuale', 'azienda'));
  end if;
end $$;

create table if not exists public.team_members (
  user_id uuid primary key references public.profiles (id) on delete cascade, -- una persona sta in una sola azienda
  company_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('titolare', 'operativo', 'contabilita', 'booking')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_id <> company_id)
);
create index if not exists team_members_company_idx on public.team_members (company_id);
alter table public.team_members enable row level security;

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.profiles (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null check (role in ('titolare', 'operativo', 'contabilita', 'booking')),
  -- codice segreto del link d'invito (64 caratteri casuali)
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);
create index if not exists team_invites_company_idx on public.team_invites (company_id, created_at desc);
alter table public.team_invites enable row level security;

-- ---------- 2) Chi sono, per quale azienda lavoro, cosa posso fare ----------
-- Azienda di chi è collegato: quella di cui è membro, altrimenti la sua (il fondatore è l'azienda)
create or replace function public.my_company()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select m.company_id from public.team_members m where m.user_id = auth.uid()), auth.uid());
$$;

-- Ruolo nella squadra: il fondatore (e chiunque non sia membro di un'altra azienda) è titolare della propria
create or replace function public.my_team_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null
              else coalesce((select m.role from public.team_members m where m.user_id = auth.uid()), 'titolare') end;
$$;

-- È membro (invitato) di un'azienda non sua?
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.team_members m where m.user_id = auth.uid());
$$;

-- MATRICE DEI PERMESSI (l'unico posto da cambiare; in TypeScript la stessa regola è in src/lib/teamRoles.ts).
-- Oggi: tutti leggono e scrivono tutti i dati dell'azienda; solo i titolari gestiscono «squadra» e «impostazioni»
-- (profilo dell'agenzia, logo, piano di Zefiro, in futuro l'abbonamento).
create or replace function public.team_role_can(p_role text, p_section text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_role = 'titolare' then true
    when p_role in ('operativo', 'contabilita', 'booking') then p_section not in ('squadra', 'impostazioni')
    else false
  end;
$$;

create or replace function public.team_can(p_section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.team_role_can(public.my_team_role(), p_section);
$$;

-- Il profilo indicato è della mia azienda (fondatore o membro)?
create or replace function public.in_my_company(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile = public.my_company()
      or exists (select 1 from public.team_members m where m.user_id = p_profile and m.company_id = public.my_company());
$$;

-- Anche i visitatori anonimi devono poterle chiamare: compaiono nelle regole delle tabelle valide per tutti
-- (es. le pagine pubbliche dei viaggi). Senza accesso restituiscono null/falso e non aprono nulla.
grant execute on function public.my_company() to anon, authenticated;
grant execute on function public.my_team_role() to anon, authenticated;
grant execute on function public.is_team_member() to anon, authenticated;
grant execute on function public.team_can(text) to anon, authenticated;
grant execute on function public.in_my_company(uuid) to anon, authenticated;
grant execute on function public.team_role_can(text, text) to anon, authenticated;

-- ---------- Regole delle due tabelle nuove ----------
drop policy if exists "team_members_select_company" on public.team_members;
create policy "team_members_select_company" on public.team_members
  for select to authenticated
  using (company_id = (select public.my_company()) or user_id = (select auth.uid()));
-- (inserimenti, cambi di ruolo e uscite solo dalle funzioni qui sotto)

drop policy if exists "team_invites_titolare_select" on public.team_invites;
create policy "team_invites_titolare_select" on public.team_invites
  for select to authenticated
  using (company_id = (select public.my_company()) and (select public.my_team_role()) = 'titolare');
drop policy if exists "team_invites_titolare_insert" on public.team_invites;
create policy "team_invites_titolare_insert" on public.team_invites
  for insert to authenticated
  with check (company_id = (select public.my_company()) and (select public.my_team_role()) = 'titolare'
              and invited_by = (select auth.uid()) and accepted_at is null and accepted_by is null
              and expires_at <= now() + interval '31 days'
              and exists (select 1 from public.profiles p where p.id = company_id and p.account_mode = 'azienda'));
drop policy if exists "team_invites_titolare_update" on public.team_invites;
create policy "team_invites_titolare_update" on public.team_invites
  for update to authenticated
  using (company_id = (select public.my_company()) and (select public.my_team_role()) = 'titolare' and accepted_at is null)
  with check (company_id = (select public.my_company()) and (select public.my_team_role()) = 'titolare' and accepted_at is null);
drop policy if exists "team_invites_titolare_delete" on public.team_invites;
create policy "team_invites_titolare_delete" on public.team_invites
  for delete to authenticated
  using (company_id = (select public.my_company()) and (select public.my_team_role()) = 'titolare');

-- ---------- 3) Regole del gestionale: dall'utente all'azienda ----------
-- Legge le regole esistenti delle tabelle del gestionale e sostituisce i confronti di owner_id con auth.uid()
-- (in tutte le forme: «auth.uid() = owner_id», «trips.owner_id = auth.uid()», «( SELECT auth.uid() AS uid)»…)
-- con l'azienda. Le altre condizioni (clienti del portale con clients.user_id, viaggi pubblicati…) restano com'erano.
-- Non tocca rete, Posta, Community né le tabelle personali. Rieseguendola non cambia più nulla.
do $$
declare
  r record;
  v_uid constant text := '(\(\s*select\s+auth\.uid\(\)\s+as\s+uid\s*\)|auth\.uid\(\))';
  v_col constant text := '(\m(?:[a-z_][a-z0-9_]*\.)?owner_id\M)';
  v_company constant text := '( SELECT public.my_company() AS my_company)';
  v_qual text;
  v_check text;
  v_sql text;
  v_count int := 0;
begin
  for r in
    select p.tablename, p.policyname, p.cmd, p.qual, p.with_check
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename in ('trips', 'trip_days', 'activities', 'activity_photos', 'documents', 'trip_checklist_items',
                          'trip_groups', 'trip_people', 'trip_packing_items', 'trip_expenses', 'trip_payments',
                          'trip_services', 'clients', 'loyalty_adjustments', 'agency_loyalty', 'agency_offers',
                          'agency_leads', 'agency_faqs', 'agency_itineraries', 'activity_templates', 'prompt_styles',
                          'country_sheets', 'sheet_shares', 'suppliers', 'supplier_price_list_items', 'ops_rows',
                          'zefiro_memory')
      and p.permissive = 'PERMISSIVE'
  loop
    v_qual := r.qual;
    v_check := r.with_check;
    if v_qual is not null then
      v_qual := regexp_replace(v_qual, v_col || '\s*=\s*' || v_uid, '\1 = ' || v_company, 'gi');
      v_qual := regexp_replace(v_qual, v_uid || '\s*=\s*' || v_col, '\2 = ' || v_company, 'gi');
    end if;
    if v_check is not null then
      v_check := regexp_replace(v_check, v_col || '\s*=\s*' || v_uid, '\1 = ' || v_company, 'gi');
      v_check := regexp_replace(v_check, v_uid || '\s*=\s*' || v_col, '\2 = ' || v_company, 'gi');
    end if;
    if v_qual is not distinct from r.qual and v_check is not distinct from r.with_check then
      continue;
    end if;
    v_sql := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if v_qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
    v_count := v_count + 1;
  end loop;
  raise notice 'Account di squadra: % regole passate all''azienda', v_count;
end $$;

-- Valori predefiniti: dove owner_id si riempiva da solo con l'utente, ora si riempie con l'azienda
do $$
declare
  t text;
begin
  foreach t in array array['agency_itineraries', 'agency_loyalty', 'agency_offers', 'country_sheets', 'loyalty_adjustments', 'ops_rows'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'owner_id'
                 and column_default ilike '%auth.uid()%') then
      execute format('alter table public.%I alter column owner_id set default public.my_company()', t);
    end if;
  end loop;
end $$;

-- ---------- 4) Account individuale o aziendale ----------
-- Alla registrazione si sceglie: «individuale» (si lavora da soli, nessuna squadra) o «azienda» (si possono invitare
-- colleghi). Gli account di oggi restano individuali: per loro non cambia nulla. Un titolare può passare ad «azienda».
-- (la colonna profiles.account_mode è creata all'inizio, sezione 1)

-- Il profilo nasce dai dati della registrazione (come prima) e in più legge la scelta account_mode
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_traveler boolean := coalesce(new.raw_user_meta_data ->> 'account_kind', '') = 'traveler';
  v_kind text := nullif(new.raw_user_meta_data ->> 'business_kind', '');
  v_mode text := case when new.raw_user_meta_data ->> 'account_mode' = 'azienda' then 'azienda' else 'individuale' end;
begin
  if v_kind is null or v_kind not in ('agenzia', 'tour_operator', 'dmc', 'guida', 'autista', 'struttura', 'esperienze', 'altro') then
    v_kind := null;
  end if;
  insert into public.profiles (id, email, full_name, is_traveler, is_professional, business_kind, account_mode)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    v_traveler,
    not v_traveler,
    case when v_traveler then null else v_kind end,
    -- la squadra è per agenzie, tour operator e DMC (i fornitori restano individuali per ora)
    case when v_traveler or not public.is_trade_kind(v_kind) then 'individuale' else v_mode end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Il titolare trasforma l'account in aziendale (o, se non ha ancora colleghi, lo riporta a individuale)
create or replace function public.set_account_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.my_company();
begin
  if auth.uid() is null or public.my_team_role() <> 'titolare' then return 'non_autorizzato'; end if;
  if p_mode not in ('individuale', 'azienda') then return 'modo'; end if;
  if not exists (select 1 from public.profiles where id = v_company and is_professional and not is_traveler
                 and public.is_trade_kind(business_kind)) then
    return 'non_professionista';
  end if;
  if p_mode = 'individuale' then
    if exists (select 1 from public.team_members where company_id = v_company) then return 'ha_squadra'; end if;
    update public.team_invites set revoked_at = now()
    where company_id = v_company and accepted_at is null and revoked_at is null;
  end if;
  update public.profiles set account_mode = p_mode where id = v_company;
  return 'ok';
end;
$$;
revoke all on function public.set_account_mode(text) from public, anon;
grant execute on function public.set_account_mode(text) to authenticated;

-- I collaboratori non aprono un proprio profilo nella rete Partner (fase 2): resta quello del fondatore
do $$
begin
  if to_regclass('public.network_profiles') is not null then
    drop policy if exists "network_profiles_team_insert" on public.network_profiles;
    create policy "network_profiles_team_insert" on public.network_profiles
      as restrictive for insert to authenticated
      with check (not (select public.is_team_member()));
  end if;
end $$;

-- ---------- 5) Profilo dell'azienda ----------
-- La squadra legge il profilo dell'azienda (nome, logo, colori, preferenze di Zefiro) e i profili dei colleghi
drop policy if exists "profiles_select_team" on public.profiles;
create policy "profiles_select_team" on public.profiles
  for select to authenticated
  using (public.in_my_company(id));
-- I titolari invitati possono modificare il profilo dell'azienda (il fondatore lo faceva già: è il suo)
drop policy if exists "profiles_update_company_titolare" on public.profiles;
create policy "profiles_update_company_titolare" on public.profiles
  for update to authenticated
  using (id = (select public.my_company()) and (select public.my_team_role()) = 'titolare')
  with check (id = (select public.my_company()) and (select public.my_team_role()) = 'titolare');

-- ---------- 6) File dell'azienda (loghi, foto, documenti di viaggio) ----------
-- Prima: ognuno solo nella cartella col proprio id. Ora: la propria cartella (es. foto della Community) oppure
-- quella dell'azienda (per il fondatore sono la stessa: per lui non cambia nulla).
do $$
declare
  v_folder text := '(storage.foldername(name))[1] in ((select auth.uid())::text, (select public.my_company())::text)';
  b record;
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects non trovato: regole dei file saltate';
    return;
  end if;
  for b in select * from (values ('public-assets', 'public_assets'), ('trip-documents', 'trip_documents')) as x(bucket, prefix) loop
    execute format('drop policy if exists %I on storage.objects', b.prefix || '_read_own_folder');
    execute format('create policy %I on storage.objects for select to authenticated using (bucket_id = %L and %s)',
                   b.prefix || '_read_own_folder', b.bucket, v_folder);
    execute format('drop policy if exists %I on storage.objects', b.prefix || '_write_own_folder');
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and %s)',
                   b.prefix || '_write_own_folder', b.bucket, v_folder);
    execute format('drop policy if exists %I on storage.objects', b.prefix || '_update_own_folder');
    execute format('create policy %I on storage.objects for update to authenticated using (bucket_id = %L and %s) with check (bucket_id = %L and %s)',
                   b.prefix || '_update_own_folder', b.bucket, v_folder, b.bucket, v_folder);
    execute format('drop policy if exists %I on storage.objects', b.prefix || '_delete_own_folder');
    execute format('create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and %s)',
                   b.prefix || '_delete_own_folder', b.bucket, v_folder);
  end loop;
end $$;

-- ---------- 7) Viaggi assegnati a un membro ----------
alter table public.trips add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
create index if not exists trips_assigned_to_idx on public.trips (assigned_to) where assigned_to is not null;

-- Si può assegnare un viaggio solo a qualcuno della stessa azienda
create or replace function public.trips_check_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null and new.assigned_to <> new.owner_id
     and not exists (select 1 from public.team_members m where m.user_id = new.assigned_to and m.company_id = new.owner_id) then
    raise exception 'Questa persona non fa parte della squadra.';
  end if;
  return new;
end;
$$;
revoke all on function public.trips_check_assignee() from public, anon, authenticated;
drop trigger if exists trips_check_assignee_trg on public.trips;
create trigger trips_check_assignee_trg
  before insert or update of assigned_to, owner_id on public.trips
  for each row execute function public.trips_check_assignee();

-- ---------- 8) Inviti e gestione della squadra ----------
-- Pagina dell'invito (anche senza accesso): di quale agenzia, per quale email, ancora valido?
create or replace function public.team_invite_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'agency', coalesce(nullif(p.agency_name, ''), p.full_name, 'un''agenzia'),
    'email', i.email,
    'role', i.role,
    'state', case when i.revoked_at is not null then 'revocato'
                  when i.accepted_at is not null then 'usato'
                  when i.expires_at < now() then 'scaduto'
                  else 'valido' end
  )
  from public.team_invites i
  join public.profiles p on p.id = i.company_id
  where i.token = p_token and char_length(coalesce(p_token, '')) >= 32;
$$;
revoke all on function public.team_invite_info(text) from public;
grant execute on function public.team_invite_info(text) to anon, authenticated;

-- Al primo accesso dopo la registrazione dal link d'invito: entra nella squadra.
-- Il codice dell'invito arriva dai dati della registrazione (user_metadata.team_invite) oppure, per chi ha già un
-- account (vuoto) ed è collegato, dalla pagina dell'invito (p_token). In ogni caso l'email deve essere quella invitata.
-- Risposte: none (nessun invito), ok, gia_membro, non_trovato, revocato, usato, scaduto, email (email diversa),
-- altra_squadra, ha_dati (account che ha già dati propri: serve un'altra email), non_professionista.
create or replace function public.accept_team_invite(p_token text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := coalesce(nullif(trim(p_token), ''), nullif(auth.jwt() -> 'user_metadata' ->> 'team_invite', ''));
  v_inv public.team_invites%rowtype;
  v_email text;
  v_member public.team_members%rowtype;
begin
  if v_uid is null or v_token is null then return 'none'; end if;

  select * into v_inv from public.team_invites where token = v_token for update;
  if not found then return 'non_trovato'; end if;

  select * into v_member from public.team_members where user_id = v_uid;
  if found then
    return case when v_member.company_id = v_inv.company_id then 'gia_membro' else 'altra_squadra' end;
  end if;

  if v_inv.revoked_at is not null then return 'revocato'; end if;
  if v_inv.accepted_at is not null then return 'usato'; end if;
  if v_inv.expires_at < now() then return 'scaduto'; end if;
  if not exists (select 1 from public.profiles where id = v_inv.company_id and account_mode = 'azienda') then return 'revocato'; end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null or v_email <> lower(trim(v_inv.email)) then return 'email'; end if;
  if v_inv.company_id = v_uid then return 'ha_dati'; end if;

  if exists (select 1 from public.profiles p where p.id = v_uid and (p.is_traveler or not p.is_professional)) then
    return 'non_professionista';
  end if;

  -- Un account che ha già un'attività sua (viaggi, clienti, fornitori, una squadra, la rete) non può entrare
  if exists (select 1 from public.trips where owner_id = v_uid)
     or exists (select 1 from public.clients where owner_id = v_uid)
     or exists (select 1 from public.suppliers where owner_id = v_uid)
     or exists (select 1 from public.team_members where company_id = v_uid)
     or exists (select 1 from public.network_profiles where user_id = v_uid)
     or exists (select 1 from public.network_orders where v_uid in (seller_id, buyer_id)) then
    return 'ha_dati';
  end if;

  insert into public.team_members (user_id, company_id, role, invited_by)
  values (v_uid, v_inv.company_id, v_inv.role, v_inv.invited_by);
  update public.team_invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return 'ok';
end;
$$;
revoke all on function public.accept_team_invite(text) from public, anon;
grant execute on function public.accept_team_invite(text) to authenticated;

-- Cambia il ruolo di un membro (solo i titolari; il fondatore resta sempre titolare)
create or replace function public.team_set_role(p_user uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.my_company();
  v_old text;
begin
  if auth.uid() is null or public.my_team_role() <> 'titolare' then return 'non_autorizzato'; end if;
  if p_role not in ('titolare', 'operativo', 'contabilita', 'booking') then return 'ruolo'; end if;
  if p_user = v_company then return 'fondatore'; end if;
  select role into v_old from public.team_members where user_id = p_user and company_id = v_company for update;
  if v_old is null then return 'non_trovato'; end if;
  -- deve restare almeno un titolare (il fondatore lo è sempre: il controllo è una sicurezza in più)
  if v_old = 'titolare' and p_role <> 'titolare'
     and not exists (select 1 from public.profiles where id = v_company)
     and not exists (select 1 from public.team_members where company_id = v_company and role = 'titolare' and user_id <> p_user) then
    return 'ultimo_titolare';
  end if;
  update public.team_members set role = p_role where user_id = p_user and company_id = v_company;
  return 'ok';
end;
$$;
revoke all on function public.team_set_role(uuid, text) from public, anon;
grant execute on function public.team_set_role(uuid, text) to authenticated;

-- Toglie un membro dalla squadra: perde subito l'accesso; i dati restano all'azienda
create or replace function public.team_remove(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.my_company();
  v_role text;
begin
  if auth.uid() is null or public.my_team_role() <> 'titolare' then return 'non_autorizzato'; end if;
  if p_user = v_company then return 'fondatore'; end if;
  select role into v_role from public.team_members where user_id = p_user and company_id = v_company for update;
  if v_role is null then return 'non_trovato'; end if;
  if v_role = 'titolare'
     and not exists (select 1 from public.profiles where id = v_company)
     and not exists (select 1 from public.team_members where company_id = v_company and role = 'titolare' and user_id <> p_user) then
    return 'ultimo_titolare';
  end if;
  update public.trips set assigned_to = null where owner_id = v_company and assigned_to = p_user;
  delete from public.team_members where user_id = p_user and company_id = v_company;
  return 'ok';
end;
$$;
revoke all on function public.team_remove(uuid) from public, anon;
grant execute on function public.team_remove(uuid) to authenticated;

-- ---------- Funzioni del gestionale che guardavano solo l'utente ----------
-- Il viaggio è della mia agenzia? (chat con i clienti, traduzioni, messaggi letti)
create or replace function public.is_trip_agency(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = public.my_company());
$$;

-- Notifiche dei messaggi: dal cliente all'agenzia arrivano al fondatore e a chi lavora ai viaggi
create or replace function public.get_trip_message_push_targets(p_trip_id uuid)
returns table (endpoint text, p256dh text, auth_key text, recipient_role text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trip_agency(p_trip_id) then
    return query
      select ps.endpoint, ps.p256dh, ps.auth, 'client'::text
      from public.trips t
      join public.clients c on c.id = t.client_id
      join public.profiles p on p.id = c.user_id
      join public.push_subscriptions ps on ps.profile_id = c.user_id
      where t.id = p_trip_id and c.user_id is not null and p.notify_trips;
  elsif public.is_trip_client(p_trip_id) then
    return query
      select ps.endpoint, ps.p256dh, ps.auth, 'agency'::text
      from public.trips t
      join public.profiles p on p.id = t.owner_id
           or p.id in (select m.user_id from public.team_members m
                       where m.company_id = t.owner_id and public.team_role_can(m.role, 'viaggi'))
      join public.push_subscriptions ps on ps.profile_id = p.id
      where t.id = p_trip_id and p.notify_trips;
  end if;
end;
$$;

-- Pulsante d'emergenza del cliente: avvisa il fondatore e tutta la squadra (chi ha le notifiche d'emergenza attive)
create or replace function public.get_emergency_push_targets(p_trip_id uuid)
returns table (endpoint text, p256dh text, auth_key text)
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
         or p.id in (select m.user_id from public.team_members m where m.company_id = t.owner_id)
    join public.push_subscriptions ps on ps.profile_id = p.id
    where t.id = p_trip_id and p.notify_emergencies;
end;
$$;

-- Offerte ai clienti: le manda chi ha il permesso sui clienti, ai clienti dell'azienda
create or replace function public.get_offer_push_targets(p_offer_id uuid)
returns table (endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.my_company();
begin
  if not public.team_can('clienti')
     or not exists (select 1 from public.agency_offers where id = p_offer_id and owner_id = v_company) then
    return;
  end if;
  return query
    select distinct ps.endpoint, ps.p256dh, ps.auth
    from public.clients c
    join public.profiles cp on cp.id = c.user_id
    join public.push_subscriptions ps on ps.profile_id = c.user_id
    where c.owner_id = v_company and c.user_id is not null and cp.notify_trips;
end;
$$;

-- Lista «Per iniziare»: viaggi, clienti e logo sono dell'azienda; il resto resta personale
create or replace function public.onboarding_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'seen', coalesce(p.onboarding_seen, false),
    'logo', coalesce(nullif(co.logo_url, ''), '') <> '',
    'trips', (select count(*) from (select 1 from public.trips t where t.owner_id = co.id limit 5) x),
    'published', (select count(*) from (select 1 from public.trips t where t.owner_id = co.id and t.is_published limit 5) x),
    'clients', (select count(*) from (select 1 from public.clients c where c.owner_id = co.id limit 5) x),
    'ai', exists (select 1 from public.ai_usage u where u.user_id = auth.uid()),
    'collabs', (select count(*) from (select 1 from public.network_collaborations c
                where co.id in (c.from_user, c.to_user) and c.status in ('in_attesa', 'accettata') limit 5) x),
    'orders', (select count(*) from (select 1 from public.network_orders o
                where co.id in (o.seller_id, o.buyer_id) limit 5) x),
    'showcase', coalesce((select (np.logo_path is not null and nullif(np.tagline, '') is not null)
                from public.network_profiles np where np.user_id = co.id), false),
    'listed', coalesce((select np.listed from public.network_profiles np where np.user_id = co.id), false),
    'agenda', exists (select 1 from public.network_calendar_events e where e.user_id = co.id)
              or coalesce((select pr.share_availability from public.network_prefs pr where pr.user_id = co.id), false),
    'packing', exists (select 1 from public.trip_packing_items i join public.trips t on t.id = i.trip_id where t.owner_id = co.id),
    'expenses', exists (select 1 from public.trip_expenses x join public.trips t on t.id = x.trip_id where t.owner_id = co.id),
    'push', exists (select 1 from public.push_subscriptions s where s.profile_id = auth.uid()),
    'client_details', exists (select 1 from public.clients c
                where c.user_id = auth.uid() and c.date_of_birth is not null
                  and (nullif(c.passport_number, '') is not null or nullif(c.id_card_number, '') is not null))
  )
  from public.profiles p
  join public.profiles co on co.id = public.my_company()
  where p.id = auth.uid();
$$;

-- Sconto Rotta: conta i viaggi dell'azienda; i promemoria ai clienti li mandano solo i titolari
create or replace function public.rotta_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (select * from public.rotta_trips(public.my_company())),
  n as (select count(*) filter (where counted)::int as verified,
               count(*) filter (where state = 'in_attesa')::int as pending,
               count(*) filter (where state in ('senza_account', 'non_partito', 'oltre_limite'))::int as excluded
        from r)
  select jsonb_build_object(
    'verified', n.verified,
    'pending', n.pending,
    'excluded', n.excluded,
    'discount', public.rotta_discount(n.verified),
    'next_at', case when n.verified < 5 then 5 when n.verified < 15 then 15 when n.verified < 40 then 40 end,
    'next_discount', case when n.verified < 5 then 10 when n.verified < 15 then 20 when n.verified < 40 then 30 end
  )
  from n
  where auth.uid() is not null;
$$;

create or replace function public.rotta_trip_list()
returns table (trip_id uuid, title text, destination text, end_day date, client_name text, state text, confirmed_by text, counted boolean, reminder_sent_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.rotta_trips(public.my_company()) where auth.uid() is not null;
$$;

create or replace function public.rotta_claim_reminder(p_trip uuid)
returns table (client_email text, client_name text, trip_title text, agency_name text, agency_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_company uuid := public.my_company();
begin
  if auth.uid() is null or public.my_team_role() <> 'titolare' then return; end if;
  select exists (select 1 from public.rotta_trips(v_company) r
                 where r.trip_id = p_trip and r.state = 'in_attesa' and r.reminder_sent_at is null)
    into v_ok;
  if not v_ok then return; end if;

  insert into public.trip_verifications (trip_id, reminder_sent_at) values (p_trip, now())
  on conflict (trip_id) do update set reminder_sent_at = now() where public.trip_verifications.reminder_sent_at is null;

  return query
    select cp.email, c.full_name, t.title, coalesce(o.agency_name, o.full_name, ''), o.email
    from public.trips t
    join public.clients c on c.id = t.client_id
    join public.profiles cp on cp.id = c.user_id
    join public.profiles o on o.id = t.owner_id
    where t.id = p_trip and t.owner_id = v_company;
end;
$$;

create or replace function public.rotta_release_reminder(p_trip uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.trip_verifications v set reminder_sent_at = null
  where v.trip_id = p_trip and v.status = 'in_attesa'
    and exists (select 1 from public.trips t where t.id = p_trip and t.owner_id = public.my_company());
$$;
