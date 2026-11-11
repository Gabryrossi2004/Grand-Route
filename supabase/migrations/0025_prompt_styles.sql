-- Migrazione: stili di prompt riutilizzabili per la generazione itinerario
-- con l'AI (sezione "Stili" nella Libreria, accanto ai "Blocchi").
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0024_...

create table if not exists public.prompt_styles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  prompt_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists prompt_styles_owner_id_idx on public.prompt_styles (owner_id);

alter table public.prompt_styles enable row level security;

drop policy if exists "prompt_styles_all_own" on public.prompt_styles;
create policy "prompt_styles_all_own" on public.prompt_styles
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
