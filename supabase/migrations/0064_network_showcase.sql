-- 0064 — Rete: vetrina personalizzabile (copertina, logo, foto, listini) e richieste di collaborazione.
-- Quando una collaborazione viene accettata, i dati dell'altra parte finiscono nella rubrica Fornitori.
-- Serve aver eseguito prima 0061 (Rete), 0062 e 0063.

-- ============================================================
-- 1. Vetrina del profilo
-- ============================================================
alter table public.network_profiles
  add column if not exists cover_path text,
  add column if not exists logo_path text,
  add column if not exists tagline text,
  add column if not exists brand_color text,
  add column if not exists gallery text[] not null default '{}';

alter table public.network_profiles drop constraint if exists network_profiles_showcase_check;
alter table public.network_profiles add constraint network_profiles_showcase_check check (
  (tagline is null or char_length(tagline) <= 90)
  and (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$')
  and cardinality(gallery) <= 8
);

-- ============================================================
-- 2. Cartelle di archiviazione
--    network-media: foto di copertina, logo e galleria (pubbliche, sono la vetrina)
--    network-files: listini e documenti (privati: li legge solo chi ha accesso alla Rete, o solo i partner)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('network-media', 'network-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('network-files', 'network-files', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "network_media_write_own" on storage.objects;
create policy "network_media_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'network-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "network_media_update_own" on storage.objects;
create policy "network_media_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'network-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "network_media_delete_own" on storage.objects;
create policy "network_media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'network-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "network_files_write_own" on storage.objects;
create policy "network_files_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'network-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "network_files_delete_own" on storage.objects;
create policy "network_files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'network-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 3. Collaborazioni
-- ============================================================
create table if not exists public.network_collaborations (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  message text check (message is null or char_length(message) <= 600),
  status text not null default 'in_attesa' check (status in ('in_attesa', 'accettata', 'rifiutata', 'annullata', 'terminata')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);
create unique index if not exists network_collab_active_idx
  on public.network_collaborations ((least(from_user, to_user)), (greatest(from_user, to_user)))
  where status in ('in_attesa', 'accettata');
create index if not exists network_collab_to_idx on public.network_collaborations (to_user, status);
create index if not exists network_collab_from_idx on public.network_collaborations (from_user, status);
alter table public.network_collaborations enable row level security;
-- (nessuna policy: si passa solo dalle funzioni qui sotto)

-- Dati del partner salvati nella rubrica Fornitori (e legame con il profilo della Rete)
alter table public.suppliers add column if not exists network_user_id uuid references public.profiles (id) on delete set null;
create unique index if not exists suppliers_network_user_idx on public.suppliers (owner_id, network_user_id) where network_user_id is not null;

create or replace function public.network_are_partners(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.network_collaborations c
    where c.status = 'accettata' and ((c.from_user = a and c.to_user = b) or (c.from_user = b and c.to_user = a))
  );
$$;

-- Listini e documenti
create table if not exists public.network_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  path text not null check (char_length(path) <= 300),
  size_bytes integer,
  mime text,
  visibility text not null default 'rete' check (visibility in ('rete', 'partner')),
  created_at timestamptz not null default now()
);
create index if not exists network_files_user_idx on public.network_files (user_id, created_at desc);
alter table public.network_files enable row level security;
drop policy if exists "network_files_own" on public.network_files;
create policy "network_files_own" on public.network_files for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and path like auth.uid()::text || '/%');

create or replace function public.network_can_read_file(p_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.network_files f
    where f.path = p_name
      and (f.user_id = auth.uid()
           or (public.network_has_access(auth.uid()) and (f.visibility = 'rete' or public.network_are_partners(auth.uid(), f.user_id))))
  );
$$;

drop policy if exists "network_files_read" on storage.objects;
create policy "network_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'network-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.network_can_read_file(name)));

create or replace function public.network_files_of(p_user uuid)
returns table (id uuid, title text, path text, size_bytes integer, mime text, visibility text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select f.id, f.title, f.path, f.size_bytes, f.mime, f.visibility, f.created_at
  from public.network_files f
  where f.user_id = p_user
    and (p_user = auth.uid()
         or (public.network_has_access(auth.uid()) and (f.visibility = 'rete' or public.network_are_partners(auth.uid(), p_user))))
  order by f.created_at desc;
$$;

-- Salva i dati di un partner nella rubrica Fornitori di chi li riceve (solo chi usa il gestionale)
create or replace function public.network_save_partner(p_owner uuid, p_partner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  np public.network_profiles%rowtype;
  v_email text;
  v_cat text;
  v_note text;
begin
  if not public.is_trade_kind(public.network_kind_of(p_owner)) then return; end if;
  select * into np from public.network_profiles where user_id = p_partner;
  if not found then return; end if;
  select email into v_email from public.profiles where id = p_partner;
  v_cat := case np.kind when 'struttura' then 'alloggio' when 'autista' then 'trasporto' when 'guida' then 'attivita' when 'esperienze' then 'attivita' else 'altro' end;
  v_note := concat_ws(E'\n',
    'Partner della Rete Grand Route · ' || case np.kind
      when 'agenzia' then 'Agenzia di viaggi' when 'tour_operator' then 'Tour operator' when 'dmc' then 'Agenzia locale (DMC)'
      when 'guida' then 'Guida turistica' when 'autista' then 'Autista / transfer' when 'struttura' then 'Struttura ricettiva'
      when 'esperienze' then 'Esperienze e attività' else 'Fornitore' end,
    'Indirizzo: ' || np.address || ', ' || coalesce(np.postal_code || ' ', '') || np.city || ' (' || np.country || ')',
    'Partita IVA: ' || np.vat_number,
    case when np.pec is not null then 'PEC: ' || np.pec end,
    case when np.sdi_code is not null then 'Codice SDI: ' || np.sdi_code end,
    case when np.website is not null then 'Sito: ' || np.website end,
    case when cardinality(np.languages) > 0 then 'Lingue: ' || array_to_string(np.languages, ', ') end,
    'Scheda nella Rete: /rete/' || p_partner::text
  );
  insert into public.suppliers (owner_id, full_name, category, email, phone, notes, countries, network_user_id)
  values (p_owner, np.business_name, v_cat, v_email, np.phone, v_note, np.countries_served, p_partner)
  on conflict (owner_id, network_user_id) where network_user_id is not null
  do update set full_name = excluded.full_name, category = excluded.category, email = excluded.email, phone = excluded.phone,
                notes = excluded.notes, countries = excluded.countries;
end;
$$;

-- Accetta (internamente): chiude la richiesta e scambia i dati nelle rubriche
create or replace function public.network_collab_apply(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.network_collaborations%rowtype;
begin
  select * into c from public.network_collaborations where id = p_id and status = 'in_attesa';
  if not found then return; end if;
  update public.network_collaborations set status = 'accettata', responded_at = now() where id = p_id;
  perform public.network_save_partner(c.from_user, c.to_user);
  perform public.network_save_partner(c.to_user, c.from_user);
end;
$$;

create or replace function public.network_collab_request(p_to uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not public.network_has_access(v_uid) then raise exception 'Per collaborare serve un accesso attivo alla Rete.'; end if;
  if p_to = v_uid then raise exception 'Non puoi collaborare con te stesso.'; end if;
  if not exists (select 1 from public.network_profiles n where n.user_id = v_uid) then
    raise exception 'Completa prima il tuo profilo nella Rete: chi accetta riceve i tuoi dati.';
  end if;
  if not exists (select 1 from public.network_profiles n where n.user_id = p_to and n.status = 'verificato' and n.listed) then raise exception 'Profilo non trovato.'; end if;
  if exists (select 1 from public.network_collaborations c where c.status in ('in_attesa', 'accettata')
             and ((c.from_user = v_uid and c.to_user = p_to) or (c.from_user = p_to and c.to_user = v_uid))) then
    raise exception 'C''è già una richiesta o una collaborazione attiva con questo professionista.';
  end if;
  if (select count(*) from public.network_collaborations where from_user = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Hai già mandato molte richieste oggi: riprova domani.';
  end if;
  insert into public.network_collaborations (from_user, to_user, message)
  values (v_uid, p_to, nullif(left(trim(coalesce(p_message, '')), 600), ''))
  returning id into v_id;
  -- i profili di prova non possono rispondere: la collaborazione si accetta da sola
  if exists (select 1 from public.profiles where id = p_to and email like '%@demo.grandroute.invalid') then
    perform public.network_collab_apply(v_id);
  end if;
  return v_id;
end;
$$;

create or replace function public.network_collab_respond(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.network_collaborations where id = p_id and to_user = auth.uid() and status = 'in_attesa') then
    raise exception 'Richiesta non trovata.';
  end if;
  if p_accept then
    perform public.network_collab_apply(p_id);
  else
    update public.network_collaborations set status = 'rifiutata', responded_at = now() where id = p_id;
  end if;
end;
$$;

-- Annulla una richiesta (chi l'ha mandata) o termina una collaborazione (una qualsiasi delle due parti)
create or replace function public.network_collab_end(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.network_collaborations%rowtype;
begin
  select * into c from public.network_collaborations where id = p_id and (from_user = auth.uid() or to_user = auth.uid());
  if not found then raise exception 'Richiesta non trovata.'; end if;
  if c.status = 'in_attesa' and c.from_user = auth.uid() then
    update public.network_collaborations set status = 'annullata', responded_at = now() where id = p_id;
  elsif c.status = 'accettata' then
    update public.network_collaborations set status = 'terminata', responded_at = now() where id = p_id;
  end if;
end;
$$;

create or replace function public.network_collab_status(p_user uuid)
returns table (id uuid, status text, direction text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.status, case when c.from_user = auth.uid() then 'inviata' else 'ricevuta' end
  from public.network_collaborations c
  where c.status in ('in_attesa', 'accettata')
    and ((c.from_user = auth.uid() and c.to_user = p_user) or (c.to_user = auth.uid() and c.from_user = p_user))
  limit 1;
$$;

create or replace function public.network_collab_list()
returns table (
  id uuid, direction text, status text, other_user uuid, other_name text, other_kind text, message text,
  created_at timestamptz, responded_at timestamptz, other_email text, other_phone text
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id,
         case when c.from_user = auth.uid() then 'inviata' else 'ricevuta' end,
         c.status,
         o.id,
         coalesce(np.business_name, o.agency_name, o.full_name, 'Professionista'),
         public.network_kind_of(o.id),
         c.message, c.created_at, c.responded_at,
         case when c.status = 'accettata' then o.email end,
         case when c.status = 'accettata' then np.phone end
  from public.network_collaborations c
  join public.profiles o on o.id = case when c.from_user = auth.uid() then c.to_user else c.from_user end
  left join public.network_profiles np on np.user_id = o.id
  where c.from_user = auth.uid() or c.to_user = auth.uid()
  order by (c.status = 'in_attesa') desc, c.created_at desc
  limit 200;
$$;

create or replace function public.network_collab_pending_count()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.network_collaborations where to_user = auth.uid() and status = 'in_attesa';
$$;

-- ============================================================
-- 4. Elenco e scheda con la vetrina (cambia l'elenco delle colonne restituite)
-- ============================================================
drop function if exists public.network_search(text, text, text, int, int);
drop function if exists public.network_get(uuid);

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
  rating_pos int, rating_neg int, rating_total int,
  cover_path text, logo_path text, tagline text, brand_color text
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
         r.total::int,
         n.cover_path, n.logo_path, n.tagline, n.brand_color
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
  rating_pos int, rating_neg int, rating_total int,
  cover_path text, logo_path text, tagline text, brand_color text, gallery text[]
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
         r.total::int,
         n.cover_path, n.logo_path, n.tagline, n.brand_color, n.gallery
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
-- 5. Profili di prova: con foto, slogan e una richiesta di collaborazione da accettare
-- ============================================================
create or replace function public.demo_apply_media()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/1280px-Colosseo_2020.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Villa_Deste_park_Rometta_2011_2.jpg/1280px-Villa_Deste_park_Rometta_2011_2.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg/1280px-Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/Civita_%28Bagnoregio%29_-_Panorama.jpg/1280px-Civita_%28Bagnoregio%29_-_Panorama.jpg']::text[], tagline = 'Roma senza la fila, con chi la conosce davvero', brand_color = '#233c5e'
   where user_id = (select id from public.profiles where email = 'demo-guida-roma@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Merzouga_Dunes_2011.jpg/1280px-Merzouga_Dunes_2011.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Chefchaouen_the_blue_pearl_kd.jpg/1280px-Chefchaouen_the_blue_pearl_kd.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Kasbah_Ait_Benhaddou%2C_Morocco_%281%29_%2830765760583%29_%28cropped_to_focus_on_old_town%29.jpg/1280px-Kasbah_Ait_Benhaddou%2C_Morocco_%281%29_%2830765760583%29_%28cropped_to_focus_on_old_town%29.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Maroc_Marrakech_Jemaa-el-Fna_Luc_Viatour.JPG/1280px-Maroc_Marrakech_Jemaa-el-Fna_Luc_Viatour.JPG']::text[], tagline = 'Souk, Sahara e Atlante con una guida del posto', brand_color = '#b0563a'
   where user_id = (select id from public.profiles where email = 'demo-guida-marrakech@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Fuji_Kawaguchi_357.JPG/1280px-Fuji_Kawaguchi_357.JPG', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/KyotoFushimiInariLarge.jpg/1280px-KyotoFushimiInariLarge.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Water_reflection_of_Kinkaku-ji_Temple_a_sunny_day%2C_Kyoto%2C_Japan.jpg/1280px-Water_reflection_of_Kinkaku-ji_Temple_a_sunny_day%2C_Kyoto%2C_Japan.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e6/Ogi_Shirakawa-g%C5%8D%2C_Gifu%2C_Japan.jpg/1280px-Ogi_Shirakawa-g%C5%8D%2C_Gifu%2C_Japan.jpg']::text[], tagline = 'Kyoto a piedi, in italiano', brand_color = '#6b3f69'
   where user_id = (select id from public.profiles where email = 'demo-guida-kyoto@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Agrigent_BW_2012-10-07_13-10-58.jpg/1280px-Agrigent_BW_2012-10-07_13-10-58.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Ortigia_dall%27alto.jpg/1280px-Ortigia_dall%27alto.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/Taormina_BW_2012-10-05_16-23-05_stitch.jpg/1280px-Taormina_BW_2012-10-05_16-23-05_stitch.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Monreale_Cathedral_exterior_BW_2012-10-09_10-23-10.jpg/1280px-Monreale_Cathedral_exterior_BW_2012-10-09_10-23-10.jpg']::text[], tagline = 'Transfer e tour in Sicilia, puntuali e sicuri', brand_color = '#233c5e'
   where user_id = (select id from public.profiles where email = 'demo-autista-sicilia@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/All_Gizah_Pyramids-3.jpg/1280px-All_Gizah_Pyramids-3.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Great_Sphinx_of_Giza_and_Pyramid_of_Cheops.jpg/1280px-Great_Sphinx_of_Giza_and_Pyramid_of_Cheops.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Gro%C3%9Fer_Tempel_%28Abu_Simbel%29_06.jpg/1280px-Gro%C3%9Fer_Tempel_%28Abu_Simbel%29_06.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/1550_bis_1070_v._Chr._ca._wurde_der_Tempel_von_Luxor_erbaut._01.jpg/1280px-1550_bis_1070_v._Chr._ca._wurde_der_Tempel_von_Luxor_erbaut._01.jpg']::text[], tagline = 'Autisti italiani-friendly in tutto l''Egitto', brand_color = '#c58f2d'
   where user_id = (select id from public.profiles where email = 'demo-autista-cairo@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Alberobello_con_il_drone.jpg/1280px-Alberobello_con_il_drone.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Otranto_-_Seafront_-_01.jpg/1280px-Otranto_-_Seafront_-_01.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Polignano-a-Mare.jpg/1280px-Polignano-a-Mare.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Ostuni_col_drone.jpg/1280px-Ostuni_col_drone.jpg']::text[], tagline = 'Una masseria tra gli ulivi, a due passi dal mare', brand_color = '#2f6b4f'
   where user_id = (select id from public.profiles where email = 'demo-struttura-puglia@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8d/TanahLot_2014.JPG/1280px-TanahLot_2014.JPG', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Borobudur-Temple-Park_Indonesia_Stupas-of-Borobudur-12.jpg/1280px-Borobudur-Temple-Park_Indonesia_Stupas-of-Borobudur-12.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Broken_Bay%2C_Nusa_Penida.jpg/1280px-Broken_Bay%2C_Nusa_Penida.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/6/66/Yogyakarta_Indonesia_Prambanan-temple-complex-02.jpg/1280px-Yogyakarta_Indonesia_Prambanan-temple-complex-02.jpg']::text[], tagline = 'Suite tra le risaie di Ubud', brand_color = '#1f6f78'
   where user_id = (select id from public.profiles where email = 'demo-struttura-bali@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/Panorama_San_Gimignano.jpg/1280px-Panorama_San_Gimignano.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/PiazzadelCampoSiena.jpg/1280px-PiazzadelCampoSiena.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/The_Cathedral_panoramic_view_from_Vecchio_Palace_Florence_Italy.jpg/1280px-The_Cathedral_panoramic_view_from_Vecchio_Palace_Florence_Italy.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Endless_hills_of_Pienza1.jpg/1280px-Endless_hills_of_Pienza1.jpg']::text[], tagline = 'Pasta fresca, vino e olio nel cuore della Toscana', brand_color = '#b0563a'
   where user_id = (select id from public.profiles where email = 'demo-esperienze-toscana@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6c/Kilimanjaro_from_Amboseli.jpg/1280px-Kilimanjaro_from_Amboseli.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Elefantes_africanos_de_sabana_%28Loxodonta_africana%29%2C_reserva_natural_Mas%C3%A1i_Mara%2C_Kenia%2C_2024-05-20%2C_DD_45.jpg/1280px-Elefantes_africanos_de_sabana_%28Loxodonta_africana%29%2C_reserva_natural_Mas%C3%A1i_Mara%2C_Kenia%2C_2024-05-20%2C_DD_45.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Three_giraffes_01.jpg/1280px-Three_giraffes_01.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/Diani_Beach_Ukunda.jpg/1280px-Diani_Beach_Ukunda.jpg']::text[], tagline = 'Safari privati nel Masai Mara', brand_color = '#c58f2d'
   where user_id = (select id from public.profiles where email = 'demo-esperienze-kenya@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Machu_Picchu%2C_2023_%28012%29.jpg/1280px-Machu_Picchu%2C_2023_%28012%29.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Monta%C3%B1aarcoirisperuabanto.jpg/1280px-Monta%C3%B1aarcoirisperuabanto.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Nevado_Mismi.jpg/1280px-Nevado_Mismi.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/Sacsayhuam%C3%A1n%2C_Cusco%2C_Per%C3%BA%2C_2015-07-31%2C_DD_38.JPG/1280px-Sacsayhuam%C3%A1n%2C_Cusco%2C_Per%C3%BA%2C_2015-07-31%2C_DD_38.JPG']::text[], tagline = 'Il Perù a terra, con chi ci vive', brand_color = '#6b3f69'
   where user_id = (select id from public.profiles where email = 'demo-dmc-peru@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/A_local_fishing_craft_and_it%27s_trailer_amongst_the_karsts-_the_trailer_looks_almost_microscopic%21_%2831263639110%29.jpg/1280px-A_local_fishing_craft_and_it%27s_trailer_amongst_the_karsts-_the_trailer_looks_almost_microscopic%21_%2831263639110%29.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/R%C3%ADo_Saig%C3%B3n%2C_Ciudad_Ho_Chi_Minh%2C_Vietnam%2C_2013-08-14%2C_DD_29.JPG/1280px-R%C3%ADo_Saig%C3%B3n%2C_Ciudad_Ho_Chi_Minh%2C_Vietnam%2C_2013-08-14%2C_DD_29.JPG','https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Bai-sao-phu-quoc-tuonglamphotos.jpg/1280px-Bai-sao-phu-quoc-tuonglamphotos.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0d/Ta_Van_Muong_Ha_vallei_%2888660%29.jpg/1280px-Ta_Van_Muong_Ha_vallei_%2888660%29.jpg']::text[], tagline = 'Vietnam, Cambogia e Laos su misura', brand_color = '#1f6f78'
   where user_id = (select id from public.profiles where email = 'demo-dmc-vietnam@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/KyotoFushimiInariLarge.jpg/1280px-KyotoFushimiInariLarge.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Water_reflection_of_Kinkaku-ji_Temple_a_sunny_day%2C_Kyoto%2C_Japan.jpg/1280px-Water_reflection_of_Kinkaku-ji_Temple_a_sunny_day%2C_Kyoto%2C_Japan.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e6/Ogi_Shirakawa-g%C5%8D%2C_Gifu%2C_Japan.jpg/1280px-Ogi_Shirakawa-g%C5%8D%2C_Gifu%2C_Japan.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cd/Fuji_Kawaguchi_357.JPG/1280px-Fuji_Kawaguchi_357.JPG']::text[], tagline = 'Partenze garantite per Asia, Africa e Americhe', brand_color = '#233c5e'
   where user_id = (select id from public.profiles where email = 'demo-to-orizzonti@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Bathala_%28Maldives%29_6.jpg/1280px-Bathala_%28Maldives%29_6.jpg', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Thatched-roof_villa_in_the_Maldive_Islands.jpg/1280px-Thatched-roof_villa_in_the_Maldive_Islands.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Maldives_island.JPG/1280px-Maldives_island.JPG','https://thumb.wikimedia.org/wikipedia/commons/thumb/4/44/Coral_Reef_in_the_Red_Sea.JPG/1280px-Coral_Reef_in_the_Red_Sea.JPG']::text[], tagline = 'Il lusso, dal primo preventivo all''ultimo giorno', brand_color = '#6b3f69'
   where user_id = (select id from public.profiles where email = 'demo-to-meridiana@demo.grandroute.invalid');
  update public.network_profiles set cover_path = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/La_Morra_seen_from_south.JPG/1280px-La_Morra_seen_from_south.JPG', gallery = array['https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/GolfoBorromeoFeb202026.jpg/1280px-GolfoBorromeoFeb202026.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Sacra_di_San_Michele_luminosa_all%27alba.jpg/1280px-Sacra_di_San_Michele_luminosa_all%27alba.jpg','https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/La_basilica_al_tramonto.jpg/1280px-La_basilica_al_tramonto.jpg']::text[], tagline = 'Viaggi di nozze, gruppi e cultura dal 1998', brand_color = '#2f6b4f'
   where user_id = (select id from public.profiles where email = 'demo-agenzia-bussola@demo.grandroute.invalid');end;
$$;

do $$
begin
  if to_regprocedure('public.admin_demo_create_base()') is null then
    alter function public.admin_demo_create() rename to admin_demo_create_base;
  end if;
end $$;

create or replace function public.admin_demo_create()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n int;
  v_admin uuid := auth.uid();
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  n := public.admin_demo_create_base();
  perform public.demo_apply_media();
  if v_admin is not null then
    insert into public.network_collaborations (from_user, to_user, message)
    select p.id, v_admin, 'Buongiorno, lavoriamo con molte agenzie italiane e ci piacerebbe collaborare con voi: vi mandiamo volentieri cataloghi e condizioni riservate.'
    from public.profiles p where p.email = 'demo-to-orizzonti@demo.grandroute.invalid'
    on conflict do nothing;
  end if;
  return n;
end;
$$;

-- ============================================================
-- 6. Permessi
-- ============================================================
revoke all on function public.network_are_partners(uuid, uuid) from public, anon, authenticated;
revoke all on function public.network_save_partner(uuid, uuid) from public, anon, authenticated;
revoke all on function public.network_collab_apply(uuid) from public, anon, authenticated;
revoke all on function public.network_can_read_file(text) from public, anon;
revoke all on function public.demo_apply_media() from public, anon, authenticated;
revoke all on function public.admin_demo_create_base() from public, anon, authenticated;
revoke all on function public.network_files_of(uuid) from public, anon;
revoke all on function public.network_collab_request(uuid, text) from public, anon;
revoke all on function public.network_collab_respond(uuid, boolean) from public, anon;
revoke all on function public.network_collab_end(uuid) from public, anon;
revoke all on function public.network_collab_status(uuid) from public, anon;
revoke all on function public.network_collab_list() from public, anon;
revoke all on function public.network_collab_pending_count() from public, anon;
revoke all on function public.network_search(text, text, text, int, int) from public, anon;
revoke all on function public.network_get(uuid) from public, anon;
revoke all on function public.admin_demo_create() from public, anon;
grant execute on function public.network_can_read_file(text) to authenticated;
grant execute on function public.network_files_of(uuid) to authenticated;
grant execute on function public.network_collab_request(uuid, text) to authenticated;
grant execute on function public.network_collab_respond(uuid, boolean) to authenticated;
grant execute on function public.network_collab_end(uuid) to authenticated;
grant execute on function public.network_collab_status(uuid) to authenticated;
grant execute on function public.network_collab_list() to authenticated;
grant execute on function public.network_collab_pending_count() to authenticated;
grant execute on function public.network_search(text, text, text, int, int) to authenticated;
grant execute on function public.network_get(uuid) to authenticated;
grant execute on function public.admin_demo_create() to authenticated;

-- 7. Foto ai profili di prova già creati (se non ce ne sono, non fa nulla)
select public.demo_apply_media();
