-- 0058 — Viaggiatori privati: chi organizza i viaggi da solo, senza agenzia.
--
-- Il sito funziona anche prima di questo passaggio, ma la registrazione dei viaggiatori
-- (pagina «Sono un viaggiatore») si attiva solo dopo averlo eseguito.

-- 1. Un account può essere «viaggiatore» (non è un professionista e non dipende da un'agenzia)
alter table public.profiles add column if not exists is_traveler boolean not null default false;

-- 2. Alla registrazione il profilo si crea da solo; chi si registra dalla pagina dei viaggiatori
--    ha il segno «account_kind = traveler» nei dati di accesso
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_traveler boolean := coalesce(new.raw_user_meta_data ->> 'account_kind', '') = 'traveler';
begin
  insert into public.profiles (id, email, full_name, is_traveler, is_professional)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    v_traveler,
    not v_traveler
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
