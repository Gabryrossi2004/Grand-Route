import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PLATFORM_RULES, mergePlatformRules, type PlatformRule } from "@/lib/aiRules";
import RuleEditor, { type EditableRule } from "./RuleEditor";
import { ASSISTANT_NAME } from "@/lib/assistant";

// Pagina riservata agli amministratori della piattaforma: le regole di base
// che l'AI segue per TUTTE le agenzie. Le agenzie non la vedono.
export default async function AiRulesAdminPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();

  const { data: saved } = await supabase.from("ai_platform_rules").select("*");
  const savedRows = (saved as (PlatformRule & { sort_order: number })[] | null) ?? [];
  const savedKeys = new Set(savedRows.map((row) => row.key));
  const defaultKeys = new Set(DEFAULT_PLATFORM_RULES.map((rule) => rule.key));

  const rules: EditableRule[] = mergePlatformRules(savedRows).map((rule) => ({
    key: rule.key,
    title: rule.title,
    body: rule.body,
    enabled: rule.enabled,
    sort_order: rule.sort_order,
    isDefault: defaultKeys.has(rule.key),
    customized: savedKeys.has(rule.key),
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard/settings"
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={14} /> Impostazioni
      </Link>
      <h1 className="mb-2 text-3xl font-medium tracking-tight text-[#233c5e]">Regole di base di {ASSISTANT_NAME}</h1>
      <p className="mb-6 text-sm text-slate-600">
        Valgono per <strong>tutte le agenzie</strong>, sempre. Ogni agenzia può aggiungere le proprie regole di tono e
        stile, ma non può superare queste. Le modifiche sono attive subito, per le prossime richieste a {ASSISTANT_NAME}.
        Scrivile in italiano semplice, come istruzioni a un collaboratore.
      </p>
      <RuleEditor rules={rules} />
    </div>
  );
}
