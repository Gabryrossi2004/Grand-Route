// Mostrato subito mentre una pagina del gestionale si prepara: niente schermata ferma.
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-5xl animate-pulse flex-col gap-5" aria-busy="true" aria-label="Caricamento">
      <div className="h-9 w-56 rounded-lg bg-[#e6d7bb]/70" />
      <div className="h-4 w-80 max-w-full rounded bg-[#e6d7bb]/50" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-[#e6d7bb] bg-white/70" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-[#e6d7bb] bg-white/70" />
    </div>
  );
}
