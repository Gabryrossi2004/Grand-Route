import { createClient, getCachedUser } from "@/lib/supabase/server";
import {
  DEFAULT_PLATFORM_RULES,
  buildAgencyRulesBlock,
  formatRulesForPrompt,
  mergePlatformRules,
  type PlatformRule,
} from "@/lib/aiRules";

// Legge le regole da usare per l'utente corrente: quelle di base della
// piattaforma (salvate dall'amministratore, altrimenti le predefinite) e
// quelle della sua agenzia. Se il database non risponde (o le migrazioni
// non sono state eseguite) si usano le regole predefinite: l'AI funziona
// comunque.
export async function loadAiRules(): Promise<{ text: string; platform: Required<PlatformRule>[] }> {
  const user = await getCachedUser();
  let platform = mergePlatformRules(null);
  let agencyBlock = "";

  if (user) {
    try {
      const supabase = await createClient();
      const [rulesResult, profileResult] = await Promise.all([
        supabase.rpc("get_ai_platform_rules"),
        supabase.from("profiles").select("ai_rules, ai_preferences").eq("id", user.id).maybeSingle(),
      ]);

      if (!rulesResult.error && Array.isArray(rulesResult.data)) {
        platform = mergePlatformRules(rulesResult.data as PlatformRule[]);
      }
      if (!profileResult.error && profileResult.data) {
        agencyBlock = buildAgencyRulesBlock(
          profileResult.data.ai_preferences as Record<string, string> | null,
          profileResult.data.ai_rules as string | null,
        );
      }
    } catch (error) {
      console.error("[loadAiRules]", error);
      platform = DEFAULT_PLATFORM_RULES;
    }
  }

  return { text: formatRulesForPrompt(platform, agencyBlock), platform };
}
