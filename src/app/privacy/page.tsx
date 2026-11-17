import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";

export const metadata = {
  title: "Informativa sulla Privacy — Grand Route",
};

export default function PrivacyPage() {
  return (
    <AuthShell wide>
      <AuthBrandHeader />
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Informativa sulla Privacy</h1>
        <p className="mb-6 text-xs text-slate-500">Ultimo aggiornamento: 10 novembre 2026</p>

        <div className="flex flex-col gap-5 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="mb-1 font-semibold text-slate-800">1. Titolare del trattamento</h2>
            <p>
              Il titolare del trattamento dei dati raccolti tramite la piattaforma Grand Route
              (il &quot;Servizio&quot;) è Gabriele Rossi. Per qualsiasi richiesta relativa al trattamento dei
              dati personali è possibile scrivere a{" "}
              <a href="mailto:privacy@grandroute.it" className="font-medium text-[#233c5e] hover:underline">
                privacy@grandroute.it
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">2. Che cos&apos;è Grand Route</h2>
            <p>
              Grand Route è un gestionale che permette ad agenzie di viaggio e organizzatori
              indipendenti (gli &quot;Utenti Agenzia&quot;) di creare itinerari di viaggio e condividerli con
              i propri clienti (i &quot;Clienti&quot;), i quali possono consultarli tramite un&apos;area
              dedicata o un link pubblico.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">3. Dati raccolti e finalità</h2>
            <p className="mb-2">Raccogliamo e trattiamo le seguenti categorie di dati:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Dati di account:</strong> nome, cognome, indirizzo email e password (salvata in
                forma cifrata), necessari per creare e gestire l&apos;account e autenticarsi.
              </li>
              <li>
                <strong>Dati di profilo agenzia:</strong> nome dell&apos;agenzia, logo, colore del
                marchio, termini e condizioni personalizzati, inseriti volontariamente dall&apos;Utente
                Agenzia per personalizzare gli itinerari condivisi con i propri Clienti.
              </li>
              <li>
                <strong>Dati dei viaggi e degli itinerari:</strong> destinazioni, date, attività,
                documenti di viaggio, foto e note inserite dall&apos;Utente Agenzia per costruire
                l&apos;itinerario di un Cliente.
              </li>
              <li>
                <strong>Dati anagrafici dei Clienti</strong>, inseriti dall&apos;Utente Agenzia per la
                gestione della pratica di viaggio: data e luogo di nascita, nazionalità, codice
                fiscale, indirizzo di residenza, numero e scadenza di documenti d&apos;identità
                (carta d&apos;identità, passaporto). Questi dati, per la loro natura sensibile, sono
                conservati <strong>cifrati</strong> nel nostro database (cifratura AES-256) e non sono
                mai leggibili in chiaro da chi dovesse accedere direttamente ai sistemi di
                archiviazione.
              </li>
              <li>
                <strong>Dati tecnici:</strong> indirizzo IP, log di accesso ed errori applicativi,
                raccolti automaticamente per garantire sicurezza e stabilità del Servizio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">4. Base giuridica del trattamento</h2>
            <p>
              Il trattamento si fonda sull&apos;esecuzione del contratto di utilizzo del Servizio
              (art. 6.1.b GDPR) per i dati di account e di profilo, e sul legittimo interesse del
              Titolare a garantire sicurezza e funzionamento del Servizio per i dati tecnici. I dati
              anagrafici dei Clienti sono trattati dall&apos;Utente Agenzia in qualità di autonomo
              titolare del trattamento nei confronti dei propri Clienti (si veda la sezione 8 dei{" "}
              <Link href="/termini" className="font-medium text-[#233c5e] hover:underline">
                Termini di Servizio
              </Link>
              ); Grand Route agisce, per tali dati, come responsabile del trattamento ai sensi
              dell&apos;art. 28 GDPR, limitandosi a fornire l&apos;infrastruttura tecnica necessaria.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">5. Conservazione dei dati</h2>
            <p>
              I dati sono conservati per tutta la durata dell&apos;account e, dopo la sua eventuale
              chiusura, per il tempo necessario ad adempiere a obblighi legali o a far valere diritti
              in sede giudiziaria, e comunque non oltre 10 anni, salvo richiesta di cancellazione
              anticipata.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">6. Soggetti terzi che trattano i dati</h2>
            <p className="mb-2">
              Per il funzionamento del Servizio ci appoggiamo ai seguenti fornitori, che trattano i
              dati per nostro conto in qualità di responsabili del trattamento:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Supabase</strong> — hosting del database e dei file (documenti, foto, loghi).
              </li>
              <li>
                <strong>Vercel</strong> — hosting dell&apos;applicazione web.
              </li>
              <li>
                <strong>Resend</strong> — invio delle email transazionali (conferma registrazione,
                recupero password).
              </li>
              <li>
                <strong>Anthropic</strong> — elaborazione delle richieste all&apos;assistente Zefiro (ad
                esempio i testi degli itinerari, le richieste dei clienti e i listini che l&apos;agenzia
                sceglie di sottoporgli e le domande che i clienti rivolgono a Zefiro sul proprio viaggio). Quando
                si usa Zefiro, solo il testo necessario alla richiesta e i dati del viaggio che il cliente può già
                vedere vengono inviati per l&apos;elaborazione.
              </li>
              <li>
                <strong>OpenStreetMap (Overpass)</strong> — ricerca di luoghi vicini (farmacie, bancomat, ristoranti)
                quando il cliente la chiede a Zefiro. Riceve soltanto coordinate approssimate (circa 100 metri) e il tipo
                di luogo cercato: la posizione del cliente non viene salvata.
              </li>
              <li>
                <strong>Open-Meteo</strong> — previsioni del tempo nell&apos;area clienti. Riceve
                soltanto il nome della località di destinazione, nessun dato personale.
              </li>
              <li>
                <strong>Sentry</strong> — monitoraggio tecnico degli errori applicativi, per garantire
                la stabilità del Servizio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">7. Misure di sicurezza</h2>
            <p>
              Adottiamo misure tecniche e organizzative adeguate a proteggere i dati, tra cui: cifratura
              dei dati sensibili dei Clienti nel database, cifratura delle comunicazioni (HTTPS/TLS),
              controllo degli accessi basato su autenticazione e autorizzazione a livello di riga
              (Row Level Security), header di sicurezza HTTP e monitoraggio degli errori applicativi.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">8. Diritti dell&apos;interessato</h2>
            <p>
              In qualsiasi momento è possibile esercitare i diritti previsti dagli artt. 15-22 GDPR:
              accesso, rettifica, cancellazione, limitazione, portabilità e opposizione al trattamento,
              scrivendo a{" "}
              <a href="mailto:privacy@grandroute.it" className="font-medium text-[#233c5e] hover:underline">
                privacy@grandroute.it
              </a>
              . È inoltre possibile presentare reclamo al Garante per la protezione dei dati
              personali (
              <a
                href="https://www.garanteprivacy.it"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#233c5e] hover:underline"
              >
                www.garanteprivacy.it
              </a>
              ).
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">9. Minori</h2>
            <p>
              Il Servizio non è destinato a minori di 16 anni per la creazione di un account. I dati
              di minori eventualmente presenti negli itinerari (es. figli in viaggio) sono inseriti e
              gestiti sotto la responsabilità dell&apos;Utente Agenzia e, se applicabile, con il
              consenso di chi esercita la responsabilità genitoriale.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">10. Modifiche alla presente informativa</h2>
            <p>
              Questa informativa può essere aggiornata nel tempo. In caso di modifiche sostanziali, gli
              Utenti saranno informati tramite il Servizio o via email.
            </p>
          </section>
        </div>

        <Link href="/" className="mt-8 inline-block text-sm font-medium text-[#233c5e] hover:underline">
          ← Torna alla home
        </Link>
    </AuthShell>
  );
}
