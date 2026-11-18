-- Migrazione: ricorda quando il viaggio è stato inviato per mail al cliente.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0041_...
--
-- Il sito funziona anche prima di questo passaggio: la mail parte lo stesso,
-- ma non compare la scritta "Inviato il ...".

alter table public.trips
  add column if not exists client_notified_at timestamptz;
