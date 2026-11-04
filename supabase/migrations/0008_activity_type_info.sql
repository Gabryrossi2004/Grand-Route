-- Migrazione: aggiunge il nuovo tipo di attività "Info" (blocco informativo
-- libero, senza campi specifici, utile per testo generico con tabelle e link).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0007_...

alter table public.activities drop constraint if exists activities_activity_type_check;
alter table public.activities add constraint activities_activity_type_check check (
  activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'info', 'altro')
);

alter table public.activity_templates drop constraint if exists activity_templates_activity_type_check;
alter table public.activity_templates add constraint activity_templates_activity_type_check check (
  activity_type in ('volo', 'alloggio', 'trasporto', 'ristorante', 'attivita', 'info', 'altro')
);
