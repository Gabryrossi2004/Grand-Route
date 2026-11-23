# Grand Route — scaletta dei progetti

Da riproporre al termine di ogni passo. Ultimo aggiornamento: 23/11/2026. Il dettaglio di tutto quello che è già stato fatto è in `docs/ROADMAP-archivio.md`.

> **Promemoria (richiesta di Gabriele, 22/11):** per l'area cliente e per gli utenti privati prendere spunto da **Stippl** e adottare le funzioni utili, sia per l'agenzia sia per il cliente/privato (elenco al punto A).

## Adesso
**Area viaggiatori (utenti privati)** — prima versione FATTA (passi 1–4). Scelte di Gabriele: ingresso dallo stesso sito con la scelta alla registrazione; Zefiro con l'AI per i privati con **5 itinerari al mese e tetto di 15 centesimi** (modello economico Haiku); le richieste «Fallo preparare da un'agenzia» vanno a un'agenzia **scelta dal privato da un elenco**; prima versione con TUTTO: modificare il programma, mappamondo/diario/foto, valigia e budget/spese, condivisione con gli amici. Idea di Gabriele da realizzare con la fatturazione: servizio a pagamento, **gratis se ci si affida a un'agenzia**.
- **Passo 1 FATTO (migrazione 0058 eseguita):** pagine «Organizza il tuo viaggio» (registrazione) e accesso in /viaggiatore, collegamenti dalla pagina iniziale e dall'area clienti; Home con i viaggi; «Nuovo viaggio» con proposte pronte (gratis), Zefiro con l'AI (5 al mese) o viaggio vuoto; pagina del viaggio con l'editor del programma; contatori e limiti dell'AI.
- **Passo 2 FATTO (nessuna migrazione):** voce «Mappamondo» nell'area viaggiatori, con lo stesso globo dei clienti (percorso tratteggiato, foto sul paese, schede dei luoghi) e la bacheca dei ricordi con Foto e Diario; link «Diario e foto» nella pagina del viaggio. Il diario del giorno con notifica resta per i clienti delle agenzie.
- **Passo 3 FATTO (migrazione 0059 eseguita):** il viaggio ha tre schede, **Itinerario / Valigia / Spese**. Valigia: lista da spuntare con idee automatiche (base + caldo, freddo, pioggia, mare, trekking, città, neve, auto, bambini; quantità secondo i giorni), riquadro «Da sapere» del paese (prese, documenti, moneta, fuso) dalla libreria. Spese: persone del viaggio, spese con chi ha pagato e tra chi si divide, **chi deve dare soldi a chi** (pochi pagamenti), totale per categoria e budget con barra. 
- **Passo 4 FATTO (migrazione 0060 eseguita):** schede **Condividi** (link per gli amici: solo programma, si spegne quando vuoi; WhatsApp) e **Agenzia** (elenco delle agenzie con presentazione e paesi; il viaggiatore ne sceglie una, indica il contatto, dà il consenso e le manda il viaggio). L'agenzia riceve una richiesta in Clienti → Nuove richieste con una **copia dell'itinerario** già tra i suoi viaggi; «Diventa cliente» crea il cliente e gli assegna il viaggio. Per le agenzie: **Impostazioni → Vetrina per i viaggiatori** (spenta di base). Termini e Privacy aggiornati (da far rivedere all'avvocato). Da fare: avviso (notifica) all'agenzia per le nuove richieste, limiti e funzioni sbloccate con l'agenzia (con la fatturazione).

**Controllo generale (23/11) — FATTO.**
- **Telefono FATTO:** area clienti senza scorrimento laterale e con la barra in basso (I viaggi, Mappamondo, I tuoi dati, Vantaggi); stessa barra per i viaggiatori; finestre e schede dell'agenzia sistemate sugli schermi piccoli.
- **Foto FATTO:** controllate **a vista** tutte le foto dei 215 paesi, delle 20 regioni e delle 88 zone d'Italia; tolte quelle brutte (animali, oggetti, interni, dettagli) e aggiunti i luoghi simbolo che mancavano (Piramidi, Torre Eiffel, Taj Mahal, Petra, Acropoli, Halong, Cappadocia, Chefchaouen, Plitvice...). Didascalie in italiano. 201 paesi con 4 foto; restano con meno foto solo 4 paesi poco turistici (Anguilla, Rep. Centrafricana, Guinea Equatoriale, Guinea-Bissau) perché su Wikimedia non c'è di meglio.
- **Kit di prova per le agenzie** (dopo): account demo, domande per l'amico agente e la collega del tour operator, guida da 20 minuti.

## Da fare, per blocco

### A. Area cliente e utenti privati
- **Utenti privati** (punto 3): vedi «Adesso». Piano a pagamento gratis per chi si affida a un'agenzia: con la fatturazione.
- **Incentivi per prenotare con l'agenzia** (0l): assistenza e SOS, guida dell'agenzia in Zefiro, documenti offline, tutele del pacchetto, foto illimitate, convenzioni e punti; il fai-da-te ha limiti. Da decidere insieme ai privati.
- **Cose per il cliente dall'elenco Stippl:** lista valigia da spuntare, budget e spese (con divisione tra amici), preferenze del cliente dopo la consegna.
- **Diario e ricordi, parti restanti:** condividere con parenti e amici (link da revocare), film automatico dalle foto, fotolibro da stampare.
- **Viaggi di gruppo.**
- **Mappamondo:** condivisione social (fase B), cartolina con il logo, nomi dei paesi sul globo, anteprima «Vedi come questo cliente».

### B. Strumenti per l'agenzia
- **Mappa interattiva del percorso** del viaggio, con tappe e spostamenti.
- **Fasi della vendita:** richiesta → preventivo → confermato → partito.
- **Widget per il sito dell'agenzia** e «reel» video del viaggio per i social.
- **Casella email per le riconferme (1f):** i fornitori rispondono a Grand Route, Zefiro legge e aggiorna lo stato (lavoro lungo).
- **Zefiro usa la ricerca voli** quando propone un itinerario con voli.
- **Vantaggi:** contare quante volte i clienti aprono le offerte.
- **Atlante:** 4° e 5° itinerario per le 30 mete più vendute, itinerari per le singole zone d'Italia, schede regione condivisibili.
- **Itinerari della Community** copiabili tra agenzie; più utenti per agenzia nell'Operativo.

### C. Voli e prenotazioni
- **Ricerca voli (0b):** per numero, percorso completo, coincidenza e tratta, già pronti; **da verificare con voli reali**.
- **Ricerca stile Amadeus/Sabre (0u):** ferma fino alla partita IVA. Due usi: consultazione per i privati, ricerca e prenotazione per le agenzie. Con Duffel solo come alternativa.
- **Prenotazioni nell'app (0m):** link affiliati per i privati, strumento per l'agente, vetrina di agenzie. Serve la partita IVA.

### D. Soldi e lancio
- **Pacchetti e fatturazione (punto 2):** tetto mensile di consumo, extra con ricarico (costo +60–100%), fatturazione mensile. Serve la partita IVA. Il pacchetto AI oggi lo sceglie l'agenzia da sola: va legato alla fatturazione.
- **Fornitore per reti di venditori (punto 5):** da valutare dopo la partita IVA; meglio reti di agenti con licenza che il network marketing (es. MWR Life: per ora no).

### E. Lingua
- **Sito in inglese (punto 4):** prima far funzionare la traduzione automatica dell'itinerario; poi il gestionale; poi altre lingue. Per ora il sito è solo in italiano.

### F. Tecnica e velocità
- Velocità, fase 2: istantanea della Home, meno richieste al database, misure con Speed Insights.
- Pulizia periodica dei file di viaggi e attività eliminati; «Skew Protection» di Vercel Pro per aggiornamenti senza interruzioni.
- Dettagli già noti: pulizia dei testi (sanitize-html) spostata sul server.

## Migrazioni del database
Eseguite fino alla **0060** (0056 itinerari dell'agenzia, 0057 chi ha presentato un amico, 0058 viaggiatori, 0059 valigia e spese, 0060 richieste alle agenzie). Se la 0055 non fosse stata eseguita, il pulsante «Chiedi un preventivo» e le notifiche della sera e del mattino non funzionano.

## Fatto (in sintesi; dettagli nell'archivio)
- **Zefiro:** avatar, costumi, contatore costi e pacchetti, archivio con risposte gratis, Zefiro per il cliente, dentro il viaggio (genera, modifica, controlla, traduce, suggerisce, checklist), **«Genera itinerario» (AI) e «Consulta proposte» (gratis)**.
- **Itinerari:** creazione guidata a domande; **646 itinerari con programma giorno per giorno scritto a mano** (paesi e regioni italiane); proposte gratis anche dai luoghi famosi; **itinerari dell'agenzia in Libreria** e nelle schede paese.
- **Atlante e mappamondo:** schede paese per tutto il mondo e guide per l'agente, Italia per regioni e zone, fornitori per paese, schede condivisibili, globo fisico, mappamondo dell'agenzia e del cliente.
- **Area cliente:** dialogo e chat con l'agenzia, approvazione dell'itinerario, documenti offline, meteo e conto alla rovescia, SOS, **diario con foto per luogo, percorso sul globo e foto dalla notifica della sera**, «Il tuo prossimo viaggio» e «Chiedi un preventivo».
- **Vantaggi per chi viaggia con l'agenzia:** punti e livelli, bonus, offerte con avviso, convenzioni, «presenta un amico», auguri, itinerario «verificato», **statistiche sui vantaggi**.
- **Gestionale agenzia:** scheda operativa «day by day» con riconferme, segretario senza AI (permessi d'ingresso, messaggi automatici, modelli, riepilogo in Home, «Chi contattare oggi»), statistiche, Community a vetrina con moderazione, menu riordinato, viaggio più pulito, pubblicazione e PDF.
- **Ricerca voli:** per numero di volo, percorso completo, coincidenza trovata da sola e per tratta.
- **Velocità e affidabilità:** pagine che compaiono subito, server e database nella stessa regione, eliminazioni con «Annulla», salvataggi sicuri.
- **Legale:** Termini e Privacy aggiornati (revisione dell'avvocato ancora da fare).

## Prima del lancio commerciale
- **Ricerca voli (AeroDataBox):** il piano gratuito non consente l'uso commerciale né la rivendita dei dati: serve un piano a pagamento.
- **Piani e fornitori:** Supabase Pro, Vercel Pro, rinnovo del dominio.
- **Legale:** revisione di avvocato e consulente privacy su Termini, Privacy (cita Anthropic, Open-Meteo, Wikimedia) e contratto con le agenzie; controllo legale se si vendono biglietti.
- **Società:** partita IVA e fatturazione.
- **Foto dei ricordi:** verificare lo spazio incluso nel piano Supabase (circa 0,3 MB a foto, tetto 600 per cliente), cancellare le foto quando si elimina un account, inserire nella privacy il trattamento delle foto dei clienti.
