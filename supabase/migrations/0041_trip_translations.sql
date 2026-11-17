-- Migrazione: traduzioni automatiche dell'itinerario (per i clienti che
-- scelgono il sito in inglese). La traduzione si fa una sola volta e viene
-- conservata qui; si rifà solo se l'agenzia modifica l'itinerario.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0040_...
--
-- Il sito funziona anche prima di questo passaggio: l'itinerario resta in italiano.

create table if not exists public.trip_translations (
  trip_id uuid not null references public.trips (id) on delete cascade,
  lang text not null check (lang in ('en')),
  source_hash text not null,
  items jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, lang)
);

-- Nessuna policy: si legge e si scrive solo con le due funzioni qui sotto.
alter table public.trip_translations enable row level security;

-- Legge la traduzione: l'agenzia del viaggio, il cliente collegato, oppure
-- chiunque se il viaggio è pubblicato (pagina pubblica).
create or replace function public.get_trip_translation(p_trip_id uuid, p_lang text)
returns table(source_hash text, items jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_trip_agency(p_trip_id)
     or public.is_trip_client(p_trip_id)
     or exists (select 1 from public.trips t where t.id = p_trip_id and t.is_published) then
    return query
      select tt.source_hash, tt.items from public.trip_translations tt
      where tt.trip_id = p_trip_id and tt.lang = p_lang;
  end if;
end;
$$;

-- Salva la traduzione: solo l'agenzia del viaggio o il cliente collegato.
create or replace function public.save_trip_translation(
  p_trip_id uuid, p_lang text, p_hash text, p_items jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_trip_agency(p_trip_id) or public.is_trip_client(p_trip_id)) then
    raise exception 'non autorizzato';
  end if;
  if jsonb_typeof(p_items) <> 'array' or pg_column_size(p_items) > 400000 then
    raise exception 'dati non validi';
  end if;
  insert into public.trip_translations (trip_id, lang, source_hash, items, updated_at)
  values (p_trip_id, p_lang, p_hash, p_items, now())
  on conflict (trip_id, lang) do update
    set source_hash = excluded.source_hash, items = excluded.items, updated_at = now();
end;
$$;

revoke all on function public.get_trip_translation(uuid, text) from public;
revoke all on function public.save_trip_translation(uuid, text, text, jsonb) from public, anon;
grant execute on function public.get_trip_translation(uuid, text) to anon, authenticated;
grant execute on function public.save_trip_translation(uuid, text, text, jsonb) to authenticated;
