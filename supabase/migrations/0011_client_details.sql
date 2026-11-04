-- Migrazione: dati anagrafici e documenti del cliente (tutti opzionali).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0010_...

alter table public.clients
  add column if not exists date_of_birth date,
  add column if not exists place_of_birth text,
  add column if not exists nationality text,
  add column if not exists fiscal_code text,
  add column if not exists residence_address text,
  add column if not exists id_card_number text,
  add column if not exists id_card_expiry date,
  add column if not exists passport_number text,
  add column if not exists passport_expiry date;
