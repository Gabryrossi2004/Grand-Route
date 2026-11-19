-- Scheda operativa: colonna «Stato», riconferme ai fornitori e righe importate che seguono l'itinerario.
alter table public.ops_rows add column if not exists status text not null default '';
alter table public.ops_rows drop constraint if exists ops_rows_status_check;
alter table public.ops_rows add constraint ops_rows_status_check
  check (status in ('', 'da_confermare', 'confermato', 'riconferma_inviata', 'riconfermato', 'qr_da_inviare', 'cancellato'));

-- valori presi dall'itinerario all'ultima importazione/controllo (per capire cosa è cambiato)
alter table public.ops_rows add column if not exists source jsonb;
-- modifiche arrivate dall'itinerario e non ancora viste
alter table public.ops_rows add column if not exists changes jsonb not null default '{}'::jsonb;
