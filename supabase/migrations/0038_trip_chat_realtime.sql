-- Migrazione: chat in tempo reale. I messaggi di un viaggio arrivano subito
-- all'altra parte, senza dover ricaricare la pagina.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0037_...
--
-- Il sito funziona anche prima di questo passaggio: i messaggi arrivano
-- comunque, ma con qualche secondo di ritardo.
do $$
begin
  alter publication supabase_realtime add table public.trip_messages;
exception
  when duplicate_object then null;  -- già attivo
  when undefined_object then null;  -- publication non presente
end $$;
