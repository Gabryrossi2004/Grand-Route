-- Migrazione: forma del logo dell'agenzia (squadrato, smussato, tondo,
-- personalizzato). È solo una scelta grafica, leggibile anche dalla pagina
-- pubblica del viaggio. Esegui questo file nell'SQL Editor di Supabase.
--
-- Il sito funziona anche prima di questo passaggio: il logo resta "smussato".
alter table public.profiles
  add column if not exists logo_shape text not null default 'smussato'
  check (logo_shape in ('squadrato', 'smussato', 'tondo', 'personalizzato'));

grant select (logo_shape) on public.profiles to anon;
