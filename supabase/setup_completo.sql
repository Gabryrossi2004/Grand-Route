-- ============================================================
-- GRAND ROUTE - creazione completa del database (migrazioni 0001-0040)
-- Da incollare UNA VOLTA nell'SQL Editor di un progetto Supabase NUOVO e vuoto.
-- Tutto in una transazione: se qualcosa fallisce non viene applicato nulla,
-- quindi si può correggere e rilanciare senza lasciare il database a metà.
--
-- File generato: è l'unione dei file in supabase/migrations/ in ordine numerico.
-- Se aggiungi una nuova migrazione, rigeneralo, oppure eseguila a parte.
-- Il segreto del cron resta un segnaposto ('da-sostituire'): va impostato a
-- mano dopo, perché il valore vero non deve mai stare nel codice.
-- ============================================================
begin;

-- >>>>>>>>>> 0001_initial_schema.sql <<<<<<<<<<
-- ============================================================
-- Migrazione 0001: schema iniziale (profili, clienti, viaggi,
-- giorni, attività, documenti) + archiviazione file.
--
-- NOTA STORICA IMPORTANTE
-- Questo file è una RICOSTRUZIONE. Lo schema iniziale del progetto
-- era stato eseguito a mano nell'SQL Editor di Supabase all'inizio
-- dello sviluppo e non era mai stato salvato come file di migrazione:
-- le migrazioni versionate partivano da 0002. Ricostruirlo è servito
-- per poter ricreare il database da zero su un nuovo progetto.
--
-- È stato ricostruito a partire da:
--   - i tipi TypeScript in src/lib/types.ts (le colonne di oggi);
--   - tutte le "alter table ... add column" delle migrazioni 0002-0028
--     (cioè le colonne aggiunte DOPO, che qui non devono esserci);
--   - le query effettive del codice (chi legge/scrive cosa, e con
--     quale ruolo: agenzia, cliente, o visitatore non autenticato).
--
-- ORDINE DI ESECUZIONE: questo file va eseguito per PRIMO su un
-- progetto Supabase nuovo, poi 0002, 0003, ... fino all'ultimo.
-- Le migrazioni successive aggiungono le colonne mancanti, quindi il
-- risultato finale coincide con lo schema attuale.
-- ============================================================


-- ============================================================
-- 1. PROFILI (un profilo per ogni account registrato)
-- ============================================================
-- L'id è lo stesso dell'utente in auth.users: il profilo è l'estensione
-- "applicativa" dell'account di accesso gestito da Supabase.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  account_type text not null default 'individual'
    check (account_type in ('individual', 'agency')),
  agency_name text,
  logo_url text,
  brand_color text,
  created_at timestamptz not null default now()
);

-- La registrazione (src/app/signup/actions.ts) chiama solo
-- supabase.auth.signUp(): il profilo NON viene creato dal codice
-- dell'app, lo crea questo trigger. Senza, ogni nuovo iscritto
-- resterebbe senza profilo e la dashboard non si aprirebbe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 2. CLIENTI (rubrica dell'agenzia)
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 3. VIAGGI
-- ============================================================
-- public_slug: indirizzo segreto della pagina pubblica (/t/<slug>).
-- is_published: finché è false il viaggio non è visibile a nessuno
-- tranne l'agenzia proprietaria (vedi policy più sotto).
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  destination text,
  start_date date,
  end_date date,
  cover_image_url text,
  public_slug text not null unique,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 4. GIORNI DEL VIAGGIO
-- ============================================================
create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_date date,
  day_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 5. ATTIVITÀ (le voci dentro ogni giorno)
-- ============================================================
-- activity_type e details non sono qui: vengono aggiunti dalle
-- migrazioni 0002 e 0003.
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_day_id uuid not null references public.trip_days (id) on delete cascade,
  start_time time,
  title text not null,
  description text,
  location text,
  activity_order integer not null default 0,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 6. DOCUMENTI DEL VIAGGIO
-- ============================================================
-- I file stanno nel bucket privato "trip-documents"; qui si salva solo
-- il percorso, e l'app genera di volta in volta un link temporaneo.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  uploaded_at timestamptz not null default now()
);


-- ============================================================
-- 7. INDICI
-- ============================================================
-- Ogni chiave esterna usata per filtrare ha il suo indice: senza,
-- Postgres scansiona tutta la tabella ad ogni apertura di pagina, e
-- con la distanza di rete tra server applicativo e database ogni
-- query lenta si sente subito.
create index if not exists clients_owner_id_idx on public.clients (owner_id);
create index if not exists trips_owner_id_idx on public.trips (owner_id);
create index if not exists trips_client_id_idx on public.trips (client_id);
create index if not exists trip_days_trip_id_idx on public.trip_days (trip_id);
create index if not exists trip_days_trip_id_order_idx on public.trip_days (trip_id, day_order);
create index if not exists activities_trip_day_id_idx on public.activities (trip_day_id);
create index if not exists activities_day_order_idx on public.activities (trip_day_id, activity_order);
create index if not exists documents_trip_id_idx on public.documents (trip_id);


-- ============================================================
-- 8. SICUREZZA A LIVELLO DI RIGA (RLS)
-- ============================================================
-- Regola generale: ogni agenzia vede e modifica solo i propri dati.
-- In più, chi ha il link di un viaggio PUBBLICATO può leggerlo senza
-- essere registrato (è lo scopo della pagina pubblica).
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.activities enable row level security;
alter table public.documents enable row level security;

-- --- PROFILI ---
-- Ognuno legge e modifica solo il proprio profilo.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- La pagina pubblica del viaggio mostra nome, logo e condizioni
-- dell'agenzia: chi non è registrato deve poter leggere il profilo di
-- un'agenzia, ma SOLO se quell'agenzia ha almeno un viaggio pubblicato.
drop policy if exists "profiles_select_published_owner" on public.profiles;
create policy "profiles_select_published_owner" on public.profiles
  for select using (
    exists (
      select 1 from public.trips
      where trips.owner_id = profiles.id and trips.is_published
    )
  );

-- Nota: la policy qui sopra dà accesso alla riga intera, email compresa.
-- La restrizione alle sole colonne pubbliche è nella migrazione 0029,
-- che va eseguita dopo perché una di quelle colonne
-- (terms_and_conditions) viene creata solo nella 0017.

-- --- CLIENTI ---
drop policy if exists "clients_all_own" on public.clients;
create policy "clients_all_own" on public.clients
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- --- VIAGGI ---
drop policy if exists "trips_all_own" on public.trips;
create policy "trips_all_own" on public.trips
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "trips_select_published" on public.trips;
create policy "trips_select_published" on public.trips
  for select using (is_published);

-- --- GIORNI ---
drop policy if exists "trip_days_all_own" on public.trip_days;
create policy "trip_days_all_own" on public.trip_days
  for all using (
    exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.owner_id = auth.uid())
  );

drop policy if exists "trip_days_select_published" on public.trip_days;
create policy "trip_days_select_published" on public.trip_days
  for select using (
    exists (select 1 from public.trips where trips.id = trip_days.trip_id and trips.is_published)
  );

-- --- ATTIVITÀ ---
drop policy if exists "activities_all_own" on public.activities;
create policy "activities_all_own" on public.activities
  for all using (
    exists (
      select 1 from public.trip_days
      join public.trips on trips.id = trip_days.trip_id
      where trip_days.id = activities.trip_day_id and trips.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.trip_days
      join public.trips on trips.id = trip_days.trip_id
      where trip_days.id = activities.trip_day_id and trips.owner_id = auth.uid()
    )
  );

drop policy if exists "activities_select_published" on public.activities;
create policy "activities_select_published" on public.activities
  for select using (
    exists (
      select 1 from public.trip_days
      join public.trips on trips.id = trip_days.trip_id
      where trip_days.id = activities.trip_day_id and trips.is_published
    )
  );

-- --- DOCUMENTI ---
-- Nessuna lettura pubblica: i documenti (passaporti, voucher) restano
-- privati anche quando il viaggio è pubblicato.
drop policy if exists "documents_all_own" on public.documents;
create policy "documents_all_own" on public.documents
  for all using (
    exists (select 1 from public.trips where trips.id = documents.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = documents.trip_id and trips.owner_id = auth.uid())
  );


-- ============================================================
-- 9. ARCHIVIAZIONE FILE (bucket)
-- ============================================================
-- public-assets: immagini destinate a essere viste da chiunque
-- (copertine, foto delle attività, logo dell'agenzia, foto community).
-- trip-documents: privato, per i documenti di viaggio; l'app genera
-- link temporanei firmati quando servono.
insert into storage.buckets (id, name, public)
values ('public-assets', 'public-assets', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', false)
on conflict (id) do nothing;

-- Tutti i file vengono caricati dal codice sotto una cartella che ha
-- per nome l'id dell'utente (es. "<id-utente>/trips/<id-viaggio>/..."):
-- le regole qui sotto si appoggiano a questa convenzione, così ogni
-- agenzia può scrivere solo dentro la propria cartella.
drop policy if exists "public_assets_read_all" on storage.objects;
create policy "public_assets_read_all" on storage.objects
  for select using (bucket_id = 'public-assets');

drop policy if exists "public_assets_write_own_folder" on storage.objects;
create policy "public_assets_write_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "public_assets_update_own_folder" on storage.objects;
create policy "public_assets_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "public_assets_delete_own_folder" on storage.objects;
create policy "public_assets_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_documents_read_own_folder" on storage.objects;
create policy "trip_documents_read_own_folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_documents_write_own_folder" on storage.objects;
create policy "trip_documents_write_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_documents_update_own_folder" on storage.objects;
create policy "trip_documents_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "trip_documents_delete_own_folder" on storage.objects;
create policy "trip_documents_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trip-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- >>>>>>>>>> 0002_activity_types_covers_groups.sql <<<<<<<<<<
-- Migrazione: tipologie di attività colorate, varianti di viaggio (gruppi)
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver già eseguito supabase/schema.sql.
-- (cover_image_url esiste già dalla prima versione dello schema, non serve aggiungerlo)

-- Tipologia di ogni attività (determina anche il colore mostrato)
alter table public.activities
  add column if not exists activity_type text not null default 'altro'
  check (activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'altro'));

-- Gruppo di varianti: più proposte di viaggio alternative per lo stesso cliente
create table if not exists public.trip_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.trips
  add column if not exists group_id uuid references public.trip_groups (id) on delete set null;

alter table public.trip_groups enable row level security;

drop policy if exists "trip_groups_all_own" on public.trip_groups;
create policy "trip_groups_all_own" on public.trip_groups
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);


-- >>>>>>>>>> 0003_details_library_photos.sql <<<<<<<<<<
-- Migrazione: dettagli specifici per tipo attività, libreria attività, foto
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0002_...

-- Dettagli extra dell'attività (es. per un volo: compagnia, PNR; per un hotel: tipo camera, trattamento)
-- Li salviamo come "jsonb", cioè un contenitore flessibile di campi, perché ogni tipologia
-- di attività ha campi diversi e così non dobbiamo creare decine di colonne quasi sempre vuote.
alter table public.activities
  add column if not exists details jsonb not null default '{}'::jsonb;

-- Libreria: attività "modello" salvate per essere riutilizzate in altri viaggi
create table if not exists public.activity_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  activity_type text not null default 'altro'
    check (activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'altro')),
  title text not null,
  description text,
  location text,
  details jsonb not null default '{}'::jsonb,
  cover_photo_url text,
  created_at timestamptz not null default now()
);

alter table public.activity_templates enable row level security;

drop policy if exists "activity_templates_all_own" on public.activity_templates;
create policy "activity_templates_all_own" on public.activity_templates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Foto allegate a un'attività (es. foto dell'hotel, della camera, ecc.)
create table if not exists public.activity_photos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  url text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

alter table public.activity_photos enable row level security;

drop policy if exists "activity_photos_all_own" on public.activity_photos;
create policy "activity_photos_all_own" on public.activity_photos
  for all using (
    exists (
      select 1 from public.activities
      join public.trip_days on trip_days.id = activities.trip_day_id
      join public.trips on trips.id = trip_days.trip_id
      where activities.id = activity_photos.activity_id and trips.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.activities
      join public.trip_days on trip_days.id = activities.trip_day_id
      join public.trips on trips.id = trip_days.trip_id
      where activities.id = activity_photos.activity_id and trips.owner_id = auth.uid()
    )
  );

drop policy if exists "activity_photos_select_published" on public.activity_photos;
create policy "activity_photos_select_published" on public.activity_photos
  for select using (
    exists (
      select 1 from public.activities
      join public.trip_days on trip_days.id = activities.trip_day_id
      join public.trips on trips.id = trip_days.trip_id
      where activities.id = activity_photos.activity_id and trips.is_published = true
    )
  );


-- >>>>>>>>>> 0004_pricing.sql <<<<<<<<<<
-- Migrazione: modalità prezzo del viaggio
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0003_...

alter table public.trips
  add column if not exists price_mode text not null default 'nessuno'
    check (price_mode in ('nessuno', 'lordo', 'commissioni'));

-- Usato quando price_mode = 'lordo': il prezzo totale mostrato al cliente.
alter table public.trips
  add column if not exists price_amount numeric(10, 2);

-- Usati quando price_mode = 'commissioni': costo netto + commissione.
-- Il totale mostrato al cliente è la somma dei due, calcolata al volo.
alter table public.trips
  add column if not exists price_net numeric(10, 2);

alter table public.trips
  add column if not exists price_commission numeric(10, 2);


-- >>>>>>>>>> 0005_activity_documents.sql <<<<<<<<<<
-- Migrazione: documenti collegati a una singola attività (voucher, biglietti, ecc.)
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0004_...
-- I documenti senza attività collegata restano quelli "generali" del viaggio
-- (passaporto, visti, documenti di ingresso).

alter table public.documents
  add column if not exists activity_id uuid references public.activities (id) on delete cascade;


-- >>>>>>>>>> 0006_theme_day_title.sql <<<<<<<<<<
-- Migrazione: tema grafico del viaggio + titolo personalizzato per ogni giorno
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0005_...

alter table public.trip_days
  add column if not exists title text;

alter table public.trips
  add column if not exists theme text not null default 'elegante';

alter table public.trips drop constraint if exists trips_theme_check;
alter table public.trips add constraint trips_theme_check check (
  theme in (
    'elegante', 'azteco', 'giungla', 'deserto', 'egizio',
    'nordico', 'citta', 'marocco', 'giapponese', 'tropicale'
  )
);


-- >>>>>>>>>> 0007_theme_consolidation_title_color.sql <<<<<<<<<<
-- Migrazione: unifica i temi "citta" ed "egizio" in "deserto" + colore
-- personalizzabile del titolo del viaggio.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0006_...

-- I viaggi che usavano i vecchi temi "citta" o "egizio" passano al nuovo
-- tema unico "deserto" (Deserto / Arabeggiante).
update public.trips set theme = 'deserto' where theme in ('citta', 'egizio');

alter table public.trips drop constraint if exists trips_theme_check;
alter table public.trips add constraint trips_theme_check check (
  theme in (
    'elegante', 'azteco', 'giungla', 'deserto',
    'nordico', 'marocco', 'giapponese', 'tropicale'
  )
);

-- Colore del testo del titolo nell'header (sopra l'immagine di copertina):
-- vuoto = bianco (comportamento di prima), altrimenti un colore scelto
-- dall'utente per restare leggibile sulla propria foto di copertina.
alter table public.trips
  add column if not exists title_color text;


-- >>>>>>>>>> 0008_activity_type_info.sql <<<<<<<<<<
-- Migrazione: aggiunge il nuovo tipo di attività "Info" (blocco informativo
-- libero, senza campi specifici, utile per testo generico con tabelle e link).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0007_...

alter table public.activities drop constraint if exists activities_activity_type_check;
alter table public.activities add constraint activities_activity_type_check check (
  activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'info', 'altro')
);

alter table public.activity_templates drop constraint if exists activity_templates_activity_type_check;
alter table public.activity_templates add constraint activity_templates_activity_type_check check (
  activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'info', 'altro')
);


-- >>>>>>>>>> 0009_split_trasporto.sql <<<<<<<<<<
-- Migrazione: divide il tipo generico "trasporto" in quattro tipi più
-- specifici (transfer, treno, traghetto, crociera).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0008_...

-- 1) Allarga temporaneamente il vincolo sui tipi ammessi, includendo sia il
-- vecchio "trasporto" sia i quattro nuovi tipi: serve perché le UPDATE qui
-- sotto scrivono i nuovi valori, e senza questo passaggio il database li
-- rifiuterebbe (il vincolo attuale conosce ancora solo "trasporto").
alter table public.activities drop constraint if exists activities_activity_type_check;
alter table public.activities add constraint activities_activity_type_check check (
  activity_type in (
    'volo', 'alloggio', 'trasporto', 'transfer', 'treno', 'traghetto', 'crociera',
    'ristorante', 'attivita', 'info', 'altro'
  )
);

alter table public.activity_templates drop constraint if exists activity_templates_activity_type_check;
alter table public.activity_templates add constraint activity_templates_activity_type_check check (
  activity_type in (
    'volo', 'alloggio', 'trasporto', 'transfer', 'treno', 'traghetto', 'crociera',
    'ristorante', 'attivita', 'info', 'altro'
  )
);

-- 2) Riassegna le attività e i modelli di libreria esistenti al nuovo tipo
-- più adatto, in base al vecchio campo "mezzo" salvato nei dettagli.
-- "crociera" non esisteva come opzione di "mezzo", quindi non viene mai
-- assegnata automaticamente: resta disponibile solo per le nuove attività.
update public.activities
set activity_type = case
  when details->>'mezzo' = 'Treno' then 'treno'
  when details->>'mezzo' = 'Traghetto' then 'traghetto'
  else 'transfer'
end
where activity_type = 'trasporto';

update public.activity_templates
set activity_type = case
  when details->>'mezzo' = 'Treno' then 'treno'
  when details->>'mezzo' = 'Traghetto' then 'traghetto'
  else 'transfer'
end
where activity_type = 'trasporto';

-- 3) Rinomina i campi "numero" e "luogo_arrivo" nei dettagli con le nuove
-- chiavi specifiche del tipo assegnato, e rimuove il vecchio campo "mezzo"
-- (non più necessario: il tipo stesso lo indica già).
update public.activities
set details = (details - 'mezzo' - 'numero' - 'luogo_arrivo')
  || case when details ? 'numero' then
       jsonb_build_object(
         case activity_type when 'treno' then 'numero_treno' else 'numero_corsa' end,
         details->>'numero'
       )
     else '{}'::jsonb end
  || case when details ? 'luogo_arrivo' then
       jsonb_build_object(
         case activity_type
           when 'treno' then 'stazione_arrivo'
           when 'traghetto' then 'porto_arrivo'
           else 'luogo_arrivo'
         end,
         details->>'luogo_arrivo'
       )
     else '{}'::jsonb end
where activity_type in ('transfer', 'treno', 'traghetto');

update public.activity_templates
set details = (details - 'mezzo' - 'numero' - 'luogo_arrivo')
  || case when details ? 'numero' then
       jsonb_build_object(
         case activity_type when 'treno' then 'numero_treno' else 'numero_corsa' end,
         details->>'numero'
       )
     else '{}'::jsonb end
  || case when details ? 'luogo_arrivo' then
       jsonb_build_object(
         case activity_type
           when 'treno' then 'stazione_arrivo'
           when 'traghetto' then 'porto_arrivo'
           else 'luogo_arrivo'
         end,
         details->>'luogo_arrivo'
       )
     else '{}'::jsonb end
where activity_type in ('transfer', 'treno', 'traghetto');

-- 4) Ora che nessuna riga usa più "trasporto", restringe il vincolo alla
-- lista finale (senza "trasporto").
alter table public.activities drop constraint if exists activities_activity_type_check;
alter table public.activities add constraint activities_activity_type_check check (
  activity_type in (
    'volo', 'alloggio', 'transfer', 'treno', 'traghetto', 'crociera',
    'ristorante', 'attivita', 'info', 'altro'
  )
);

alter table public.activity_templates drop constraint if exists activity_templates_activity_type_check;
alter table public.activity_templates add constraint activity_templates_activity_type_check check (
  activity_type in (
    'volo', 'alloggio', 'transfer', 'treno', 'traghetto', 'crociera',
    'ristorante', 'attivita', 'info', 'altro'
  )
);


-- >>>>>>>>>> 0010_trip_checklist.sql <<<<<<<<<<
-- Migrazione: checklist/promemoria interni per ogni viaggio (es. "Richiedere
-- saldo", "Confermare hotel"), visibili solo all'agenzia, mai al cliente.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0009_...

create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  item_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.trip_checklist_items enable row level security;

drop policy if exists "trip_checklist_items_all_own" on public.trip_checklist_items;
create policy "trip_checklist_items_all_own" on public.trip_checklist_items
  for all using (
    exists (
      select 1 from public.trips
      where trips.id = trip_checklist_items.trip_id and trips.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.trips
      where trips.id = trip_checklist_items.trip_id and trips.owner_id = auth.uid()
    )
  );


-- >>>>>>>>>> 0011_client_details.sql <<<<<<<<<<
-- Migrazione: dati anagrafici e documenti del cliente (tutti opzionali).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0010_...

alter table public.clients
  add column if not exists date_of_birth date,
  add column if not exists place_of_birth text,
  add column if not exists nationality text,
  add column if not exists fiscal_code text,
  add column if not exists residence_address text,
  add column if not exists id_card_number text,
  add column if not exists id_card_expiry date,
  add column if not exists passport_number text,
  add column if not exists passport_expiry date;


-- >>>>>>>>>> 0012_client_portal.sql <<<<<<<<<<
-- Migrazione: area clienti. Collega un account di accesso a una scheda
-- cliente e permette a quel cliente di leggere (solo in lettura) i propri
-- viaggi, anche se non pubblicati, senza toccare l'accesso dell'agenzia.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0011_...

alter table public.clients
  add column if not exists user_id uuid references auth.users (id) on delete set null;

-- Un utente non può essere collegato due volte alla stessa agenzia.
create unique index if not exists clients_owner_user_unique
  on public.clients (owner_id, user_id)
  where user_id is not null;

-- Il cliente può leggere (solo leggere) la propria scheda, per vedere es. il
-- proprio nome nell'area riservata. Le modifiche restano solo all'agenzia
-- (vedi "clients_all_own" in schema.sql).
drop policy if exists "clients_select_own_as_client" on public.clients;
create policy "clients_select_own_as_client" on public.clients
  for select using (auth.uid() = user_id);

-- TRIPS: un cliente autenticato legge i propri viaggi, pubblicati o no.
drop policy if exists "trips_select_as_client" on public.trips;
create policy "trips_select_as_client" on public.trips
  for select using (
    exists (
      select 1 from public.clients
      where clients.id = trips.client_id and clients.user_id = auth.uid()
    )
  );

drop policy if exists "trip_days_select_as_client" on public.trip_days;
create policy "trip_days_select_as_client" on public.trip_days
  for select using (
    exists (
      select 1 from public.trips
      join public.clients on clients.id = trips.client_id
      where trips.id = trip_days.trip_id and clients.user_id = auth.uid()
    )
  );

drop policy if exists "activities_select_as_client" on public.activities;
create policy "activities_select_as_client" on public.activities
  for select using (
    exists (
      select 1 from public.trip_days
      join public.trips on trips.id = trip_days.trip_id
      join public.clients on clients.id = trips.client_id
      where trip_days.id = activities.trip_day_id and clients.user_id = auth.uid()
    )
  );

drop policy if exists "activity_photos_select_as_client" on public.activity_photos;
create policy "activity_photos_select_as_client" on public.activity_photos
  for select using (
    exists (
      select 1 from public.activities
      join public.trip_days on trip_days.id = activities.trip_day_id
      join public.trips on trips.id = trip_days.trip_id
      join public.clients on clients.id = trips.client_id
      where activities.id = activity_photos.activity_id and clients.user_id = auth.uid()
    )
  );

-- Un cliente deve poter leggere nome agenzia/logo di chi gli ha organizzato
-- il viaggio (stessa cosa che già succede sulla pagina pubblica).
drop policy if exists "profiles_select_as_client_trip_owner" on public.profiles;
create policy "profiles_select_as_client_trip_owner" on public.profiles
  for select using (
    exists (
      select 1 from public.trips
      join public.clients on clients.id = trips.client_id
      where trips.owner_id = profiles.id and clients.user_id = auth.uid()
    )
  );

-- Funzione sicura chiamata al login del cliente: collega automaticamente
-- (solo per email corrispondente e non già presa da nessun altro) tutte le
-- schede cliente, di qualunque agenzia, che hanno quella email ma nessun
-- account ancora associato. "security definer" serve solo per poter leggere
-- l'email verificata della sessione corrente ed eseguire l'aggiornamento
-- mirato: non espone nessun'altra riga oltre a quelle con quella email.
create or replace function public.claim_client_profiles()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
  set user_id = auth.uid()
  where user_id is null
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
end;
$$;

revoke all on function public.claim_client_profiles() from public;
grant execute on function public.claim_client_profiles() to authenticated;


-- >>>>>>>>>> 0013_default_brand_color.sql <<<<<<<<<<
-- Migrazione: il colore di default per le nuove agenzie (usato solo come
-- fallback quando non caricano un logo) diventa il navy di Grand Route
-- invece del blu generico. Non tocca le agenzie che hanno già un colore
-- impostato (anche se coincide col vecchio default): è una preferenza loro.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0012_...

alter table public.profiles alter column brand_color set default '#2b333e';


-- >>>>>>>>>> 0014_robust_claim_client_profiles.sql <<<<<<<<<<
-- Migrazione: rende più robusto il collegamento automatico cliente<->account.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0013_...
--
-- Problema: se sotto la stessa agenzia esistono due schede cliente con la
-- stessa email (es. creata due volte per errore) ed entrambe non ancora
-- collegate, il vecchio claim_client_profiles() provava a collegarle
-- entrambe allo stesso account nella stessa UPDATE. L'indice unico
-- "clients_owner_user_unique" (un account non può essere collegato due
-- volte alla stessa agenzia) blocca questo, e l'intera UPDATE falliva: il
-- cliente restava non collegato, senza nessun errore visibile, e i suoi
-- viaggi non comparivano mai nell'area clienti.
--
-- Questa versione collega le schede una per una, e se una scheda non può
-- essere collegata (perché un'altra scheda della stessa agenzia è già
-- collegata a questo account) la salta, senza bloccare le altre.
create or replace function public.claim_client_profiles()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select id from public.clients
    where user_id is null
      and email is not null
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  loop
    begin
      update public.clients set user_id = auth.uid() where id = rec.id;
    exception when unique_violation then
      continue;
    end;
  end loop;
end;
$$;


-- >>>>>>>>>> 0015_services_suppliers.sql <<<<<<<<<<
-- Migrazione: Fornitori e Servizi (Fase 1 del modulo "gestionale vero e
-- proprio": amministrazione e prenotazione dei servizi).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0014_...
--
-- FORNITORI: rubrica dei fornitori dell'agenzia (hotel, compagnie di
-- trasporto, guide, ecc.), indipendente dai viaggi: uno stesso fornitore
-- si riusa su più viaggi.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  category text not null default 'altro'
    check (category in ('alloggio', 'trasporto', 'attivita', 'ristorazione', 'altro')),
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- SERVIZI: i servizi da prenotare/prenotati per un viaggio. Volutamente
-- separati dalle "activities" dell'itinerario: non sono visti dal cliente e
-- non sono obbligatori per costruire un viaggio. Possono opzionalmente
-- riferirsi a un'attività dell'itinerario (per sapere "a cosa corrisponde"),
-- ma non è richiesto.
create table if not exists public.trip_services (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  activity_id uuid references public.activities (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  title text not null,
  status text not null default 'da_prenotare'
    check (status in ('da_prenotare', 'richiesto', 'confermato', 'cancellato')),
  net_cost numeric(10, 2),
  confirmation_number text,
  notes text,
  service_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists suppliers_owner_id_idx on public.suppliers (owner_id);
create index if not exists trip_services_trip_id_idx on public.trip_services (trip_id);

alter table public.suppliers enable row level security;
alter table public.trip_services enable row level security;

-- FORNITORI: solo il proprietario (come clients, activity_templates, ecc.)
drop policy if exists "suppliers_all_own" on public.suppliers;
create policy "suppliers_all_own" on public.suppliers
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- SERVIZI: solo il proprietario del viaggio a cui appartengono (stessa
-- logica già usata per trip_days/documents/activities)
drop policy if exists "trip_services_all_own" on public.trip_services;
create policy "trip_services_all_own" on public.trip_services
  for all using (
    exists (select 1 from public.trips where trips.id = trip_services.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = trip_services.trip_id and trips.owner_id = auth.uid())
  );


-- >>>>>>>>>> 0016_trip_payments.sql <<<<<<<<<<
-- Migrazione: Scadenzario pagamenti (Fase 2 del gestionale prenotazioni).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0015_...
--
-- PAGAMENTI: sia gli incassi dal cliente (saldo, acconto...) sia i
-- pagamenti ai fornitori, con una data di scadenza e una data di
-- pagamento/incasso effettivo (null finché non è successo). Un pagamento
-- può opzionalmente riferirsi a un servizio specifico (es. "acconto Hotel
-- Lotus"), ma può anche essere generico per il viaggio (es. "saldo cliente").
create table if not exists public.trip_payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  service_id uuid references public.trip_services (id) on delete set null,
  direction text not null check (direction in ('incasso', 'pagamento')),
  amount numeric(10, 2) not null,
  due_date date,
  paid_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists trip_payments_trip_id_idx on public.trip_payments (trip_id);

alter table public.trip_payments enable row level security;

drop policy if exists "trip_payments_all_own" on public.trip_payments;
create policy "trip_payments_all_own" on public.trip_payments
  for all using (
    exists (select 1 from public.trips where trips.id = trip_payments.trip_id and trips.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips where trips.id = trip_payments.trip_id and trips.owner_id = auth.uid())
  );


-- >>>>>>>>>> 0017_rate_terms.sql <<<<<<<<<<
-- Migrazione: blocco "Tariffa & Termini" (facoltativo per ogni viaggio).
-- Il testo dei Termini e Condizioni è scritto una volta sola nel profilo
-- dell'agenzia e riusato in tutti i viaggi (stile Essence of Italy); il box
-- di inclusioni/esclusioni invece cambia da viaggio a viaggio. Il cliente lo
-- vede nel suo itinerario solo se lo attivi con l'interruttore apposito.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0016_...

alter table public.profiles
  add column if not exists terms_and_conditions text;

alter table public.trips
  add column if not exists rate_includes text,
  add column if not exists rate_excludes text,
  add column if not exists show_rate_block boolean not null default false;


-- >>>>>>>>>> 0018_itinerary_stage_confirmation_sync.sql <<<<<<<<<<
-- Migrazione: "2 versioni" del viaggio (preliminare/finale) + collegamento
-- automatico Servizio confermato -> Attività dell'itinerario.
-- Un unico viaggio passa da "preliminare" (bozza generica, inviata al
-- cliente/agente per conferma) a "finale" (dettagli reali, dopo aver
-- prenotato i servizi) tramite un semplice interruttore: niente copie da
-- tenere allineate.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0017_...

alter table public.trips
  add column if not exists itinerary_stage text not null default 'preliminare'
    check (itinerary_stage in ('preliminare', 'finale'));


-- >>>>>>>>>> 0019_ui_font_preferences.sql <<<<<<<<<<
-- Migrazione: preferenze di lettura dell'agenzia (dimensione e stile del
-- carattere), applicate a tutte le pagine del gestionale che l'agenzia usa
-- per lavorare (non all'itinerario mostrato al cliente, che ha già il suo
-- sistema di temi per viaggio).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0018_...

alter table public.profiles
  add column if not exists ui_font_size text not null default 'normale'
    check (ui_font_size in ('normale', 'grande', 'molto_grande')),
  add column if not exists ui_font_family text not null default 'predefinito'
    check (ui_font_family in ('predefinito', 'leggibile', 'classico'));


-- >>>>>>>>>> 0020_encrypt_client_sensitive_fields.sql <<<<<<<<<<
-- Migrazione: prepara le colonne dei dati anagrafici/documenti del cliente a
-- contenere valori cifrati (vedi src/lib/encryption.ts). Le date erano
-- colonne "date": diventano "text" perché un valore cifrato è una stringa,
-- non una data valida per Postgres. I valori esistenti vengono convertiti
-- al loro formato testuale (es. 1990-05-20), restando leggibili finché non
-- vengono risalvati dall'agenzia, a quel punto verranno cifrati.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0019_...

alter table public.clients
  alter column date_of_birth type text using date_of_birth::text,
  alter column id_card_expiry type text using id_card_expiry::text,
  alter column passport_expiry type text using passport_expiry::text;


-- >>>>>>>>>> 0021_community.sql <<<<<<<<<<
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
-- (il creatore deve poter vedere la riga appena inserita subito dopo
-- l'insert, prima che il trigger che lo rende "owner" in
-- community_group_members abbia effetto: per questo controlliamo anche
-- created_by, non solo l'appartenenza al gruppo)
drop policy if exists "community_groups_select_member" on public.community_groups;
create policy "community_groups_select_member" on public.community_groups
  for select using (created_by = auth.uid() or public.is_community_group_member(id));

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


-- >>>>>>>>>> 0022_sos_likes_push.sql <<<<<<<<<<
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


-- >>>>>>>>>> 0023_fix_is_professional_on_login.sql <<<<<<<<<<
-- Corregge un bug: claim_client_profiles() (chiamata ad ogni login
-- dell'area clienti, non solo alla registrazione) marcava chiunque
-- effettuasse il login da /client/login come "non professionista" — anche
-- un'agenzia che prova per sbaglio ad accedere con la propria email dal
-- posto sbagliato, perdendo così l'accesso alla community.
-- Da ora: il collegamento automatico delle schede cliente resta ad ogni
-- login (comportamento originale), ma il flag is_professional si imposta
-- SOLO in fase di registrazione di un nuovo cliente.

create or replace function public.claim_client_profiles()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
  set user_id = auth.uid()
  where user_id is null
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
end;
$$;

create or replace function public.mark_current_user_as_client()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_professional = false
  where id = auth.uid();
end;
$$;

revoke all on function public.mark_current_user_as_client() from public;
grant execute on function public.mark_current_user_as_client() to authenticated;


-- >>>>>>>>>> 0024_client_documents_payments_margin.sql <<<<<<<<<<
-- Migrazione: dati di viaggio compilabili dal cliente, scadenze pagamento
-- visibili al cliente, margine per servizio fornitore.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0023_...

-- ============================================================
-- 1. Il cliente può aggiornare i propri dati anagrafici/documenti (stessi
--    campi già raccolti dall'agenzia in 0011/0020), ma solo i propri e solo
--    quelli: una funzione dedicata invece di una policy UPDATE generica,
--    così non può toccare altri campi della scheda (es. note interne
--    dell'agenzia o il proprio owner_id).
-- ============================================================
create or replace function public.update_client_travel_documents(
  p_client_id uuid,
  p_date_of_birth text,
  p_place_of_birth text,
  p_nationality text,
  p_fiscal_code text,
  p_residence_address text,
  p_id_card_number text,
  p_id_card_expiry text,
  p_passport_number text,
  p_passport_expiry text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
  set
    date_of_birth = p_date_of_birth,
    place_of_birth = p_place_of_birth,
    nationality = p_nationality,
    fiscal_code = p_fiscal_code,
    residence_address = p_residence_address,
    id_card_number = p_id_card_number,
    id_card_expiry = p_id_card_expiry,
    passport_number = p_passport_number,
    passport_expiry = p_passport_expiry
  where id = p_client_id and user_id = auth.uid();
end;
$$;

revoke all on function public.update_client_travel_documents(uuid, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.update_client_travel_documents(uuid, text, text, text, text, text, text, text, text, text) to authenticated;

-- ============================================================
-- 2. Il cliente può leggere (solo in lettura) le scadenze di incasso del
--    proprio viaggio: non i pagamenti ai fornitori, mai mostrati al cliente.
-- ============================================================
drop policy if exists "trip_payments_select_as_client" on public.trip_payments;
create policy "trip_payments_select_as_client" on public.trip_payments
  for select using (
    direction = 'incasso'
    and exists (
      select 1 from public.trips t
      join public.clients c on c.id = t.client_id
      where t.id = trip_payments.trip_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Margine per servizio: prezzo di vendita al cliente, a fianco del costo
--    netto già presente, per vedere il margine riga per riga oltre alla
--    commissione complessiva già disponibile a livello di viaggio.
-- ============================================================
alter table public.trip_services
  add column if not exists sell_price numeric(10, 2);


-- >>>>>>>>>> 0025_prompt_styles.sql <<<<<<<<<<
-- Migrazione: stili di prompt riutilizzabili per la generazione itinerario
-- con l'AI (sezione "Stili" nella Libreria, accanto ai "Blocchi").
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0024_...

create table if not exists public.prompt_styles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  prompt_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists prompt_styles_owner_id_idx on public.prompt_styles (owner_id);

alter table public.prompt_styles enable row level security;

drop policy if exists "prompt_styles_all_own" on public.prompt_styles;
create policy "prompt_styles_all_own" on public.prompt_styles
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);


-- >>>>>>>>>> 0026_document_cover_image.sql <<<<<<<<<<
-- Migrazione: foto di copertina opzionale per i documenti del viaggio.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0025_...

alter table public.documents
  add column if not exists cover_image_path text;


-- >>>>>>>>>> 0027_supplier_price_lists.sql <<<<<<<<<<
-- Migrazione: Listino prezzi dei fornitori (Fase 1 del modulo "proponi
-- itinerario da richiesta cliente", pensato per i tour operator che
-- lavorano con fornitori locali via listini mail).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0026_...
--
-- Separata da "trip_services": qui non si tratta di un servizio prenotato
-- per UN viaggio, ma del catalogo prezzi riutilizzabile di un fornitore,
-- da cui in futuro si potrà proporre un itinerario a partire da una
-- richiesta cliente. owner_id diretto (come "suppliers"), non serve
-- passare dal viaggio: il listino non appartiene a nessun viaggio.
create table if not exists public.supplier_price_list_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  category text not null default 'altro'
    check (category in ('alloggio', 'trasporto', 'attivita', 'ristorazione', 'altro')),
  title text not null,
  description text,
  price numeric(10, 2),
  unit text,
  valid_from date,
  valid_to date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists supplier_price_list_items_owner_id_idx
  on public.supplier_price_list_items (owner_id);
create index if not exists supplier_price_list_items_supplier_id_idx
  on public.supplier_price_list_items (supplier_id);

alter table public.supplier_price_list_items enable row level security;

drop policy if exists "supplier_price_list_items_all_own" on public.supplier_price_list_items;
create policy "supplier_price_list_items_all_own" on public.supplier_price_list_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);


-- >>>>>>>>>> 0028_client_request_notes.sql <<<<<<<<<<
-- Migrazione: campo per le note sulla richiesta del cliente (Fase 2 del
-- modulo "proponi itinerario da richiesta cliente", vedi 0027 per la Fase 1).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0027_...
--
-- Testo libero (numero persone, preferenze, budget) estratto dalla mail del
-- cliente dall'AI e rivisto dall'agente, o scritto a mano: serve come base
-- per la Fase 3 (abbinamento con il listino), ma è utile anche da solo come
-- promemoria sul viaggio.
alter table public.trips
  add column if not exists client_request_notes text;


-- >>>>>>>>>> 0029_public_profile_columns.sql <<<<<<<<<<
-- Migrazione: limita ciò che un visitatore non registrato può leggere
-- del profilo di un'agenzia.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0028_...
--
-- La pagina pubblica di un viaggio (/t/<slug>) e il riepilogo stampabile
-- mostrano nome, logo e condizioni dell'agenzia: per farlo, la policy
-- "profiles_select_published_owner" (migrazione 0001) permette a chiunque
-- di leggere il profilo di un'agenzia che ha almeno un viaggio pubblicato.
-- Quella regola però vale sulla RIGA intera, quindi dava accesso anche a
-- email, telefono di emergenza e preferenze di notifica.
--
-- Qui restringiamo il ruolo "anon" (il visitatore senza login) alle sole
-- colonne che servono davvero a quelle due pagine. Gli utenti registrati
-- continuano a leggere il proprio profilo per intero, come prima.
--
-- Se in futuro una pagina pubblica dovesse mostrare un altro campo del
-- profilo, la query fallirà con un errore chiaro di permessi: basterà
-- aggiungere quella colonna alla grant qui sotto.
revoke select on public.profiles from anon;
grant select (id, agency_name, logo_url, terms_and_conditions) on public.profiles to anon;


-- >>>>>>>>>> 0030_ai_usage.sql <<<<<<<<<<
-- Migrazione: contatore d'uso delle funzioni AI, per limitare i costi.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0029_...
--
-- Ogni volta che un utente usa una funzione AI (genera itinerario, leggi
-- listino, leggi richiesta cliente) il sito scrive qui una riga. Prima di
-- ogni nuova chiamata il sito conta le righe delle ultime ore e rifiuta se il
-- limite è superato (vedi src/lib/aiQuota.ts). Così un uso eccessivo, o un
-- abuso, non può far salire la bolletta senza controllo.
--
-- Ogni utente può leggere e aggiungere solo le proprie righe e NON può
-- modificarle né cancellarle (nessuna policy di update/delete).
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage
  for insert to authenticated
  with check (user_id = (select auth.uid()));


-- >>>>>>>>>> 0031_security_hardening.sql <<<<<<<<<<
-- Migrazione: restringe alcuni permessi segnalati dal Security Advisor di
-- Supabase. Esegui questo file nell'SQL Editor DOPO aver eseguito 0030_...
--
-- 1) Il bucket pubblico "public-assets" permetteva a chiunque di ELENCARE
--    tutti i file (e quindi di scoprire cartelle e nomi). Le immagini restano
--    visibili tramite il loro indirizzo pubblico (non serve nessuna policy);
--    la lettura "via API" resta solo alla persona nella propria cartella,
--    che serve per poter eliminare i propri file.
drop policy if exists "public_assets_read_all" on storage.objects;
drop policy if exists "public_assets_read_own_folder" on storage.objects;
create policy "public_assets_read_own_folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2) Funzioni usate soltanto da un "trigger" interno: nessun utente deve
--    poterle chiamare direttamente (un trigger non richiede il permesso).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_community_group() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- 3) Funzioni chiamate solo da utenti con accesso: tolto il permesso ai
--    visitatori anonimi (gli utenti registrati restano autorizzati; in ogni
--    caso le funzioni controllano già auth.uid() al loro interno).
revoke execute on function public.claim_client_profiles() from public, anon;
revoke execute on function public.mark_current_user_as_client() from public, anon;
revoke execute on function public.update_client_travel_documents(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.redeem_community_invite(text) from public, anon;
revoke execute on function public.get_emergency_push_targets(uuid) from public, anon;
revoke execute on function public.get_community_post_push_targets(uuid) from public, anon;

-- Volutamente NON modificate:
--  * get_departure_reminder_push_targets: la chiama il cron giornaliero senza
--    utente collegato; è protetta da un segreto, non da auth.uid().
--  * is_current_user_professional / is_community_group_member: sono usate
--    dentro le regole di sicurezza (RLS), anche su "profiles" che i
--    visitatori leggono dalla pagina pubblica di un viaggio: togliere il
--    permesso agli anonimi la romperebbe.


-- >>>>>>>>>> 0032_brand_color_public.sql <<<<<<<<<<
-- Migrazione: il colore del brand dell'agenzia deve essere leggibile anche da
-- chi apre la pagina pubblica di un viaggio (senza login), per colorare
-- l'intestazione. È solo un codice colore, non un dato personale.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0031_...
--
-- Il sito funziona anche prima di questo passaggio (il colore semplicemente
-- non compare nella pagina pubblica).
grant select (brand_color) on public.profiles to anon;


-- >>>>>>>>>> 0033_ai_rules.sql <<<<<<<<<<
-- Migrazione: regole per l'AI (per agenzia e di base della piattaforma) e
-- note dell'AI sul viaggio.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0032_...
--
-- 1) profiles.ai_rules / ai_preferences: le regole che ogni agenzia scrive per
--    sé (tono, lunghezza, cose da non scrivere mai...). Ogni agenzia modifica
--    solo le proprie (la regola di sicurezza esistente sui profili basta).
-- 2) platform_admins: elenco di chi può modificare le regole di base della
--    piattaforma. Nessuno può leggerla o modificarla dal sito: si gestisce
--    solo da qui (SQL Editor). Vedi in fondo come aggiungere il proprio utente.
-- 3) ai_platform_rules: le regole di base, modificabili dagli amministratori.
--    Se una regola non è stata personalizzata vale quella predefinita nel
--    codice, quindi la tabella può restare vuota.
-- 4) trips.ai_notes: note lasciate dall'AI dopo aver generato un itinerario
--    (dubbi, ipotesi, verifiche su distanze e tempi).

alter table public.profiles
  add column if not exists ai_rules text,
  add column if not exists ai_preferences jsonb not null default '{}'::jsonb;

alter table public.trips
  add column if not exists ai_notes text;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.ai_platform_rules (
  key text primary key,
  title text not null,
  body text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ai_platform_rules enable row level security;
revoke all on public.ai_platform_rules from anon;
grant select, insert, update, delete on public.ai_platform_rules to authenticated;

drop policy if exists "ai_platform_rules_admin_all" on public.ai_platform_rules;
create policy "ai_platform_rules_admin_all" on public.ai_platform_rules
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Lettura per il sito: restituisce solo le regole attive, a qualunque utente
-- registrato (servono per costruire le istruzioni dell'AI), senza aprire la tabella.
create or replace function public.get_ai_platform_rules()
returns table (key text, title text, body text, enabled boolean, sort_order integer)
language sql
security definer
stable
set search_path = public
as $$
  select r.key, r.title, r.body, r.enabled, r.sort_order
  from public.ai_platform_rules r
  where auth.uid() is not null
  order by r.sort_order, r.key;
$$;
revoke all on function public.get_ai_platform_rules() from public, anon;
grant execute on function public.get_ai_platform_rules() to authenticated;

-- >>>>>>>>>> 0034_logo_shape.sql <<<<<<<<<<
alter table public.profiles
  add column if not exists logo_shape text not null default 'smussato'
  check (logo_shape in ('squadrato', 'smussato', 'tondo', 'personalizzato'));

grant select (logo_shape) on public.profiles to anon;

-- >>>>>>>>>> 0035_ai_budget.sql <<<<<<<<<<
alter table public.ai_usage
  add column if not exists input_tokens integer not null default 0 check (input_tokens >= 0),
  add column if not exists output_tokens integer not null default 0 check (output_tokens >= 0),
  add column if not exists cost_eur numeric(10, 5) not null default 0 check (cost_eur >= 0);

alter table public.profiles
  add column if not exists ai_plan text not null default 'start'
  check (ai_plan in ('start', 'plus', 'pro'));

-- >>>>>>>>>> 0036_trip_dialogue.sql <<<<<<<<<<
-- 1. Stato di approvazione dell'itinerario (lo imposta l'agenzia; il cliente
--    lo cambia solo tramite la funzione client_set_trip_approval più sotto).
alter table public.trips
  add column if not exists approval_status text not null default 'none'
    check (approval_status in ('none', 'pending', 'approved', 'changes_requested')),
  add column if not exists approval_updated_at timestamptz;

-- 2. Messaggi del viaggio
create table if not exists public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_role text not null check (author_role in ('agency', 'client')),
  kind text not null default 'message'
    check (kind in ('message', 'change_request', 'approved', 'sent_for_approval')),
  body text not null check (char_length(body) between 1 and 2000),
  day_id uuid references public.trip_days (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists trip_messages_trip_created_idx
  on public.trip_messages (trip_id, created_at);

alter table public.trip_messages enable row level security;

-- Chi può partecipare: l'agenzia proprietaria del viaggio e il cliente
-- collegato a quel viaggio.
create or replace function public.is_trip_agency(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = auth.uid());
$$;

create or replace function public.is_trip_client(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trips t
    join public.clients c on c.id = t.client_id
    where t.id = p_trip_id and c.user_id = auth.uid()
  );
$$;

revoke all on function public.is_trip_agency(uuid) from public, anon;
revoke all on function public.is_trip_client(uuid) from public, anon;
grant execute on function public.is_trip_agency(uuid) to authenticated;
grant execute on function public.is_trip_client(uuid) to authenticated;

drop policy if exists "trip_messages_select_parties" on public.trip_messages;
create policy "trip_messages_select_parties" on public.trip_messages
  for select to authenticated
  using (public.is_trip_agency(trip_id) or public.is_trip_client(trip_id));

-- Si scrive solo a proprio nome e nel proprio ruolo; i messaggi "di sistema"
-- (approvato, modifiche richieste) li crea la funzione qui sotto.
drop policy if exists "trip_messages_insert_parties" on public.trip_messages;
create policy "trip_messages_insert_parties" on public.trip_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and kind in ('message', 'sent_for_approval')
    and (
      (author_role = 'agency' and public.is_trip_agency(trip_id))
      or (author_role = 'client' and kind = 'message' and public.is_trip_client(trip_id))
    )
  );

-- Nessuna policy di update/delete: i messaggi non si modificano né si
-- cancellano (la lettura si segna con la funzione sotto).

-- 3. Il cliente approva l'itinerario o chiede modifiche.
create or replace function public.client_set_trip_approval(
  p_trip_id uuid,
  p_status text,
  p_note text default null,
  p_day_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('approved', 'changes_requested') then
    raise exception 'stato non valido';
  end if;
  if not public.is_trip_client(p_trip_id) then
    raise exception 'non autorizzato';
  end if;
  if p_status = 'changes_requested' and v_note is null then
    raise exception 'descrivi le modifiche richieste';
  end if;

  update public.trips
    set approval_status = p_status, approval_updated_at = now()
    where id = p_trip_id;

  insert into public.trip_messages (trip_id, author_id, author_role, kind, body, day_id)
  values (
    p_trip_id,
    auth.uid(),
    'client',
    case when p_status = 'approved' then 'approved' else 'change_request' end,
    left(coalesce(v_note, 'Itinerario approvato'), 2000),
    p_day_id
  );
end;
$$;

revoke all on function public.client_set_trip_approval(uuid, text, text, uuid) from public, anon;
grant execute on function public.client_set_trip_approval(uuid, text, text, uuid) to authenticated;

-- 4. Segna come letti i messaggi dell'altra parte.
create or replace function public.mark_trip_messages_read(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if public.is_trip_agency(p_trip_id) then v_role := 'agency';
  elsif public.is_trip_client(p_trip_id) then v_role := 'client';
  else return;
  end if;

  update public.trip_messages
    set read_at = now()
    where trip_id = p_trip_id and author_role <> v_role and read_at is null;
end;
$$;

revoke all on function public.mark_trip_messages_read(uuid) from public, anon;
grant execute on function public.mark_trip_messages_read(uuid) to authenticated;

-- 5. Destinatari della notifica push: l'altra parte del viaggio.
create or replace function public.get_trip_message_push_targets(p_trip_id uuid)
returns table(endpoint text, p256dh text, auth_key text, recipient_role text)
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
      join public.push_subscriptions ps on ps.profile_id = t.owner_id
      where t.id = p_trip_id and p.notify_trips;
  end if;
end;
$$;

revoke all on function public.get_trip_message_push_targets(uuid) from public, anon;
grant execute on function public.get_trip_message_push_targets(uuid) to authenticated;


-- >>>>>>>>>> 0037_trip_dialogue_activity.sql <<<<<<<<<<
alter table public.trip_messages
  add column if not exists activity_id uuid references public.activities (id) on delete set null;

-- Giorno e attività indicati devono appartenere davvero a quel viaggio.
drop policy if exists "trip_messages_insert_parties" on public.trip_messages;
create policy "trip_messages_insert_parties" on public.trip_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and kind in ('message', 'sent_for_approval')
    and (
      (author_role = 'agency' and public.is_trip_agency(trip_id))
      or (author_role = 'client' and kind = 'message' and public.is_trip_client(trip_id))
    )
    and (
      day_id is null
      or exists (select 1 from public.trip_days d where d.id = day_id and d.trip_id = trip_messages.trip_id)
    )
    and (
      activity_id is null
      or exists (
        select 1 from public.activities a
        join public.trip_days d on d.id = a.trip_day_id
        where a.id = activity_id and d.trip_id = trip_messages.trip_id
      )
    )
  );

-- Nuova versione della funzione di approvazione, con l'attività (la vecchia,
-- a quattro parametri, viene tolta).
drop function if exists public.client_set_trip_approval(uuid, text, text, uuid);

create or replace function public.client_set_trip_approval(
  p_trip_id uuid,
  p_status text,
  p_note text default null,
  p_day_id uuid default null,
  p_activity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('approved', 'changes_requested') then
    raise exception 'stato non valido';
  end if;
  if not public.is_trip_client(p_trip_id) then
    raise exception 'non autorizzato';
  end if;
  if p_status = 'changes_requested' and v_note is null then
    raise exception 'descrivi le modifiche richieste';
  end if;
  if p_day_id is not null and not exists (
    select 1 from public.trip_days d where d.id = p_day_id and d.trip_id = p_trip_id
  ) then
    raise exception 'giorno non valido';
  end if;
  if p_activity_id is not null and not exists (
    select 1 from public.activities a
    join public.trip_days d on d.id = a.trip_day_id
    where a.id = p_activity_id and d.trip_id = p_trip_id
  ) then
    raise exception 'attività non valida';
  end if;

  update public.trips
    set approval_status = p_status, approval_updated_at = now()
    where id = p_trip_id;

  insert into public.trip_messages (trip_id, author_id, author_role, kind, body, day_id, activity_id)
  values (
    p_trip_id,
    auth.uid(),
    'client',
    case when p_status = 'approved' then 'approved' else 'change_request' end,
    left(coalesce(v_note, 'Itinerario approvato'), 2000),
    p_day_id,
    p_activity_id
  );
end;
$$;

revoke all on function public.client_set_trip_approval(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.client_set_trip_approval(uuid, text, text, uuid, uuid) to authenticated;


-- >>>>>>>>>> 0038_trip_chat_realtime.sql <<<<<<<<<<
do $$
begin
  alter publication supabase_realtime add table public.trip_messages;
exception
  when duplicate_object then null;  -- già attivo
  when undefined_object then null;  -- publication non presente
end $$;


-- >>>>>>>>>> 0039_client_documents.sql <<<<<<<<<<
alter table public.documents
  add column if not exists visible_to_client boolean not null default false;

drop policy if exists "documents_select_as_client" on public.documents;
create policy "documents_select_as_client" on public.documents
  for select to authenticated
  using (visible_to_client and public.is_trip_client(trip_id));

-- Il cliente può scaricare i file (e le copertine) dei documenti visibili.
drop policy if exists "trip_documents_read_as_client" on storage.objects;
create policy "trip_documents_read_as_client" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-documents'
    and exists (
      select 1 from public.documents d
      where (d.file_path = storage.objects.name or d.cover_image_path = storage.objects.name)
        and d.visible_to_client
        and public.is_trip_client(d.trip_id)
    )
  );


-- >>>>>>>>>> 0040_client_zefiro.sql <<<<<<<<<<
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


-- ── Per diventare amministratore (una volta sola, solo per il tuo utente) ──
-- Sostituisci l'email qui sotto con quella con cui accedi e premi Run:
--
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'LA-TUA-EMAIL'
--   on conflict do nothing;

commit;

-- ===== 0041_trip_translations.sql =====
-- Migrazione: traduzioni automatiche dell'itinerario (per i clienti che
-- scelgono il sito in inglese). La traduzione si fa una sola volta e viene
-- conservata qui; si rifà solo se l'agenzia modifica l'itinerario.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0040_...
--
-- Il sito funziona anche prima di questo passaggio: l'itinerario resta in italiano.

create table if not exists public.trip_translations (
  trip_id uuid not null references public.trips (id) on delete cascade,
  lang text not null check (lang in ('en')),
  source_hash text not null,
  items jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, lang)
);

-- Nessuna policy: si legge e si scrive solo con le due funzioni qui sotto.
alter table public.trip_translations enable row level security;

-- Legge la traduzione: l'agenzia del viaggio, il cliente collegato, oppure
-- chiunque se il viaggio è pubblicato (pagina pubblica).
create or replace function public.get_trip_translation(p_trip_id uuid, p_lang text)
returns table(source_hash text, items jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_trip_agency(p_trip_id)
     or public.is_trip_client(p_trip_id)
     or exists (select 1 from public.trips t where t.id = p_trip_id and t.is_published) then
    return query
      select tt.source_hash, tt.items from public.trip_translations tt
      where tt.trip_id = p_trip_id and tt.lang = p_lang;
  end if;
end;
$$;

-- Salva la traduzione: solo l'agenzia del viaggio o il cliente collegato.
create or replace function public.save_trip_translation(
  p_trip_id uuid, p_lang text, p_hash text, p_items jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_trip_agency(p_trip_id) or public.is_trip_client(p_trip_id)) then
    raise exception 'non autorizzato';
  end if;
  if jsonb_typeof(p_items) <> 'array' or pg_column_size(p_items) > 400000 then
    raise exception 'dati non validi';
  end if;
  insert into public.trip_translations (trip_id, lang, source_hash, items, updated_at)
  values (p_trip_id, p_lang, p_hash, p_items, now())
  on conflict (trip_id, lang) do update
    set source_hash = excluded.source_hash, items = excluded.items, updated_at = now();
end;
$$;

revoke all on function public.get_trip_translation(uuid, text) from public;
revoke all on function public.save_trip_translation(uuid, text, text, jsonb) from public, anon;
grant execute on function public.get_trip_translation(uuid, text) to anon, authenticated;
grant execute on function public.save_trip_translation(uuid, text, text, jsonb) to authenticated;

-- ===== 0042_trip_sent_to_client.sql =====
-- Migrazione: ricorda quando il viaggio è stato inviato per mail al cliente.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0041_...
--
-- Il sito funziona anche prima di questo passaggio: la mail parte lo stesso,
-- ma non compare la scritta "Inviato il ...".

alter table public.trips
  add column if not exists client_notified_at timestamptz;

-- ===== 0043_itinerary_mode.sql =====
-- Migrazione: modalità dell'itinerario. "activities" (default) = una scheda per ogni
-- attività; "days" = ogni giorno è un unico blocco di testo con tutte le attività elencate.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0042_...
--
-- Il sito funziona anche prima di questo passaggio: restano disponibili solo gli itinerari
-- per attività (la scelta «giornata intera» non viene salvata).

alter table public.trips
  add column if not exists itinerary_mode text not null default 'activities'
    check (itinerary_mode in ('activities', 'days'));

-- ===== 0044_client_photos.sql =====
-- Migrazione: bacheca dei ricordi nel mappamondo del cliente (foto per paese).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0043_...
--
-- Ogni cliente carica le proprie foto per paese visitato. Le foto sono PRIVATE:
-- le vede solo chi le ha caricate (la condivisione sui social avviene dal telefono
-- del cliente, quando decide lui). Il sito funziona anche prima di questo passaggio:
-- la bacheca semplicemente non permette ancora di caricare foto.

-- 1. Cartella di archiviazione privata (foto già ridotte dal sito, max 8 MB l'una)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-photos', 'client-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ognuno lavora solo dentro la cartella che ha per nome il proprio id utente
drop policy if exists "client_photos_read_own" on storage.objects;
create policy "client_photos_read_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "client_photos_write_own" on storage.objects;
create policy "client_photos_write_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "client_photos_delete_own" on storage.objects;
create policy "client_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Elenco delle foto
create table if not exists public.client_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  country text not null check (char_length(country) between 2 and 80),
  file_path text not null check (char_length(file_path) <= 300),
  caption text check (caption is null or char_length(caption) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists client_photos_user_country_idx
  on public.client_photos (user_id, country, created_at desc);

alter table public.client_photos enable row level security;

drop policy if exists "client_photos_select_own" on public.client_photos;
create policy "client_photos_select_own" on public.client_photos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "client_photos_insert_own" on public.client_photos;
create policy "client_photos_insert_own" on public.client_photos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and file_path like auth.uid()::text || '/%'
    and (trip_id is null or public.is_trip_client(trip_id))
  );

drop policy if exists "client_photos_update_own" on public.client_photos;
create policy "client_photos_update_own" on public.client_photos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "client_photos_delete_own" on public.client_photos;
create policy "client_photos_delete_own" on public.client_photos
  for delete to authenticated using (user_id = auth.uid());

-- 3. Tetto di sicurezza: al massimo 600 foto per persona (evita abusi e costi di archiviazione)
create or replace function public.client_photos_cap()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.client_photos where user_id = new.user_id) >= 600 then
    raise exception 'Hai raggiunto il numero massimo di foto.';
  end if;
  return new;
end;
$$;

drop trigger if exists client_photos_cap_trg on public.client_photos;
create trigger client_photos_cap_trg
  before insert on public.client_photos
  for each row execute function public.client_photos_cap();
