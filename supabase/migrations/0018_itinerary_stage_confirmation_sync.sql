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
