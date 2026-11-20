"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { getSuppliersForPlace, type PlaceSupplier, type PlaceSuppliers } from "@/lib/actions/placeSuppliers";

const CATEGORY: Record<string, string> = { alloggio: "Alloggio", trasporto: "Trasporto", attivita: "Attività", ristorazione: "Ristorazione", altro: "Altro" };

function Row({ s }: { s: PlaceSupplier }) {
  return (
    <li className="rounded-xl border border-[#e6d7bb] bg-white px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-[#1d2b40]">{s.full_name}</span>
        <span className="rounded-full bg-[#f6eedc] px-2 py-0.5 text-[11px] text-[#5b4a2c]">{CATEGORY[s.category] ?? s.category}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
        {s.phone && (
          <a href={`tel:${s.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 hover:underline">
            <Phone size={12} /> {s.phone}
          </a>
        )}
        {s.email && (
          <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 hover:underline">
            <Mail size={12} /> {s.email}
          </a>
        )}
      </div>
      {s.notes && <p className="mt-0.5 text-xs text-slate-500">{s.notes}</p>}
    </li>
  );
}

// I fornitori dell'agenzia per questo paese (o regione): solo per l'agenzia, non compare nella stampa né nel link per il cliente.
export default function CountrySuppliers({ code, region }: { code: string; region?: string }) {
  const [data, setData] = useState<PlaceSuppliers | null>(null);

  useEffect(() => {
    let alive = true;
    getSuppliersForPlace(code, region).then((res) => alive && setData(res));
    return () => {
      alive = false;
    };
  }, [code, region]);

  if (!data) return null;
  const total = data.tagged.length + data.used.length;
  return (
    <div className="print:hidden">
      <h3 className="mb-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[#233c5e]">I tuoi fornitori qui</h3>
      <p className="mb-2 text-xs text-slate-500">Solo per te: non compare nella stampa né nel link per il cliente.</p>
      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-[#ddc8a0] px-3 py-2 text-sm text-slate-600">
          Nessun fornitore collegato.{" "}
          <Link href="/dashboard/suppliers" className="font-semibold text-[#233c5e] underline">
            Nella rubrica fornitori
          </Link>{" "}
          indica in quali paesi lavorano{data.ready ? "" : " (serve l'aggiornamento del database 0050)"}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.tagged.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.tagged.map((s) => (
                <Row key={s.id} s={s} />
              ))}
            </ul>
          )}
          {data.used.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#a87a1e]">Già usati nei tuoi viaggi in questo paese</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.used.map((s) => (
                  <Row key={s.id} s={s} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
