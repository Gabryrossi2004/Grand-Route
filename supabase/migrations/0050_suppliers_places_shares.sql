-- 0050 — Fornitori collegati ai paesi e alle regioni italiane + link pubblico della scheda paese.
--
-- Il sito funziona anche prima di questo passaggio: senza queste colonne la rubrica fornitori
-- resta com'è e il pulsante «Condividi» avvisa che serve l'aggiornamento.

-- 1. Paesi (codici a due lettere) e regioni italiane in cui lavora ogni fornitore
alter table public.suppliers
  add column if not exists countries text[] not null default '{}',
  add column if not exists regions text[] not null default '{}';

create index if not exists suppliers_countries_idx on public.suppliers using gin (countries);

-- 2. Link pubblici delle schede paese da mandare ai clienti (si possono revocare)
create table if not exists public.sheet_shares (
  token text primary key check (char_length(token) between 16 and 64),
  owner_id uuid not null references auth.users (id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  unique (owner_id, country_code)
);
alter table public.sheet_shares enable row level security;
drop policy if exists "sheet_shares_all_own" on public.sheet_shares;
create policy "sheet_shares_all_own" on public.sheet_shares
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 3. Lettura pubblica tramite il token: restituisce solo ciò che serve alla pagina del cliente
--    (nome e logo dell'agenzia, scheda personalizzata se c'è). Niente email, telefoni o dati interni.
create or replace function public.get_shared_sheet(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share public.sheet_shares%rowtype;
  v_sheet record;
  v_profile record;
begin
  select * into v_share from public.sheet_shares where token = p_token;
  if not found then
    return null;
  end if;
  select agency_name, logo_url, to_jsonb(p) ->> 'brand_color' as brand_color
    into v_profile from public.profiles p where p.id = v_share.owner_id;
  select content, photos, updated_at into v_sheet
    from public.country_sheets
    where owner_id = v_share.owner_id and country_code = v_share.country_code;
  return jsonb_build_object(
    'country_code', v_share.country_code,
    'owner_id', v_share.owner_id,
    'agency_name', v_profile.agency_name,
    'logo_url', v_profile.logo_url,
    'brand_color', v_profile.brand_color,
    'content', v_sheet.content,
    'photos', v_sheet.photos,
    'updated_at', v_sheet.updated_at
  );
end;
$$;
revoke all on function public.get_shared_sheet(text) from public;
grant execute on function public.get_shared_sheet(text) to anon, authenticated;
