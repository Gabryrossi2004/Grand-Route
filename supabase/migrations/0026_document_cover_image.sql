-- Migrazione: foto di copertina opzionale per i documenti del viaggio.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0025_...

alter table public.documents
  add column if not exists cover_image_path text;
