-- Migrazione: il colore di default per le nuove agenzie (usato solo come
-- fallback quando non caricano un logo) diventa il navy di Grand Route
-- invece del blu generico. Non tocca le agenzie che hanno già un colore
-- impostato (anche se coincide col vecchio default): è una preferenza loro.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0012_...

alter table public.profiles alter column brand_color set default '#2b333e';
