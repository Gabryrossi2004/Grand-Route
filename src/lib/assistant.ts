// L'assistente di Grand Route: nome e descrizione in UN solo posto.
// Per cambiargli nome basta modificare ASSISTANT_NAME qui sotto: compare
// ovunque nelle schermate. (Le frasi sono scritte in modo da non dipendere
// dal genere del nome.)
export const ASSISTANT_NAME = "Zefiro";
export const ASSISTANT_TAGLINE = "il tuo assistente di viaggio";

// Zefiro fluttuante sullo schermo: acceso di default, si spegne dalle
// Impostazioni (preferenza salvata nel profilo, in ai_preferences.avatar).
export function isAvatarVisible(preferences: Record<string, string> | null | undefined): boolean {
  return (preferences?.avatar ?? "on") !== "off";
}
