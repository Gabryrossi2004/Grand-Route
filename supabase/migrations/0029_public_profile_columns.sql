-- Migrazione: limita ciò che un visitatore non registrato può leggere
-- del profilo di un'agenzia.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0028_...
--
-- La pagina pubblica di un viaggio (/t/<slug>) e il riepilogo stampabile
-- mostrano nome, logo e condizioni dell'agenzia: per farlo, la policy
-- "profiles_select_published_owner" (migrazione 0001) permette a chiunque
-- di leggere il profilo di un'agenzia che ha almeno un viaggio pubblicato.
-- Quella regola però vale sulla RIGA intera, quindi dava accesso anche a
-- email, telefono di emergenza e preferenze di notifica.
--
-- Qui restringiamo il ruolo "anon" (il visitatore senza login) alle sole
-- colonne che servono davvero a quelle due pagine. Gli utenti registrati
-- continuano a leggere il proprio profilo per intero, come prima.
--
-- Se in futuro una pagina pubblica dovesse mostrare un altro campo del
-- profilo, la query fallirà con un errore chiaro di permessi: basterà
-- aggiungere quella colonna alla grant qui sotto.
revoke select on public.profiles from anon;
grant select (id, agency_name, logo_url, terms_and_conditions) on public.profiles to anon;
