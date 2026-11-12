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
