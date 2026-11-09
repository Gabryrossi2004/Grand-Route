-- Migrazione: preferenze di lettura dell'agenzia (dimensione e stile del
-- carattere), applicate a tutte le pagine del gestionale che l'agenzia usa
-- per lavorare (non all'itinerario mostrato al cliente, che ha già il suo
-- sistema di temi per viaggio).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0018_...

alter table public.profiles
  add column if not exists ui_font_size text not null default 'normale'
    check (ui_font_size in ('normale', 'grande', 'molto_grande')),
  add column if not exists ui_font_family text not null default 'predefinito'
    check (ui_font_family in ('predefinito', 'leggibile', 'classico'));
