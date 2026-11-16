-- Migrazione: il colore del brand dell'agenzia deve essere leggibile anche da
-- chi apre la pagina pubblica di un viaggio (senza login), per colorare
-- l'intestazione. È solo un codice colore, non un dato personale.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0031_...
--
-- Il sito funziona anche prima di questo passaggio (il colore semplicemente
-- non compare nella pagina pubblica).
grant select (brand_color) on public.profiles to anon;
