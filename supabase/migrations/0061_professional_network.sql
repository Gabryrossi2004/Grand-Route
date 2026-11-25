-- 0061 — Rete professionale del turismo: tipo di attività, profili verificati, elenco, richieste di contatto
-- e valutazioni anonime (positivo / negativo).
--
-- Il sito funziona anche prima di questo passaggio: la Rete e la registrazione dei fornitori
-- (guide, autisti, strutture...) si attivano solo dopo averlo eseguito.
-- Serve aver eseguito prima 0033 (amministratori) e 0058 (viaggiatori).

-- ============================================================
-- 1. Tipo di attività (al posto di «viaggiatore privato / agenzia»)
-- ============================================================
alter table public.profiles add column if not exists business_kind text;
alter table public.profiles drop constraint if exists profiles_business_kind_check;
alter table public.profiles
  add constraint profiles_business_kind_check
  check (business_kind is null or business_kind in ('agenzia', 'tour_operator', 'dmc', 'guida', 'autista', 'struttura', 'esperienze', 'altro'));

-- Chi vende ai clienti finali o alle agenzie (gestionale e Community): agenzie, tour operator e agenzie locali.
-- Chi non ha ancora scelto (account più vecchi) è un'agenzia.
create or replace function public.is_trade_kind(p_kind text)
returns boolean
language sql
immutable
as $$
  select p_kind is null or p_kind in ('agenzia', 'tour_operator', 'dmc');
$$;

-- Alla registrazione il tipo di attività arriva dai dati di accesso («business_kind»)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_traveler boolean := coalesce(new.raw_user_meta_data ->> 'account_kind', '') = 'traveler';
  v_kind text := nullif(new.raw_user_meta_data ->> 'business_kind', '');
begin
  if v_kind is null or v_kind not in ('agenzia', 'tour_operator', 'dmc', 'guida', 'autista', 'struttura', 'esperienze', 'altro') then
    v_kind := null;
  end if;
  insert into public.profiles (id, email, full_name, is_traveler, is_professional, business_kind)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    v_traveler,
    not v_traveler,
    case when v_traveler then null else v_kind end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- La Community tra agenzie resta riservata a chi vende (non ai fornitori)
create or replace function public.is_current_user_professional()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_professional and public.is_trade_kind(business_kind)
  );
$$;

-- ============================================================
-- 2. Impostazioni della Rete (l'abbonamento si accende quando sarà pronta la fatturazione)
-- ============================================================
create table if not exists public.network_settings (
  id boolean primary key default true check (id),
  billing_enabled boolean not null default false
);
insert into public.network_settings (id) values (true) on conflict do nothing;
alter table public.network_settings enable row level security;
drop policy if exists "network_settings_select" on public.network_settings;
create policy "network_settings_select" on public.network_settings for select to authenticated using (true);

-- ============================================================
-- 3. Profilo professionale (uno per account)
-- ============================================================
create table if not exists public.network_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('agenzia', 'tour_operator', 'dmc', 'guida', 'autista', 'struttura', 'esperienze', 'altro')),
  business_name text not null,
  legal_form text,
  country text not null,                 -- sede legale (codice a 2 lettere)
  vat_number text not null,
  tax_code text,
  sdi_code text,
  pec text,
  address text not null,
  postal_code text,
  city text not null,
  province text,
  phone text not null,
  website text,
  description text not null,
  countries_served text[] not null default '{}',
  languages text[] not null default '{}',
  specialties text[] not null default '{}',
  kind_data jsonb not null default '{}'::jsonb,   -- dati propri di ogni attività (licenze, assicurazioni, mezzi...)
  status text not null default 'in_verifica' check (status in ('bozza', 'in_verifica', 'verificato', 'rifiutato', 'sospeso')),
  status_note text,
  verified_at timestamptz,
  listed boolean not null default true,  -- compare nell'elenco (dopo la verifica)
  subscription_until date,               -- abbonamento valido fino a (quando la fatturazione sarà attiva)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists network_profiles_listing_idx on public.network_profiles (status, listed, kind);
create index if not exists network_profiles_countries_idx on public.network_profiles using gin (countries_served);

alter table public.network_profiles enable row level security;

drop policy if exists "np_select_own_or_admin" on public.network_profiles;
create policy "np_select_own_or_admin" on public.network_profiles
  for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "np_insert_own" on public.network_profiles;
create policy "np_insert_own" on public.network_profiles
  for insert to authenticated
  with check (user_id = auth.uid() and status in ('bozza', 'in_verifica') and verified_at is null and subscription_until is null);

drop policy if exists "np_update_own_or_admin" on public.network_profiles;
create policy "np_update_own_or_admin" on public.network_profiles
  for update to authenticated
  using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

-- Chi non è amministratore non può cambiare stato, verifica e abbonamento. Se cambia i dati che identificano
-- l'attività, un profilo verificato torna «in verifica»; uno rifiutato si ripresenta da solo.
create or replace function public.network_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if public.is_platform_admin() then
    if new.status = 'verificato' and old.status is distinct from 'verificato' then
      new.verified_at := now();
    end if;
    return new;
  end if;
  new.verified_at := old.verified_at;
  new.subscription_until := old.subscription_until;
  new.status_note := old.status_note;
  new.status := old.status;
  if old.status = 'verificato'
     and (new.business_name, new.vat_number, new.country, new.kind, new.kind_data)
         is distinct from (old.business_name, old.vat_number, old.country, old.kind, old.kind_data) then
    new.status := 'in_verifica';
  elsif old.status in ('bozza', 'rifiutato') then
    new.status := 'in_verifica';
  end if;
  return new;
end;
$$;
drop trigger if exists network_profiles_guard_trg on public.network_profiles;
create trigger network_profiles_guard_trg before update on public.network_profiles
  for each row execute function public.network_profiles_guard();

-- ============================================================
-- 4. Chi può usare la Rete
-- ============================================================
-- Per ora tutti i professionisti. Quando in «network_settings» si accende l'abbonamento,
-- serve un abbonamento valido (network_profiles.subscription_until).
create or replace function public.network_has_access(p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_uid is not null
    and exists (select 1 from public.profiles p where p.id = p_uid and p.is_professional and not p.is_traveler)
    and (
      not coalesce((select billing_enabled from public.network_settings limit 1), false)
      or exists (select 1 from public.network_profiles n where n.user_id = p_uid and n.subscription_until >= current_date)
    );
$$;

-- Tipo di attività di un account (gli account più vecchi sono agenzie)
create or replace function public.network_kind_of(p_uid uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select n.kind from public.network_profiles n where n.user_id = p_uid),
    (select p.business_kind from public.profiles p where p.id = p_uid),
    'agenzia'
  );
$$;

-- ============================================================
-- 5. Valutazioni anonime: solo «positivo» o «negativo», senza nomi.
--    Non si valuta chi fa lo stesso mestiere (niente agenzie su agenzie, guide su guide...).
--    Nessuno può leggere le righe: si vedono solo i totali, e solo da 3 voti in su.
-- ============================================================
create table if not exists public.network_reviews (
  reviewed_user uuid not null references public.profiles (id) on delete cascade,
  reviewer_user uuid not null references public.profiles (id) on delete cascade,
  positive boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (reviewed_user, reviewer_user),
  check (reviewed_user <> reviewer_user)
);
alter table public.network_reviews enable row level security;
-- (nessuna policy: le righe non si leggono né si scrivono direttamente)

create or replace function public.network_review(p_reviewed uuid, p_positive boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.network_has_access(v_uid) then
    raise exception 'Per valutare serve un accesso attivo alla Rete.';
  end if;
  if p_reviewed = v_uid then
    raise exception 'Non puoi valutare te stesso.';
  end if;
  if not exists (select 1 from public.network_profiles n where n.user_id = p_reviewed and n.status = 'verificato') then
    raise exception 'Profilo non trovato.';
  end if;
  if public.network_kind_of(v_uid) = public.network_kind_of(p_reviewed) then
    raise exception 'Non puoi valutare chi svolge la tua stessa attività.';
  end if;
  insert into public.network_reviews (reviewed_user, reviewer_user, positive)
  values (p_reviewed, v_uid, p_positive)
  on conflict (reviewed_user, reviewer_user) do update set positive = excluded.positive, updated_at = now();
end;
$$;

create or replace function public.network_my_review(p_reviewed uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select r.positive from public.network_reviews r where r.reviewed_user = p_reviewed and r.reviewer_user = auth.uid();
$$;

create or replace function public.network_remove_review(p_reviewed uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.network_reviews where reviewed_user = p_reviewed and reviewer_user = auth.uid();
$$;

-- ============================================================
-- 6. Elenco: ricerca e scheda (solo dati pubblici, mai email e telefono)
-- ============================================================
create or replace function public.network_search(
  p_query text default null,
  p_country text default null,
  p_kind text default null,
  p_limit int default 30,
  p_offset int default 0
)
returns table (
  user_id uuid, kind text, business_name text, city text, country text,
  countries_served text[], languages text[], specialties text[], description text, website text,
  rating_pos int, rating_neg int, rating_total int
)
language sql
security definer
set search_path = public
stable
as $$
  select n.user_id, n.kind, n.business_name, n.city, n.country,
         n.countries_served, n.languages, n.specialties, n.description, n.website,
         case when r.total >= 3 then r.pos::int end,
         case when r.total >= 3 then r.neg::int end,
         r.total::int
  from public.network_profiles n
  left join lateral (
    select count(*) filter (where v.positive) as pos, count(*) filter (where not v.positive) as neg, count(*) as total
    from public.network_reviews v where v.reviewed_user = n.user_id
  ) r on true
  where public.network_has_access(auth.uid())
    and n.status = 'verificato' and n.listed
    and (not coalesce((select s.billing_enabled from public.network_settings s limit 1), false) or n.subscription_until >= current_date)
    and n.user_id <> auth.uid()
    and (p_kind is null or p_kind = '' or n.kind = p_kind)
    and (p_country is null or p_country = '' or p_country = any (n.countries_served) or n.country = p_country)
    and (
      p_query is null or p_query = ''
      or n.business_name ilike '%' || p_query || '%'
      or n.city ilike '%' || p_query || '%'
      or n.description ilike '%' || p_query || '%'
      or exists (select 1 from unnest(n.specialties) s where s ilike '%' || p_query || '%')
    )
  order by (case when r.total >= 3 then r.pos - r.neg else 0 end) desc, n.business_name
  limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
$$;

create or replace function public.network_get(p_user uuid)
returns table (
  user_id uuid, kind text, business_name text, city text, country text,
  countries_served text[], languages text[], specialties text[], description text, website text,
  rating_pos int, rating_neg int, rating_total int
)
language sql
security definer
set search_path = public
stable
as $$
  select n.user_id, n.kind, n.business_name, n.city, n.country,
         n.countries_served, n.languages, n.specialties, n.description, n.website,
         case when r.total >= 3 then r.pos::int end,
         case when r.total >= 3 then r.neg::int end,
         r.total::int
  from public.network_profiles n
  left join lateral (
    select count(*) filter (where v.positive) as pos, count(*) filter (where not v.positive) as neg, count(*) as total
    from public.network_reviews v where v.reviewed_user = n.user_id
  ) r on true
  where n.user_id = p_user
    and public.network_has_access(auth.uid())
    and n.status = 'verificato' and n.listed
    and (not coalesce((select s.billing_enabled from public.network_settings s limit 1), false) or n.subscription_until >= current_date);
$$;

-- ============================================================
-- 7. Richieste di contatto: chi scrive si presenta, chi riceve vede i recapiti di chi ha scritto
-- ============================================================
create table if not exists public.network_contacts (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 10 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (from_user <> to_user)
);
create index if not exists network_contacts_to_idx on public.network_contacts (to_user, created_at desc);
create index if not exists network_contacts_from_idx on public.network_contacts (from_user, created_at desc);
alter table public.network_contacts enable row level security;
-- (nessuna policy: si passa solo dalle funzioni qui sotto)

create or replace function public.network_send_contact(p_to uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not public.network_has_access(v_uid) then
    raise exception 'Per scrivere serve un accesso attivo alla Rete.';
  end if;
  if p_to = v_uid then raise exception 'Non puoi scrivere a te stesso.'; end if;
  if not exists (select 1 from public.network_profiles n where n.user_id = p_to and n.status = 'verificato' and n.listed) then
    raise exception 'Profilo non trovato.';
  end if;
  if char_length(trim(coalesce(p_message, ''))) < 10 then raise exception 'Scrivi almeno una frase.'; end if;
  if (select count(*) from public.network_contacts where from_user = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Hai già mandato molte richieste oggi: riprova domani.';
  end if;
  if (select count(*) from public.network_contacts where from_user = v_uid and to_user = p_to and created_at > now() - interval '1 day') >= 2 then
    raise exception 'Hai già scritto a questo professionista: attendi la risposta.';
  end if;
  insert into public.network_contacts (from_user, to_user, message)
  values (v_uid, p_to, left(trim(p_message), 1000))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.network_inbox()
returns table (
  id uuid, direction text, other_user uuid, other_name text, other_kind text,
  other_email text, other_phone text, message text, created_at timestamptz, read_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, 'ricevuta'::text, c.from_user,
         coalesce(np.business_name, p.agency_name, p.full_name, 'Professionista'),
         public.network_kind_of(c.from_user),
         p.email, np.phone, c.message, c.created_at, c.read_at
  from public.network_contacts c
  join public.profiles p on p.id = c.from_user
  left join public.network_profiles np on np.user_id = c.from_user
  where c.to_user = auth.uid()
  union all
  select c.id, 'inviata'::text, c.to_user,
         coalesce(np.business_name, p.agency_name, p.full_name, 'Professionista'),
         public.network_kind_of(c.to_user),
         null::text, null::text, c.message, c.created_at, null::timestamptz
  from public.network_contacts c
  join public.profiles p on p.id = c.to_user
  left join public.network_profiles np on np.user_id = c.to_user
  where c.from_user = auth.uid()
  order by 9 desc
  limit 200;
$$;

create or replace function public.network_unread_count()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.network_contacts where to_user = auth.uid() and read_at is null;
$$;

create or replace function public.network_mark_all_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.network_contacts set read_at = now() where to_user = auth.uid() and read_at is null;
$$;

-- ============================================================
-- 8. Verifica (solo amministratori): elenco con tutti i dati e l'email
-- ============================================================
create or replace function public.network_admin_list(p_status text default null)
returns table (
  user_id uuid, email text, full_name text, kind text, business_name text, legal_form text, country text,
  vat_number text, tax_code text, sdi_code text, pec text, address text, postal_code text, city text, province text,
  phone text, website text, description text, countries_served text[], languages text[], specialties text[],
  kind_data jsonb, status text, status_note text, listed boolean, created_at timestamptz, updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select n.user_id, p.email, p.full_name, n.kind, n.business_name, n.legal_form, n.country,
         n.vat_number, n.tax_code, n.sdi_code, n.pec, n.address, n.postal_code, n.city, n.province,
         n.phone, n.website, n.description, n.countries_served, n.languages, n.specialties,
         n.kind_data, n.status, n.status_note, n.listed, n.created_at, n.updated_at
  from public.network_profiles n
  join public.profiles p on p.id = n.user_id
  where public.is_platform_admin() and (p_status is null or p_status = '' or n.status = p_status)
  order by n.updated_at desc
  limit 200;
$$;

-- ============================================================
-- 9. Permessi delle funzioni
-- ============================================================
revoke all on function public.network_has_access(uuid) from public, anon;
revoke all on function public.network_kind_of(uuid) from public, anon;
revoke all on function public.network_review(uuid, boolean) from public, anon;
revoke all on function public.network_my_review(uuid) from public, anon;
revoke all on function public.network_remove_review(uuid) from public, anon;
revoke all on function public.network_search(text, text, text, int, int) from public, anon;
revoke all on function public.network_get(uuid) from public, anon;
revoke all on function public.network_send_contact(uuid, text) from public, anon;
revoke all on function public.network_inbox() from public, anon;
revoke all on function public.network_unread_count() from public, anon;
revoke all on function public.network_mark_all_read() from public, anon;
revoke all on function public.network_admin_list(text) from public, anon;
grant execute on function public.network_has_access(uuid) to authenticated;
grant execute on function public.network_kind_of(uuid) to authenticated;
grant execute on function public.network_review(uuid, boolean) to authenticated;
grant execute on function public.network_my_review(uuid) to authenticated;
grant execute on function public.network_remove_review(uuid) to authenticated;
grant execute on function public.network_search(text, text, text, int, int) to authenticated;
grant execute on function public.network_get(uuid) to authenticated;
grant execute on function public.network_send_contact(uuid, text) to authenticated;
grant execute on function public.network_inbox() to authenticated;
grant execute on function public.network_unread_count() to authenticated;
grant execute on function public.network_mark_all_read() to authenticated;
grant execute on function public.network_admin_list(text) to authenticated;
