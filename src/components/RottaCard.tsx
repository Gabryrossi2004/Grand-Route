import Link from "next/link";
import { ArrowRight, Route } from "lucide-react";
import RottaProgress from "@/components/RottaProgress";
import type { RottaSummary } from "@/lib/rotta";

// Riquadro nella Home: a che punto è lo Sconto Rotta
export default function RottaCard({ s }: { s: RottaSummary }) {
  return (
    <section className="rounded-2xl border border-[#e6d7bb] bg-gradient-to-b from-white to-[#faf7ee] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-medium text-[#233c5e]">
            <Route size={20} className="text-[#c58f2d]" aria-hidden /> Sconto Rotta
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            <strong className="text-[#233c5e]">{s.verified}</strong> {s.verified === 1 ? "viaggio verificato" : "viaggi verificati"} negli ultimi 12 mesi
            {s.discount > 0 ? <> · sconto raggiunto <strong className="text-[#233c5e]">−{s.discount}%</strong></> : null}
            {s.next_at ? <> · ancora {s.next_at - s.verified} per il −{s.next_discount}%</> : <> · traguardo massimo raggiunto</>}
          </p>
          {s.pending > 0 && (
            <p className="mt-1 text-sm font-medium text-amber-800">
              {s.pending} {s.pending === 1 ? "viaggio aspetta" : "viaggi aspettano"} una conferma
            </p>
          )}
        </div>
        <Link href="/dashboard/sconto" className="inline-flex items-center gap-1 rounded-full border border-[#e6d7bb] bg-white px-4 py-1.5 text-sm font-medium text-[#233c5e] hover:bg-[#faf3e6]">
          Vedi i viaggi <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <div className="mt-4 px-3">
        <RottaProgress s={s} />
      </div>
    </section>
  );
}
