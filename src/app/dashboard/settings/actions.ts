"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detectFileMime, safeStorageName, validateImageFile, verifyFileSignature } from "@/lib/fileValidation";
import { reserveAiCall } from "@/lib/aiQuota";
import { loadAiRules } from "@/lib/aiRulesServer";
import {
  MAX_AGENCY_RULES_CHARS,
  PREFERENCE_OPTIONS,
  buildAgencyRulesBlock,
  formatRulesForPrompt,
  type PreferenceKey,
} from "@/lib/aiRules";
import { generateRulesSample } from "@/lib/rulesSampleAi";
import { ZEFIRO_MODES } from "@/lib/assistant";
import { NOT_TITOLARE, companyIdOf, getTeamContext } from "@/lib/team";

export async function updateProfile(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Devi essere loggato." };
  const team = await getTeamContext();
  const companyId = team?.companyId ?? user.id;

  const kindRaw = String(formData.get("business_kind") ?? "");
  const agencyName = String(formData.get("agency_name") ?? "").trim() || null;
  const brandColor = String(formData.get("brand_color") ?? "#2563eb");
  const termsAndConditions = String(formData.get("terms_and_conditions") ?? "").trim() || null;
  const uiFontSize = String(formData.get("ui_font_size") ?? "normale");
  const uiFontFamily = String(formData.get("ui_font_family") ?? "predefinito");
  const emergencyPhone = String(formData.get("emergency_phone") ?? "").trim() || null;

  // Dati dell'agenzia (solo i titolari) e preferenze personali (lettura e notifiche: di ciascuno)
  const agency: Record<string, unknown> = {
    account_type: "agency",
    agency_name: agencyName,
    brand_color: brandColor,
    terms_and_conditions: termsAndConditions,
    emergency_phone: emergencyPhone,
  };
  const personal: Record<string, unknown> = {
    ui_font_size: ["normale", "grande", "molto_grande"].includes(uiFontSize) ? uiFontSize : "normale",
    ui_font_family: ["predefinito", "leggibile", "classico"].includes(uiFontFamily) ? uiFontFamily : "predefinito",
    notify_trips: formData.get("notify_trips") === "on",
    notify_community: formData.get("notify_community") === "on",
    notify_emergencies: formData.get("notify_emergencies") === "on",
  };

  if (companyId === user.id) {
    // account individuale o fondatore: tutto sul proprio profilo, come sempre
    const { error } = await supabase.from("profiles").update({ ...agency, ...personal }).eq("id", user.id);
    if (error) return { error: "Errore durante il salvataggio." };
  } else {
    const { error } = await supabase.from("profiles").update(personal).eq("id", user.id);
    if (error) return { error: "Errore durante il salvataggio." };
    if (team?.isTitolare) {
      const { error: agencyError } = await supabase.from("profiles").update(agency).eq("id", companyId);
      if (agencyError) return { error: "Errore durante il salvataggio dei dati dell'agenzia." };
    }
  }
  // il tipo di attività si salva a parte: funziona dopo la migrazione 0061, prima viene ignorato
  if (team?.isTitolare !== false && ["agenzia", "tour_operator", "dmc"].includes(kindRaw)) {
    await supabase.from("profiles").update({ business_kind: kindRaw }).eq("id", companyId);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { success: true };
}

// Carica il logo dell'agenzia e lo collega al profilo. Restituisce { ok: true }
// oppure { error } con la causa, che la zona di caricamento mostra a schermo.
export async function uploadLogo(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Nessun file selezionato." };
  const fileError = validateImageFile(file) ?? (await verifyFileSignature(file));
  if (fileError) return { error: fileError };

  const { data: current } = await supabase.from("profiles").select("logo_url").eq("id", companyId).maybeSingle();

  const path = `${companyId}/logo-${Date.now()}-${safeStorageName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("public-assets")
    .upload(path, file, { contentType: (await detectFileMime(file)) ?? (file.type || undefined) });
  if (uploadError) {
    console.error("[uploadLogo]", uploadError.message);
    return { error: "Non è stato possibile caricare il logo. Riprova tra poco." };
  }

  const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
  const { error: updateError } = await supabase.from("profiles").update({ logo_url: data.publicUrl }).eq("id", companyId);
  if (updateError) {
    console.error("[uploadLogo] salvataggio:", updateError.message);
    await supabase.storage.from("public-assets").remove([path]);
    return { error: "Il logo è stato caricato ma non è stato possibile salvarlo. Riprova." };
  }

  // Pulizia: il vecchio logo non serve più (solo file della propria cartella).
  const oldPath = current?.logo_url?.split("/public-assets/")[1];
  if (oldPath && oldPath.startsWith(`${companyId}/`) && oldPath !== path) {
    await supabase.storage.from("public-assets").remove([decodeURIComponent(oldPath)]);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Legge le scelte rapide e il testo libero dal modulo, scartando i valori non validi.
function readAiRules(formData: FormData) {
  const preferences: Record<string, string> = {};
  for (const key of Object.keys(PREFERENCE_OPTIONS) as PreferenceKey[]) {
    const value = String(formData.get(`pref_${key}`) ?? "");
    if (PREFERENCE_OPTIONS[key].choices.some((choice) => choice.value === value)) preferences[key] = value;
  }
  const text = String(formData.get("ai_rules") ?? "").trim().slice(0, MAX_AGENCY_RULES_CHARS);
  return { preferences, text };
}

// Salva le regole che l'agenzia ha scritto per l'AI.
export async function saveAiRules(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { preferences, text } = readAiRules(formData);
  // Si uniscono alle altre preferenze già salvate (per esempio se Zefiro è
  // visibile sullo schermo), che non vanno perse.
  const { data: current } = await supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle();
  const merged = { ...((current?.ai_preferences as Record<string, string> | null) ?? {}), ...preferences };
  const { error } = await supabase
    .from("profiles")
    .update({ ai_rules: text || null, ai_preferences: merged })
    .eq("id", companyId);
  if (error) {
    console.error("[saveAiRules]", error.message);
    return { error: "Non è stato possibile salvare le regole. Riprova tra poco." };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// Mostra un esempio scritto dall'AI con le regole attualmente nel modulo
// (anche non salvate), per provarle prima di tenerle.
export async function testAiRules(formData: FormData): Promise<{ sample: string } | { error: string }> {
  const quota = await reserveAiCall("rules_test");
  if (!quota.ok) return { error: quota.error };

  const { preferences, text } = readAiRules(formData);
  const platform = (await loadAiRules()).platform;
  const rulesBlock = formatRulesForPrompt(platform, buildAgencyRulesBlock(preferences, text));
  try {
    const sample = await generateRulesSample(rulesBlock);
    return sample ? { sample } : { error: "Non è stato restituito nessun testo. Riprova." };
  } catch (error) {
    console.error("[testAiRules]", error);
    return { error: "Non è stato possibile preparare l'esempio. Riprova tra poco." };
  }
}

// Mostra o nasconde Zefiro fluttuante sullo schermo.
export async function setAvatarVisible(visible: boolean): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { data: current } = await supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle();
  const merged = { ...((current?.ai_preferences as Record<string, string> | null) ?? {}), avatar: visible ? "on" : "off" };
  const { error } = await supabase.from("profiles").update({ ai_preferences: merged }).eq("id", companyId);
  if (error) {
    console.error("[setAvatarVisible]", error.message);
    return { error: "Non è stato possibile salvare la preferenza. Riprova tra poco." };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Sceglie il costume di Zefiro.
export async function setAvatarStyle(style: string): Promise<{ ok: true } | { error: string }> {
  if (!(ZEFIRO_MODES as string[]).includes(style)) return { error: "Costume non valido." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { data: current } = await supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle();
  const merged = { ...((current?.ai_preferences as Record<string, string> | null) ?? {}), avatar_style: style };
  const { error } = await supabase.from("profiles").update({ ai_preferences: merged }).eq("id", companyId);
  if (error) {
    console.error("[setAvatarStyle]", error.message);
    return { error: "Non è stato possibile salvare il costume. Riprova tra poco." };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function setLogoShape(shape: string): Promise<{ ok: true } | { error: string }> {
  const allowed = ["squadrato", "smussato", "tondo", "personalizzato"];
  if (!allowed.includes(shape)) return { error: "Forma non valida." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { error } = await supabase.from("profiles").update({ logo_shape: shape }).eq("id", companyId);
  if (error) {
    console.error("[setLogoShape]", error.message);
    return {
      error: error.message.includes("logo_shape")
        ? "Manca un aggiornamento del database (migrazione 0034). Eseguilo nell'SQL Editor di Supabase e riprova."
        : "Non è stato possibile salvare la forma del logo. Riprova tra poco.",
    };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function setAiPlan(plan: string): Promise<{ ok: true } | { error: string }> {
  if (!["start", "plus", "pro"].includes(plan)) return { error: "Pacchetto non valido." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { error } = await supabase.from("profiles").update({ ai_plan: plan }).eq("id", companyId);
  if (error) {
    console.error("[setAiPlan]", error.message);
    return {
      error: error.message.includes("ai_plan")
        ? "Manca un aggiornamento del database (migrazione 0035). Eseguilo nell'SQL Editor di Supabase e riprova."
        : "Non è stato possibile salvare il pacchetto. Riprova tra poco.",
    };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// Zefiro risponde ai clienti nell'area clienti? (valore predefinito dell'agenzia)
export async function setClientZefiroDefault(enabled: boolean): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { data: current } = await supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle();
  const merged = { ...((current?.ai_preferences as Record<string, string> | null) ?? {}), client_zefiro: enabled ? "on" : "off" };
  const { error } = await supabase.from("profiles").update({ ai_preferences: merged }).eq("id", companyId);
  if (error) {
    console.error("[setClientZefiroDefault]", error.message);
    return { error: "Non è stato possibile salvare la preferenza. Riprova tra poco." };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// Argomenti su cui Zefiro può rispondere ai clienti, e la "guida dell'agenzia"
// (consigli scritti a mano: ristoranti, cose da fare, contatti utili).
export async function saveClientZefiroConfig(
  topics: string[],
  guide: string,
): Promise<{ ok: true } | { error: string }> {
  const allowed = ["paese", "consigli", "trasporti", "servizi"];
  const chosen = topics.filter((t) => allowed.includes(t));
  const cleanGuide = String(guide ?? "").trim().slice(0, 3000);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { data: current } = await supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle();
  const merged: Record<string, string> = {
    ...((current?.ai_preferences as Record<string, string> | null) ?? {}),
    client_topics: chosen.join(","),
  };
  if (cleanGuide) merged.client_guide = cleanGuide;
  else delete merged.client_guide;

  const { error } = await supabase.from("profiles").update({ ai_preferences: merged }).eq("id", companyId);
  if (error) {
    console.error("[saveClientZefiroConfig]", error.message);
    return { error: "Non è stato possibile salvare. Riprova tra poco." };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// Scheda operativa: pulsante «Importa dai viaggi» (utile ai tour operator, spento per le agenzie)
export async function setOpsImport(enabled: boolean, key: "ops_import" | "ops_auto" = "ops_import"): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { data: current } = await supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle();
  const merged = { ...((current?.ai_preferences as Record<string, string> | null) ?? {}), [key]: enabled ? "on" : "off" };
  const { error } = await supabase.from("profiles").update({ ai_preferences: merged }).eq("id", companyId);
  if (error) {
    console.error("[setOpsImport]", error.message);
    return { error: "Non è stato possibile salvare la preferenza. Riprova tra poco." };
  }
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/operativo");
  return { ok: true };
}

// Messaggi automatici ai clienti (vigilia della partenza, primo giorno, rientro)
export async function setAutoMessages(enabled: boolean): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const companyId = await companyIdOf(user.id);
  // impostazioni dell'agenzia: solo i titolari
  if (!(await getTeamContext())?.isTitolare) return { error: NOT_TITOLARE };

  const { data: current } = await supabase.from("profiles").select("ai_preferences").eq("id", companyId).maybeSingle();
  const merged = { ...((current?.ai_preferences as Record<string, string> | null) ?? {}), auto_messages: enabled ? "on" : "off" };
  const { error } = await supabase.from("profiles").update({ ai_preferences: merged }).eq("id", companyId);
  if (error) {
    console.error("[setAutoMessages]", error.message);
    return { error: "Non è stato possibile salvare la preferenza. Riprova tra poco." };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
