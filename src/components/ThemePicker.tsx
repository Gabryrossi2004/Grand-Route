import { themeOptions } from "@/lib/themes";
import type { TripTheme } from "@/lib/types";
import { updateTripTheme } from "@/app/dashboard/trips/[id]/actions";

export default function ThemePicker({ tripId, current }: { tripId: string; current: TripTheme }) {
  return (
    <form action={updateTripTheme.bind(null, tripId)} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {themeOptions.map((theme) => {
        const isActive = theme.id === current;
        return (
          <button
            key={theme.id}
            type="submit"
            name="theme"
            value={theme.id}
            title={theme.description}
            className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition ${
              isActive ? "border-[#d3b589] bg-[#faf3e6]" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <span
              className="h-8 w-8 rounded-full border border-black/5"
              style={{ background: `linear-gradient(135deg, ${theme.swatchFrom}, ${theme.swatchTo})` }}
            />
            <span className="text-xs font-medium text-slate-700">{theme.label}</span>
          </button>
        );
      })}
    </form>
  );
}
