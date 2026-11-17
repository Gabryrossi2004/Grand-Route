-- Migrazione: documenti di viaggio visibili al cliente (voucher, biglietti...).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0038_...
--
-- L'agenzia sceglie, documento per documento, cosa mostrare al cliente:
-- all'inizio nessun documento è visibile. Il cliente vede solo i documenti
-- segnati come visibili e solo dei propri viaggi.
--
-- Il sito funziona anche prima di questo passaggio: il cliente semplicemente
-- non vede documenti.
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
