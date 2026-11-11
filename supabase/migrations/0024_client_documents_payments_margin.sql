-- Migrazione: dati di viaggio compilabili dal cliente, scadenze pagamento
-- visibili al cliente, margine per servizio fornitore.
-- Esegui questo file nell'SQL Editor di Supabase DOPO aver eseguito 0023_...

-- ============================================================
-- 1. Il cliente può aggiornare i propri dati anagrafici/documenti (stessi
--    campi già raccolti dall'agenzia in 0011/0020), ma solo i propri e solo
--    quelli: una funzione dedicata invece di una policy UPDATE generica,
--    così non può toccare altri campi della scheda (es. note interne
--    dell'agenzia o il proprio owner_id).
-- ============================================================
create or replace function public.update_client_travel_documents(
  p_client_id uuid,
  p_date_of_birth text,
  p_place_of_birth text,
  p_nationality text,
  p_fiscal_code text,
  p_residence_address text,
  p_id_card_number text,
  p_id_card_expiry text,
  p_passport_number text,
  p_passport_expiry text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.clients
  set
    date_of_birth = p_date_of_birth,
    place_of_birth = p_place_of_birth,
    nationality = p_nationality,
    fiscal_code = p_fiscal_code,
    residence_address = p_residence_address,
    id_card_number = p_id_card_number,
    id_card_expiry = p_id_card_expiry,
    passport_number = p_passport_number,
    passport_expiry = p_passport_expiry
  where id = p_client_id and user_id = auth.uid();
end;
$$;

revoke all on function public.update_client_travel_documents(uuid, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.update_client_travel_documents(uuid, text, text, text, text, text, text, text, text, text) to authenticated;

-- ============================================================
-- 2. Il cliente può leggere (solo in lettura) le scadenze di incasso del
--    proprio viaggio: non i pagamenti ai fornitori, mai mostrati al cliente.
-- ============================================================
drop policy if exists "trip_payments_select_as_client" on public.trip_payments;
create policy "trip_payments_select_as_client" on public.trip_payments
  for select using (
    direction = 'incasso'
    and exists (
      select 1 from public.trips t
      join public.clients c on c.id = t.client_id
      where t.id = trip_payments.trip_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Margine per servizio: prezzo di vendita al cliente, a fianco del costo
--    netto già presente, per vedere il margine riga per riga oltre alla
--    commissione complessiva già disponibile a livello di viaggio.
-- ============================================================
alter table public.trip_services
  add column if not exists sell_price numeric(10, 2);
