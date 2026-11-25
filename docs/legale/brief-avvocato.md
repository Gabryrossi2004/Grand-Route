# Brief per l'avvocato — Grand Route

*Documento preparato per una consulenza legale. Versione 1 — da aggiornare prima dell'incontro.*

## 1. Chi siamo e cosa facciamo
Grand Route (https://grandroute.it) è un software online (SaaS) per agenzie di viaggio. Oggi offre:
- un **gestionale per agenzie e tour operator**: pratiche, clienti, preventivi e itinerari, fornitori, messaggi, area cliente;
- un'**area per il cliente dell'agenzia** (portale) e un'**area per il viaggiatore privato** (itinerari con assistente AI, limitati a 5 al mese);
- una **Community** tra agenzie e tour operator (gruppi, post, commenti, segnalazioni);
- la nuova **Rete professionale**: una vetrina/elenco dove anche guide, autisti, strutture, esperienze e altri fornitori hanno un profilo verificato.

Le vendite dei viaggi restano **delle agenzie**: Grand Route non vende viaggi, non incassa pagamenti dei viaggi e non emette biglietti. Al momento la società **non ha ancora partita IVA**: il servizio è gratuito e in fase di test con poche agenzie.

Dati tecnici: Next.js, database Supabase (Unione Europea), hosting Vercel. Assistente AI tramite fornitori esterni (Anthropic).

## 2. Cosa vogliamo fare (e dove ci serve il parere)
1. **Abbonamento** per i fornitori della Rete (guide, autisti, ecc.), circa 5–6 € al mese, con partita IVA e dati obbligatori. In futuro anche piani per le agenzie.
2. **Elenco pubblico/semi-pubblico** di professionisti: i legami tra agenzie e fornitori restano **nascosti** (nessuno vede con chi lavora un altro), per evitare conflitti di interesse.
3. **Recensioni anonime** solo positive/negative, **mai tra concorrenti dello stesso tipo** (agenzia↔agenzia, tour operator↔tour operator, guida↔guida…). Il voto totale si mostra solo da 3 voti.
4. **Moderazione e sospensione** degli account da parte dell'amministrazione (ora esiste un pannello admin).
5. **Viaggiatore privato** che sceglie un'agenzia da un elenco e, in futuro, un piano a pagamento gratuito se si affida a un'agenzia.
6. Voli tramite Amadeus/Sabre (rimandato) e altri partner (rimandato).

## 3. Domande per l'avvocato
**Società e fisco**
- Quale forma societaria e quali passaggi per aprire partita IVA e attività (codice ATECO, regime) per un SaaS con abbonamenti?
- Gestione IVA su abbonamenti a clienti in Italia, UE ed extra-UE (OSS)? Fatturazione elettronica?
- C'è un accordo tra i soci / due amici coinvolti? Come regolare quote, ruoli, cessione di proprietà intellettuale del software?

**Contratti (da far redigere o rivedere)**
- Termini e condizioni di servizio (già bozza: *Termini* sezione 19 per la Rete) per agenzie, fornitori e viaggiatori privati.
- Clausole di limitazione di responsabilità: Grand Route è solo strumento, non parte del contratto di viaggio.
- Contratto/condizioni specifiche per i **fornitori della Rete** (abbonamento, verifica, sospensione, recesso).
- Contratto di trattamento dati (art. 28 GDPR) con le agenzie, che per i propri clienti sono titolari e noi responsabili.

**Privacy / GDPR**
- Informativa e ruoli: titolare vs responsabile (agenzie ↔ Grand Route), registro dei trattamenti, DPIA se necessaria.
- Dati dei clienti: passaporti, date di nascita, esigenze alimentari o di salute (dati particolari). Misure e basi giuridiche.
- Uso dell'AI con dati personali (fornitori fuori UE, trasferimenti, clausole contrattuali standard).
- Minori, conservazione dei dati, cancellazione, diritti degli interessati.
- Cookie e consenso (analytics, assistente).

**Turismo**
- Obblighi di un intermediario tecnologico: serve qualche autorizzazione/SCIA? Siamo "organizzatori" o "venditori" ai sensi del Codice del Turismo (D.Lgs. 79/2011, direttiva UE 2015/2302 sui pacchetti)?
- Rischio di qualificazione come "intermediario" per le prenotazioni dei fornitori nella Rete.
- Pubblicazione di profili di guide e autisti: abilitazioni, licenze, verifica dei documenti (cosa possiamo/dobbiamo controllare, cosa scriviamo in elenco).

**Piattaforma e recensioni**
- Regole per recensioni anonime (Codice del consumo, direttiva Omnibus, responsabilità per contenuti dannosi): è ammissibile il solo giudizio positivo/negativo senza nome?
- Procedura di segnalazione e rimozione (notice-and-takedown, DSA): obblighi per una piccola piattaforma.
- Regole sulla concorrenza: nascondere i collegamenti tra agenzie e fornitori, rischi antitrust o di pratiche scorrette.
- Sospensione dell'account: motivazioni, preavviso, diritto di replica.

**Proprietà intellettuale**
- Titolarità del codice e dei contenuti (foto da Wikimedia/Commons con licenze CC: obblighi di attribuzione).
- Marchio "Grand Route": ricerca di anteriorità e registrazione.
- Contenuti caricati dagli utenti: licenza d'uso concessa a Grand Route.

## 4. Documenti già pronti (da mostrare all'avvocato)
- Termini di servizio e Privacy (pagine pubbliche del sito, sezioni 19 e 11 per la Rete).
- Guida all'uso del gestionale.
- Kit per i tester (documento condiviso).
- Elenco delle tabelle e dei dati raccolti: profili, clienti, pratiche, messaggi, profili Rete (partita IVA, licenze, assicurazioni).

## 5. Costi indicativi (stima nostra, da verificare)
Consulenza complessiva (contratti, privacy, termini, società): circa 2.000–5.000 €, in base a quanto lavoro di redazione si chiede. Meglio chiedere un preventivo a forfait diviso per voci.

## 6. Dati chiave per l'incontro
- Dominio: grandroute.it
- Stato: in sviluppo/test, gratuito, nessun incasso, nessuna partita IVA.
- Utenti: pochi tester (agenzie amiche e viaggiatori).
- Dati personali trattati: anagrafica dei clienti delle agenzie, dati di viaggio, passaporti (solo se inseriti dall'agenzia), email e telefono dei professionisti, partite IVA e licenze dei fornitori.
