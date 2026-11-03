-- Migrazione: tema grafico del viaggio + titolo personalizzato per ogni giorno
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0005_...

alter table public.trip_days
  add column if not exists title text;

alter table public.trips
  add column if not exists theme text not null default 'elegante';

alter table public.trips drop constraint if exists trips_theme_check;
alter table public.trips add constraint trips_theme_check check (
  theme in (
    'elegante', 'azteco', 'giungla', 'deserto', 'egizio',
    'nordico', 'citta', 'marocco', 'giapponese', 'tropicale'
  )
);
