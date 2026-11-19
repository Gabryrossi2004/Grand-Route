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
