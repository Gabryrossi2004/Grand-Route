// Mostrato subito mentre una pagina della sezione Partner si prepara: il clic ha sempre una risposta visibile.
export default function PartnerLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Caricamento">
      <div className="h-3 w-20 rounded bg-[#e6d7bb]/70" />
      <div className="h-9 w-72 max-w-full rounded-lg bg-[#e6d7bb]/70" />
      <div className="h-4 w-96 max-w-full rounded bg-[#e6d7bb]/50" />
      <div className="h-16 rounded-2xl border border-[#e6d7bb] bg-white/70" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-2xl border border-[#e6d7bb] bg-white/70" />
      ))}
    </div>
  );
}
