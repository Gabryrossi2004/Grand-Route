-- Migrazione: prepara le colonne dei dati anagrafici/documenti del cliente a
-- contenere valori cifrati (vedi src/lib/encryption.ts). Le date erano
-- colonne "date": diventano "text" perché un valore cifrato è una stringa,
-- non una data valida per Postgres. I valori esistenti vengono convertiti
-- al loro formato testuale (es. 1990-05-20), restando leggibili finché non
-- vengono risalvati dall'agenzia, a quel punto verranno cifrati.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0019_...

alter table public.clients
  alter column date_of_birth type text using date_of_birth::text,
  alter column id_card_expiry type text using id_card_expiry::text,
  alter column passport_expiry type text using passport_expiry::text;
