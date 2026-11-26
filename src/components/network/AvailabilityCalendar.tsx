// Disponibilità di un fornitore, in sola lettura: mesi con i giorni liberi, non disponibili e (se condiviso) già impegnati.
export type AvailabilityDay = { day: string; state: string };

const monthTitle = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12)).toISOString().slice(0, 10);

export default function AvailabilityCalendar({ days, today, months = 3, withBusy }: { days: AvailabilityDay[]; today: string; months?: number; withBusy: boolean }) {
  const state = new Map(days.map((d) => [d.day, d.state]));
  const [y0, m0] = today.split("-").map(Number);
  const grids = Array.from({ length: months }, (_, k) => {
    const first = new Date(Date.UTC(y0, m0 - 1 + k, 1, 12));
    const y = first.getUTCFullYear();
    const m = first.getUTCMonth();
    const count = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // lunedì = 0
    return { title: monthTitle(iso(y, m, 1)), cells: [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => iso(y, m, i + 1))] };
  });

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {grids.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 text-sm font-semibold capitalize text-[#233c5e]">{g.title}</p>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase text-slate-400">
              {["L", "M", "M", "G", "V", "S", "D"].map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <div className="mt-0.5 grid grid-cols-7 gap-0.5">
              {g.cells.map((c, i) => {
                if (!c) return <span key={`b${i}`} />;
                const s = state.get(c);
                const past = c < today;
                const cls =
                  s === "non_disponibile"
                    ? "bg-[repeating-linear-gradient(135deg,#e2d7bd_0,#e2d7bd_4px,#f4efe2_4px,#f4efe2_8px)] text-slate-600"
                    : s === "impegnato"
                      ? "bg-amber-100 text-amber-900"
                      : "border border-[#efe3c8] bg-white text-slate-700";
                return (
                  <span
                    key={c}
                    title={s === "non_disponibile" ? "Non disponibile" : s === "impegnato" ? "Già impegnato" : "Nessun impedimento segnalato"}
                    className={`flex h-8 items-center justify-center rounded-md text-xs font-medium ${cls} ${past ? "opacity-40" : ""} ${c === today ? "ring-2 ring-[#233c5e]" : ""}`}
                  >
                    {Number(c.slice(8))}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border border-[#efe3c8] bg-white" /> Nessun impedimento segnalato</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-[repeating-linear-gradient(135deg,#e2d7bd_0,#e2d7bd_3px,#f4efe2_3px,#f4efe2_6px)]" /> Non disponibile</span>
        {withBusy && <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-amber-100" /> Già impegnato</span>}
      </p>
    </div>
  );
}
