import Image from "next/image";

// Intestazione con logo e nome della piattaforma, mostrata su tutte le
// pagine di accesso (login/registrazione/recupero password), sia lato
// agenzia che lato clienti. Il nome dell'agenzia stessa (configurabile da
// ogni agenzia in Impostazioni) resta invece separato: compare dentro la
// dashboard e sulle pagine dei viaggi, non qui.
export default function AuthBrandHeader() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <Image
        src="/grand-route-logo.jpg"
        alt="Grand Route"
        width={48}
        height={48}
        className="rounded-xl shadow-sm"
      />
      <span className="text-sm font-semibold tracking-wide text-slate-700">Grand Route</span>
    </div>
  );
}
