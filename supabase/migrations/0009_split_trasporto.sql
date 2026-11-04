-- Migrazione: divide il tipo generico "trasporto" in quattro tipi più
-- specifici (transfer, treno, traghetto, crociera).
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0008_...

-- 1) Allarga temporaneamente il vincolo sui tipi ammessi, includendo sia il
-- vecchio "trasporto" sia i quattro nuovi tipi: serve perché le UPDATE qui
-- sotto scrivono i nuovi valori, e senza questo passaggio il database li
-- rifiuterebbe (il vincolo attuale conosce ancora solo "trasporto").
alter table public.activities drop constraint if exists activities_activity_type_check;
alter table public.activities add constraint activities_activity_type_check check (
  activity_type in (
    'volo', 'alloggio', 'trasporto', 'transfer', 'treno', 'traghetto', 'crociera',
    'ristorante', 'attivita', 'info', 'altro'
  )
);

alter table public.activity_templates drop constraint if exists activity_templates_activity_type_check;
alter table public.activity_templates add constraint activity_templates_activity_type_check check (
  activity_type in (
    'volo', 'alloggio', 'trasporto', 'transfer', 'treno', 'traghetto', 'crociera',
    'ristorante', 'attivita', 'info', 'altro'
  )
);

-- 2) Riassegna le attività e i modelli di libreria esistenti al nuovo tipo
-- più adatto, in base al vecchio campo "mezzo" salvato nei dettagli.
-- "crociera" non esisteva come opzione di "mezzo", quindi non viene mai
-- assegnata automaticamente: resta disponibile solo per le nuove attività.
update public.activities
set activity_type = case
  when details->>'mezzo' = 'Treno' then 'treno'
  when details->>'mezzo' = 'Traghetto' then 'traghetto'
  else 'transfer'
end
where activity_type = 'trasporto';

update public.activity_templates
set activity_type = case
  when details->>'mezzo' = 'Treno' then 'treno'
  when details->>'mezzo' = 'Traghetto' then 'traghetto'
  else 'transfer'
end
where activity_type = 'trasporto';

-- 3) Rinomina i campi "numero" e "luogo_arrivo" nei dettagli con le nuove
-- chiavi specifiche del tipo assegnato, e rimuove il vecchio campo "mezzo"
-- (non più necessario: il tipo stesso lo indica già).
update public.activities
set details = (details - 'mezzo' - 'numero' - 'luogo_arrivo')
  || case when details ? 'numero' then
       jsonb_build_object(
         case activity_type when 'treno' then 'numero_treno' else 'numero_corsa' end,
         details->>'numero'
       )
     else '{}'::jsonb end
  || case when details ? 'luogo_arrivo' then
       jsonb_build_object(
         case activity_type
           when 'treno' then 'stazione_arrivo'
           when 'traghetto' then 'porto_arrivo'
           else 'luogo_arrivo'
         end,
         details->>'luogo_arrivo'
       )
     else '{}'::jsonb end
where activity_type in ('transfer', 'treno', 'traghetto');

update public.activity_templates
set details = (details - 'mezzo' - 'numero' - 'luogo_arrivo')
  || case when details ? 'numero' then
       jsonb_build_object(
         case activity_type when 'treno' then 'numero_treno' else 'numero_corsa' end,
         details->>'numero'
       )
     else '{}'::jsonb end
  || case when details ? 'luogo_arrivo' then
       jsonb_build_object(
         case activity_type
           when 'treno' then 'stazione_arrivo'
           when 'traghetto' then 'porto_arrivo'
           else 'luogo_arrivo'
         end,
         details->>'luogo_arrivo'
       )
     else '{}'::jsonb end
where activity_type in ('transfer', 'treno', 'traghetto');

-- 4) Ora che nessuna riga usa più "trasporto", restringe il vincolo alla
-- lista finale (senza "trasporto").
alter table public.activities drop constraint if exists activities_activity_type_check;
alter table public.activities add constraint activities_activity_type_check check (
  activity_type in (
    'volo', 'alloggio', 'transfer', 'treno', 'traghetto', 'crociera',
    'ristorante', 'attivita', 'info', 'altro'
  )
);

alter table public.activity_templates drop constraint if exists activity_templates_activity_type_check;
alter table public.activity_templates add constraint activity_templates_activity_type_check check (
  activity_type in (
    'volo', 'alloggio', 'transfer', 'treno', 'traghetto', 'crociera',
    'ristorante', 'attivita', 'info', 'altro'
  )
);
