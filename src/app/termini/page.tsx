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
        <p className="mb-6 text-xs text-slate-400">Ultimo aggiornamento: 10 novembre 2026</p>

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
              pubblico.
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
            <h2 className="mb-1 font-semibold text-slate-800">9. Proprietà intellettuale</h2>
            <p>
              Il nome Grand Route, il relativo logo e il software che compone il Servizio sono di
              proprietà del Fornitore e non possono essere riprodotti o utilizzati senza
              autorizzazione, salvo quanto necessario per il normale utilizzo del Servizio.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">10. Modifiche ai Termini</h2>
            <p>
              Questi Termini possono essere aggiornati nel tempo. In caso di modifiche sostanziali,
              gli Utenti saranno informati tramite il Servizio o via email. L&apos;uso continuato del
              Servizio dopo una modifica comporta l&apos;accettazione dei nuovi Termini.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">11. Legge applicabile</h2>
            <p>
              I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà
              competente il foro del luogo di residenza del Fornitore, salvo diversa previsione
              inderogabile di legge a tutela del consumatore.
            </p>
          </section>

          <section>
            <h2 className="mb-1 font-semibold text-slate-800">12. Contatti</h2>
            <p>
              Per qualsiasi domanda relativa a questi Termini è possibile scrivere a{" "}
              <a href="mailto:privacy@grandroute.it" className="font-medium text-[#233c5e] hover:underline">
                privacy@grandroute.it
              </a>
              .
            </p>
          </section>
        </div>

        <Link href="/" className="mt-8 inline-block text-sm font-medium text-[#233c5e] hover:underline">
          ← Torna alla home
        </Link>
    </AuthShell>
  );
}
