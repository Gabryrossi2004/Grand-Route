-- Migrazione: regole per l'AI (per agenzia e di base della piattaforma) e
-- note dell'AI sul viaggio.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0032_...
--
-- 1) profiles.ai_rules / ai_preferences: le regole che ogni agenzia scrive per
--    sé (tono, lunghezza, cose da non scrivere mai...). Ogni agenzia modifica
--    solo le proprie (la regola di sicurezza esistente sui profili basta).
-- 2) platform_admins: elenco di chi può modificare le regole di base della
--    piattaforma. Nessuno può leggerla o modificarla dal sito: si gestisce
--    solo da qui (SQL Editor). Vedi in fondo come aggiungere il proprio utente.
-- 3) ai_platform_rules: le regole di base, modificabili dagli amministratori.
--    Se una regola non è stata personalizzata vale quella predefinita nel
--    codice, quindi la tabella può restare vuota.
-- 4) trips.ai_notes: note lasciate dall'AI dopo aver generato un itinerario
--    (dubbi, ipotesi, verifiche su distanze e tempi).

alter table public.profiles
  add column if not exists ai_rules text,
  add column if not exists ai_preferences jsonb not null default '{}'::jsonb;

alter table public.trips
  add column if not exists ai_notes text;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create table if not exists public.ai_platform_rules (
  key text primary key,
  title text not null,
  body text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ai_platform_rules enable row level security;
revoke all on public.ai_platform_rules from anon;
grant select, insert, update, delete on public.ai_platform_rules to authenticated;

drop policy if exists "ai_platform_rules_admin_all" on public.ai_platform_rules;
create policy "ai_platform_rules_admin_all" on public.ai_platform_rules
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Lettura per il sito: restituisce solo le regole attive, a qualunque utente
-- registrato (servono per costruire le istruzioni dell'AI), senza aprire la tabella.
create or replace function public.get_ai_platform_rules()
returns table (key text, title text, body text, enabled boolean, sort_order integer)
language sql
security definer
stable
set search_path = public
as $$
  select r.key, r.title, r.body, r.enabled, r.sort_order
  from public.ai_platform_rules r
  where auth.uid() is not null
  order by r.sort_order, r.key;
$$;
revoke all on function public.get_ai_platform_rules() from public, anon;
grant execute on function public.get_ai_platform_rules() to authenticated;

-- ── Per diventare amministratore (una volta sola, solo per il tuo utente) ──
-- Sostituisci l'email qui sotto con quella con cui accedi e premi Run:
--
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'LA-TUA-EMAIL'
--   on conflict do nothing;
