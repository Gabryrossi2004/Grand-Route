import Image from "next/image";
import Link from "next/link";
import { Briefcase, Sparkles, User } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#faf3e6]">
      <header className="flex items-center justify-center gap-2.5 border-b border-[#e6d7bb] bg-[#faf3e6] px-4 py-5">
        <Image src="/grand-route-logo.jpg" alt="Grand Route" width={36} height={36} className="rounded-lg shadow-sm" />
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide text-[#233c5e]">
          Grand Route
        </span>
      </header>

      <main className="grid flex-1 grid-cols-1 bg-gradient-to-b from-[#f2e2c4] via-[#cda876] to-[#233c5e] sm:grid-cols-2 sm:bg-gradient-to-r">
        {/* Agenzie */}
        <section className="relative flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#233c5e] text-[#e6d7bb] shadow-sm">
            <Briefcase size={24} />
          </span>
          <div className="relative">
            <h2 className="text-2xl font-semibold text-[#233c5e]">Agenti di viaggio</h2>
            <p className="mx-auto mt-2 max-w-xs text-balance text-sm text-[#6b5f4a]">
              Crea itinerari curati e condividili con i tuoi clienti attraverso una pagina brandizzata ed elegante.
            </p>
          </div>
          <div className="relative flex flex-col items-center gap-2.5">
            <Link
              href="/signup"
              className="rounded-lg bg-[#233c5e] px-6 py-3 text-sm font-semibold text-[#faf3e6] shadow-sm transition hover:bg-[#17283f] hover:shadow-md"
            >
              Inizia gratis
            </Link>
            <Link href="/login" className="text-sm font-medium text-[#6b5f4a] hover:text-[#233c5e] hover:underline">
              Accedi al tuo account agenzia
            </Link>
          </div>
        </section>

        {/* Clienti */}
        <section className="relative flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#cda876] text-[#233c5e] shadow-sm">
            <User size={24} />
          </span>
          <div className="relative">
            <h2 className="text-2xl font-semibold text-[#faf3e6]">Viaggiatore</h2>
            <p className="mx-auto mt-2 max-w-xs text-balance text-sm text-[#f2e9d8]">
              Accedi alla tua area riservata e ritrova tutti i viaggi che la tua agenzia ha organizzato per te.
            </p>
          </div>
          <div className="relative flex flex-col items-center gap-2.5">
            <Link
              href="/client/login"
              className="rounded-lg bg-[#cda876] px-6 py-3 text-sm font-semibold text-[#233c5e] shadow-sm transition hover:bg-[#bd9765] hover:shadow-md"
            >
              Accedi ai miei viaggi
            </Link>
            <Link href="/client/signup" className="text-sm font-medium text-[#e3d9c4] hover:text-[#faf3e6] hover:underline">
              Prima volta? Registrati qui
            </Link>
          </div>
        </section>
      </main>

      <footer className="flex items-center justify-center gap-2 border-t border-[#e6d7bb] bg-[#faf3e6] px-4 py-4 text-xs font-medium text-[#8c7a5e]">
        <Sparkles size={13} className="text-[#cda876]" />
        Itinerari che fanno colpo
      </footer>
    </div>
  );
}
