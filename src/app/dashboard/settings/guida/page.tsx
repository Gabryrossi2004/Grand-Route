import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

type Step = {
  id: string;
  title: string;
  body: React.ReactNode;
  images?: { src: string; caption: string }[];
};

type Section = {
  id: string;
  title: string;
  intro?: string;
  steps: Step[];
};

const sections: Section[] = [
  {
    id: "impostazioni",
    title: "1. Impostazioni iniziali",
    intro:
      "La prima volta, prima di creare viaggi, conviene configurare l'agenzia: queste informazioni vengono riusate automaticamente ovunque.",
    steps: [
      {
        id: "profilo",
        title: "Nome agenzia, colore e logo",
        body: (
          <>
            Da <strong>Impostazioni</strong> (menu in alto) imposta il nome che vedrà il cliente, un colore del
            brand e carica il tuo logo. Qui scegli anche se operi come privato o come agenzia.
          </>
        ),
      },
      {
        id: "termini",
        title: "Termini e Condizioni standard",
        body: (
          <>
            Nello stesso posto trovi un campo &quot;Termini e Condizioni standard&quot;: scrivi qui una volta sola
            il testo che usi di solito (acconto richiesto, politica di cancellazione, ecc.). Questo testo verrà
            riproposto automaticamente ogni volta che attivi il blocco &quot;Tariffa &amp; Termini&quot; su un
            viaggio (lo vedremo più avanti) — non devi riscriverlo ogni volta.
          </>
        ),
        images: [{ src: "/guide/02-impostazioni.png", caption: "La pagina Impostazioni, con il campo Termini e Condizioni." }],
      },
    ],
  },
  {
    id: "clienti",
    title: "2. Creare un cliente",
    intro: "Ogni viaggio può essere collegato a una scheda cliente: anagrafica, contatti e documenti.",
    steps: [
      {
        id: "nuovo-cliente",
        title: "Scheda cliente",
        body: (
          <>
            Vai su <strong>Clienti → Nuovo cliente</strong>. Nome ed email bastano per iniziare; gli altri campi
            (documenti, residenza...) sono opzionali e li puoi completare quando servono, ad esempio per un visto.
            Se inserisci l&apos;email, il cliente potrà in futuro registrarsi nell&apos;area clienti e vedere da
            solo i propri viaggi.
          </>
        ),
        images: [{ src: "/guide/03-nuovo-cliente.png", caption: "Form di creazione di un nuovo cliente." }],
      },
    ],
  },
  {
    id: "viaggio",
    title: "3. Creare un viaggio",
    intro: "Un viaggio è il contenitore di tutto: itinerario, servizi, pagamenti e, se vuoi, il link da dare al cliente.",
    steps: [
      {
        id: "nuovo-viaggio",
        title: "Nuovo viaggio",
        body: (
          <>
            Da <strong>Viaggi → Nuovo viaggio</strong> basta un titolo per iniziare. Se indichi anche le date di
            inizio e fine, il gestionale crea in automatico tutti i giorni dell&apos;itinerario, pronti da
            riempire con le attività (puoi comunque aggiungerne altri dopo con &quot;+ Aggiungi&quot;).
          </>
        ),
        images: [{ src: "/guide/04-nuovo-viaggio.png", caption: "Form di creazione di un nuovo viaggio." }],
      },
      {
        id: "zefiro-nuovo",
        title: "Zefiro: l'assistente che prepara l'itinerario",
        body: (
          <>
            Zefiro è l&apos;assistente di Grand Route: lo trovi nel tondo in basso a destra, in ogni pagina. Quando
            crei un viaggio ti offre due strade. <strong>Consulta proposte</strong> (itinerari pronti, gratis) ti
            mostra gli itinerari scritti a mano per il paese o la regione che indichi e quelli che hai salvato tu
            in Libreria: ne scegli uno e il viaggio nasce già con tutti i giorni compilati.{" "}
            <strong>Genera itinerario</strong> (creato con l&apos;AI) ti fa poche domande (durata, stile, cosa
            piace al cliente) e scrive una o più bozze su misura. Tutte le bozze si possono modificare: Zefiro non
            inventa prezzi, orari di apertura o nomi di locali.
          </>
        ),
      },
      {
        id: "scheda-viaggio",
        title: "La scheda del viaggio",
        body: (
          <>
            Qui trovi tutto: in alto i pulsanti principali — <strong>Pubblica</strong> (genera il link per il
            cliente), <strong>Preview</strong> (vedi come lo vede il cliente), <strong>Segna come
            finale</strong> (ne parliamo più avanti) e <strong>Servizi e fornitori</strong> (pannello interno,
            mai visibile al cliente). Più sotto: informazioni di base, Tariffa &amp; Termini, Promemoria e
            l&apos;itinerario vero e proprio.
          </>
        ),
        images: [{ src: "/guide/05-scheda-viaggio.png", caption: "La testata della scheda viaggio con i pulsanti principali." }],
      },
      {
        id: "informazioni",
        title: "Informazioni, prezzo e stile grafico",
        body: (
          <>
            Nella sezione &quot;Informazioni viaggio&quot; completi destinazione e date (se non l&apos;hai già
            fatto), scegli come mostrare il prezzo al cliente (nessun prezzo, un totale, oppure costo + servizio
            di organizzazione separati) e, aprendo &quot;Personalizza interfaccia viaggio&quot;, scegli uno dei
            10 stili grafici per la pagina che vedrà il cliente.
          </>
        ),
        images: [{ src: "/guide/06-informazioni-viaggio.png", caption: "Informazioni viaggio, prezzo e scelta del tema grafico." }],
      },
    ],
  },
  {
    id: "tariffa-termini",
    title: "4. Tariffa & Termini (facoltativo)",
    intro:
      "Un box, in stile Tour Operator, con cosa è incluso/escluso nella quota e i Termini e Condizioni — lo vede il cliente solo se lo attivi tu.",
    steps: [
      {
        id: "rate-block",
        title: "Cosa include / non include la quota",
        body: (
          <>
            Apri la sezione &quot;Tariffa &amp; Termini&quot; sulla scheda del viaggio. Scrivi una voce per riga
            in &quot;La quota include&quot; e &quot;La quota non include&quot;. I Termini e Condizioni non li
            scrivi qui: arrivano automaticamente da quelli impostati una volta per tutte nelle Impostazioni.
            Spunta <strong>&quot;Mostra questo box al cliente nell&apos;itinerario&quot;</strong> solo quando sei
            pronto a farlo vedere — resta nascosto finché non lo attivi.
          </>
        ),
        images: [{ src: "/guide/07-tariffa-termini.png", caption: "Il pannello Tariffa & Termini compilato." }],
      },
    ],
  },
  {
    id: "itinerario",
    title: "5. Costruire l'itinerario",
    intro: "Il cuore del viaggio: giorni e attività, quello che il cliente legge davvero.",
    steps: [
      {
        id: "giorni",
        title: "Giorni e attività",
        body: (
          <>
            Nella sezione &quot;Itinerario&quot; trovi i giorni del viaggio a sinistra e, per ciascuno, il
            pulsante <strong>+ Attività</strong> per aggiungere voli, alloggi, transfer, treni, traghetti,
            ristoranti, attività o informazioni varie. Ogni tipologia ha colore e icona propria, e campi dedicati
            (es. numero di volo, numero di conferma hotel...).
          </>
        ),
        images: [{ src: "/guide/09-itinerario.png", caption: "L'itinerario con i giorni del viaggio e le attività." }],
      },
      {
        id: "nuova-attivita",
        title: "Aggiungere un'attività",
        body: (
          <>
            Scegli il tipo, scrivi un titolo e, se vuoi, una descrizione e i dettagli specifici. Per i voli puoi
            cercare automaticamente orari e aeroporti inserendo solo il numero di volo. Puoi modificare
            un&apos;attività già creata con un doppio click ovunque sulla sua card.
          </>
        ),
        images: [{ src: "/guide/08-nuova-attivita.png", caption: "Il modulo per aggiungere una nuova attività (es. un volo)." }],
      },
      {
        id: "libreria",
        title: "La Libreria",
        body: (
          <>
            Se riusi spesso le stesse attività (un hotel, una visita guidata...), salvale in Libreria con
            l&apos;icona del segnalibro su un&apos;attività già scritta. La prossima volta che crei
            un&apos;attività dello stesso tipo, il gestionale ti suggerisce (con una stella ⭐) il template più
            simile al titolo che stai scrivendo: un click e titolo, descrizione e foto sono già compilati — resta
            comunque tutto modificabile prima di salvare.
          </>
        ),
        images: [{ src: "/guide/10-libreria.png", caption: "Il pannello Libreria aperto accanto all'itinerario." }],
      },
      {
        id: "libreria-pagina",
        title: "La pagina Libreria: blocchi, itinerari e stili",
        body: (
          <>
            Dal menu <strong>Libreria</strong> hai tre schede. <strong>Blocchi</strong>: le attività che hai
            salvato. <strong>Itinerari</strong>: i tuoi programmi completi, divisi per paese o regione.{" "}
            <strong>Stili</strong>: il tuo modo di scrivere (tono, lunghezza, cose da evitare), che Zefiro segue
            quando genera un itinerario. Per salvare un viaggio finito tra gli itinerari usa{" "}
            <strong>Salva come proposta in Libreria</strong> nel menu dei tre puntini del viaggio: da quel momento
            compare in &quot;Consulta proposte&quot; e nella scheda del paese nell&apos;Atlante, e puoi crearci un
            nuovo viaggio con un click.
          </>
        ),
      },
    ],
  },
  {
    id: "servizi",
    title: "6. Fornitori, Servizi e Pagamenti (facoltativo)",
    intro:
      "Un pannello interno, mai mostrato al cliente, per tenere traccia di cosa va prenotato con i fornitori e dei soldi che girano sul viaggio. Non è obbligatorio: puoi costruire un viaggio senza mai aprirlo.",
    steps: [
      {
        id: "fornitori",
        title: "La rubrica Fornitori",
        body: (
          <>
            Da <strong>Fornitori</strong> nel menu principale crei la tua rubrica: hotel, compagnie, guide...
            Inserisci l&apos;email se vuoi poter inviare richieste di disponibilità direttamente da qui (lo
            vediamo tra poco).
          </>
        ),
        images: [
          { src: "/guide/11-nuovo-fornitore.png", caption: "Creazione di un nuovo fornitore." },
          { src: "/guide/12-rubrica-fornitori.png", caption: "La rubrica fornitori dell'agenzia." },
        ],
      },
      {
        id: "nuovo-servizio",
        title: "Creare un Servizio",
        body: (
          <>
            Sulla scheda del viaggio, apri <strong>Servizi e fornitori → + Nuovo servizio</strong>. Dai un titolo,
            collega (se vuoi) un fornitore della rubrica e l&apos;attività dell&apos;itinerario a cui corrisponde,
            e imposta lo stato (da prenotare, richiesto, confermato...). Numero di conferma e costo netto li
            aggiungi quando li hai.
          </>
        ),
        images: [{ src: "/guide/13-nuovo-servizio.png", caption: "Creazione di un nuovo Servizio collegato a un fornitore e un'attività." }],
      },
      {
        id: "sync",
        title: "Il numero di conferma si aggiorna da solo nell'itinerario",
        body: (
          <>
            Appena un Servizio collegato a un&apos;attività riceve un numero di conferma, questo compare da solo
            nei dettagli di quell&apos;attività nell&apos;itinerario (es. il PNR di un volo o il numero di
            conferma di un hotel) — non devi ricopiarlo a mano.
          </>
        ),
        images: [{ src: "/guide/14-lista-servizi.png", caption: "L'elenco dei Servizi di un viaggio." }],
      },
      {
        id: "pagamenti",
        title: "Pagamenti e scadenze",
        body: (
          <>
            Nella scheda &quot;Pagamenti e scadenze&quot; dello stesso pannello registri incassi dal cliente e
            pagamenti ai fornitori, con una scadenza e un segno di spunta per &quot;incassato/pagato&quot;. Questi
            dati alimentano anche la statistica &quot;Incassato reale&quot; nella Home.
          </>
        ),
        images: [{ src: "/guide/18-pagamenti.png", caption: "Aggiunta di una scadenza di pagamento." }],
      },
    ],
  },
  {
    id: "email",
    title: "7. Richiedere un servizio via email",
    intro:
      "Il gestionale non invia email da solo: ti prepara il testo e apre la TUA casella di posta vera, così il fornitore riceve una mail normale, da un indirizzo reale.",
    steps: [
      {
        id: "invio",
        title: "Da dove parte la richiesta",
        body: (
          <>
            Se un Servizio è collegato a un fornitore con un&apos;email, vedrai l&apos;icona a forma di busta
            &quot;Invia richiesta via email&quot;. Cliccandola si apre un riquadro con oggetto e testo già
            pronti (puoi modificarli). Premendo <strong>&quot;Apri nella tua email&quot;</strong> si apre il tuo
            programma di posta normale (Gmail, Outlook, Mail...) con tutto già scritto: controlli e premi invio
            tu, dalla tua vera casella.
          </>
        ),
        images: [{ src: "/guide/15-email-composer.png", caption: "Il riquadro di composizione della richiesta via email." }],
      },
      {
        id: "risposta",
        title: "Quando il fornitore risponde",
        body: (
          <>
            Torna sul Servizio e clicca &quot;Incolla la risposta del fornitore&quot;. Incolli il testo della mail
            di risposta e premi <strong>Analizza risposta</strong>: il gestionale cerca da solo numero di
            conferma e importo nel testo e propone di aggiornare lo stato. Controlli i valori proposti (sono
            sempre modificabili) e premi <strong>Applica al servizio</strong> per salvarli — a quel punto, come
            visto sopra, il numero di conferma arriva anche sull&apos;attività dell&apos;itinerario.
          </>
        ),
        images: [
          { src: "/guide/16-incolla-risposta.png", caption: "Il testo della risposta del fornitore incollato." },
          { src: "/guide/17-risposta-analizzata.png", caption: "I dati estratti automaticamente dalla risposta." },
        ],
      },
    ],
  },
  {
    id: "pubblicazione",
    title: "8. Pubblicare e condividere col cliente",
    intro: "Quando l'itinerario è pronto da mostrare, lo pubblichi e ottieni un link da inviare al cliente.",
    steps: [
      {
        id: "pubblica",
        title: "Pubblica",
        body: (
          <>
            Il pulsante <strong>Pubblica</strong> rende il viaggio raggiungibile dal link mostrato in alto a
            destra: condividilo col cliente (via email, WhatsApp, come preferisci). Finché resta &quot;Bozza&quot;,
            il link non è attivo.
          </>
        ),
      },
      {
        id: "stadio",
        title: 'Itinerario "preliminare" o "finale"',
        body: (
          <>
            Ogni viaggio nasce come <strong>itinerario preliminare</strong>: il cliente vede un avviso che i
            dettagli sono ancora indicativi — utile nella fase di proposta, prima che i servizi siano
            effettivamente prenotati. Quando hai confermato tutto con i fornitori, premi{" "}
            <strong>&quot;Segna come finale&quot;</strong>: l&apos;avviso sparisce e il cliente vede
            l&apos;itinerario come definitivo. È un unico interruttore: non devi gestire due viaggi diversi.
          </>
        ),
        images: [
          { src: "/guide/19-pubblica.png", caption: "Viaggio pubblicato, ancora in stadio preliminare." },
          { src: "/guide/22-finale.png", caption: "Dopo aver premuto \"Segna come finale\"." },
        ],
      },
    ],
  },
  {
    id: "cliente",
    title: "9. Cosa vede il cliente",
    intro: "Una pagina pulita, brandizzata con il tuo logo e colori, con solo le informazioni che hai deciso di mostrare.",
    steps: [
      {
        id: "portale",
        title: "L'itinerario del cliente",
        body: (
          <>
            Il cliente vede il riepilogo del viaggio, i dettagli giorno per giorno con foto, l&apos;eventuale
            prezzo e, se li hai attivati, il box Tariffa &amp; Termini e l&apos;avviso &quot;itinerario
            preliminare&quot;. Non vede mai Servizi, Fornitori, Pagamenti o note interne.
          </>
        ),
        images: [{ src: "/guide/20-itinerario-cliente.png", caption: "L'itinerario così come lo vede il cliente, con il banner preliminare." }],
      },
    ],
  },
  {
    id: "dashboard",
    title: "10. La Home / Dashboard",
    intro: "Una panoramica d'insieme su tutti i tuoi viaggi.",
    steps: [
      {
        id: "home",
        title: "Statistiche e prossime partenze",
        body: (
          <>
            La Home mostra quanti viaggi hai in corso, i prossimi in partenza e alcune statistiche, incluso
            l&apos;<strong>Incassato reale</strong> calcolato dai pagamenti che hai segnato come incassati. Trovi
            anche i messaggi dei clienti, i promemoria da fare, il calendario delle partenze e{" "}
            <strong>Chi contattare oggi</strong>: compleanni, anniversari di viaggio, clienti vicini a un livello
            del programma fedeltà e amici presentati, con un tasto per scrivere subito.
          </>
        ),
        images: [{ src: "/guide/21-dashboard.png", caption: "La Home del gestionale con le statistiche." }],
      },
    ],
  },
  {
    id: "zefiro",
    title: "11. Zefiro dentro il viaggio e i suoi costi",
    intro: "Zefiro ti aiuta anche quando il viaggio esiste già. Le funzioni con l'intelligenza artificiale hanno un costo, che puoi tenere sotto controllo.",
    steps: [
      {
        id: "zefiro-viaggio",
        title: "Cosa puoi chiedergli nella scheda del viaggio",
        body: (
          <>
            Tocca Zefiro nella scheda del viaggio: <strong>Controlla il viaggio</strong> rilegge il programma e segnala
            dimenticanze e incoerenze, <strong>Suggerisci attività</strong> propone
            idee per un giorno, scrive le descrizioni che mancano e prepara la <strong>Checklist del viaggio</strong>{" "}
            da dare al cliente. Può anche modificare l&apos;itinerario seguendo una tua richiesta scritta e tradurlo
            in un&apos;altra lingua.
          </>
        ),
      },
      {
        id: "zefiro-costi",
        title: "Archivio, risposte gratis e tetto di spesa",
        body: (
          <>
            Da <strong>Impostazioni → Archivio di Zefiro</strong> vedi quanto hai speso oggi e nel mese, il tuo
            pacchetto e le risposte già date. Quando una domanda è già nell&apos;archivio, o si
            può rispondere con i dati del viaggio o dell&apos;Atlante, Zefiro risponde subito e gratis, senza
            chiamare l&apos;AI. Ogni pacchetto ha un tetto di spesa giornaliero: raggiunto quello, le funzioni AI
            si fermano fino al giorno dopo.
          </>
        ),
      },
    ],
  },
  {
    id: "atlante",
    title: "12. L'Atlante: schede paese e Italia",
    intro: "Una guida su 215 paesi e sull'Italia, pensata per chi deve proporre una meta che non conosce a fondo.",
    steps: [
      {
        id: "atlante-schede",
        title: "La scheda di un paese",
        body: (
          <>
            Dal menu <strong>Atlante</strong> cerca un paese o toccalo sul globo. La scheda ha presentazione, foto,
            dati pratici (documenti, moneta, fuso, prese, volo dall&apos;Italia), luoghi da visitare, come muoversi,
            piatti tipici, esperienze e itinerari consigliati. Per l&apos;agente c&apos;è di più: il{" "}
            <strong>calendario mese per mese di ogni zona</strong> del paese (ottimo, buono, sconsigliato) e i
            consigli su cosa vendere a chi. L&apos;Italia è divisa in regioni e zone, con itinerari propri.
          </>
        ),
      },
      {
        id: "atlante-chiedi",
        title: "Chiedi al Mappamondo e fornitori",
        body: (
          <>
            Nella pagina dell&apos;Atlante trovi un campo dove scrivere una domanda (per esempio &quot;Quando conviene
            andare a Phuket?&quot;): la risposta arriva dalle schede, senza costi quando possibile. Nella scheda di
            ogni paese vedi anche i <strong>tuoi fornitori</strong> di quel paese, e puoi condividere la scheda con
            un cliente.
          </>
        ),
      },
    ],
  },
  {
    id: "voli",
    title: "13. Cercare un volo",
    intro: "Quando aggiungi un'attività di tipo volo, il gestionale può compilarla da solo.",
    steps: [
      {
        id: "voli-ricerca",
        title: "Per numero di volo o per tratta",
        body: (
          <>
            Nel modulo del volo scegli <strong>Numero di volo</strong> (inserisci il numero e la data) oppure{" "}
            <strong>Tratta</strong> (per esempio Roma → Delhi, con la data): vedi i voli disponibili e, se non c&apos;è
            un diretto, il gestionale cerca da solo le coincidenze. Un tocco e orari, aeroporti e compagnia entrano
            nell&apos;itinerario, con il blocco &quot;Arrivo&quot; già pronto. Gli orari arrivano da un servizio
            gratuito: prima di confermare al cliente controllali sempre con la compagnia.
          </>
        ),
      },
    ],
  },
  {
    id: "operativo",
    title: "14. Operativo day by day",
    intro: "La scheda di lavoro per chi segue le partenze: cosa succede ogni giorno e cosa va confermato.",
    steps: [
      {
        id: "operativo-scheda",
        title: "Servizi per giorno e riconferme",
        body: (
          <>
            Dal menu <strong>Operativo</strong> vedi giorno per giorno i servizi dei viaggi (trasferimenti, hotel,
            visite) con fornitore, responsabile e stato della riconferma. Puoi guardare un intervallo di date o
            un solo viaggio, e le righe si allineano da sole all&apos;itinerario quando lo modifichi. È pensata per
            non dimenticare nessuna riconferma ai fornitori prima della partenza.
          </>
        ),
      },
    ],
  },
  {
    id: "clienti-messaggi",
    title: "15. Clienti, messaggi e area clienti",
    intro: "Dopo aver mandato il link, il cliente ha una sua area riservata: ecco come la segui dal gestionale.",
    steps: [
      {
        id: "area-clienti",
        title: "Cosa vede e cosa può fare il cliente",
        body: (
          <>
            Il cliente entra con la sua email e trova i suoi viaggi, i documenti sempre disponibili anche senza
            connessione, il meteo e il conto alla rovescia, il tasto <strong>SOS</strong> con il tuo numero di
            emergenza, la chat con te e, durante il viaggio, il <strong>diario con le foto</strong> per ogni luogo.
            Nella sua pagina compare anche <strong>Il tuo prossimo viaggio</strong>: idee, curiosità, giochi e un
            pulsante per chiederti un preventivo. Dalla scheda del cliente puoi vedere tutto con{" "}
            <strong>Vedi come questo cliente</strong>.
          </>
        ),
      },
      {
        id: "messaggi",
        title: "Messaggi e notifiche",
        body: (
          <>
            Dal menu <strong>Messaggi</strong> leggi e rispondi alla chat dei clienti, con un contatore dei messaggi
            non letti. Da <strong>Impostazioni → Messaggi automatici ai clienti</strong> puoi attivare le notifiche
            sul telefono della vigilia della partenza, del primo giorno e del rientro: sono firmate con il nome
            dell&apos;agenzia e non usano l&apos;AI. Il cliente riceve anche la notifica della sera per raccontare la giornata.
          </>
        ),
      },
      {
        id: "richieste",
        title: "Nuove richieste e preventivi",
        body: (
          <>
            Nella pagina <strong>Clienti</strong> trovi <strong>Nuove richieste</strong>: i preventivi
            chiesti dai clienti, gli amici presentati e i viaggiatori che ti hanno scelto dalla vetrina. Con{" "}
            <strong>Diventa cliente</strong> crei la scheda e, se c&apos;è un itinerario, lo ritrovi già tra i tuoi
            viaggi.
          </>
        ),
      },
    ],
  },
  {
    id: "vantaggi",
    title: "16. Vantaggi per i clienti e statistiche",
    intro: "Strumenti per far tornare chi ha già viaggiato con te e per capire come va l'agenzia.",
    steps: [
      {
        id: "vantaggi-programma",
        title: "Programma fedeltà e offerte",
        body: (
          <>
            Da <strong>Impostazioni → Vantaggi per i clienti</strong> attivi il programma a punti con livelli,
            crei <strong>offerte riservate</strong> (sconti sul prossimo viaggio, partenze di gruppo, early booking)
            e inserisci le convenzioni con fornitori sul posto. Il cliente le vede nella sua area, riceve un avviso
            per le nuove offerte e può presentare un amico con un link personale. L&apos;itinerario può mostrare il
            bollino &quot;verificato&quot; dall&apos;agenzia.
          </>
        ),
      },
      {
        id: "statistiche",
        title: "Statistiche",
        body: (
          <>
            Il menu <strong>Statistiche</strong> mostra partenze e incassi per mese, destinazioni più vendute,
            stagionalità, clienti più fedeli e chi è da ricontattare dopo più di un anno e mezzo. Una pagina a parte
            raccoglie i numeri dei vantaggi: amici presentati, preventivi richiesti, offerte e punti.
          </>
        ),
      },
    ],
  },
  {
    id: "viaggiatori",
    title: "17. Vetrina per i viaggiatori",
    intro: "Chi organizza da solo può farsi aiutare da un'agenzia: puoi comparire nell'elenco.",
    steps: [
      {
        id: "vetrina",
        title: "Come funziona",
        body: (
          <>
            Da <strong>Impostazioni → Vetrina per i viaggiatori</strong> (spenta di base) scrivi una presentazione e
            indichi i paesi in cui sei specializzata. Un viaggiatore che ha preparato un itinerario da solo può
            sceglierti e mandartelo, dandoti il consenso a contattarlo: la richiesta arriva in{" "}
            <strong>Clienti → Nuove richieste</strong> con una copia dell&apos;itinerario già tra i tuoi viaggi.
          </>
        ),
      },
    ],
  },
  {
    id: "community",
    title: "18. Community",
    intro: "Uno spazio per confrontarsi con altre agenzie.",
    steps: [
      {
        id: "community-uso",
        title: "Gruppi, domande e recensioni",
        body: (
          <>
            Dal menu <strong>Community</strong> puoi pubblicare domande, recensioni di fornitori e messaggi in chat,
            entrare in gruppi aperti o su invito e creare i tuoi. I contenuti sono visibili agli altri professionisti
            iscritti, non ai clienti.
          </>
        ),
      },
    ],
  },
  {
    id: "rete",
    title: "19. La Rete dei professionisti",
    intro: "Un elenco di agenzie, tour operator, agenzie locali, guide, autisti e strutture verificati, per trovare chi ti serve in ogni paese.",
    steps: [
      {
        id: "rete-profilo",
        title: "Il tuo profilo",
        body: (
          <>
            Dal menu <strong>Rete → Il mio profilo</strong> compili i dati dell&apos;attività (partita IVA, sede, licenze e
            assicurazioni previste per il tuo tipo di attività) e scegli paesi, lingue e specializzazioni. Il team li
            controlla: quando il profilo è <strong>verificato</strong> compari nell&apos;elenco. Email, telefono e dati
            fiscali non sono pubblici. In <strong>Impostazioni → Tipo di attività</strong> scegli se sei agenzia, tour
            operator o agenzia locale.
          </>
        ),
      },
      {
        id: "rete-cerca",
        title: "Cercare e scrivere",
        body: (
          <>
            In <strong>Rete → Cerca</strong> filtri per paese, tipo di attività o parola. Aprendo una scheda leggi la
            presentazione e scrivi una richiesta: chi la riceve vede il tuo nome e i tuoi recapiti e ti risponde
            direttamente. Le richieste ricevute e inviate sono in <strong>Rete → Messaggi</strong>.
          </>
        ),
      },
      {
        id: "rete-vetrina",
        title: "La tua vetrina: foto e listini",
        body: (
          <>
            In <strong>Rete → Il mio profilo</strong>, sopra i dati dell&apos;attività, personalizzi come ti vedono gli
            altri: <strong>copertina</strong> (si vede già nell&apos;elenco dei risultati), <strong>logo</strong>,
            slogan, colore del profilo, fino a 8 foto nella galleria e i <strong>listini</strong> (PDF, Excel o
            immagini). Per ogni documento scegli se lo apre tutta la Rete o solo i tuoi partner. Senza copertina
            l&apos;elenco ti mostra come prima.
          </>
        ),
      },
      {
        id: "rete-collaborazioni",
        title: "Proporre una collaborazione",
        body: (
          <>
            Nella scheda di un professionista premi <strong>Proponi una collaborazione</strong>. Quando accetta, i dati
            dell&apos;attività di entrambi (nome, recapiti, partita IVA, sede, paesi) vengono salvati da soli nelle
            rispettive rubriche: tu lo ritrovi in <strong>Anagrafiche → Fornitori</strong>. Le proposte ricevute si
            accettano o si rifiutano da <strong>Rete → Messaggi</strong>. Serve avere il proprio profilo compilato.
          </>
        ),
      },
      {
        id: "rete-valutazioni",
        title: "Valutazioni anonime",
        body: (
          <>
            Puoi dare un voto <strong>positivo o negativo</strong>, senza testo e senza nome: nessuno, nemmeno il
            valutato, vede chi ha votato, e i totali compaiono dal terzo voto. Non si valuta chi fa il tuo stesso
            mestiere (un&apos;agenzia non valuta le agenzie, una guida non valuta le guide).
          </>
        ),
      },
    ],
  },
];

export default function GuidaPage() {
  return (
    <div className="mx-auto max-w-5xl pb-16">
      <Link
        href="/dashboard/settings"
        className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={14} /> Impostazioni
      </Link>

      <h1 className="mb-2 text-3xl font-medium tracking-tight text-[#233c5e]">
        Guida all&apos;uso del gestionale
      </h1>
      <p className="mb-8 pl-4 text-base text-slate-500">
        Una spiegazione passo per passo, pensata per chi parte da zero: dalla configurazione iniziale fino al link
        che arriva al cliente, e poi l&apos;assistente Zefiro, l&apos;Atlante, l&apos;Operativo e gli strumenti per i clienti.
      </p>

      <nav className="mb-10 rounded-2xl border border-[#e6d7bb] bg-white p-6">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Indice</p>
        <ol className="grid gap-2 text-base sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-[#233c5e] hover:underline">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-14">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="mb-2 text-2xl font-semibold text-slate-900">{section.title}</h2>
            {section.intro && <p className="mb-6 text-base leading-relaxed text-slate-600">{section.intro}</p>}

            <div className="flex flex-col gap-10 border-l-2 border-[#f2e2c4] pl-6">
              {section.steps.map((step) => (
                <div key={step.id} id={step.id} className="scroll-mt-20">
                  <h3 className="mb-2 text-lg font-semibold text-slate-800">{step.title}</h3>
                  <p className="mb-4 text-base leading-relaxed text-slate-600">{step.body}</p>
                  {step.images && step.images.length > 0 && (
                    <div className={step.images.length > 1 ? "grid gap-4 sm:grid-cols-2" : ""}>
                      {step.images.map((image) => (
                        <figure
                          key={image.src}
                          className="overflow-hidden rounded-xl border border-[#e6d7bb] bg-slate-50 shadow-sm"
                        >
                          <Image
                            src={image.src}
                            alt={image.caption}
                            width={1024}
                            height={700}
                            className="w-full"
                            sizes="(max-width: 768px) 100vw, 900px"
                          />
                          <figcaption className="border-t border-[#e6d7bb] bg-white px-3 py-2.5 text-sm text-slate-500">
                            {image.caption}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ec] p-6 text-center">
        <p className="text-base text-slate-600">
          Hai ancora dubbi su qualcosa? Questa guida si aggiorna insieme al gestionale: se manca una spiegazione,
          segnalacelo.
        </p>
      </div>
    </div>
  );
}
