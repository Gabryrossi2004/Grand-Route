-- 0049 — L'archivio di Zefiro: domande frequenti dell'agenzia, memoria delle risposte già date
-- e contatore delle risposte gratuite (date senza AI).
--
-- Il sito funziona anche prima di questo passaggio: senza queste tabelle Zefiro risponde
-- comunque gratis dal viaggio e dalle schede paese, e passa all'AI per il resto.

-- 1. Domande frequenti scritte dall'agenzia (orari, assicurazione, bagagli, penali…)
create table if not exists public.agency_faqs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 300),
  answer text not null check (char_length(answer) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agency_faqs_owner_idx on public.agency_faqs (owner_id);
alter table public.agency_faqs enable row level security;
drop policy if exists "agency_faqs_all_own" on public.agency_faqs;
create policy "agency_faqs_all_own" on public.agency_faqs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- 2. Memoria: risposte generali già date dall'AI (non legate al singolo cliente), riusate per
--    domande simili sugli stessi paesi. L'agenzia le può correggere o eliminare.
create table if not exists public.zefiro_memory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  countries text[] not null default '{}',
  question text not null check (char_length(question) between 3 and 500),
  answer text not null check (char_length(answer) between 1 and 4000),
  uses integer not null default 0,
  edited boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists zefiro_memory_owner_idx on public.zefiro_memory (owner_id, created_at desc);
alter table public.zefiro_memory enable row level security;
drop policy if exists "zefiro_memory_select_own" on public.zefiro_memory;
create policy "zefiro_memory_select_own" on public.zefiro_memory
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "zefiro_memory_update_own" on public.zefiro_memory;
create policy "zefiro_memory_update_own" on public.zefiro_memory
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "zefiro_memory_delete_own" on public.zefiro_memory;
create policy "zefiro_memory_delete_own" on public.zefiro_memory
  for delete to authenticated using (owner_id = (select auth.uid()));

-- 3. Per il cliente: domande frequenti e memoria dell'agenzia del suo viaggio
create or replace function public.client_zefiro_knowledge(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_countries text[];
begin
  if not public.is_trip_client(p_trip_id) then
    return '{}'::jsonb;
  end if;
  select t.owner_id, coalesce(t.countries, '{}') || coalesce(t.auto_countries, '{}')
    into v_owner, v_countries
    from public.trips t where t.id = p_trip_id;
  return jsonb_build_object(
    'faqs', coalesce((
      select jsonb_agg(jsonb_build_object('question', f.question, 'answer', f.answer))
      from (select question, answer from public.agency_faqs where owner_id = v_owner order by created_at limit 200) f
    ), '[]'::jsonb),
    'memory', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'question', m.question, 'answer', m.answer))
      from (
        select id, question, answer from public.zefiro_memory
        where owner_id = v_owner and (countries && v_countries or cardinality(countries) = 0)
        order by uses desc, created_at desc limit 300
      ) m
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.client_zefiro_knowledge(uuid) from public, anon;
grant execute on function public.client_zefiro_knowledge(uuid) to authenticated;

-- 4. Conta una risposta gratuita (fonte: viaggio, paese, faq, memoria) senza toccare limiti e budget
create or replace function public.client_zefiro_free(p_trip_id uuid, p_source text, p_memory_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if not public.is_trip_client(p_trip_id) then
    return;
  end if;
  if p_source not in ('viaggio', 'paese', 'faq', 'memoria') then
    return;
  end if;
  select owner_id into v_owner from public.trips where id = p_trip_id;
  insert into public.ai_usage (user_id, kind, client_user_id) values (v_owner, 'free:' || p_source, auth.uid());
  if p_memory_id is not null then
    update public.zefiro_memory set uses = uses + 1 where id = p_memory_id and owner_id = v_owner;
  end if;
end;
$$;
revoke all on function public.client_zefiro_free(uuid, text, uuid) from public, anon;
grant execute on function public.client_zefiro_free(uuid, text, uuid) to authenticated;

-- 5. Salva in memoria una risposta generale data dall'AI. Solo per una domanda vera di questo
--    cliente (la prenotazione appena fatta, entro 15 minuti) e una sola volta per domanda.
create or replace function public.client_zefiro_remember(p_trip_id uuid, p_call_id uuid, p_question text, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_countries text[];
begin
  if not public.is_trip_client(p_trip_id) then
    return;
  end if;
  select t.owner_id, coalesce(t.countries, '{}') || coalesce(t.auto_countries, '{}')
    into v_owner, v_countries
    from public.trips t where t.id = p_trip_id;
  if not exists (
    select 1 from public.ai_usage u
    where u.id = p_call_id and u.user_id = v_owner and u.kind = 'client:zefiro'
      and u.client_user_id = auth.uid() and u.created_at > now() - interval '15 minutes'
  ) then
    return;
  end if;
  if exists (select 1 from public.zefiro_memory m where m.owner_id = v_owner and lower(m.question) = lower(left(p_question, 500)))
     or (select count(*) from public.zefiro_memory m where m.owner_id = v_owner) >= 2000 then
    return;
  end if;
  insert into public.zefiro_memory (owner_id, countries, question, answer)
  values (v_owner, v_countries, left(p_question, 500), left(p_answer, 4000));
end;
$$;
revoke all on function public.client_zefiro_remember(uuid, uuid, text, text) from public, anon;
grant execute on function public.client_zefiro_remember(uuid, uuid, text, text) to authenticated;
