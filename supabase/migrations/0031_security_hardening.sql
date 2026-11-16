-- Migrazione: restringe alcuni permessi segnalati dal Security Advisor di
-- Supabase. Esegui questo file nell'SQL Editor DOPO aver eseguito 0030_...
--
-- 1) Il bucket pubblico "public-assets" permetteva a chiunque di ELENCARE
--    tutti i file (e quindi di scoprire cartelle e nomi). Le immagini restano
--    visibili tramite il loro indirizzo pubblico (non serve nessuna policy);
--    la lettura "via API" resta solo alla persona nella propria cartella,
--    che serve per poter eliminare i propri file.
drop policy if exists "public_assets_read_all" on storage.objects;
drop policy if exists "public_assets_read_own_folder" on storage.objects;
create policy "public_assets_read_own_folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'public-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2) Funzioni usate soltanto da un "trigger" interno: nessun utente deve
--    poterle chiamare direttamente (un trigger non richiede il permesso).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_community_group() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- 3) Funzioni chiamate solo da utenti con accesso: tolto il permesso ai
--    visitatori anonimi (gli utenti registrati restano autorizzati; in ogni
--    caso le funzioni controllano già auth.uid() al loro interno).
revoke execute on function public.claim_client_profiles() from public, anon;
revoke execute on function public.mark_current_user_as_client() from public, anon;
revoke execute on function public.update_client_travel_documents(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.redeem_community_invite(text) from public, anon;
revoke execute on function public.get_emergency_push_targets(uuid) from public, anon;
revoke execute on function public.get_community_post_push_targets(uuid) from public, anon;

-- Volutamente NON modificate:
--  * get_departure_reminder_push_targets: la chiama il cron giornaliero senza
--    utente collegato; è protetta da un segreto, non da auth.uid().
--  * is_current_user_professional / is_community_group_member: sono usate
--    dentro le regole di sicurezza (RLS), anche su "profiles" che i
--    visitatori leggono dalla pagina pubblica di un viaggio: togliere il
--    permesso agli anonimi la romperebbe.
