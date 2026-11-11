-- Corregge un bug: claim_client_profiles() (chiamata ad ogni login
-- dell'area clienti, non solo alla registrazione) marcava chiunque
-- effettuasse il login da /client/login come "non professionista" — anche
-- un'agenzia che prova per sbaglio ad accedere con la propria email dal
-- posto sbagliato, perdendo così l'accesso alla community.
-- Da ora: il collegamento automatico delle schede cliente resta ad ogni
-- login (comportamento originale), ma il flag is_professional si imposta
-- SOLO in fase di registrazione di un nuovo cliente.

create or replace function public.claim_client_profiles()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
  set user_id = auth.uid()
  where user_id is null
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
end;
$$;

create or replace function public.mark_current_user_as_client()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_professional = false
  where id = auth.uid();
end;
$$;

revoke all on function public.mark_current_user_as_client() from public;
grant execute on function public.mark_current_user_as_client() to authenticated;
