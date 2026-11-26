import Image from "next/image";

// Intestazione con logo e nome della piattaforma, mostrata su tutte le
// pagine di accesso (login/registrazione/recupero password), sia lato
// agenzia che lato clienti. Il nome dell'agenzia stessa (configurabile da
// ogni agenzia in Impostazioni) resta invece separato: compare dentro la
// dashboard e sulle pagine dei viaggi, non qui.
export default function AuthBrandHeader({ area, label }: { area?: "pro" | "client"; label?: string } = {}) {
  return (
    <div className="mb-7 flex flex-col items-center gap-3">
      <Image
        src="/grand-route-logo.jpg"
        alt="Grand Route"
        width={48}
        height={48}
        className="rounded-xl shadow-sm"
      />
      <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide text-[#233c5e]">
        Grand Route
      </span>
      {area && label && (
        <span
          className={`-mt-1.5 rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
            area === "pro" ? "bg-[#233c5e] text-[#faf3e6]" : "bg-[#cda876]/25 text-[#8a5a12]"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
