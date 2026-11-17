"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Languages } from "lucide-react";
import { translateTripForReader } from "@/lib/actions/tripTranslation";
import { useI18n } from "@/components/I18nProvider";

// Avvisa che l'itinerario si sta traducendo e, quando è pronto, aggiorna la pagina.
export default function ItineraryTranslator({ tripId }: { tripId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    translateTripForReader(tripId)
      .then((result) => {
        if ("error" in result) setError(result.error);
        else router.refresh();
      })
      .catch((e: Error) => setError(`net: ${e.message}`.slice(0, 200)));
  }, [tripId, router]);

  return (
    <div className="mx-auto mb-4 flex w-full max-w-3xl items-start gap-2 rounded-2xl border border-[#e6d7bb] bg-[#faf3e6] px-4 py-3 text-sm text-[#233c5e] print:hidden">
      {error ? <Languages size={16} className="mt-0.5 shrink-0" /> : <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />}
      <div>
        <p>{error ? t("trip.translateFailed") : t("trip.translating")}</p>
        {error && <p className="mt-1 break-words text-xs text-slate-500">({error})</p>}
      </div>
    </div>
  );
}
