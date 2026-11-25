-- 0063 — Profili di prova (fantoccio) per vedere come sarà il sito pieno, e rimozione con un clic.
-- Tutti gli account di prova hanno un'email che finisce con @demo.grandroute.invalid (non esiste, non si può accedere):
-- si creano e si tolgono dalla pagina Amministrazione. Togliere un account cancella anche profilo, valutazioni e messaggi.
-- Serve aver eseguito prima 0061 (Rete) e 0062 (amministrazione).

create or replace function public.admin_demo_count()
returns int
language sql
security definer
set search_path = public, auth
stable
as $$
  select case when public.is_platform_admin()
    then (select count(*)::int from auth.users where email like '%@demo.grandroute.invalid')
    else 0 end;
$$;

create or replace function public.admin_demo_remove()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n int;
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  delete from auth.users where email like '%@demo.grandroute.invalid';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.admin_demo_create()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r record;
  v_id uuid;
  i int := 0;
  v_admin uuid := auth.uid();
begin
  if not public.is_platform_admin() then raise exception 'Non hai i permessi.'; end if;
  -- si riparte da zero, così non si creano doppioni
  delete from auth.users where email like '%@demo.grandroute.invalid';

  for r in
    select * from (values
      ('guida-roma', 'guida', 'Marta Ferri – Roma antica e Vaticano', 'Libero professionista', 'IT', 'Roma', 'RM', '00184', 'Via dei Fori Imperiali 10', '+39 06 0000 0001',
       'Guida abilitata a Roma da dodici anni. Visite private al Colosseo, ai Musei Vaticani e ai quartieri meno battuti, per piccoli gruppi e famiglie. Mi occupo anche di gruppi di agenzia con auricolari e tempi precisi.',
       array['IT'], array['Italiano','Inglese','Francese'], array['Arte e storia','Archeologia','Famiglie e bambini'],
       '{"license_country":"Italia","license_body":"Regione Lazio","license_number":"DEMO-0001","group_max":"25"}'::jsonb),
      ('guida-marrakech', 'guida', 'Youssef Amrani – Guide in Marocco', 'Libero professionista', 'MA', 'Marrakech', null, '40000', 'Derb Sidi Ahmed 4', '+212 600 000 002',
       'Guida ufficiale tra Marrakech, il Sahara e l''Atlante. Accompagno viaggiatori italiani e francesi tra souk, cucina e trekking. Organizzo anche notti nel deserto con partner di fiducia.',
       array['MA'], array['Francese','Arabo','Inglese','Italiano'], array['Gastronomia','Natura e trekking','Avventura'],
       '{"license_country":"Marocco","license_body":"Ministero del Turismo","license_number":"DEMO-0002"}'::jsonb),
      ('guida-kyoto', 'guida', 'Hana Sato – Kyoto a piedi', 'Libero professionista', 'JP', 'Kyoto', null, '604-8001', 'Nakagyo-ku 12', '+81 75 000 0003',
       'Guida a Kyoto e Nara: templi, giardini, cerimonia del tè e cucina di quartiere. Parlo italiano dopo anni a Milano. Posso preparare giornate su misura per voli con arrivo al mattino.',
       array['JP'], array['Giapponese','Inglese','Italiano'], array['Arte e storia','Religioni e spiritualità','Gastronomia'],
       '{"license_country":"Giappone","license_body":"JNTO","license_number":"DEMO-0003"}'::jsonb),
      ('autista-sicilia', 'autista', 'Salvo Transfer Sicilia', 'Ditta individuale', 'IT', 'Catania', 'CT', '95121', 'Via Etnea 100', '+39 095 000 0004',
       'Noleggio con conducente da Catania e Palermo. Transfer aeroportuali, giri di più giorni tra Etna, Siracusa e Taormina. Van e berline, bambini con seggiolino su richiesta.',
       array['IT'], array['Italiano','Inglese'], array['Aeroporto','Famiglie','Tour di più giorni'],
       '{"auth_type":"Noleggio con conducente (NCC)","auth_body":"Comune di Catania","auth_number":"DEMO-0004","vehicle_types":["Van","Berlina di lusso"],"max_seats":"8","vehicles_count":"3"}'::jsonb),
      ('autista-cairo', 'autista', 'Nile Drivers Cairo', 'Società a responsabilità limitata', 'EG', 'Cairo', null, '11511', 'Zamalek 8', '+20 2 0000 0005',
       'Autisti e mezzi per agenzie italiane in Egitto: aeroporto, Giza, Luxor e Assuan. Minibus con aria condizionata, autisti che parlano italiano e inglese, assistenza telefonica 24 ore.',
       array['EG'], array['Arabo','Inglese','Italiano'], array['Aeroporto','Gruppi'],
       '{"auth_type":"Autobus / granturismo","auth_body":"Ministero dei Trasporti","auth_number":"DEMO-0005","vehicle_types":["Minibus","Bus"],"max_seats":"45","vehicles_count":"12"}'::jsonb),
      ('struttura-puglia', 'struttura', 'Masseria Quattro Venti', 'Società a responsabilità limitata', 'IT', 'Ostuni', 'BR', '72017', 'Contrada Ulivi 3', '+39 0831 000006',
       'Masseria del Settecento tra gli ulivi, a dieci minuti da Ostuni. Quattordici camere, piscina, cucina con prodotti dell''orto. Ottima per gruppi piccoli, matrimoni e viaggi di nozze.',
       array['IT'], array['Italiano','Inglese','Tedesco'], array['Charme','Natura','Benessere'],
       '{"structure_type":"Agriturismo","structure_location":"Ostuni, Italia","structure_code":"DEMO-0006","category":"4 stelle","rooms":"14"}'::jsonb),
      ('struttura-bali', 'struttura', 'Villa Frangipani Ubud', 'Altro', 'ID', 'Ubud', null, '80571', 'Jalan Raya 22', '+62 361 0000 07',
       'Boutique villa tra le risaie di Ubud con otto suite e cucina balinese. Colazione in giardino, lezioni di yoga, transfer dall''aeroporto. Tariffe dedicate alle agenzie.',
       array['ID'], array['Inglese','Italiano'], array['Charme','Benessere','Natura'],
       '{"structure_type":"Resort","structure_location":"Ubud, Indonesia","structure_code":"DEMO-0007","category":"Boutique","rooms":"8"}'::jsonb),
      ('esperienze-toscana', 'esperienze', 'Cucinare in Toscana', 'Società a responsabilità limitata', 'IT', 'Firenze', 'FI', '50125', 'Via dei Serragli 5', '+39 055 000 0008',
       'Corsi di cucina e degustazioni in casale vicino a Firenze: pasta fresca, vino e olio. Gruppi da 4 a 14 persone, mezza giornata o giornata intera, anche con visita al mercato.',
       array['IT'], array['Italiano','Inglese','Spagnolo'], array['Gastronomia','Famiglie','Gruppi'],
       '{"activity_type":"Cucina e degustazioni","group_max":"14","duration":"Mezza giornata"}'::jsonb),
      ('esperienze-kenya', 'esperienze', 'Mara Safari Experience', 'Società a responsabilità limitata', 'KE', 'Nairobi', null, '00100', 'Karen Road 15', '+254 20 000 0009',
       'Safari privati e in piccoli gruppi nel Masai Mara e ad Amboseli. Guide naturalistiche, jeep scoperte, campi tendati. Per chi vuole la Grande Migrazione senza folla.',
       array['KE','TZ'], array['Inglese','Italiano','Francese'], array['Natura','Famiglie','Privato'],
       '{"activity_type":"Safari e natura","group_max":"6","duration":"3-7 giorni"}'::jsonb),
      ('dmc-peru', 'dmc', 'Andes Local Partners', 'Società a responsabilità limitata', 'PE', 'Cusco', null, '08000', 'Calle Plateros 20', '+51 84 000 010',
       'Agenzia locale a Cusco: Machu Picchu, Valle Sacra, Lago Titicaca e Amazzonia. Servizi a terra per agenzie e tour operator italiani, con assistenza in italiano e inglese.',
       array['PE','BO'], array['Spagnolo','Inglese','Italiano'], array['Su misura','Natura e avventura','Culturali'],
       '{"license_number":"DEMO-0010","license_body":"MINCETUR","years_active":"11"}'::jsonb),
      ('dmc-vietnam', 'dmc', 'Indochina Travel Partners', 'Società a responsabilità limitata', 'VN', 'Hanoi', null, '100000', 'Hang Bac 30', '+84 24 0000 011',
       'Agenzia locale per Vietnam, Cambogia e Laos. Itinerari su misura, gruppi, viaggi di nozze e crociere nella baia di Halong. Contratti e prezzi netti per le agenzie.',
       array['VN','KH','LA'], array['Inglese','Francese','Italiano'], array['Su misura','Gruppi','Culturali'],
       '{"license_number":"DEMO-0011","license_body":"Ministero del Turismo","years_active":"9"}'::jsonb),
      ('to-orizzonti', 'tour_operator', 'Orizzonti Tour Operator', 'Società per azioni', 'IT', 'Milano', 'MI', '20121', 'Via Montenapoleone 1', '+39 02 0000 0012',
       'Tour operator con pacchetti di gruppo e su misura per Asia, Africa e Americhe. Partenze garantite, accompagnatore dall''Italia, commissioni chiare per le agenzie.',
       array['IT','JP','IN','KE','PE'], array['Italiano','Inglese'], array['Tour di gruppo','Avventura','Culturali'],
       '{"auth_body":"Regione Lombardia","auth_number":"DEMO-0012","association":"Astoi"}'::jsonb),
      ('to-meridiana', 'tour_operator', 'Meridiana Viaggi di Lusso', 'Società a responsabilità limitata', 'IT', 'Roma', 'RM', '00187', 'Via Veneto 30', '+39 06 0000 0013',
       'Viaggi di lusso e viaggi di nozze: Maldive, Polinesia, Africa australe e grandi tour privati. Un unico referente per l''agenzia, preventivi in 24 ore.',
       array['IT','MV','ZA','PF'], array['Italiano','Inglese','Francese'], array['Lusso','Viaggi su misura','Mare'],
       '{"auth_body":"Regione Lazio","auth_number":"DEMO-0013"}'::jsonb),
      ('agenzia-bussola', 'agenzia', 'Bussola d''Oro Viaggi', 'Società a responsabilità limitata', 'IT', 'Torino', 'TO', '10121', 'Via Roma 50', '+39 011 000 0014',
       'Agenzia di viaggi a Torino dal 1998: viaggi di nozze, gruppi e viaggi culturali. Cerchiamo guide e agenzie locali affidabili per Giappone, Marocco e Perù.',
       array['IT'], array['Italiano','Inglese'], array['Viaggi di nozze','Viaggi culturali','Gruppi'],
       '{"auth_body":"Regione Piemonte","auth_number":"DEMO-0014"}'::jsonb)
    ) as t(slug, kind, business_name, legal_form, country, city, province, postal_code, address, phone, description, countries_served, languages, specialties, kind_data)
  loop
    i := i + 1;
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'demo-' || r.slug || '@demo.grandroute.invalid', '', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('business_kind', r.kind, 'full_name', r.business_name),
      now() - (i || ' days')::interval, now(),
      '', '', '', ''
    );
    -- il profilo lo crea il trigger di registrazione: lo completiamo
    update public.profiles set agency_name = r.business_name, is_professional = true, is_traveler = false, business_kind = r.kind where id = v_id;
    insert into public.network_profiles (
      user_id, kind, business_name, legal_form, country, vat_number, address, postal_code, city, province, phone,
      description, countries_served, languages, specialties, kind_data, status, verified_at, listed
    ) values (
      v_id, r.kind, r.business_name, r.legal_form, r.country, 'DEMO' || lpad(i::text, 7, '0'), r.address, r.postal_code, r.city, r.province, r.phone,
      r.description, r.countries_served, r.languages, r.specialties, r.kind_data, 'verificato', now(), true
    );
  end loop;

  -- valutazioni: positivo/negativo da chi fa un mestiere diverso (mai dallo stesso tipo)
  insert into public.network_reviews (reviewed_user, reviewer_user, positive)
  select a.user_id, b.user_id, (abs(hashtext(a.business_name || b.business_name)) % 6) <> 0
  from public.network_profiles a
  join public.profiles pa on pa.id = a.user_id and pa.email like '%@demo.grandroute.invalid'
  join public.network_profiles b on b.kind <> a.kind
  join public.profiles pb on pb.id = b.user_id and pb.email like '%@demo.grandroute.invalid'
  where abs(hashtext(b.business_name || a.business_name)) % 3 <> 0;

  -- due richieste di contatto per chi ha creato i profili (si vedono in Rete → Messaggi)
  if v_admin is not null then
    insert into public.network_contacts (from_user, to_user, message)
    select p.id, v_admin, m.msg
    from (values
      ('demo-guida-roma@demo.grandroute.invalid', 'Buongiorno, sono una guida di Roma e collaboro con diverse agenzie. Se avete gruppi in arrivo in primavera posso mandarvi tariffe e disponibilità.'),
      ('demo-to-meridiana@demo.grandroute.invalid', 'Salve, siamo un tour operator di viaggi di lusso e cerchiamo agenzie partner per i viaggi di nozze. Possiamo sentirci questa settimana?')
    ) as m(email, msg)
    join public.profiles p on p.email = m.email;
  end if;

  return i;
end;
$$;

revoke all on function public.admin_demo_count() from public, anon;
revoke all on function public.admin_demo_remove() from public, anon;
revoke all on function public.admin_demo_create() from public, anon;
grant execute on function public.admin_demo_count() to authenticated;
grant execute on function public.admin_demo_remove() to authenticated;
grant execute on function public.admin_demo_create() to authenticated;
