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
