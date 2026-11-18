-- Migrazione: modalità dell'itinerario. "activities" (default) = una scheda per ogni
-- attività; "days" = ogni giorno è un unico blocco di testo con tutte le attività elencate.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0042_...
--
-- Il sito funziona anche prima di questo passaggio: restano disponibili solo gli itinerari
-- per attività (la scelta «giornata intera» non viene salvata).

alter table public.trips
  add column if not exists itinerary_mode text not null default 'activities'
    check (itinerary_mode in ('activities', 'days'));
