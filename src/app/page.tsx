import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <h1 className="text-3xl font-semibold text-slate-900">Gestionale Viaggi</h1>
      <p className="mt-3 max-w-md text-slate-500">
        Crea itinerari di viaggio e condividili con i tuoi clienti attraverso una pagina
        brandizzata, come su Travefy.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Inizia gratis
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Accedi
        </Link>
      </div>
    </div>
  );
}
