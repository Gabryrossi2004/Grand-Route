-- Migrazione: contatore d'uso delle funzioni AI, per limitare i costi.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0029_...
--
-- Ogni volta che un utente usa una funzione AI (genera itinerario, leggi
-- listino, leggi richiesta cliente) il sito scrive qui una riga. Prima di
-- ogni nuova chiamata il sito conta le righe delle ultime ore e rifiuta se il
-- limite è superato (vedi src/lib/aiQuota.ts). Così un uso eccessivo, o un
-- abuso, non può far salire la bolletta senza controllo.
--
-- Ogni utente può leggere e aggiungere solo le proprie righe e NON può
-- modificarle né cancellarle (nessuna policy di update/delete).
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage
  for insert to authenticated
  with check (user_id = (select auth.uid()));
