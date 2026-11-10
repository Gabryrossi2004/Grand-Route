import Image from "next/image";

// Intestazione con logo e nome della piattaforma, mostrata su tutte le
// pagine di accesso (login/registrazione/recupero password), sia lato
// agenzia che lato clienti. Il nome dell'agenzia stessa (configurabile da
// ogni agenzia in Impostazioni) resta invece separato: compare dentro la
// dashboard e sulle pagine dei viaggi, non qui.
export default function AuthBrandHeader() {
  return (
    <div className="mb-7 flex flex-col items-center gap-3">
      <Image
        src="/grand-route-logo.jpg"
        alt="Grand Route"
        width={48}
        height={48}
        className="rounded-xl shadow-sm"
      />
      <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide text-[#2b333e]">
        Grand Route
      </span>
    </div>
  );
}
