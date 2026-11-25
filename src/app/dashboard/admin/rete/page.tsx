import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { nameItOfCode } from "@/lib/geo/countryCodes";
import { KIND_FIELDS, isBusinessKind, kindLabel } from "@/lib/network/kinds";
import { setNetworkStatus } from "@/lib/actions/network";

type Row = {
  user_id: string; email: string; full_name: string | null; kind: string; business_name: string; legal_form: string | null; country: string;
  vat_number: string; tax_code: string | null; sdi_code: string | null; pec: string | null; address: string; postal_code: string | null;
  city: string; province: string | null; phone: string; website: string | null; description: string; countries_served: string[];
  languages: string[]; specialties: string[]; kind_data: Record<string, string | string[]>; status: string; status_note: string | null;
  listed: boolean; created_at: string;
};

const TABS = [
  { key: "in_verifica", label: "Da verificare" },
  { key: "verificato", label: "Verificati" },
  { key: "rifiutato", label: "Rifiutati" },
  { key: "sospeso", label: "Sospesi" },
];

// Verifica dei profili della Rete (solo amministratori): si controllano partita IVA, licenze e assicurazioni, poi si approva.
export default async function AdminNetwork({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "in_verifica" } = await searchParams;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();
  const { data, error } = await supabase.rpc("network_admin_list", { p_status: s });
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <Link href="/dashboard/settings" className="mb-4 flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Impostazioni
      </Link>
      <h1 className="mb-4 text-3xl font-medium text-[#233c5e]">Rete: verifica dei profili</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/dashboard/admin/rete?s=${t.key}`} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${s === t.key ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#233c5e]"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {error && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Serve la migrazione 0061.</p>}
      {!error && rows.length === 0 && <p className="text-slate-500">Nessun profilo in questa lista.</p>}
      <div className="grid gap-4">
        {rows.map((r) => {
          const fields = isBusinessKind(r.kind) ? KIND_FIELDS[r.kind] : [];
          return (
            <details key={r.user_id} className="rounded-2xl border border-[#e6d7bb] bg-white p-4 shadow-sm" open={s === "in_verifica"}>
              <summary className="cursor-pointer text-base font-semibold text-[#233c5e]">
                {r.business_name} <span className="text-sm font-normal text-slate-500">· {kindLabel(r.kind)} · {r.city}, {nameItOfCode(r.country)}</span>
              </summary>
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Item k="Referente" v={`${r.full_name ?? ""} — ${r.email}`} />
                <Item k="Telefono" v={r.phone} />
                <Item k="Forma giuridica" v={r.legal_form} />
                <Item k="Partita IVA" v={r.vat_number} />
                <Item k="Codice fiscale" v={r.tax_code} />
                <Item k="SDI / PEC" v={[r.sdi_code, r.pec].filter(Boolean).join(" / ")} />
                <Item k="Sede" v={`${r.address}, ${r.postal_code ?? ""} ${r.city} ${r.province ?? ""}`} />
                <Item k="Sito" v={r.website} />
                <Item k="Paesi" v={r.countries_served.map(nameItOfCode).join(", ")} />
                <Item k="Lingue" v={r.languages.join(", ")} />
                {fields.map((f) => {
                  const v = r.kind_data[f.key];
                  return <Item key={f.key} k={f.label} v={Array.isArray(v) ? v.join(", ") : v} />;
                })}
              </dl>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-[#faf3e6] p-3 text-sm text-slate-700">{r.description}</p>
              <form action={setNetworkStatus} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="user_id" value={r.user_id} />
                <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-600">
                  Nota per l&apos;utente (facoltativa)
                  <input name="note" defaultValue={r.status_note ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <button name="status" value="verificato" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Verifica</button>
                <button name="status" value="rifiutato" className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white">Chiedi correzioni</button>
                <button name="status" value="sospeso" className="rounded-full bg-[#b0413e] px-4 py-2 text-sm font-semibold text-white">Sospendi</button>
              </form>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v || !v.trim()) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="text-slate-800">{v}</dd>
    </div>
  );
}
