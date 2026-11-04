-- Migrazione: rende più robusto il collegamento automatico cliente<->account.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0013_...
--
-- Problema: se sotto la stessa agenzia esistono due schede cliente con la
-- stessa email (es. creata due volte per errore) ed entrambe non ancora
-- collegate, il vecchio claim_client_profiles() provava a collegarle
-- entrambe allo stesso account nella stessa UPDATE. L'indice unico
-- "clients_owner_user_unique" (un account non può essere collegato due
-- volte alla stessa agenzia) blocca questo, e l'intera UPDATE falliva: il
-- cliente restava non collegato, senza nessun errore visibile, e i suoi
-- viaggi non comparivano mai nell'area clienti.
--
-- Questa versione collega le schede una per una, e se una scheda non può
-- essere collegata (perché un'altra scheda della stessa agenzia è già
-- collegata a questo account) la salta, senza bloccare le altre.
create or replace function public.claim_client_profiles()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select id from public.clients
    where user_id is null
      and email is not null
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  loop
    begin
      update public.clients set user_id = auth.uid() where id = rec.id;
    exception when unique_violation then
      continue;
    end;
  end loop;
end;
$$;
