import Link from "next/link";
import { BadgeCheck, MapPin, ThumbsDown, ThumbsUp } from "lucide-react";
import { nameItOfCode } from "@/lib/geo/countryCodes";
import { kindLabel } from "@/lib/network/kinds";

export type NetworkRow = {
  user_id: string;
  kind: string;
  business_name: string;
  city: string;
  country: string;
  countries_served: string[];
  languages: string[];
  specialties: string[];
  description: string;
  website: string | null;
  rating_pos: number | null;
  rating_neg: number | null;
  rating_total: number;
};

export function Rating({ row, big }: { row: Pick<NetworkRow, "rating_pos" | "rating_neg" | "rating_total">; big?: boolean }) {
  const t = big ? "text-sm" : "text-xs";
  if (row.rating_pos == null || row.rating_neg == null)
    return <span className={`${t} text-slate-400`}>{row.rating_total > 0 ? "Poche valutazioni" : "Nessuna valutazione"}</span>;
  return (
    <span className={`flex items-center gap-3 ${t} font-medium`}>
      <span className="flex items-center gap-1 text-emerald-700"><ThumbsUp size={big ? 16 : 14} /> {row.rating_pos}</span>
      <span className="flex items-center gap-1 text-[#b0413e]"><ThumbsDown size={big ? 16 : 14} /> {row.rating_neg}</span>
    </span>
  );
}

export default function ProfileCard({ row }: { row: NetworkRow }) {
  const served = row.countries_served.slice(0, 5).map(nameItOfCode);
  return (
    <Link href={`/rete/${row.user_id}`} className="block rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-lg font-semibold text-[#233c5e]" style={{ fontFamily: "var(--font-display)" }}>
            <span className="truncate">{row.business_name}</span>
            <BadgeCheck size={18} className="shrink-0 text-[#c58f2d]" aria-label="Verificato" />
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            {kindLabel(row.kind)} · <MapPin size={12} /> {row.city}, {nameItOfCode(row.country)}
          </p>
        </div>
        <Rating row={row} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{row.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {served.map((c) => (
          <span key={c} className="rounded-full bg-[#faf3e6] px-2.5 py-1 text-xs font-medium text-[#233c5e]">{c}</span>
        ))}
        {row.countries_served.length > 5 && <span className="px-1 py-1 text-xs text-slate-400">+{row.countries_served.length - 5}</span>}
      </div>
    </Link>
  );
}
