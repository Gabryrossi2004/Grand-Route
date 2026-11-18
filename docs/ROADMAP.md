# Grand Route — scaletta dei progetti

Da riproporre al termine di ogni passo. Ultimo aggiornamento: 18/11/2026.

## Fatto
- Contatore dei costi di Zefiro + pacchetti giornalieri 2/5/10 € (migrazione 0035)
- Logo agenzia: forme e ritaglio automatico (migrazione 0034)
- Zefiro: avatar 3D, 10 costumi, modalità dinamica, regole per agenzia
- **Parte cliente, dialogo con l'agenzia** (migrazioni 0036 e 0037): messaggi sul viaggio con riferimento a un giorno o a una singola attività; invio in approvazione, approva, richiesta di modifiche; notifiche push; scheda "Dai tuoi clienti" nella Home
- **Chat con il cliente** (migrazione 0038): sempre disponibile, anche durante il viaggio, in tempo reale; pagina "Messaggi" per l'agenzia con i non letti; richiesta di modifica e approvazione solo finché l'itinerario è preliminare

- **Rifiniture area cliente** (migrazione 0039): conto alla rovescia, ora e meteo della meta, documenti di viaggio visibili al cliente (scelti dall'agenzia) e salvabili per l'uso senza rete, pagine già aperte consultabili offline

- **Zefiro per il cliente** (migrazione 0040): scheda Zefiro nella chat con avatar 3D, risponde solo con i dati del viaggio visibili al cliente; acceso/spento dalle Impostazioni e per viaggio; costi sul budget dell'agenzia (clienti max 70%, 8 domande/ora e 25/giorno per cliente); modello Haiku con ripiego su Sonnet
- **Zefiro per il cliente, argomenti e guida** (nessuna migrazione): l'agenzia sceglie gli argomenti (paese, consigli sul posto, muoversi, servizi vicini con mappa) e scrive la propria guida; servizi vicini da OpenStreetMap; blocco per pacchetto pronto ma spento (GATE_TOPICS_BY_PLAN in src/lib/zefiroTopics.ts)
- **Zefiro per l'agenzia, strumenti**: briefing in Home (senza AI), controllo prima dell'invio al cliente, bozze di messaggi, traduzione dell'itinerario (copia del viaggio in 10 lingue, senza foto/documenti)
- **Sito in inglese per i clienti (NASCOSTO: per ora il sito è solo in italiano; si riattiva con LANGUAGE_SWITCH_ENABLED in src/lib/i18n/index.ts, ma prima va risolta la traduzione automatica dell'itinerario)** (nessuna migrazione): interruttore IT | EN (cookie `gr_lang`, altrimenti lingua del browser) nell'area clienti, nelle pagine di accesso/registrazione/recupero password e nella pagina pubblica del viaggio; Zefiro risponde nella lingua del cliente. Restano in italiano: pagine legali, notifiche push, messaggio WhatsApp di emergenza, tutta la dashboard dell'agenzia. Testi in `src/lib/i18n/dictionary.ts`
- **Itinerario tradotto in automatico per chi legge in inglese** (migrazione 0041): titoli, descrizioni e note dell'itinerario si traducono alla prima visita del cliente e restano salvati; si rifanno solo se l'agenzia modifica il viaggio. Non ancora tradotti: titoli nella lista viaggi e nell'intestazione della chat

## Da fare, in ordine
**0. Prossimi passi richiesti (da fare prima del resto)**
- **Pubblicazione del viaggio migliorata** — FATTO (migrazione 0042): dopo la pubblicazione compare «Invia al cliente» con conferma («Sì, invia»), mail al cliente con il link (serve RESEND_API_KEY e MAIL_FROM su Vercel); «Salva in PDF» per agenzia, cliente e pagina pubblica (finestra di stampa del browser). Da valutare: PDF allegato alla mail
- **Scheda viaggio più pulita** — FATTO: barra con 5 elementi (Pubblica, Invia al cliente, Preview, Servizi e fornitori, Altro); in «Altro»: PDF, preliminare/finale, variante, traduzione; il link per il cliente è una barra in fondo alla copertina (copia / apri); «Metti in bozza» nascosto quando il viaggio è pubblicato; la foto di copertina si cambia con doppio clic sulla copertina (o icona fotocamera)
- **Creazione con AI più semplice** — oggi ha troppi passaggi ed è macchinosa: ridurre i passaggi (da un solo testo/richiesta all'itinerario pronto)

**1. Mappamondo dei viaggi, fase A** — globo 3D nell'area clienti con i viaggi fatti (tappe ricavate dagli itinerari); il cliente può vedere dove si trova adesso, solo sul proprio telefono
**2. Pacchetti e fatturazione** — tetto mensile di consumo incluso nell'abbonamento, extra a consumo con ricarico (consigliato costo + 60-100%), fatturazione mensile (serve partita IVA); blocco degli argomenti di Zefiro per pacchetto (GATE_TOPICS_BY_PLAN)
**3. Ampliamento a pubblico senza agenzia** — utenti privati che organizzano i propri viaggi con Zefiro, senza passare da un'agenzia; qui anche la fase B del mappamondo (social: condividere viaggi e posizione, con consenso e privacy)

**4. Lingua del sito: inglese** — prima far funzionare la traduzione automatica dell'itinerario (i testi dell'interfaccia sono già pronti ma nascosti); poi gestionale agenzia in inglese; — stessa struttura già pronta per i clienti; impostazione di lingua nelle Impostazioni dell'agenzia; poi eventuali altre lingue

## Prima del lancio commerciale
Supabase Pro e Vercel Pro, revisione legale (compresa l'informativa privacy: ora cita Anthropic e Open-Meteo) (privacy, termini, contratto con le agenzie), partita IVA e fatturazione, rinnovo del dominio.
