import Link from "next/link";
import { Archive, BookOpen, ChevronRight, Gift, Users } from "lucide-react";
import { createClient, getCachedUser } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import SettingsForm from "./SettingsForm";
import LogoUploader from "./LogoUploader";
import AiRulesCard from "./AiRulesCard";
import { ASSISTANT_NAME } from "@/lib/assistant";
import ZefiroCard from "./ZefiroCard";
import ZefiroUsageCard from "./ZefiroUsageCard";
import ClientZefiroCard from "./ClientZefiroCard";
import OpsSettingsCard from "./OpsSettingsCard";
import AutoMessagesCard from "./AutoMessagesCard";
import { parseAiPlan } from "@/lib/aiPricing";
import { getAiUsageSummary } from "@/lib/aiQuota";
import { parseLogoShape } from "@/lib/logoShape";
import { getAvatarStyle, isAvatarVisible } from "@/lib/assistant";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  const usage = await getAiUsageSummary();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-3xl font-medium tracking-tight text-[#233c5e]">Impostazioni</h1>

      <Link
        href="/dashboard/settings/guida"
        className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#e6d7bb] bg-gradient-to-r from-[#faf3e6] to-white px-5 py-4 transition hover:shadow-sm"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-white">
            <BookOpen size={16} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Guida all&apos;uso del gestionale</span>
            <span className="block text-xs text-slate-500">
              Spiegazione passo per passo con schermate, pensata per chi parte da zero.
            </span>
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-500" />
      </Link>

      <Link
        href="/dashboard/settings/vantaggi"
        className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#e6d7bb] bg-white px-5 py-4 transition hover:shadow-sm"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-white">
            <Gift size={16} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Vantaggi per i clienti</span>
            <span className="block text-xs text-slate-500">Programma fedeltà a punti, livelli e offerte riservate a chi viaggia con te.</span>
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-500" />
      </Link>

      <Link
        href="/dashboard/settings/viaggiatori"
        className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#e6d7bb] bg-white px-5 py-4 transition hover:shadow-sm"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#233c5e] text-white">
            <Users size={16} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Vetrina per i viaggiatori</span>
            <span className="block text-xs text-slate-500">Compari nell&apos;elenco di chi organizza da solo e riceve richieste con l&apos;itinerario già pronto.</span>
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-500" />
      </Link>

      <Link
        href="/dashboard/settings/zefiro"
        className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#e6d7bb] bg-white px-5 py-4 transition hover:shadow-sm"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c58f2d] text-white">
            <Archive size={16} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">Archivio di {ASSISTANT_NAME}</span>
            <span className="block text-xs text-slate-500">
              Domande frequenti, risposte salvate e quante risposte sono state date gratis senza AI.
            </span>
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-500" />
      </Link>

      <LogoUploader logoUrl={(profile as Profile).logo_url} initialShape={parseLogoShape((profile as Profile).logo_shape)} />

      <SettingsForm profile={profile as Profile} />

      <div className="mt-6">
        <AutoMessagesCard initiallyOn={(profile as Profile).ai_preferences?.auto_messages === "on"} />
        <OpsSettingsCard initiallyOn={(profile as Profile).ai_preferences?.ops_import === "on"} />
        <AiRulesCard profile={profile as Profile} />
        {usage && <ZefiroUsageCard summary={usage} />}
        <ClientZefiroCard
          initiallyOn={((profile as Profile).ai_preferences?.client_zefiro ?? "on") !== "off"}
          preferences={(profile as Profile).ai_preferences}
          plan={parseAiPlan((profile as Profile).ai_plan)}
          initialGuide={(profile as Profile).ai_preferences?.client_guide ?? ""}
        />
        <ZefiroCard
          initiallyVisible={isAvatarVisible((profile as Profile).ai_preferences)}
          initialStyle={getAvatarStyle((profile as Profile).ai_preferences)}
        />
      </div>

      {isAdmin === true && (
        <Link
          href="/dashboard/admin"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#233c5e]/30 bg-white px-5 py-4 transition hover:shadow-sm"
        >
          <span>
            <span className="block text-sm font-semibold text-slate-900">Amministrazione</span>
            <span className="block text-xs text-slate-500">Verifica dei profili della Rete, utenti e sospensioni, segnalazioni e regole di {ASSISTANT_NAME}.</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-500" />
        </Link>
      )}
    </div>
  );
}
