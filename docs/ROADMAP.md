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
- **Zefiro per l'agenzia, strumenti**: briefing in Home (senza AI), controllo prima dell'invio al cliente, bozze di messaggi, traduzione dell'itinerario (copia del viaggio in 10 lingue, senza foto/documenti; interfaccia dell'area clienti ancora solo in italiano)

## Da fare, in ordine
**1. Mappamondo dei viaggi, fase A** — globo 3D nell'area clienti con i viaggi fatti (tappe ricavate dagli itinerari); il cliente può vedere dove si trova adesso, solo sul proprio telefono
**2. Pacchetti e fatturazione** — tetto mensile di consumo incluso nell'abbonamento, extra a consumo con ricarico (consigliato costo + 60-100%), fatturazione mensile (serve partita IVA); blocco degli argomenti di Zefiro per pacchetto (GATE_TOPICS_BY_PLAN)
**3. Ampliamento a pubblico senza agenzia** — utenti privati che organizzano i propri viaggi con Zefiro, senza passare da un'agenzia; qui anche la fase B del mappamondo (social: condividere viaggi e posizione, con consenso e privacy)

## Prima del lancio commerciale
Supabase Pro e Vercel Pro, revisione legale (compresa l'informativa privacy: ora cita Anthropic e Open-Meteo) (privacy, termini, contratto con le agenzie), partita IVA e fatturazione, rinnovo del dominio.
