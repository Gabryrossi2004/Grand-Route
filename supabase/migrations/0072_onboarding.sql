-- 0072 — «Per iniziare»: la lista di benvenuto in Home (agenzie, fornitori, viaggiatori, clienti).
-- Le voci si spuntano da sole guardando cosa l'utente ha già fatto; qui si salva solo se l'ha nascosta.
-- Nessun dato nuovo oltre a un interruttore sul profilo.

alter table public.profiles add column if not exists onboarding_hidden boolean not null default false;

-- Cosa ha già fatto chi è collegato: un solo giro al database per tutte le voci. Conta fino a un massimo (non serve di più).
create or replace function public.onboarding_status()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'hidden', coalesce(p.onboarding_hidden, false),
    'logo', coalesce(nullif(p.logo_url, ''), '') <> '',
    'trips', (select count(*) from (select 1 from public.trips t where t.owner_id = auth.uid() limit 5) x),
    'published', (select count(*) from (select 1 from public.trips t where t.owner_id = auth.uid() and t.is_published limit 5) x),
    'clients', (select count(*) from (select 1 from public.clients c where c.owner_id = auth.uid() limit 5) x),
    'ai', exists (select 1 from public.ai_usage u where u.user_id = auth.uid()),
    'collabs', (select count(*) from (select 1 from public.network_collaborations c
                where auth.uid() in (c.from_user, c.to_user) and c.status in ('in_attesa', 'accettata') limit 5) x),
    'orders', (select count(*) from (select 1 from public.network_orders o
                where auth.uid() in (o.seller_id, o.buyer_id) limit 5) x),
    'showcase', coalesce((select (np.logo_path is not null and nullif(np.tagline, '') is not null)
                from public.network_profiles np where np.user_id = auth.uid()), false),
    'listed', coalesce((select np.listed from public.network_profiles np where np.user_id = auth.uid()), false),
    'agenda', exists (select 1 from public.network_calendar_events e where e.user_id = auth.uid())
              or coalesce((select pr.share_availability from public.network_prefs pr where pr.user_id = auth.uid()), false),
    'packing', exists (select 1 from public.trip_packing_items i join public.trips t on t.id = i.trip_id where t.owner_id = auth.uid()),
    'expenses', exists (select 1 from public.trip_expenses x join public.trips t on t.id = x.trip_id where t.owner_id = auth.uid()),
    'push', exists (select 1 from public.push_subscriptions s where s.profile_id = auth.uid()),
    'client_details', exists (select 1 from public.clients c
                where c.user_id = auth.uid() and c.date_of_birth is not null
                  and (nullif(c.passport_number, '') is not null or nullif(c.id_card_number, '') is not null))
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Nasconde (o riapre dal menu Account) la lista «Per iniziare»
create or replace function public.set_onboarding_hidden(p_hidden boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set onboarding_hidden = coalesce(p_hidden, false) where id = auth.uid();
$$;

revoke all on function public.onboarding_status() from public, anon;
revoke all on function public.set_onboarding_hidden(boolean) from public, anon;
grant execute on function public.onboarding_status() to authenticated;
grant execute on function public.set_onboarding_hidden(boolean) to authenticated;
