import Image from "next/image";
import Link from "next/link";
import { Compass, MapPin, Plane, Sparkles, User } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="pointer-events-none absolute -top-24 right-[-10%] h-96 w-96 rounded-full bg-blue-100 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-10%] h-96 w-96 rounded-full bg-indigo-100 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <Image src="/grand-route-logo.jpg" alt="Grand Route" width={56} height={56} className="mb-4 rounded-xl shadow-sm" />

        <div className="mb-6 flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm backdrop-blur">
          <Sparkles size={14} className="text-blue-500" />
          Itinerari che fanno colpo
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Grand <span className="text-blue-600">Route</span>
        </h1>
        <p className="mt-4 max-w-md text-balance text-base text-slate-500 sm:text-lg">
          Crea itinerari curati e condividili con i tuoi clienti attraverso una pagina brandizzata,
          elegante e pronta da mandare — come su Travefy.
        </p>

        <div className="mt-9 flex gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 hover:shadow-md"
          >
            Inizia gratis
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Accedi
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-400">Area riservata alle agenzie di viaggio</p>

        <Link
          href="/client/login"
          className="mt-8 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <User size={15} />
          Sei un cliente? Accedi alla tua area viaggi
        </Link>

        <div className="mt-16 grid grid-cols-3 gap-6 text-slate-400 sm:gap-10">
          <div className="flex flex-col items-center gap-1.5">
            <Plane size={20} />
            <span className="text-xs font-medium">Itinerari</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <MapPin size={20} />
            <span className="text-xs font-medium">Tappe</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Compass size={20} />
            <span className="text-xs font-medium">Esperienze</span>
          </div>
        </div>
      </main>
    </div>
  );
}
