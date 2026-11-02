-- Migrazione: modalità prezzo del viaggio
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0003_...

alter table public.trips
  add column if not exists price_mode text not null default 'nessuno'
    check (price_mode in ('nessuno', 'lordo', 'commissioni'));

-- Usato quando price_mode = 'lordo': il prezzo totale mostrato al cliente.
alter table public.trips
  add column if not exists price_amount numeric(10, 2);

-- Usati quando price_mode = 'commissioni': costo netto + commissione.
-- Il totale mostrato al cliente è la somma dei due, calcolata al volo.
alter table public.trips
  add column if not exists price_net numeric(10, 2);

alter table public.trips
  add column if not exists price_commission numeric(10, 2);
