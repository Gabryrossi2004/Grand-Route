-- Migrazione: documenti collegati a una singola attività (voucher, biglietti, ecc.)
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0004_...
-- I documenti senza attività collegata restano quelli "generali" del viaggio
-- (passaporto, visti, documenti di ingresso).

alter table public.documents
  add column if not exists activity_id uuid references public.activities (id) on delete cascade;
