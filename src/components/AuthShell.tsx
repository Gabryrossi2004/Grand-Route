// Contenitore condiviso da tutte le pagine di accesso/registrazione e dalle
// pagine legali: stesso sfondo "da documento di viaggio" (bagliori dorati
// sfocati, coerenti con lo sfondo della dashboard) e stessa cornice con
// bordo superiore color ottone, invece di ripetere lo stesso markup in ogni
// pagina.
export default function AuthShell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#faf3e6] px-4 py-12">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 right-[-8%] h-96 w-96 rounded-full bg-[#cda876]/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[-8%] h-96 w-96 rounded-full bg-[#233c5e]/10 blur-3xl" />
      </div>
      <div
        className={`relative z-10 w-full overflow-hidden rounded-2xl border border-[#e6d7bb] bg-white shadow-lg shadow-[#e6d7bb]/40 ${
          wide ? "max-w-2xl" : "max-w-sm"
        }`}
      >
        <div className="h-1.5 bg-gradient-to-r from-[#cda876] via-[#e4cc98] to-[#cda876]" />
        <div className={wide ? "p-8" : "p-8"}>{children}</div>
      </div>
    </div>
  );
}
