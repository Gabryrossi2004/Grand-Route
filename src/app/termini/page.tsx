import Link from "next/link";
import AuthBrandHeader from "@/components/AuthBrandHeader";
import AuthShell from "@/components/AuthShell";

export const metadata = {
  title: "Termini di Servizio — Grand Route",
};

export default function TerminiPage() {
  return (
    <AuthShell wide>
      <AuthBrandHeader />
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Termini di Servizio</h1>
        <p className="mb-6 text-xs text-slate-500">Ultimo aggiornamento: 22 novembre 2026</p>

        <div className="flex flex-col gap-5 text-sm leading-relaxed text-slate-600">
          <section>
            <p>
              I presenti Termini di Servizio (i &quot;Termini&quot;) regolano l&apos;utilizzo della
              piattaforma Grand Route (il &quot;Servizio&quot;), fornita da Gabriele Rossi (il
              &quot;Fornitore&quot;). Registrandosi o utilizzando il Servizio, l&apos;utente (l&apos;&quot;Utente&quot;)
              accetta integralmente questi Termini.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">1. Descrizione del Servizio</h2>
            <p>
              Grand Route è un gestionale che consente a agenzie di viaggio e organizzatori
              indipendenti (gli &quot;Utenti Agenzia&quot;) di creare e gestire itinerari di viaggio e di
              condividerli con i propri clienti (i &quot;Clienti&quot;) tramite un&apos;area dedicata o un link
              pubblico. Comprende inoltre l&apos;Atlante (schede e guide dei paesi), l&apos;assistente Zefiro,
              le notifiche e la Community riservata ai professionisti del viaggio.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">2. Registrazione e account</h2>
            <p>
              Per utilizzare il Servizio è necessario creare un account fornendo dati veritieri e
              una password adeguata. L&apos;Utente è responsabile della riservatezza delle proprie
              credenziali e di ogni attività svolta tramite il proprio account.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">3. Utilizzo consentito</h2>
            <p>
              L&apos;Utente si impegna a utilizzare il Servizio in conformità alla legge, a non
              caricare contenuti illeciti, offensivi o che violino diritti di terzi, e a non tentare
              di accedere senza autorizzazione a dati o sistemi del Servizio.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">4. Contenuti caricati dall&apos;Utente</h2>
            <p>
              L&apos;Utente Agenzia resta proprietario dei contenuti che inserisce nel Servizio
              (itinerari, foto, documenti, dati dei Clienti) e ne garantisce la legittima
              disponibilità. Il Fornitore tratta tali contenuti unicamente per fornire il Servizio e
              non ne reclama alcuna proprietà.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">5. Disponibilità del Servizio</h2>
            <p>
              Il Fornitore si impegna a mantenere il Servizio disponibile e funzionante, ma non
              garantisce un funzionamento ininterrotto o privo di errori. Potranno verificarsi
              interruzioni temporanee per manutenzione o per causa di forza maggiore, anche legate
              ai fornitori terzi su cui il Servizio si appoggia (hosting, database, invio email).
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">6. Limitazione di responsabilità</h2>
            <p>
              Nei limiti massimi consentiti dalla legge, il Fornitore non è responsabile per danni
              indiretti, perdita di dati o di profitto derivanti dall&apos;uso o dall&apos;impossibilità di
              uso del Servizio. Il Servizio è fornito &quot;così com&apos;è&quot;, senza garanzie implicite di
              idoneità a uno scopo particolare, salvo quanto diversamente previsto dalla legge
              applicabile a tutela del consumatore.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">7. Sospensione e cessazione dell&apos;account</h2>
            <p>
              Il Fornitore può sospendere o chiudere un account in caso di violazione dei presenti
              Termini o di uso illecito del Servizio. L&apos;Utente può chiudere il proprio account in
              qualsiasi momento richiedendo la cancellazione dei propri dati scrivendo a{" "}
              <a href="mailto:privacy@grandroute.it" className="font-medium text-[#233c5e] hover:underline">
                privacy@grandroute.it
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">8. Responsabilità dell&apos;Utente Agenzia verso i propri Clienti</h2>
            <p>
              Quando un Utente Agenzia inserisce nel Servizio dati personali dei propri Clienti
              (inclusi dati anagrafici e documenti d&apos;identità), l&apos;Utente Agenzia agisce come
              autonomo titolare del trattamento di tali dati nei confronti dei propri Clienti, ed è
              responsabile di avere una base giuridica adeguata per il trattamento (ad esempio il
              consenso del Cliente o l&apos;esecuzione del contratto di viaggio) e di informare i
              propri Clienti ai sensi della normativa sulla protezione dei dati applicabile. Il
              Fornitore agisce, in questo contesto, come responsabile del trattamento ai sensi
              dell&apos;art. 28 GDPR, fornendo esclusivamente l&apos;infrastruttura tecnica. Si veda
              l&apos;
              <Link href="/privacy" className="font-medium text-[#233c5e] hover:underline">
                Informativa sulla Privacy
              </Link>{" "}
              per maggiori dettagli.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">9. Schede paese, guide e informazioni di viaggio</h2>
            <p>
              Le schede e le guide dell&apos;Atlante (documenti d&apos;ingresso, visti, sicurezza, salute,
              clima, usanze, prezzi, fornitori e simili) hanno finalità puramente informativa e di
              supporto al lavoro dell&apos;agenzia. Possono contenere errori o essere superate: le regole di
              ingresso, sanitarie e di sicurezza cambiano spesso. L&apos;Utente Agenzia è tenuto a
              verificarle sulle fonti ufficiali (ad esempio{" "}
              <a href="https://www.viaggiaresicuri.it" className="font-medium text-[#233c5e] hover:underline">
                viaggiaresicuri.it
              </a>
              , il sito delle autorità del paese di destinazione e le compagnie di trasporto) prima di
              comunicarle ai Clienti. Il Fornitore non risponde di decisioni di viaggio, rifiuti
              d&apos;imbarco, ingressi negati o altri danni derivanti dall&apos;uso di tali informazioni senza
              verifica. Le fotografie delle schede provengono da archivi pubblici (ad esempio Wikimedia
              Commons) e restano soggette alle rispettive licenze e ai diritti dei rispettivi autori.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">10. Assistente Zefiro e contenuti generati con l&apos;AI</h2>
            <p>
              Zefiro risponde in parte da informazioni già presenti nel Servizio (viaggio, schede paese,
              domande frequenti dell&apos;agenzia) e, quando non bastano, tramite un servizio di
              intelligenza artificiale di terzi. Le risposte e gli itinerari generati possono essere
              imprecisi o incompleti e non sostituiscono la consulenza professionale: l&apos;Utente Agenzia le
              rilegge e ne risponde prima di inviarle ai Clienti. Le risposte generali già date possono
              essere conservate nell&apos;archivio dell&apos;agenzia per rispondere più rapidamente a domande
              simili; l&apos;agenzia può correggerle o eliminarle in ogni momento. L&apos;uso dell&apos;AI può essere
              soggetto a limiti giornalieri e di budget.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">11. Link condivisi e notifiche</h2>
            <p>
              L&apos;Utente Agenzia può creare link pubblici (ad esempio la scheda di un paese da inviare a un
              Cliente): chiunque abbia il link può vedere il contenuto condiviso, che può essere
              revocato in qualsiasi momento. L&apos;Utente è responsabile di ciò che condivide. Le notifiche
              (promemoria di viaggio, messaggi automatici ai Clienti, Community) sono inviate solo a chi le ha
              attivate e si possono disattivare dalle impostazioni; i messaggi automatici ai Clienti sono
              attivi solo se l&apos;agenzia li abilita.
            </p>
          </section>

          <section id="community">
            <h2 className="mb-1 font-semibold text-slate-800">12. Community e contenuti degli utenti</h2>
            <p className="mb-2">
              La Community è uno spazio riservato ai professionisti del viaggio (agenzie e organizzatori),
              in cui si scambiano recensioni, domande e messaggi su prodotti e fornitori. È organizzata in
              gruppi <strong>aperti</strong> (visibili in vetrina a tutti i professionisti, a cui ci si unisce
              con un clic) e gruppi <strong>privati</strong> (solo su invito del responsabile). Non è
              accessibile ai Clienti. Pubblicando nella Community l&apos;Utente si impegna a rispettare queste
              regole:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                scrivere in modo <strong>rispettoso e pertinente</strong>: sono vietati insulti, attacchi
                personali, discriminazioni, minacce, molestie e toni aggressivi, anche verso fornitori e
                colleghi;
              </li>
              <li>
                <strong>recensioni oneste</strong>: raccontare solo esperienze reali e dirette, senza
                recensioni false, concordate o scritte per danneggiare o favorire un concorrente o un
                fornitore; i fatti vanno descritti per quello che sono, distinguendoli dalle opinioni;
              </li>
              <li>
                <strong>nessun dato personale dei Clienti</strong> (nomi, contatti, documenti, foto
                riconoscibili, dettagli di pratiche) né di altre persone senza il loro consenso;
              </li>
              <li>
                nessuna pubblicità non richiesta, spam, offerte di lavoro o vendita di servizi non
                pertinenti, contenuti illeciti o che violino diritti d&apos;autore e di terzi;
              </li>
              <li>nessun contenuto su questioni politiche, religiose o personali estranee al lavoro di viaggio.</li>
            </ul>
            <p className="mt-2">
              <strong>Contenuti e responsabilità.</strong> L&apos;Utente resta l&apos;unico responsabile di ciò che
              pubblica e ne garantisce la veridicità e la legittimità; le opinioni espresse sono dei singoli
              utenti e non del Fornitore, che non le verifica preventivamente e non garantisce l&apos;esattezza
              delle recensioni e dei consigli. Pubblicando, l&apos;Utente concede al Fornitore e agli altri membri
              del gruppo una licenza gratuita, non esclusiva, limitata al funzionamento del Servizio, per
              mostrare il contenuto ai destinatari previsti; il contenuto resta di sua proprietà e può
              eliminarlo in ogni momento.
            </p>
            <p className="mt-2">
              <strong>Segnalazioni e moderazione.</strong> Ogni membro può segnalare un post o un commento. Il
              responsabile del gruppo (chi lo ha creato) può esaminare le segnalazioni e rimuovere contenuti
              e membri del proprio gruppo; il Fornitore può rimuovere contenuti, sospendere o chiudere
              l&apos;account di chi viola queste regole, anche senza preavviso nei casi gravi, e collaborare con le
              autorità quando la legge lo richiede. Il responsabile di un gruppo agisce a titolo
              volontario e non è un dipendente o un rappresentante del Fornitore. Per segnalare un
              contenuto illecito o richiederne la rimozione si può anche scrivere a{" "}
              <a href="mailto:privacy@grandroute.it" className="font-medium text-[#233c5e] hover:underline">
                privacy@grandroute.it
              </a>
              . La chiusura di un gruppo comporta l&apos;eliminazione dei suoi contenuti.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">13. Fornitori, recensioni e rapporti commerciali</h2>
            <p>
              Il Servizio permette di annotare fornitori e di leggere recensioni dei colleghi, ma non
              intermedia né garantisce alcun acquisto, prenotazione o rapporto commerciale tra gli
              utenti o con terzi. Ogni accordo è concluso e gestito direttamente dalle parti interessate,
              sotto la loro esclusiva responsabilità.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">14. Proprietà intellettuale</h2>
            <p>
              Il nome Grand Route, il relativo logo e il software che compone il Servizio sono di
              proprietà del Fornitore e non possono essere riprodotti o utilizzati senza
              autorizzazione, salvo quanto necessario per il normale utilizzo del Servizio.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">15. Modifiche ai Termini</h2>
            <p>
              Questi Termini possono essere aggiornati nel tempo. In caso di modifiche sostanziali,
              gli Utenti saranno informati tramite il Servizio o via email. L&apos;uso continuato del
              Servizio dopo una modifica comporta l&apos;accettazione dei nuovi Termini.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">16. Legge applicabile</h2>
            <p>
              I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà
              competente il foro del luogo di residenza del Fornitore, salvo diversa previsione
              inderogabile di legge a tutela del consumatore.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">17. Contatti</h2>
            <p>
              Per qualsiasi domanda relativa a questi Termini è possibile scrivere a{" "}
              <a href="mailto:privacy@grandroute.it" className="font-medium text-[#233c5e] hover:underline">
                privacy@grandroute.it
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">18. Viaggiatori privati e richieste alle agenzie</h2>
            <p>
              L&apos;area viaggiatori è uno strumento per organizzare i propri viaggi: Grand Route non
              vende viaggi, voli o servizi turistici e non è parte del rapporto tra il viaggiatore e le
              agenzie. Gli itinerari proposti dalla libreria o scritti dall&apos;assistente sono idee da
              verificare prima di prenotare. Se il viaggiatore manda un viaggio a un&apos;agenzia dell&apos;elenco,
              ogni accordo, preventivo, prenotazione e tutela del pacchetto turistico riguarda solo lui e
              l&apos;agenzia, che risponde dei propri servizi. Le agenzie in elenco decidono da sole se
              comparire e come presentarsi. Alcune funzioni gratuite, come gli itinerari con l&apos;assistente,
              hanno limiti mensili che possono cambiare.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">19. Rete professionale del turismo</h2>
            <p>
              La Rete è un elenco di professionisti del turismo (agenzie, tour operator, agenzie locali, guide,
              autisti, strutture e altri fornitori), riservato a chi svolge un&apos;attività e la dichiara con dati
              veritieri: partita IVA o equivalente, licenze e assicurazioni previste dalla propria attività.
              Grand Route controlla i dati prima di pubblicare un profilo, ma non garantisce la qualità dei servizi
              dei professionisti in elenco e non è parte dei loro accordi: ogni contratto, preventivo e pagamento
              riguarda solo le parti. Email e telefono non sono pubblici: si scrive una richiesta e chi la riceve
              vede i recapiti di chi ha scritto. Le valutazioni sono anonime (solo positivo o negativo, senza testo),
              non si danno a chi svolge la stessa attività del valutato e si mostrano in forma di totale dal terzo
              voto. Grand Route non rivela chi ha votato, può rimuovere valutazioni abusive e sospendere i profili
              con dati falsi o che violano questi Termini. L&apos;accesso potrà diventare a pagamento con un
              abbonamento: i prezzi saranno comunicati prima.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">20. Collaborazioni, ordini di servizio e fatture tra professionisti</h2>
            <p>
              Accettando una collaborazione, i due professionisti acconsentono a scambiarsi i dati dell&apos;attività
              (denominazione, partita IVA, sede, recapiti), che vengono salvati nelle rispettive rubriche. Tra partner si
              possono registrare ordini di servizio: ogni modifica a data, prezzo o condizioni va confermata dall&apos;altra
              parte; il giorno dopo la data del servizio l&apos;ordine risulta svolto; l&apos;annullamento dopo la data limite
              comporta la penale indicata nell&apos;ordine; le variazioni di prezzo proposte dal fornitore si possono
              contestare entro 3 giorni, dopo valgono come accettate. Sono strumenti per tenere traccia degli accordi presi
              tra le parti, che restano le sole responsabili dei servizi e dei pagamenti. Grand Route prepara una bozza di
              fattura con i dati inseriti dalle parti ma non emette fatture, non le invia al Sistema di Interscambio e non
              fornisce consulenza fiscale: chi fattura resta responsabile del contenuto, dell&apos;emissione e della
              trasmissione della fattura. Su richiesta del fornitore, Grand Route invia al cliente promemoria di pagamento
              per le fatture scadute registrate sulla piattaforma; il fornitore può disattivarli in ogni momento.
            </p>
          </section>
        </div>

        <Link href="/" className="mt-8 inline-block text-sm font-medium text-[#233c5e] hover:underline">
          ← Torna alla home
        </Link>
    </AuthShell>
  );
}
