"use server";

import { createClient } from "@/lib/supabase/server";
import { cleanReferralCode } from "@/lib/referral";
import { isBusinessKind, isTradeKind } from "@/lib/network/kinds";
import { formToRecord, hasBusinessInput, validateNetworkProfile } from "@/lib/network/validate";

type State = { error?: string; errors?: Record<string, string>; success?: boolean } | undefined;

export async function signup(_prevState: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "agenzia");
  const kind = isBusinessKind(kindRaw) ? kindRaw : "agenzia";

  if (fullName.length < 2) return { error: "Scrivi nome e cognome." };
  if (password.length < 6) {
    return { error: "La password deve avere almeno 6 caratteri." };
  }
  if (!formData.get("acceptTerms")) {
    return { error: "Devi accettare i Termini di Servizio e l'Informativa sulla Privacy." };
  }

  // Dati dell'attività: obbligatori per i fornitori, facoltativi per agenzie e tour operator (si completano nella Rete)
  const record = formToRecord(formData);
  const referral = cleanReferralCode(formData.get("referral"));
  for (const k of ["email", "fullName", "kind", "acceptTerms", "acceptTruth", "referral", "accountMode"]) delete record[k];
  const trade = isTradeKind(kind);
  // Account aziendale (con il team) o individuale: il team è per agenzie, tour operator e DMC
  const accountMode = trade && formData.get("accountMode") === "azienda" ? "azienda" : "individuale";
  let draft: Record<string, unknown> | null = null;
  if (!trade || hasBusinessInput(record)) {
    const checked = validateNetworkProfile(kind, record);
    if (!checked.ok) return { error: "Controlla i campi evidenziati.", errors: checked.errors };
    if (!formData.get("acceptTruth")) return { error: "Conferma che i dati dell'attività sono veritieri.", errors: { acceptTruth: "Obbligatorio." } };
    draft = record;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        business_kind: kind,
        account_mode: accountMode,
        ...(referral ? { referral_code: referral } : {}),
        ...(draft ? { network_draft: draft } : {}),
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
