import Image from "next/image";
import Link from "next/link";
import { Briefcase, Sparkles, User } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-center gap-2.5 border-b border-slate-100 px-4 py-5">
        <Image src="/grand-route-logo.jpg" alt="Grand Route" width={36} height={36} className="rounded-lg shadow-sm" />
        <span className="text-lg font-bold tracking-tight text-slate-900">
          Grand <span className="text-blue-600">Route</span>
        </span>
      </header>

      <main className="grid flex-1 grid-cols-1 sm:grid-cols-2">
        {/* Agenzie */}
        <section className="group relative flex flex-col items-center justify-center gap-5 overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-16 text-center transition sm:border-b-0 sm:border-r">
          <div className="pointer-events-none absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-blue-100 opacity-70 blur-3xl" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <Briefcase size={24} />
          </span>
          <div className="relative">
            <h2 className="text-2xl font-bold text-slate-900">Sono un&apos;agenzia</h2>
            <p className="mx-auto mt-2 max-w-xs text-balance text-sm text-slate-500">
              Crea itinerari curati e condividili con i tuoi clienti attraverso una pagina brandizzata ed elegante.
            </p>
          </div>
          <div className="relative flex flex-col items-center gap-2.5">
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 hover:shadow-md"
            >
              Inizia gratis
            </Link>
            <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 hover:underline">
              Accedi al tuo account agenzia
            </Link>
          </div>
        </section>

        {/* Clienti */}
        <section className="group relative flex flex-col items-center justify-center gap-5 overflow-hidden bg-gradient-to-bl from-amber-50 to-white px-6 py-16 text-center transition">
          <div className="pointer-events-none absolute -bottom-24 left-[-10%] h-72 w-72 rounded-full bg-amber-100 opacity-70 blur-3xl" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <User size={24} />
          </span>
          <div className="relative">
            <h2 className="text-2xl font-bold text-slate-900">Sono un cliente</h2>
            <p className="mx-auto mt-2 max-w-xs text-balance text-sm text-slate-500">
              Accedi alla tua area riservata e ritrova tutti i viaggi che la tua agenzia ha organizzato per te.
            </p>
          </div>
          <div className="relative flex flex-col items-center gap-2.5">
            <Link
              href="/client/login"
              className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 hover:shadow-md"
            >
              Accedi ai miei viaggi
            </Link>
            <Link href="/client/signup" className="text-sm font-medium text-slate-500 hover:text-slate-900 hover:underline">
              Prima volta? Registrati qui
            </Link>
          </div>
        </section>
      </main>

      <footer className="flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-4 text-xs font-medium text-slate-400">
        <Sparkles size={13} className="text-blue-400" />
        Itinerari che fanno colpo
      </footer>
    </div>
  );
}
