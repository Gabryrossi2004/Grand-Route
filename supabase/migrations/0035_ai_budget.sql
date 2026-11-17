-- Migrazione: contatore dei costi di Zefiro e pacchetto giornaliero.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0034_...
--
-- Per ogni uso di Zefiro il sito salva anche i token consumati e il costo in
-- euro, così ogni agenzia vede quanto ha usato oggi e nel mese, e il sito può
-- fermare Zefiro quando il budget giornaliero del suo pacchetto è finito.
-- Il pacchetto (start = 2 €/giorno, plus = 5 €/giorno, pro = 10 €/giorno) si
-- sceglie nelle Impostazioni.
--
-- Il sito funziona anche prima di questo passaggio: il contatore dei costi
-- resta semplicemente a zero.
alter table public.ai_usage
  add column if not exists input_tokens integer not null default 0 check (input_tokens >= 0),
  add column if not exists output_tokens integer not null default 0 check (output_tokens >= 0),
  add column if not exists cost_eur numeric(10, 5) not null default 0 check (cost_eur >= 0);

alter table public.profiles
  add column if not exists ai_plan text not null default 'start'
  check (ai_plan in ('start', 'plus', 'pro'));
