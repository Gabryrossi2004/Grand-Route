import Image from "next/image";
import { Briefcase, Compass, Sparkles } from "lucide-react";
import { areaHref, CLIENT_LOGIN, PRO_LOGIN } from "@/lib/areas";

// Ingresso del sito: due porte separate. I professionisti del turismo da una parte, i clienti e i viaggiatori dall'altra.
// Quando le due aree diventeranno due siti, ognuno mostrerà direttamente la propria porta (vedi proxy.ts).
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#faf3e6]">
      <header className="flex items-center justify-center gap-2.5 border-b border-[#e6d7bb] bg-[#faf3e6] px-4 py-5">
        <Image src="/grand-route-logo.jpg" alt="Grand Route" width={36} height={36} className="rounded-lg shadow-sm" />
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide text-[#233c5e]">
          Grand Route
        </span>
      </header>

      <main className="grid flex-1 grid-cols-1 bg-gradient-to-b from-[#f2e2c4] via-[#cda876] to-[#233c5e] md:grid-cols-2 md:bg-gradient-to-r">
        {/* Professionisti */}
        <section className="flex flex-col items-center justify-center gap-5 px-6 py-14 text-center md:py-20">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#233c5e] text-[#e6d7bb] shadow-sm">
            <Briefcase size={24} />
          </span>
          <div>
            <h2 className="text-2xl font-semibold text-[#233c5e]">Sono un professionista</h2>
            <p className="mx-auto mt-2 max-w-xs text-balance text-sm text-[#3d3424]">
              Agenzie, tour operator, agenzie locali, guide, autisti, strutture e fornitori: itinerari, clienti, servizi, agenda e fatture.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2.5">
            <a
              href={areaHref("pro", PRO_LOGIN)}
              className="rounded-lg bg-[#233c5e] px-7 py-3 text-sm font-semibold text-[#faf3e6] shadow-sm transition hover:bg-[#17283f] hover:shadow-md"
            >
              Accedi
            </a>
            <a href={areaHref("pro", "/signup")} className="text-sm font-medium text-[#233c5e] hover:underline">
              Prima volta? Registra la tua attività
            </a>
          </div>
        </section>

        {/* Clienti e viaggiatori */}
        <section className="flex flex-col items-center justify-center gap-5 px-6 py-14 text-center md:py-20">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#faf3e6] text-[#233c5e] shadow-sm">
            <Compass size={24} />
          </span>
          <div>
            <h2 className="text-2xl font-semibold text-[#faf3e6]">Sono un viaggiatore</h2>
            <p className="mx-auto mt-2 max-w-xs text-balance text-sm text-[#f2e9d8]">
              Ritrova i viaggi organizzati dalla tua agenzia, oppure prepara da solo il tuo prossimo viaggio.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2.5">
            <a
              href={areaHref("client", CLIENT_LOGIN)}
              className="rounded-lg bg-[#faf3e6] px-7 py-3 text-sm font-semibold text-[#233c5e] shadow-sm transition hover:bg-white hover:shadow-md"
            >
              Accedi
            </a>
            <a href={areaHref("client", CLIENT_LOGIN)} className="text-sm font-medium text-[#faf3e6] hover:underline">
              Prima volta? Crea il tuo account
            </a>
          </div>
        </section>
      </main>

      <footer className="flex items-center justify-center gap-2 border-t border-[#e6d7bb] bg-[#faf3e6] px-4 py-4 text-xs font-medium text-[#756548]">
        <Sparkles size={13} className="text-[#cda876]" />
        Itinerari che fanno colpo
      </footer>
    </div>
  );
}
