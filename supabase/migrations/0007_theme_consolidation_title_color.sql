-- Migrazione: unifica i temi "citta" ed "egizio" in "deserto" + colore
-- personalizzabile del titolo del viaggio.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0006_...

-- I viaggi che usavano i vecchi temi "citta" o "egizio" passano al nuovo
-- tema unico "deserto" (Deserto / Arabeggiante).
update public.trips set theme = 'deserto' where theme in ('citta', 'egizio');

alter table public.trips drop constraint if exists trips_theme_check;
alter table public.trips add constraint trips_theme_check check (
  theme in (
    'elegante', 'azteco', 'giungla', 'deserto',
    'nordico', 'marocco', 'giapponese', 'tropicale'
  )
);

-- Colore del testo del titolo nell'header (sopra l'immagine di copertina):
-- vuoto = bianco (comportamento di prima), altrimenti un colore scelto
-- dall'utente per restare leggibile sulla propria foto di copertina.
alter table public.trips
  add column if not exists title_color text;
